import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as sql from 'mssql';

import { ESTADO_CUENTA } from 'src/database/consultas';
import { DatabaseService } from 'src/database/database.service';

import { RegistrarAsistenciasDto } from './dto/registrar-asistencias.dto';

export interface EstudianteSesion {
  id_inscripcion: number;
  id_estudiante: number;
  id_asistencia: number | null;
  nombres: string;
  apellidos: string;
  estado_asistencia: string | null;
  observacion: string | null;
  tiene_mora: boolean;
}

export interface AsistenciaRegistrada {
  id_asistencia: number;
  id_inscripcion: number;
  id_sesion: number;
  estado_asistencia: string;
  observacion: string | null;
}

@Injectable()
export class AsistenciaService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // OBTENER TODAS
  // ============================================================

  async getAsistencias() {
    const pool = this.databaseService.getPool();

    const result = await pool.request().query(`
      SELECT
        a.*,
        i.id_estudiante,
        e.codigo,
        e.nombres,
        e.apellidos,
        s.id_grupo,
        s.fecha_programada,
        CONVERT(VARCHAR(5), s.hora_inicio, 108) AS hora_inicio,
        CONVERT(VARCHAR(5), s.hora_finalizacion, 108) AS hora_finalizacion
      FROM ASISTENCIA a
      INNER JOIN INSCRIPCION i
        ON a.id_inscripcion = i.id_inscripcion
      INNER JOIN ESTUDIANTE e
        ON i.id_estudiante = e.id_estudiante
      INNER JOIN SESION_CLASE s
        ON a.id_sesion = s.id_sesion
      ORDER BY
        s.fecha_programada,
        s.hora_inicio,
        e.apellidos,
        e.nombres;
    `);

    return result.recordset;
  }

  // ============================================================
  // OBTENER UNA
  // ============================================================

  async getAsistencia(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', id).query(`
        SELECT
          a.*,
          i.id_estudiante,
          e.codigo,
          e.nombres,
          e.apellidos,
          s.id_grupo,
          s.fecha_programada,
          CONVERT(VARCHAR(5), s.hora_inicio, 108) AS hora_inicio,
          CONVERT(VARCHAR(5), s.hora_finalizacion, 108) AS hora_finalizacion
        FROM ASISTENCIA a
        INNER JOIN INSCRIPCION i
          ON a.id_inscripcion = i.id_inscripcion
        INNER JOIN ESTUDIANTE e
          ON i.id_estudiante = e.id_estudiante
        INNER JOIN SESION_CLASE s
          ON a.id_sesion = s.id_sesion
        WHERE a.id_asistencia = @id;
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `La asistencia con id ${id} no fue encontrada.`,
      );
    }

    return result.recordset[0];
  }

  async getLista(
    id: number,
    request = this.databaseService.getPool().request(),
    lock = false,
  ): Promise<{
    sesion: { id_sesion: number; estado: string };
    estudiantes: EstudianteSesion[];
  }> {
    const result = await request.input('sesion', id).query(`
      SELECT id_sesion, id_grupo, fecha_programada, estado
      FROM SESION_CLASE ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
      WHERE id_sesion = @sesion;

      SELECT i.id_inscripcion, i.id_estudiante, e.codigo, e.nombres, e.apellidos,
        a.id_asistencia, a.estado_asistencia, a.observacion,
        CAST(CASE WHEN EXISTS (
          SELECT 1 FROM ${ESTADO_CUENTA} o
          WHERE o.id_inscripcion = i.id_inscripcion AND o.estado <> 'ANULADA'
            AND o.fecha_vencimiento < s.fecha_programada
            AND o.saldo_neto + o.pagado > COALESCE((
              SELECT SUM(p.monto_pagado) FROM PAGO p
              WHERE p.id_obligacion = o.id_obligacion
                AND CAST(p.fecha_pago AS DATE) <= s.fecha_programada
            ), 0)
            AND NOT EXISTS (
              SELECT 1 FROM PRORROGA pr WHERE pr.id_obligacion = o.id_obligacion
                AND s.fecha_programada BETWEEN pr.fecha_inicio AND pr.fecha_finalizacion
            )
        ) THEN 1 ELSE 0 END AS bit) AS tiene_mora
      FROM SESION_CLASE s
      JOIN INSCRIPCION i ON i.id_grupo = s.id_grupo
      JOIN ESTUDIANTE e ON e.id_estudiante = i.id_estudiante
      LEFT JOIN ASISTENCIA a ON a.id_sesion = s.id_sesion AND a.id_inscripcion = i.id_inscripcion
      WHERE s.id_sesion = @sesion AND (
        a.id_asistencia IS NOT NULL OR (s.estado = 'PROGRAMADA'
          AND i.estado = 'ACTIVA' AND i.fecha_inscripcion <= s.fecha_programada)
      )
      ORDER BY e.apellidos, e.nombres, i.id_inscripcion;
    `);
    const [sesiones, estudiantes] = result.recordsets as [
      { id_sesion: number; estado: string }[],
      EstudianteSesion[],
    ];
    if (!sesiones.length) throw new NotFoundException('La sesión no existe.');
    return { sesion: sesiones[0], estudiantes };
  }

  async registrarAsistencias(id: number, data: RegistrarAsistenciasDto) {
    return this.databaseService.transaction(async (tx) => {
      const { sesion, estudiantes } = await this.getLista(
        id,
        tx.request(),
        true,
      );
      if (sesion.estado === 'CANCELADA') {
        throw new BadRequestException('La sesión está cancelada.');
      }

      const lista = new Map(
        estudiantes.map((e) => [e.id_inscripcion, e] as const),
      );
      const ids = new Set(data.asistencias.map((a) => a.id_inscripcion));
      if (
        ids.size !== data.asistencias.length ||
        ids.size !== lista.size ||
        [...ids].some((inscripcion) => !lista.has(inscripcion))
      ) {
        throw new BadRequestException(
          'La lista cambió. Recarga y registra una asistencia por cada estudiante.',
        );
      }

      const resultados: AsistenciaRegistrada[] = [];
      const creadas: number[] = [];
      for (const asistencia of data.asistencias) {
        const alumno = lista.get(asistencia.id_inscripcion)!;
        const conservaEstado =
          asistencia.estado_asistencia === alumno.estado_asistencia;
        if (
          !conservaEstado &&
          asistencia.estado_asistencia === 'SUSPENDIDO_POR_MORA' &&
          !alumno.tiene_mora
        ) {
          throw new BadRequestException(
            'La inscripción seleccionada no tiene mora.',
          );
        }
        const estado =
          conservaEstado || !alumno.tiene_mora
            ? asistencia.estado_asistencia
            : 'SUSPENDIDO_POR_MORA';
        const result = await tx
          .request()
          .input('sesion', id)
          .input('inscripcion', asistencia.id_inscripcion)
          .input('estado', estado)
          .input(
            'observacion',
            sql.NVarChar(500),
            asistencia.observacion ?? null,
          )
          .query<AsistenciaRegistrada>(
            `
            IF EXISTS (
              SELECT 1 FROM RESULTADO_EVALUACION r JOIN EVALUACION e ON e.id_evaluacion = r.id_evaluacion
              WHERE e.id_sesion = @sesion AND r.id_inscripcion = @inscripcion
                AND ((@estado = 'PRESENTE' AND r.estado_resultado = 'NO_SE_PRESENTO')
                  OR (@estado <> 'PRESENTE' AND r.estado_resultado = 'CALIFICADO'))
            )
              THROW 50001, 'El cambio es incompatible con los resultados de evaluación registrados.', 1;
            IF EXISTS (SELECT 1 FROM ASISTENCIA WHERE id_sesion = @sesion AND id_inscripcion = @inscripcion)
              UPDATE ASISTENCIA SET estado_asistencia = @estado, observacion = @observacion
                OUTPUT INSERTED.* WHERE id_sesion = @sesion AND id_inscripcion = @inscripcion;
            ELSE
              INSERT INTO ASISTENCIA (id_sesion, id_inscripcion, estado_asistencia, observacion)
                OUTPUT INSERTED.* VALUES (@sesion, @inscripcion, @estado, @observacion);
          `,
          )
          .catch((error) => {
            if (error.number === 50001)
              throw new BadRequestException(error.message);
            throw error;
          });
        const registro = result.recordset[0];
        resultados.push(registro);
        if (!alumno.id_asistencia) creadas.push(registro.id_asistencia);
      }

      return {
        message: 'Asistencias guardadas.',
        id_sesion: id,
        total_registradas: resultados.length,
        asistencias: resultados,
        creadas,
      };
    });
  }
}
