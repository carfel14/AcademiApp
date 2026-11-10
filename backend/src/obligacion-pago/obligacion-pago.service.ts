import { Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { ESTADO_CUENTA } from 'src/database/consultas';
import { DatabaseService } from 'src/database/database.service';

/**
 * Columnas de OBLIGACION_PAGO y de vw_estado_cuenta (recargos, pagado, saldo,
 * fecha_vencimiento_efectiva, dias_mora), más `descuentos` y `saldo_neto`.
 */
const SELECT_OBLIGACION = `
  SELECT o.*, i.id_grupo, p.id_curso, c.nombre AS curso
  FROM ${ESTADO_CUENTA} o
  JOIN INSCRIPCION i ON i.id_inscripcion = o.id_inscripcion
  JOIN GRUPO g ON g.id_grupo = i.id_grupo
  JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
  JOIN CURSO c ON c.id_curso = p.id_curso`;

@Injectable()
export class ObligacionPagoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getObligaciones() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_OBLIGACION} ORDER BY o.fecha_vencimiento, o.id_obligacion
    `);
    return result.recordset;
  }

  async getObligacion(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(`${SELECT_OBLIGACION} WHERE o.id_obligacion = @id`);
    if (!result.recordset.length)
      throw new NotFoundException(
        `La obligación de pago con id ${id} no fue encontrada.`,
      );
    return result.recordset[0];
  }

  async getObligacionesPorInscripcion(idInscripcion: number) {
    const pool = this.databaseService.getPool();
    const inscripcion = await pool
      .request()
      .input('id', sql.Int, idInscripcion)
      .query(
        'SELECT id_inscripcion FROM INSCRIPCION WHERE id_inscripcion = @id',
      );
    if (!inscripcion.recordset.length)
      throw new NotFoundException(
        `La inscripción con id ${idInscripcion} no fue encontrada.`,
      );
    const result = await pool.request().input('id', sql.Int, idInscripcion)
      .query(`
      ${SELECT_OBLIGACION} WHERE o.id_inscripcion = @id
      ORDER BY CASE WHEN o.tipo = 'MATRICULA' THEN 0 ELSE 1 END, o.numero_cuota
    `);
    return result.recordset;
  }
}
