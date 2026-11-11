import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { fechaISO } from 'src/database/consultas';
import { DatabaseService } from 'src/database/database.service';
import { CreateProrrogaDto } from './dto/create-prorroga.dto';
import { UpdateProrrogaDto } from './dto/update-prorroga.dto';

const SELECT_PRORROGA = `
  SELECT p.*, o.id_inscripcion, o.tipo, o.numero_cuota, o.periodo,
    o.fecha_vencimiento, o.monto, o.estado AS estado_obligacion
  FROM PRORROGA p
  JOIN OBLIGACION_PAGO o ON o.id_obligacion = p.id_obligacion`;

/**
 * El script permite varias prórrogas por obligación; vw_estado_cuenta toma la
 * mayor fecha_finalizacion como vencimiento efectivo.
 */
@Injectable()
export class ProrrogaService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getProrrogas() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_PRORROGA} ORDER BY p.fecha_inicio DESC, p.id_prorroga DESC
    `);
    return result.recordset;
  }

  async getProrroga(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(`${SELECT_PRORROGA} WHERE p.id_prorroga = @id`);
    if (!result.recordset.length)
      throw new NotFoundException(
        `La prórroga con id ${id} no fue encontrada.`,
      );
    return result.recordset[0];
  }

  async getProrrogasPorObligacion(idObligacion: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, idObligacion)
      .query(
        `${SELECT_PRORROGA} WHERE p.id_obligacion = @id ORDER BY p.fecha_inicio`,
      );
    return result.recordset;
  }

  async createProrroga(prorroga: CreateProrrogaDto) {
    const obligacion = (
      await this.databaseService
        .getPool()
        .request()
        .input('id', sql.Int, prorroga.id_obligacion)
        .query(
          'SELECT fecha_vencimiento, estado FROM OBLIGACION_PAGO WHERE id_obligacion = @id',
        )
    ).recordset[0];
    if (!obligacion)
      throw new NotFoundException(
        `La obligación con id ${prorroga.id_obligacion} no fue encontrada.`,
      );
    // Regla de la academia: una sola prórroga por obligación (se edita si cambia).
    const existente = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, prorroga.id_obligacion)
      .query('SELECT TOP (1) id_prorroga FROM PRORROGA WHERE id_obligacion = @id');
    if (existente.recordset.length)
      throw new BadRequestException(
        'La obligación ya tiene una prórroga. Edítala en lugar de crear otra.',
      );
    this.validar(
      obligacion,
      prorroga.fecha_inicio,
      prorroga.fecha_finalizacion,
    );

    // PRORROGA tiene trigger de bitácora: se usa SCOPE_IDENTITY() en lugar de OUTPUT.
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, prorroga.id_obligacion)
      .input('inicio', sql.VarChar(10), prorroga.fecha_inicio.slice(0, 10))
      .input('fin', sql.VarChar(10), prorroga.fecha_finalizacion.slice(0, 10))
      .input('observacion', sql.NVarChar(500), prorroga.observacion ?? null)
      .query(`
        INSERT INTO PRORROGA (id_obligacion, fecha_inicio, fecha_finalizacion, observacion)
        VALUES (@id, CONVERT(DATE, @inicio, 23), CONVERT(DATE, @fin, 23), @observacion);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS id_prorroga;
      `);
    return this.getProrroga(result.recordset[0].id_prorroga);
  }

  async updateProrroga(id: number, datos: UpdateProrrogaDto) {
    const actual = await this.getProrroga(id);
    const inicio =
      datos.fecha_inicio?.slice(0, 10) ?? fechaISO(actual.fecha_inicio)!;
    const fin =
      datos.fecha_finalizacion?.slice(0, 10) ??
      fechaISO(actual.fecha_finalizacion)!;
    this.validar(
      {
        fecha_vencimiento: actual.fecha_vencimiento,
        estado: actual.estado_obligacion,
      },
      inicio,
      fin,
    );
    await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .input('inicio', sql.VarChar(10), inicio)
      .input('fin', sql.VarChar(10), fin)
      .input(
        'observacion',
        sql.NVarChar(500),
        datos.observacion !== undefined
          ? datos.observacion
          : actual.observacion,
      ).query(`
        UPDATE PRORROGA
        SET fecha_inicio = CONVERT(DATE, @inicio, 23),
          fecha_finalizacion = CONVERT(DATE, @fin, 23),
          observacion = @observacion
        WHERE id_prorroga = @id;
      `);
    return this.getProrroga(id);
  }

  async deleteProrroga(id: number) {
    const actual = await this.getProrroga(id);
    if (actual.estado_obligacion === 'PAGADA')
      throw new BadRequestException(
        'No se puede eliminar una prórroga asociada a una obligación pagada.',
      );
    await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM PRORROGA WHERE id_prorroga = @id');
    return { mensaje: 'Prórroga eliminada correctamente.', id_prorroga: id };
  }

  private validar(
    obligacion: { fecha_vencimiento: Date | string; estado: string },
    inicio: string,
    fin: string,
  ) {
    if (obligacion.estado === 'ANULADA')
      throw new BadRequestException('La obligación está anulada.');
    if (obligacion.estado === 'PAGADA')
      throw new BadRequestException('La obligación ya está pagada.');
    if (inicio > fin)
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la fecha de finalización.',
      );
    if (inicio <= fechaISO(obligacion.fecha_vencimiento)!)
      throw new BadRequestException(
        'La fecha de inicio de la prórroga debe ser posterior a la fecha de vencimiento de la obligación.',
      );
  }
}
