import * as sql from 'mssql';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from 'src/database/database.service';

import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { UpdateEvaluacionDto } from './dto/update-evaluacion.dto';

@Injectable()
export class EvaluacionService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // OBTENER TODAS
  // ============================================================

  async getEvaluaciones(sesion?: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('sesion', sql.Int, sesion ?? null)
      .query(`
      SELECT
        e.*,
        s.id_grupo,
        s.fecha_programada,
        CONVERT(VARCHAR(5), s.hora_inicio, 108) AS hora_inicio,
        CONVERT(VARCHAR(5), s.hora_finalizacion, 108) AS hora_finalizacion,
        s.estado AS estado_sesion,
        g.nombre AS grupo
      FROM EVALUACION e
      INNER JOIN SESION_CLASE s
        ON e.id_sesion = s.id_sesion
      INNER JOIN GRUPO g
        ON s.id_grupo = g.id_grupo
      WHERE @sesion IS NULL OR s.id_sesion = @sesion
      ORDER BY
        s.fecha_programada,
        e.id_evaluacion;
    `);

    return result.recordset;
  }

  // ============================================================
  // OBTENER UNA
  // ============================================================

  async getEvaluacion(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', id).query(`
        SELECT
          e.*,
          s.id_grupo,
          s.fecha_programada,
          CONVERT(VARCHAR(5), s.hora_inicio, 108) AS hora_inicio,
          CONVERT(VARCHAR(5), s.hora_finalizacion, 108) AS hora_finalizacion,
          s.estado AS estado_sesion,
          g.nombre AS grupo
        FROM EVALUACION e
        INNER JOIN SESION_CLASE s
          ON e.id_sesion = s.id_sesion
        INNER JOIN GRUPO g
          ON s.id_grupo = g.id_grupo
        WHERE e.id_evaluacion = @id;
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `La evaluación con id ${id} no fue encontrada.`,
      );
    }

    return result.recordset[0];
  }

  // ============================================================
  // CREAR
  // ============================================================

  async createEvaluacion(evaluacion: CreateEvaluacionDto) {
    return this.databaseService.transaction(async (tx) => {
      const sesion = await tx.request().input('id_sesion', evaluacion.id_sesion)
        .query(`
        SELECT
          s.id_sesion,
          s.id_grupo,
          s.estado AS estado_sesion
        FROM SESION_CLASE s WITH (UPDLOCK, HOLDLOCK)
        WHERE s.id_sesion = @id_sesion;
      `);

      if (sesion.recordset.length === 0) {
        throw new NotFoundException(
          `La sesión con id ${evaluacion.id_sesion} no fue encontrada.`,
        );
      }

      const sesionActual = sesion.recordset[0];

      if (
        sesionActual.estado_sesion === 'CANCELADA' ||
        sesionActual.estado_sesion === 'REALIZADA'
      ) {
        throw new BadRequestException(
          'No se puede crear una evaluación para una sesión cancelada o ya realizada.',
        );
      }

      const result = await tx
        .request()
        .input('id_sesion', evaluacion.id_sesion)
        .input('tipo', evaluacion.tipo)
        .input('descripcion', evaluacion.descripcion ?? null).query(`
        INSERT INTO EVALUACION (
          id_sesion,
          tipo,
          descripcion
        )
        OUTPUT INSERTED.*
        VALUES (
          @id_sesion,
          @tipo,
          @descripcion
        );
      `);

      return result.recordset[0];
    });
  }

  async updateEvaluacion(id: number, evaluacion: UpdateEvaluacionDto) {
    const pool = this.databaseService.getPool();

    const existente = await pool.request().input('id', id).query(`
        SELECT
          e.*,
          s.estado AS estado_sesion
        FROM EVALUACION e
        INNER JOIN SESION_CLASE s
          ON e.id_sesion = s.id_sesion
        WHERE e.id_evaluacion = @id;
      `);

    if (existente.recordset.length === 0) {
      throw new NotFoundException(
        `La evaluación con id ${id} no fue encontrada.`,
      );
    }

    const actual = existente.recordset[0];

    if (
      actual.estado_sesion === 'CANCELADA' ||
      actual.estado_sesion === 'REALIZADA'
    ) {
      throw new BadRequestException(
        'No se puede modificar una evaluación de una sesión cancelada o ya realizada.',
      );
    }

    const tipo = evaluacion.tipo ?? actual.tipo;

    const descripcion =
      evaluacion.descripcion !== undefined
        ? evaluacion.descripcion
        : actual.descripcion;

    const result = await pool
      .request()
      .input('id', id)
      .input('tipo', tipo)
      .input('descripcion', descripcion).query(`
        UPDATE EVALUACION
        SET
          tipo = @tipo,
          descripcion = @descripcion
        WHERE id_evaluacion = @id;

        SELECT *
        FROM EVALUACION
        WHERE id_evaluacion = @id;
      `);

    return result.recordset[0];
  }
}
