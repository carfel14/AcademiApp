import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { FECHA_FIN_ESTIMADA, fechaISO } from 'src/database/consultas';
import { DatabaseService } from 'src/database/database.service';
import { PagoService } from 'src/pago/pago.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { UpdateInscripcionDto } from './dto/update-inscripcion.dto';

const SELECT_INSCRIPCION = `
  SELECT i.*, e.codigo, e.nombres, e.apellidos,
    g.nombre AS grupo, g.id_plan, p.id_curso, c.nombre AS curso
  FROM INSCRIPCION i
  JOIN ESTUDIANTE e ON e.id_estudiante = i.id_estudiante
  JOIN GRUPO g ON g.id_grupo = i.id_grupo
  JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
  JOIN CURSO c ON c.id_curso = p.id_curso`;

@Injectable()
export class InscripcionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pagoService: PagoService,
  ) {}

  async getInscripciones() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_INSCRIPCION} ORDER BY i.id_inscripcion DESC
    `);
    return result.recordset;
  }

  async getInscripcion(
    id: number,
    request = this.databaseService.getPool().request(),
  ) {
    const result = await request.input('id', sql.Int, id).query(`
      ${SELECT_INSCRIPCION} WHERE i.id_inscripcion = @id
    `);
    if (!result.recordset.length)
      throw new NotFoundException(
        `La inscripción con id ${id} no fue encontrada.`,
      );
    return result.recordset[0];
  }

  async getInscripcionesPorGrupo(idGrupo: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id_grupo', sql.Int, idGrupo).query(`
        ${SELECT_INSCRIPCION} WHERE i.id_grupo = @id_grupo
        ORDER BY e.apellidos, e.nombres
      `);
    return result.recordset;
  }

  /**
   * Crea la inscripción, la obligación de MATRICULA (pagada en efectivo en el
   * mismo acto) y una MENSUALIDAD por cada mes de duración del grupo, todo en
   * una transacción.
   */
  async createInscripcion(inscripcion: CreateInscripcionDto) {
    return this.databaseService.transaction(async (tx) => {
      const estudiante = (
        await tx.request().input('id', sql.Int, inscripcion.id_estudiante)
          .query(`
          SELECT estado FROM ESTUDIANTE WHERE id_estudiante = @id
        `)
      ).recordset[0];
      if (!estudiante)
        throw new NotFoundException(
          `El estudiante con id ${inscripcion.id_estudiante} no fue encontrado.`,
        );
      if (estudiante.estado !== 'ACTIVO')
        throw new BadRequestException(
          'No se puede inscribir un estudiante que no está activo.',
        );

      const grupo = (
        await tx.request().input('id', sql.Int, inscripcion.id_grupo).query(`
          SELECT g.id_grupo, g.nombre, g.estado, g.fecha_inicio, g.duracion_meses,
            ${FECHA_FIN_ESTIMADA('g')} AS fecha_fin_estimada,
            c.id_curso, c.nombre AS curso, c.precio_total, c.precio_matricula,
            CONVERT(VARCHAR(10), CAST(GETDATE() AS DATE), 23) AS hoy
          FROM GRUPO g WITH (UPDLOCK, HOLDLOCK)
          JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
          JOIN CURSO c ON c.id_curso = p.id_curso
          WHERE g.id_grupo = @id
        `)
      ).recordset[0];
      if (!grupo)
        throw new NotFoundException(
          `El grupo con id ${inscripcion.id_grupo} no fue encontrado.`,
        );
      if (grupo.estado !== 'EN_CURSO')
        throw new BadRequestException(
          'No se puede inscribir un estudiante en un grupo que no está en curso.',
        );
      const fechaInicio = fechaISO(grupo.fecha_inicio)!;
      if (grupo.hoy > fechaInicio)
        throw new BadRequestException(
          'No se puede inscribir un estudiante después de la fecha de inicio del grupo.',
        );

      // UQ_INSCRIPCION_id_estudiante_id_grupo: una sola inscripción por grupo,
      // sin importar su estado.
      const existente = (
        await tx
          .request()
          .input('estudiante', sql.Int, inscripcion.id_estudiante)
          .input('grupo', sql.Int, inscripcion.id_grupo).query(`
            SELECT estado FROM INSCRIPCION
            WHERE id_estudiante = @estudiante AND id_grupo = @grupo
          `)
      ).recordset[0];
      if (existente)
        throw new BadRequestException(
          existente.estado === 'ACTIVA'
            ? 'El estudiante ya está inscrito en este grupo.'
            : `El estudiante ya tiene una inscripción ${existente.estado.toLowerCase()} en este grupo.`,
        );

      const precioTotal = Number(grupo.precio_total);
      const precioMatricula = Number(grupo.precio_matricula);
      const meses = Number(grupo.duracion_meses);
      const base = Math.floor((precioTotal / meses) * 100) / 100;
      const diferencia = Math.round((precioTotal - base * meses) * 100) / 100;

      const nueva = (
        await tx
          .request()
          .input('estudiante', sql.Int, inscripcion.id_estudiante)
          .input('grupo', sql.Int, inscripcion.id_grupo)
          .input(
            'observacion',
            sql.NVarChar(500),
            inscripcion.observacion ?? null,
          ).query(`
            INSERT INTO INSCRIPCION (id_estudiante, id_grupo, observacion)
            OUTPUT INSERTED.id_inscripcion
            VALUES (@estudiante, @grupo, @observacion);
          `)
      ).recordset[0];
      const idInscripcion = nueva.id_inscripcion as number;

      // La matrícula vence el día de inicio del grupo.
      const matricula = await this.insertarObligacion(tx, {
        id_inscripcion: idInscripcion,
        tipo: 'MATRICULA',
        numero_cuota: null,
        periodo: null,
        fecha_vencimiento: fechaInicio,
        monto: precioMatricula,
      });
      const pagoMatricula =
        precioMatricula > 0
          ? await this.pagoService.registrarPagoEnTransaccion(
              tx,
              matricula.id_obligacion,
              precioMatricula,
              'EFECTIVO',
              'Pago automático de matrícula al realizar la inscripción.',
            )
          : null;
      if (precioMatricula === 0) {
        await tx.request().input('id', sql.Int, matricula.id_obligacion).query(`
          UPDATE OBLIGACION_PAGO SET estado = 'PAGADA' WHERE id_obligacion = @id
        `);
      }

      // Cuota n vence n meses después del inicio; la última absorbe los centavos.
      const mensualidades: Record<string, unknown>[] = [];
      for (let cuota = 1; cuota <= meses; cuota++) {
        const vencimiento = this.sumarMeses(fechaInicio, cuota);
        mensualidades.push(
          await this.insertarObligacion(tx, {
            id_inscripcion: idInscripcion,
            tipo: 'MENSUALIDAD',
            numero_cuota: cuota,
            periodo: vencimiento.slice(0, 7),
            fecha_vencimiento: vencimiento,
            monto:
              cuota === meses
                ? Math.round((base + diferencia) * 100) / 100
                : base,
          }),
        );
      }

      const matriculaActual = (
        await tx.request().input('id', sql.Int, matricula.id_obligacion).query(`
          SELECT * FROM OBLIGACION_PAGO WHERE id_obligacion = @id
        `)
      ).recordset[0];

      return {
        mensaje:
          'Inscripción creada, matrícula pagada y obligaciones de pago generadas correctamente.',
        inscripcion: await this.getInscripcion(idInscripcion, tx.request()),
        curso: {
          id_curso: grupo.id_curso,
          nombre: grupo.curso,
          precio_total: precioTotal,
          precio_matricula: precioMatricula,
        },
        grupo: {
          id_grupo: grupo.id_grupo,
          nombre: grupo.nombre,
          fecha_inicio: fechaInicio,
          fecha_fin_estimada: fechaISO(grupo.fecha_fin_estimada),
          duracion_meses: meses,
        },
        obligaciones: {
          matricula: matriculaActual,
          mensualidades,
          total: 1 + mensualidades.length,
        },
        pago_matricula: pagoMatricula,
      };
    });
  }

  async updateInscripcion(id: number, inscripcion: UpdateInscripcionDto) {
    const actual = await this.getInscripcion(id);
    if (actual.estado !== 'ACTIVA')
      throw new BadRequestException(
        'No se puede modificar una inscripción que ya fue finalizada o cancelada.',
      );
    await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .input('observacion', sql.NVarChar(500), inscripcion.observacion ?? null)
      .query(
        'UPDATE INSCRIPCION SET observacion = @observacion WHERE id_inscripcion = @id',
      );
    return this.getInscripcion(id);
  }

  /**
   * Cancela la inscripción y anula sus mensualidades pendientes. La matrícula
   * se conserva. No se permite si ya hay pagos de mensualidades.
   */
  async deleteInscripcion(id: number) {
    return this.databaseService.transaction(async (tx) => {
      const actual = (
        await tx.request().input('id', sql.Int, id).query(`
          SELECT estado FROM INSCRIPCION WITH (UPDLOCK, HOLDLOCK) WHERE id_inscripcion = @id
        `)
      ).recordset[0];
      if (!actual)
        throw new NotFoundException(
          `La inscripción con id ${id} no fue encontrada.`,
        );
      if (actual.estado !== 'ACTIVA')
        throw new BadRequestException(
          'La inscripción ya fue finalizada o cancelada.',
        );

      const pagos = await tx.request().input('id', sql.Int, id).query(`
        SELECT COUNT(*) AS total FROM PAGO p
        JOIN OBLIGACION_PAGO o ON o.id_obligacion = p.id_obligacion
        WHERE o.id_inscripcion = @id AND o.tipo = 'MENSUALIDAD'
      `);
      if (pagos.recordset[0].total > 0)
        throw new BadRequestException(
          'No se puede cancelar la inscripción porque existen pagos registrados en una o más mensualidades.',
        );

      await tx.request().input('id', sql.Int, id).query(`
        UPDATE OBLIGACION_PAGO SET estado = 'ANULADA'
        WHERE id_inscripcion = @id AND tipo = 'MENSUALIDAD' AND estado = 'PENDIENTE';

        UPDATE INSCRIPCION SET estado = 'CANCELADA'
        WHERE id_inscripcion = @id AND estado = 'ACTIVA';
      `);
      return {
        mensaje: 'Inscripción cancelada correctamente.',
        inscripcion: await this.getInscripcion(id, tx.request()),
      };
    });
  }

  private async insertarObligacion(
    tx: sql.Transaction,
    o: {
      id_inscripcion: number;
      tipo: 'MATRICULA' | 'MENSUALIDAD';
      numero_cuota: number | null;
      periodo: string | null;
      fecha_vencimiento: string;
      monto: number;
    },
  ) {
    const result = await tx
      .request()
      .input('inscripcion', sql.Int, o.id_inscripcion)
      .input('tipo', sql.VarChar(15), o.tipo)
      .input('cuota', sql.TinyInt, o.numero_cuota)
      .input('periodo', sql.Char(7), o.periodo)
      .input('vencimiento', sql.VarChar(10), o.fecha_vencimiento)
      .input('monto', sql.Decimal(10, 2), o.monto).query(`
        INSERT INTO OBLIGACION_PAGO (id_inscripcion, tipo, numero_cuota, periodo, fecha_vencimiento, monto)
        VALUES (@inscripcion, @tipo, @cuota, @periodo, CONVERT(DATE, @vencimiento, 23), @monto);
        -- La tabla tiene trigger de bitácora: OUTPUT sin INTO no está permitido.
        SELECT * FROM OBLIGACION_PAGO WHERE id_obligacion = SCOPE_IDENTITY();
      `);
    return result.recordset[0];
  }

  /** Suma meses conservando el día; si no existe, usa el último día del mes. */
  private sumarMeses(fecha: string, meses: number) {
    const [year, month, day] = fecha.split('-').map(Number);
    const base = new Date(Date.UTC(year, month - 1 + meses, 1));
    const ultimo = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
    ).getUTCDate();
    base.setUTCDate(Math.min(day, ultimo));
    return base.toISOString().slice(0, 10);
  }
}
