import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
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
    if (where) request.input('parent', parent);
    return (
      await request.query(`
      SELECT * FROM dbo.${config.table} ${where} ORDER BY ${config.sort ?? config.key}, ${config.key}
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
          throw new ConflictException('Ya existe un registro con esos datos.');
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

  async cuenta(id: number) {
    const result = await this.db.getPool().request().input('id', id).query(`
      SELECT * FROM vw_estado_cuenta WHERE id_obligacion = @id;
      SELECT p.* FROM pago p WHERE p.id_obligacion = @id ORDER BY p.fecha_pago DESC, p.id_pago DESC;
      SELECT * FROM prorroga WHERE id_obligacion = @id;
      SELECT d.nombre, od.* FROM obligacion_descuento od JOIN descuento d ON d.id_descuento = od.id_descuento
        WHERE od.id_obligacion = @id;
      SELECT * FROM recargo WHERE id_obligacion = @id ORDER BY id_recargo DESC;
    `);
    const [obligaciones, pagos, prorrogas, descuentos, recargos] =
      result.recordsets as sql.IRecordSet<unknown>[];
    if (!obligaciones.length)
      throw new NotFoundException('La obligación no existe.');
    return {
      obligacion: obligaciones[0],
      pagos,
      prorroga: prorrogas[0] ?? null,
      descuentos,
      recargos,
    };
  }

  async ajuste(
    id: number,
    data: { id_descuento?: number; monto?: number; motivo?: string },
  ) {
    return this.db.transaction(async (tx) => {
      const { recordset } = await tx.request().input('id', id).query(`
        SELECT estado FROM obligacion_pago WITH (UPDLOCK, HOLDLOCK) WHERE id_obligacion = @id
      `);
      if (!recordset.length)
        throw new NotFoundException('La obligación no existe.');
      if (recordset[0].estado !== 'PENDIENTE')
        throw new BadRequestException(
          'Solo puedes ajustar una obligación pendiente.',
        );
      if (data.id_descuento) {
        const result = await tx
          .request()
          .input('id', id)
          .input('descuento', data.id_descuento)
          .query(
            `
          INSERT INTO obligacion_descuento (id_obligacion, id_descuento, tipo_aplicado, valor_aplicado)
          OUTPUT INSERTED.*
          SELECT @id, id_descuento, tipo, valor FROM descuento WHERE id_descuento = @descuento AND estado = 'ACTIVO'
        `,
          )
          .catch((error) => {
            if ([2601, 2627].includes(error.number))
              throw new ConflictException('Ese descuento ya está aplicado.');
            throw error;
          });
        if (!result.recordset.length)
          throw new BadRequestException('Selecciona un descuento activo.');
      } else {
        await tx
          .request()
          .input('id', id)
          .input('monto', sql.Decimal(10, 2), data.monto)
          .input('motivo', data.motivo).query(`
            INSERT INTO recargo (id_obligacion, monto, motivo) VALUES (@id, @monto, @motivo)
          `);
      }
      const saldo = (
        await tx.request().input('id', id).query(`
        SELECT saldo_pendiente FROM vw_estado_cuenta WHERE id_obligacion = @id
      `)
      ).recordset[0].saldo_pendiente;
      if (saldo < 0)
        throw new BadRequestException(
          'El descuento supera el saldo pendiente.',
        );
      if (saldo === 0) {
        await tx
          .request()
          .input('id', id)
          .query(
            "UPDATE obligacion_pago SET estado = 'PAGADA' WHERE id_obligacion = @id",
          );
      }
      return { id_obligacion: id, saldo_pendiente: saldo };
    });
  }

  async notificaciones() {
    return (
      await this.db.getPool().request().query(`
      SELECT TOP (500) n.*, o.id_inscripcion, p.nombre AS plantilla, p.canal, CONCAT(e.nombres, ' ', e.apellidos) AS estudiante
      FROM notificacion n JOIN plantilla_notificacion p ON p.id_plantilla = n.id_plantilla
      JOIN estudiante e ON e.id_estudiante = n.id_estudiante
      LEFT JOIN obligacion_pago o ON o.id_obligacion = n.id_obligacion ORDER BY n.id_notificacion DESC
    `)
    ).recordset;
  }

  async generarRecordatorios(fecha: string) {
    return this.db.transaction(async (tx) => {
      const result = await tx.request().input('fecha', sql.VarChar(10), fecha)
        .query(`
        DECLARE @dia date = CONVERT(date, @fecha, 23);
        INSERT INTO notificacion (id_obligacion, id_plantilla, id_estudiante, destino, fecha_programada)
        SELECT DISTINCT o.id_obligacion, p.id_plantilla, e.id_estudiante,
          CASE WHEN p.canal = 'EMAIL' THEN TRIM(e.email) ELSE TRIM(e.telefono) END, @dia
        FROM vw_estado_cuenta o JOIN inscripcion i ON i.id_inscripcion = o.id_inscripcion
        JOIN estudiante e ON e.id_estudiante = i.id_estudiante
        JOIN regla_recordatorio r ON DATEADD(day, r.dias_respecto_vencimiento, o.vencimiento_efectivo) = @dia
        JOIN plantilla_notificacion p ON p.id_plantilla = r.id_plantilla
        WHERE o.estado = 'PENDIENTE' AND o.saldo_pendiente > 0 AND r.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
          AND i.estado_inscripcion <> 'CANCELADA'
          AND NULLIF(CASE WHEN p.canal = 'EMAIL' THEN TRIM(e.email) ELSE TRIM(e.telefono) END, '') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM notificacion n WITH (UPDLOCK, HOLDLOCK)
            WHERE n.id_obligacion = o.id_obligacion AND n.id_plantilla = p.id_plantilla AND n.fecha_programada = @dia);
        SELECT @@ROWCOUNT AS total;
      `);
      return { total: result.recordset[0].total };
    });
  }

  async cancelarNotificacion(id: number) {
    const result = await this.db.getPool().request().input('id', id).query(`
      UPDATE notificacion SET estado_envio = 'CANCELADO' OUTPUT INSERTED.id_notificacion
      WHERE id_notificacion = @id AND estado_envio = 'PENDIENTE'
    `);
    if (!result.recordset.length)
      throw new BadRequestException('El recordatorio ya no está pendiente.');
    return result.recordset[0];
  }

  async bitacora() {
    return (
      await this.db.getPool().request().query(`
      SELECT TOP (500) b.*, u.username FROM bitacora b
      LEFT JOIN usuario u ON u.id_usuario = b.id_usuario ORDER BY b.id_bitacora DESC
    `)
    ).recordset;
  }

  async reportes(curso?: number) {
    const { recordsets } = await this.db
      .getPool()
      .request()
      .input('curso', sql.Int, curso ?? null).query(`
      SELECT c.id_curso, c.nombre_curso, COUNT(DISTINCT i.id_estudiante) AS estudiantes,
        COUNT(i.id_inscripcion) AS inscripciones, COALESCE(SUM(p.total), 0) AS ingresos
      FROM curso c LEFT JOIN grupo g ON g.id_curso = c.id_curso LEFT JOIN inscripcion i ON i.id_grupo = g.id_grupo
      OUTER APPLY (SELECT SUM(pa.monto_pagado) AS total FROM pago pa
        JOIN obligacion_pago o ON o.id_obligacion = pa.id_obligacion WHERE o.id_inscripcion = i.id_inscripcion) p
      WHERE @curso IS NULL OR c.id_curso = @curso GROUP BY c.id_curso, c.nombre_curso ORDER BY c.nombre_curso;

      SELECT i.id_inscripcion, e.codigo_estudiante, CONCAT(e.nombres, ' ', e.apellidos) AS estudiante,
        c.nombre_curso, g.nombre_grupo, i.estado_inscripcion,
        COALESCE(a.presentes, 0) AS presentes, a.total AS asistencias, n.promedio
      FROM inscripcion i JOIN estudiante e ON e.id_estudiante = i.id_estudiante
      JOIN grupo g ON g.id_grupo = i.id_grupo JOIN curso c ON c.id_curso = g.id_curso
      OUTER APPLY (SELECT COUNT(*) AS total, SUM(CASE WHEN estado_asistencia = 'PRESENTE' THEN 1 ELSE 0 END) AS presentes
        FROM asistencia WHERE id_inscripcion = i.id_inscripcion) a
      OUTER APPLY (SELECT CAST(AVG(nota) AS DECIMAL(5,2)) AS promedio
        FROM resultado_evaluacion WHERE id_inscripcion = i.id_inscripcion) n
      WHERE @curso IS NULL OR c.id_curso = @curso ORDER BY e.apellidos, e.nombres;

      SELECT o.id_obligacion, CONCAT(e.nombres, ' ', e.apellidos) AS estudiante, c.nombre_curso,
        o.tipo_obligacion, o.vencimiento_efectivo, o.saldo_pendiente
      FROM vw_estado_cuenta o JOIN inscripcion i ON i.id_inscripcion = o.id_inscripcion
      JOIN estudiante e ON e.id_estudiante = i.id_estudiante JOIN grupo g ON g.id_grupo = i.id_grupo
      JOIN curso c ON c.id_curso = g.id_curso
      WHERE o.estado = 'PENDIENTE' AND o.saldo_pendiente > 0 AND o.vencimiento_efectivo < CAST(GETDATE() AS date)
        AND (@curso IS NULL OR c.id_curso = @curso) ORDER BY o.vencimiento_efectivo;

      SELECT p.id_pago, p.fecha_pago, CONCAT(e.nombres, ' ', e.apellidos) AS estudiante, c.nombre_curso,
        p.metodo_pago, p.monto_pagado
      FROM pago p JOIN obligacion_pago o ON o.id_obligacion = p.id_obligacion
      JOIN inscripcion i ON i.id_inscripcion = o.id_inscripcion JOIN estudiante e ON e.id_estudiante = i.id_estudiante
      JOIN grupo g ON g.id_grupo = i.id_grupo JOIN curso c ON c.id_curso = g.id_curso
      WHERE @curso IS NULL OR c.id_curso = @curso ORDER BY p.fecha_pago DESC, p.id_pago DESC;
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
