import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { ESTADO_CUENTA } from 'src/database/consultas';
import { DatabaseService } from 'src/database/database.service';
import { CreatePagoDto } from './dto/create-pago.dto';

const SELECT_PAGO = `
  SELECT p.*,
    o.id_inscripcion, o.tipo, o.numero_cuota, o.periodo, o.fecha_vencimiento,
    o.monto AS monto_obligacion, o.estado AS estado_obligacion,
    i.id_estudiante, i.id_grupo, e.codigo, e.nombres, e.apellidos,
    g.nombre AS grupo, pl.id_curso, c.nombre AS curso
  FROM PAGO p
  JOIN OBLIGACION_PAGO o ON o.id_obligacion = p.id_obligacion
  JOIN INSCRIPCION i ON i.id_inscripcion = o.id_inscripcion
  JOIN ESTUDIANTE e ON e.id_estudiante = i.id_estudiante
  JOIN GRUPO g ON g.id_grupo = i.id_grupo
  JOIN PLAN_ESTUDIO pl ON pl.id_plan = g.id_plan
  JOIN CURSO c ON c.id_curso = pl.id_curso`;

@Injectable()
export class PagoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPagos() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_PAGO} ORDER BY p.fecha_pago DESC, p.id_pago DESC
    `);
    return result.recordset;
  }

  async getPago(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(`${SELECT_PAGO} WHERE p.id_pago = @id`);
    if (!result.recordset.length)
      throw new NotFoundException(`El pago con id ${id} no fue encontrado.`);
    return result.recordset[0];
  }

  async getPagosPorObligacion(idObligacion: number) {
    const pool = this.databaseService.getPool();
    const obligacion = await pool
      .request()
      .input('id', sql.Int, idObligacion)
      .query(
        'SELECT id_obligacion FROM OBLIGACION_PAGO WHERE id_obligacion = @id',
      );
    if (!obligacion.recordset.length)
      throw new NotFoundException(
        `La obligación de pago con id ${idObligacion} no fue encontrada.`,
      );
    const result = await pool.request().input('id', sql.Int, idObligacion)
      .query(`
      SELECT * FROM PAGO WHERE id_obligacion = @id ORDER BY fecha_pago, id_pago
    `);
    return result.recordset;
  }

  async createPago(pago: CreatePagoDto) {
    return this.databaseService.transaction(async (tx) => {
      const inscripcion = (
        await tx.request().input('id', sql.Int, pago.id_obligacion).query(`
          SELECT i.estado FROM OBLIGACION_PAGO o
          JOIN INSCRIPCION i ON i.id_inscripcion = o.id_inscripcion
          WHERE o.id_obligacion = @id
        `)
      ).recordset[0];
      if (inscripcion?.estado === 'CANCELADA')
        throw new BadRequestException(
          'No se pueden registrar pagos para una inscripción cancelada.',
        );
      const resultado = await this.registrarPagoEnTransaccion(
        tx,
        pago.id_obligacion,
        pago.monto_pagado,
        pago.metodo_pago,
        pago.observacion,
        pago.fecha_pago,
      );
      const cuenta = await this.cuenta(tx, pago.id_obligacion);
      return {
        mensaje: 'Pago registrado correctamente.',
        pago: resultado,
        obligacion: cuenta,
        resumen: {
          pagado: Number(cuenta.pagado),
          saldo_neto: Number(cuenta.saldo_neto),
          pagada: cuenta.estado === 'PAGADA',
        },
      };
    });
  }

  /**
   * Registra un pago dentro de una transacción abierta por quien lo llama.
   * El saldo considera recargos (vw_estado_cuenta) y descuentos aplicados.
   */
  async registrarPagoEnTransaccion(
    tx: sql.Transaction,
    idObligacion: number,
    montoPagado: number,
    metodoPago: string,
    observacion?: string | null,
    fechaPago?: string,
  ) {
    const obligacion = (
      await tx.request().input('id', sql.Int, idObligacion).query(`
        SELECT estado FROM OBLIGACION_PAGO WITH (UPDLOCK, HOLDLOCK) WHERE id_obligacion = @id
      `)
    ).recordset[0];
    if (!obligacion)
      throw new NotFoundException(
        `La obligación de pago con id ${idObligacion} no fue encontrada.`,
      );
    if (obligacion.estado === 'ANULADA')
      throw new BadRequestException(
        'No se pueden registrar pagos para una obligación anulada.',
      );
    if (obligacion.estado === 'PAGADA')
      throw new BadRequestException(
        'Esta obligación ya fue pagada completamente.',
      );
    if (montoPagado <= 0)
      throw new BadRequestException(
        'El monto del pago debe ser mayor que cero.',
      );

    const saldo = Number((await this.cuenta(tx, idObligacion)).saldo_neto);
    if (saldo <= 0)
      throw new BadRequestException(
        'La obligación ya está completamente pagada.',
      );
    if (montoPagado > saldo)
      throw new BadRequestException(
        `El pago excede el saldo pendiente de la obligación. Saldo pendiente: C$${saldo.toFixed(2)}.`,
      );

    // PAGO tiene trigger de bitácora: se usa SCOPE_IDENTITY() en lugar de OUTPUT.
    const result = await tx
      .request()
      .input('id', sql.Int, idObligacion)
      .input('monto', sql.Decimal(10, 2), montoPagado)
      .input('metodo', sql.VarChar(15), metodoPago)
      .input('observacion', sql.NVarChar(500), observacion ?? null)
      .input('fecha', sql.VarChar(19), fechaPago ?? null).query(`
        INSERT INTO PAGO (id_obligacion, fecha_pago, monto_pagado, metodo_pago, observacion)
        VALUES (@id, COALESCE(CAST(@fecha AS DATETIME2(0)), SYSDATETIME()), @monto, @metodo, @observacion);
        SELECT * FROM PAGO WHERE id_pago = SCOPE_IDENTITY();
      `);

    if (Math.round((saldo - montoPagado) * 100) <= 0) {
      await tx.request().input('id', sql.Int, idObligacion).query(`
        UPDATE OBLIGACION_PAGO SET estado = 'PAGADA' WHERE id_obligacion = @id
      `);
    }
    return result.recordset[0];
  }

  private async cuenta(tx: sql.Transaction, id: number) {
    const result = await tx.request().input('id', sql.Int, id).query(`
      SELECT * FROM ${ESTADO_CUENTA} o WHERE o.id_obligacion = @id
    `);
    return result.recordset[0];
  }
}
