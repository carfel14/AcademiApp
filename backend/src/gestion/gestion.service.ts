import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { ESTADO_CUENTA } from '../database/consultas';
import { DatabaseService } from '../database/database.service';
import { catalogos, validar } from './catalogos';

@Injectable()
export class GestionService {
  constructor(private readonly db: DatabaseService) {}

  async catalogo(nombre: string, parent?: number) {
    const config = this.config(nombre);
    const request = this.db.getPool().request();
    const where =
      config.parent && parent !== undefined
        ? `WHERE ${config.parent} = @parent`
        : '';
    if (where) request.input('parent', sql.Int, parent);
    return (
      await request.query(`
      SELECT * FROM dbo.${config.table} ${where}
      ORDER BY ${config.sort ? `${config.sort}, ` : ''}${config.key}
    `)
    ).recordset;
  }

  async guardar(nombre: string, data: Record<string, unknown>, id?: number) {
    const config = this.config(nombre);
    if (!data || Array.isArray(data) || typeof data !== 'object')
      throw new BadRequestException('Datos inválidos.');
    if (
      nombre === 'descuentos' &&
      data.tipo === 'PORCENTAJE' &&
      Number(data.valor) > 100
    ) {
      throw new BadRequestException('El porcentaje debe ser de 0,01 a 100.');
    }
    const request = this.db.getPool().request();
    for (const field of config.fields) {
      const value = validar(field, data[field.name]);
      const type =
        field.type === 'text'
          ? sql.NVarChar(sql.MAX)
          : field.integer
            ? sql.Int
            : sql.Decimal(10, 2);
      request.input(field.name, type, value);
    }
    const fields = config.fields.map((field) => field.name);
    const statement =
      id === undefined
        ? `INSERT INTO dbo.${config.table} (${fields.join(', ')}) OUTPUT INSERTED.*
        VALUES (${fields.map((field) => '@' + field).join(', ')})`
        : `UPDATE dbo.${config.table} SET ${fields.map((field) => field + ' = @' + field).join(', ')}
        OUTPUT INSERTED.* WHERE ${config.key} = @id`;
    const { recordset } = await request
      .input('id', sql.Int, id ?? null)
      .query(statement)
      .catch((error) => {
        if ([2601, 2627].includes(error.number))
          throw new ConflictException(this.duplicado(String(error.message)));
        if (error.number === 547)
          throw new BadRequestException(
            'Revisa la relación y los valores seleccionados.',
          );
        throw error;
      });
    if (!recordset.length)
      throw new NotFoundException('El registro no existe.');
    return recordset[0];
  }

  /** Mensaje según la restricción UNIQUE del script que se violó. */
  private duplicado(mensaje: string) {
    const reglas: [string, string][] = [
      ['UQ_PLAN_ESTUDIO_id_curso_version', 'Este curso ya tiene un plan con esa versión.'],
      ['UQ_UNIDAD_ESTUDIO_id_plan_orden', 'Ya hay una unidad con ese orden en el plan.'],
      ['UQ_TEMA_ESTUDIO_id_unidad_orden', 'Ya hay un tema con ese orden en la unidad.'],
      ['UQ_PLANTILLA_NOTIFICACION_nombre', 'Ya existe una plantilla con ese nombre.'],
      ['UQ_REGLA_RECORDATORIO', 'Esa plantilla ya tiene una regla con esos días.'],
    ];
    return reglas.find(([nombre]) => mensaje.includes(nombre))?.[1] ?? 'Ya existe un registro con esos datos.';
  }

  /** Elimina un plan, unidad o tema si nada depende de él. */
  async eliminar(nombre: string, id: number) {
    if (!['planes', 'unidades', 'temas'].includes(nombre))
      throw new NotFoundException('Este catálogo no admite eliminación.');
    const config = this.config(nombre);
    const uso: Record<string, string> = {
      planes: `SELECT
        (SELECT COUNT(*) FROM GRUPO WHERE id_plan = @id) AS grupos,
        (SELECT COUNT(*) FROM UNIDAD_ESTUDIO WHERE id_plan = @id) AS unidades`,
      unidades: 'SELECT (SELECT COUNT(*) FROM TEMA_ESTUDIO WHERE id_unidad = @id) AS temas',
      temas: 'SELECT (SELECT COUNT(*) FROM PROGRAMACION_CONTENIDO WHERE id_tema = @id) AS sesiones',
    };
    const pool = this.db.getPool();
    const [conteo] = (await pool.request().input('id', sql.Int, id).query(uso[nombre])).recordset;
    const etiquetas: Record<string, [string, string]> = {
      grupos: ['grupo', 'grupos'],
      unidades: ['unidad', 'unidades'],
      temas: ['tema', 'temas'],
      sesiones: ['sesión con este tema programado', 'sesiones con este tema programado'],
    };
    const enUso = Object.entries(conteo as Record<string, number>)
      .filter(([, n]) => n > 0)
      .map(([que, n]) => `${n} ${etiquetas[que][n === 1 ? 0 : 1]}`);
    if (enUso.length)
      throw new BadRequestException(`No se puede eliminar: tiene ${enUso.join(' y ')}.`);
    const result = await pool.request().input('id', sql.Int, id)
      .query(`DELETE FROM dbo.${config.table} WHERE ${config.key} = @id`);
    if (!result.rowsAffected[0]) throw new NotFoundException('El registro no existe.');
    return { mensaje: 'Registro eliminado.', [config.key]: id };
  }

  async cuenta(id: number) {
    const result = await this.db.getPool().request().input('id', sql.Int, id)
      .query(`
      SELECT * FROM ${ESTADO_CUENTA} o WHERE o.id_obligacion = @id;
      SELECT p.* FROM PAGO p WHERE p.id_obligacion = @id ORDER BY p.fecha_pago DESC, p.id_pago DESC;
      SELECT * FROM PRORROGA WHERE id_obligacion = @id ORDER BY fecha_inicio, id_prorroga;
      SELECT d.nombre, od.*,
        CAST(CASE WHEN od.tipo_aplicado = 'PORCENTAJE' THEN ROUND(o.monto * od.valor_aplicado / 100, 2)
          ELSE od.valor_aplicado END AS DECIMAL(12,2)) AS monto_descontado
      FROM OBLIGACION_DESCUENTO od
      JOIN DESCUENTO d ON d.id_descuento = od.id_descuento
      JOIN OBLIGACION_PAGO o ON o.id_obligacion = od.id_obligacion
      WHERE od.id_obligacion = @id;
      SELECT * FROM RECARGO WHERE id_obligacion = @id ORDER BY id_recargo DESC;
    `);
    const [obligaciones, pagos, prorrogas, descuentos, recargos] =
      result.recordsets as sql.IRecordSet<unknown>[];
    if (!obligaciones.length)
      throw new NotFoundException('La obligación no existe.');
    return {
      obligacion: obligaciones[0],
      pagos,
      prorrogas,
      descuentos,
      recargos,
    };
  }

  async ajuste(
    id: number,
    data: {
      id_descuento?: number;
      observacion?: string;
      monto?: number;
      motivo?: string;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const { recordset } = await tx.request().input('id', sql.Int, id).query(`
        SELECT estado FROM OBLIGACION_PAGO WITH (UPDLOCK, HOLDLOCK) WHERE id_obligacion = @id
      `);
      if (!recordset.length)
        throw new NotFoundException('La obligación no existe.');
      if (recordset[0].estado !== 'PENDIENTE')
        throw new BadRequestException(
          'Solo puedes ajustar una obligación pendiente.',
        );
      let registro: unknown;
      if (data.id_descuento) {
        // Se guarda una copia del tipo y valor vigentes del descuento.
        const result = await tx
          .request()
          .input('id', sql.Int, id)
          .input('descuento', sql.Int, data.id_descuento)
          .input('observacion', sql.NVarChar(500), data.observacion ?? null)
          .query(
            `
          INSERT INTO OBLIGACION_DESCUENTO (id_obligacion, id_descuento, tipo_aplicado, valor_aplicado, observacion)
          OUTPUT INSERTED.*
          SELECT @id, id_descuento, tipo, valor, @observacion FROM DESCUENTO
          WHERE id_descuento = @descuento AND estado = 'ACTIVO'
        `,
          )
          .catch((error) => {
            if ([2601, 2627].includes(error.number))
              throw new ConflictException('Ese descuento ya está aplicado.');
            throw error;
          });
        if (!result.recordset.length)
          throw new BadRequestException('Selecciona un descuento activo.');
        registro = result.recordset[0];
      } else {
        // RECARGO tiene trigger de bitácora: sin OUTPUT.
        const result = await tx
          .request()
          .input('id', sql.Int, id)
          .input('monto', sql.Decimal(10, 2), data.monto)
          .input('motivo', sql.NVarChar(200), data.motivo).query(`
            INSERT INTO RECARGO (id_obligacion, monto, motivo) VALUES (@id, @monto, @motivo);
            SELECT * FROM RECARGO WHERE id_recargo = SCOPE_IDENTITY();
          `);
        registro = result.recordset[0];
      }
      const saldo = Number(
        (
          await tx.request().input('id', sql.Int, id).query(`
            SELECT saldo_neto FROM ${ESTADO_CUENTA} o WHERE o.id_obligacion = @id
          `)
        ).recordset[0].saldo_neto,
      );
      if (saldo < 0)
        throw new BadRequestException(
          'El descuento supera el saldo pendiente.',
        );
      if (saldo === 0) {
        await tx
          .request()
          .input('id', sql.Int, id)
          .query(
            "UPDATE OBLIGACION_PAGO SET estado = 'PAGADA' WHERE id_obligacion = @id",
          );
      }
      return { id_obligacion: id, saldo_neto: saldo, registro };
    });
  }

  async notificaciones() {
    return (
      await this.db.getPool().request().query(`
      SELECT TOP (500) n.*, o.id_inscripcion, p.nombre AS plantilla, p.canal,
        CONCAT(e.nombres, ' ', e.apellidos) AS estudiante
      FROM NOTIFICACION n
      JOIN PLANTILLA_NOTIFICACION p ON p.id_plantilla = n.id_plantilla
      JOIN ESTUDIANTE e ON e.id_estudiante = n.id_estudiante
      LEFT JOIN OBLIGACION_PAGO o ON o.id_obligacion = n.id_obligacion
      ORDER BY n.id_notificacion DESC
    `)
    ).recordset;
  }

  /** Cola de envío del script (vw_notificaciones_pendientes). */
  async pendientes() {
    return (
      await this.db.getPool().request().query(`
        SELECT * FROM vw_notificaciones_pendientes ORDER BY fecha_programada, id_notificacion
      `)
    ).recordset;
  }

  /** Ejecuta sp_generar_recordatorios tal como lo define el script. */
  async generarRecordatorios(fecha: string) {
    const result = await this.db
      .getPool()
      .request()
      .input('fecha', sql.VarChar(10), fecha).query(`
        DECLARE @dia DATE = CONVERT(DATE, @fecha, 23);
        EXEC sp_generar_recordatorios @fecha = @dia;
      `);
    return { total: result.recordset[0].notificaciones_generadas };
  }

  /** Ejecuta sp_marcar_notificacion después de intentar el envío. */
  async marcarNotificacion(id: number, exito: boolean, error?: string) {
    const existe = await this.db
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(
        'SELECT estado_envio FROM NOTIFICACION WHERE id_notificacion = @id',
      );
    if (!existe.recordset.length)
      throw new NotFoundException('El recordatorio no existe.');
    if (existe.recordset[0].estado_envio !== 'PENDIENTE')
      throw new BadRequestException('El recordatorio ya no está pendiente.');
    await this.db
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .input('exito', sql.Bit, exito)
      .input('error', sql.NVarChar(500), error ?? null)
      .query(
        'EXEC sp_marcar_notificacion @id_notificacion = @id, @exito = @exito, @error = @error',
      );
    return (
      await this.db
        .getPool()
        .request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM NOTIFICACION WHERE id_notificacion = @id')
    ).recordset[0];
  }

  async cancelarNotificacion(id: number) {
    const result = await this.db.getPool().request().input('id', sql.Int, id)
      .query(`
      UPDATE NOTIFICACION SET estado_envio = 'CANCELADO' OUTPUT INSERTED.id_notificacion
      WHERE id_notificacion = @id AND estado_envio = 'PENDIENTE'
    `);
    if (!result.recordset.length)
      throw new BadRequestException('El recordatorio ya no está pendiente.');
    return result.recordset[0];
  }

  async bitacora() {
    return (
      await this.db.getPool().request().query(`
      SELECT TOP (500) b.*, u.usuario FROM BITACORA b
      LEFT JOIN USUARIO u ON u.id_usuario = b.id_usuario ORDER BY b.id_bitacora DESC
    `)
    ).recordset;
  }

  async reportes(curso?: number) {
    const { recordsets } = await this.db
      .getPool()
      .request()
      .input('curso', sql.Int, curso ?? null).query(`
      SELECT c.id_curso, c.nombre AS curso, COUNT(DISTINCT i.id_estudiante) AS estudiantes,
        COUNT(i.id_inscripcion) AS inscripciones, COALESCE(SUM(p.total), 0) AS ingresos
      FROM CURSO c
      LEFT JOIN PLAN_ESTUDIO pl ON pl.id_curso = c.id_curso
      LEFT JOIN GRUPO g ON g.id_plan = pl.id_plan
      LEFT JOIN INSCRIPCION i ON i.id_grupo = g.id_grupo
      OUTER APPLY (SELECT SUM(pa.monto_pagado) AS total FROM PAGO pa
        JOIN OBLIGACION_PAGO o ON o.id_obligacion = pa.id_obligacion WHERE o.id_inscripcion = i.id_inscripcion) p
      WHERE @curso IS NULL OR c.id_curso = @curso
      GROUP BY c.id_curso, c.nombre ORDER BY c.nombre;

      SELECT i.id_inscripcion, e.codigo, CONCAT(e.nombres, ' ', e.apellidos) AS estudiante,
        c.nombre AS curso, g.nombre AS grupo, i.estado,
        COALESCE(a.presentes, 0) AS presentes, a.total AS asistencias, n.promedio
      FROM INSCRIPCION i
      JOIN ESTUDIANTE e ON e.id_estudiante = i.id_estudiante
      JOIN GRUPO g ON g.id_grupo = i.id_grupo
      JOIN PLAN_ESTUDIO pl ON pl.id_plan = g.id_plan
      JOIN CURSO c ON c.id_curso = pl.id_curso
      OUTER APPLY (SELECT COUNT(*) AS total, SUM(CASE WHEN estado_asistencia = 'PRESENTE' THEN 1 ELSE 0 END) AS presentes
        FROM ASISTENCIA WHERE id_inscripcion = i.id_inscripcion) a
      OUTER APPLY (SELECT CAST(AVG(nota) AS DECIMAL(5,2)) AS promedio
        FROM RESULTADO_EVALUACION WHERE id_inscripcion = i.id_inscripcion) n
      WHERE @curso IS NULL OR c.id_curso = @curso ORDER BY e.apellidos, e.nombres;

      SELECT o.id_obligacion, o.estudiante, c.nombre AS curso, o.grupo,
        o.tipo, o.fecha_vencimiento_efectiva, o.dias_mora, o.saldo_neto
      FROM ${ESTADO_CUENTA} o
      JOIN INSCRIPCION i ON i.id_inscripcion = o.id_inscripcion
      JOIN GRUPO g ON g.id_grupo = i.id_grupo
      JOIN PLAN_ESTUDIO pl ON pl.id_plan = g.id_plan
      JOIN CURSO c ON c.id_curso = pl.id_curso
      WHERE o.estado = 'PENDIENTE' AND o.saldo_neto > 0 AND o.dias_mora > 0
        AND (@curso IS NULL OR c.id_curso = @curso)
      ORDER BY o.fecha_vencimiento_efectiva;

      SELECT p.id_pago, p.fecha_pago, CONCAT(e.nombres, ' ', e.apellidos) AS estudiante,
        c.nombre AS curso, p.metodo_pago, p.monto_pagado
      FROM PAGO p
      JOIN OBLIGACION_PAGO o ON o.id_obligacion = p.id_obligacion
      JOIN INSCRIPCION i ON i.id_inscripcion = o.id_inscripcion
      JOIN ESTUDIANTE e ON e.id_estudiante = i.id_estudiante
      JOIN GRUPO g ON g.id_grupo = i.id_grupo
      JOIN PLAN_ESTUDIO pl ON pl.id_plan = g.id_plan
      JOIN CURSO c ON c.id_curso = pl.id_curso
      WHERE @curso IS NULL OR c.id_curso = @curso
      ORDER BY p.fecha_pago DESC, p.id_pago DESC;
    `);
    const [cursos, estudiantes, vencidas, pagos] =
      recordsets as sql.IRecordSet<unknown>[];
    return { cursos, estudiantes, vencidas, pagos };
  }

  private config(name: string) {
    if (!Object.hasOwn(catalogos, name))
      throw new NotFoundException('El catálogo no existe.');
    return catalogos[name];
  }
}
