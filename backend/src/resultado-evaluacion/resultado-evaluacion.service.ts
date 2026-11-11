import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as sql from 'mssql';

import { DatabaseService } from 'src/database/database.service';

import { CreateResultadosEvaluacionDto } from './dto/create-resultados-evaluacion.dto';
import { UpdateResultadoEvaluacionDto } from './dto/update-resultado-evaluacion.dto';

@Injectable()
export class ResultadoEvaluacionService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // OBTENER TODOS
  // ============================================================

  async getResultados(sesion?: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('sesion', sql.Int, sesion ?? null)
      .query(`
      SELECT
        r.*,
        e.tipo,
        e.id_sesion,
        i.id_estudiante,
        est.codigo,
        est.nombres,
        est.apellidos
      FROM RESULTADO_EVALUACION r
      INNER JOIN EVALUACION e
        ON r.id_evaluacion = e.id_evaluacion
      INNER JOIN INSCRIPCION i
        ON r.id_inscripcion = i.id_inscripcion
      INNER JOIN ESTUDIANTE est
        ON i.id_estudiante = est.id_estudiante
      WHERE @sesion IS NULL OR e.id_sesion = @sesion
      ORDER BY
        e.id_evaluacion,
        est.apellidos,
        est.nombres;
    `);

    return result.recordset;
  }

  // ============================================================
  // OBTENER UNO
  // ============================================================

  async getResultado(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', id).query(`
        SELECT
          r.*,
          e.tipo,
          e.id_sesion,
          i.id_estudiante,
          est.codigo,
          est.nombres,
          est.apellidos
        FROM RESULTADO_EVALUACION r
        INNER JOIN EVALUACION e
          ON r.id_evaluacion = e.id_evaluacion
        INNER JOIN INSCRIPCION i
          ON r.id_inscripcion = i.id_inscripcion
        INNER JOIN ESTUDIANTE est
          ON i.id_estudiante = est.id_estudiante
        WHERE r.id_resultado = @id;
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `El resultado con id ${id} no fue encontrado.`,
      );
    }

    return result.recordset[0];
  }

  // ============================================================
  // REGISTRAR RESULTADOS DE UNA EVALUACIÓN
  // ============================================================

  async createResultados(
    idEvaluacion: number,
    data: CreateResultadosEvaluacionDto,
  ) {
    return this.databaseService.transaction(async (tx) => {
      const evaluacion = (
        await tx.request().input('id', idEvaluacion).query(`
        SELECT s.id_sesion, s.estado AS estado_sesion FROM EVALUACION e
        JOIN SESION_CLASE s WITH (UPDLOCK, HOLDLOCK) ON s.id_sesion = e.id_sesion
        WHERE e.id_evaluacion = @id
      `)
      ).recordset[0];
      if (!evaluacion) throw new NotFoundException('La evaluación no existe.');
      if (evaluacion.estado_sesion !== 'PROGRAMADA') {
        throw new BadRequestException(
          'La sesión debe estar programada para registrar resultados.',
        );
      }
      const { recordset: asistencia } = await tx
        .request()
        .input('sesion', evaluacion.id_sesion).query(`
        SELECT id_inscripcion, estado_asistencia FROM ASISTENCIA WHERE id_sesion = @sesion
      `);
      if (!asistencia.length)
        throw new BadRequestException(
          'Registra primero la asistencia de la sesión.',
        );
      const presentes = asistencia.filter(
        (a) => a.estado_asistencia === 'PRESENTE',
      );
      const notas = new Map(
        data.resultados.map((r) => [r.id_inscripcion, r.nota] as const),
      );
      if (
        notas.size !== presentes.length ||
        notas.size !== data.resultados.length ||
        presentes.some((a) => !notas.has(a.id_inscripcion))
      ) {
        throw new BadRequestException(
          'Registra una nota para cada estudiante presente.',
        );
      }
      const previos = await tx.request().input('id', idEvaluacion).query(`
        SELECT id_resultado FROM RESULTADO_EVALUACION WHERE id_evaluacion = @id
      `);
      if (previos.recordset.length)
        throw new BadRequestException(
          'Los resultados ya están registrados. Edita las notas existentes.',
        );
      const resultados: { id_resultado: number }[] = [];
      for (const alumno of asistencia) {
        const nota = notas.get(alumno.id_inscripcion) ?? null;
        const { recordset } = await tx
          .request()
          .input('id', idEvaluacion)
          .input('inscripcion', alumno.id_inscripcion)
          .input('nota', sql.Decimal(5, 2), nota)
          .input('estado', nota === null ? 'NO_SE_PRESENTO' : 'CALIFICADO')
          .query(`
            INSERT INTO RESULTADO_EVALUACION (id_evaluacion, id_inscripcion, nota, estado_resultado)
            VALUES (@id, @inscripcion, @nota, @estado);
            SELECT * FROM RESULTADO_EVALUACION WHERE id_resultado = SCOPE_IDENTITY();
          `);
        resultados.push(recordset[0]);
      }
      // La sesión sigue PROGRAMADA para poder agregar más evaluaciones; se
      // cierra con "Finalizar sesión" (PATCH /sesiones/:id/finalizar).
      return {
        mensaje: 'Resultados registrados.',
        id_evaluacion: idEvaluacion,
        cantidad: resultados.length,
        resultados,
      };
    });
  }

  async updateResultado(id: number, data: UpdateResultadoEvaluacionDto) {
    const pool = this.databaseService.getPool();

    // ==========================================================
    // 1. OBTENER RESULTADO + EVALUACIÓN + SESIÓN
    // ==========================================================

    const existente = await pool.request().input('id', id).query(`
        SELECT
          r.id_resultado,
          r.id_evaluacion,
          r.id_inscripcion,
          r.nota,
          r.estado_resultado,
          e.id_sesion,
          s.id_grupo,
          s.estado AS estado_sesion
        FROM RESULTADO_EVALUACION r
        INNER JOIN EVALUACION e
          ON r.id_evaluacion = e.id_evaluacion
        INNER JOIN SESION_CLASE s
          ON e.id_sesion = s.id_sesion
        WHERE r.id_resultado = @id;
      `);

    if (existente.recordset.length === 0) {
      throw new NotFoundException(
        `El resultado con id ${id} no fue encontrado.`,
      );
    }

    const actual = existente.recordset[0];

    // ==========================================================
    // 2. VALIDAR ESTADO DE LA SESIÓN
    // ==========================================================

    if (actual.estado_sesion === 'CANCELADA') {
      throw new BadRequestException(
        'No se puede modificar un resultado perteneciente a una sesión cancelada.',
      );
    }

    // ==========================================================
    // 3. VERIFICAR INSCRIPCIÓN
    // ==========================================================

    const inscripcion = await pool
      .request()
      .input('id_inscripcion', actual.id_inscripcion).query(`
        SELECT
          id_inscripcion,
          estado
        FROM INSCRIPCION
        WHERE id_inscripcion = @id_inscripcion;
      `);

    if (inscripcion.recordset.length === 0) {
      throw new NotFoundException(
        `La inscripción ${actual.id_inscripcion} no fue encontrada.`,
      );
    }

    if (inscripcion.recordset[0].estado === 'CANCELADA') {
      throw new BadRequestException(
        'No se puede modificar un resultado de una inscripción cancelada.',
      );
    }

    // ==========================================================
    // 4. OBTENER ASISTENCIA
    // ==========================================================

    const asistencia = await pool
      .request()
      .input('id_inscripcion', actual.id_inscripcion)
      .input('id_sesion', actual.id_sesion).query(`
        SELECT
          id_asistencia,
          estado_asistencia
        FROM ASISTENCIA
        WHERE id_inscripcion = @id_inscripcion
          AND id_sesion = @id_sesion;
      `);

    if (asistencia.recordset.length === 0) {
      throw new BadRequestException(
        'La inscripción no tiene asistencia registrada para esta sesión.',
      );
    }

    const estadoAsistencia = asistencia.recordset[0].estado_asistencia;

    // ==========================================================
    // 5. LA ASISTENCIA MANDA
    // ==========================================================

    let nota: number | null;
    let estadoResultado: 'CALIFICADO' | 'NO_SE_PRESENTO';

    if (estadoAsistencia === 'PRESENTE') {
      estadoResultado = 'CALIFICADO';

      nota = data.nota !== undefined ? data.nota : actual.nota;

      if (nota === null || nota === undefined) {
        throw new BadRequestException(
          'Un estudiante con asistencia PRESENTE debe tener una nota.',
        );
      }

      if (nota < 0 || nota > 100) {
        throw new BadRequestException('La nota debe estar entre 0 y 100.');
      }
    } else if (
      estadoAsistencia === 'AUSENTE' ||
      estadoAsistencia === 'JUSTIFICADA' ||
      estadoAsistencia === 'SUSPENDIDO_POR_MORA'
    ) {
      estadoResultado = 'NO_SE_PRESENTO';
      nota = null;
    } else {
      throw new BadRequestException('El estado de asistencia no es válido.');
    }

    // ==========================================================
    // 6. ACTUALIZAR
    // ==========================================================

    const result = await pool
      .request()
      .input('id', id)
      .input('nota', sql.Decimal(5, 2), nota)
      .input('estado_resultado', estadoResultado).query(`
        UPDATE RESULTADO_EVALUACION
        SET
          nota = @nota,
          estado_resultado = @estado_resultado
        WHERE id_resultado = @id;

        SELECT
          r.*,
          e.tipo,
          e.id_sesion,
          i.id_estudiante,
          est.codigo,
          est.nombres,
          est.apellidos
        FROM RESULTADO_EVALUACION r
        INNER JOIN EVALUACION e
          ON r.id_evaluacion = e.id_evaluacion
        INNER JOIN INSCRIPCION i
          ON r.id_inscripcion = i.id_inscripcion
        INNER JOIN ESTUDIANTE est
          ON i.id_estudiante = est.id_estudiante
        WHERE r.id_resultado = @id;
      `);

    return result.recordset[0];
  }
}
