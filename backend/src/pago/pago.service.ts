import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as sql from 'mssql';

import { DatabaseService } from 'src/database/database.service';

import { CreatePagoDto } from './dto/create-pago.dto';

interface DatosObligacion {
  id_obligacion: number;
  id_inscripcion: number;
  tipo_obligacion: 'MATRICULA' | 'MENSUALIDAD';
  numero_cuota: number | null;
  periodo: string | null;
  fecha_vencimiento: string | Date;
  monto: number;
  estado: 'PENDIENTE' | 'PAGADA' | 'ANULADA';
}

@Injectable()
export class PagoService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // OBTENER TODOS LOS PAGOS
  // ============================================================

  async getPagos() {
    const pool = this.databaseService.getPool();

    const result = await pool.request().query(`
      SELECT
        p.*,

        o.id_inscripcion,
        o.tipo_obligacion,
        o.numero_cuota,
        o.periodo,
        o.fecha_vencimiento,
        o.monto AS monto_obligacion,
        o.estado AS estado_obligacion,

        i.id_estudiante,
        i.id_grupo,

        e.nombres AS nombre_estudiante,
        e.apellidos AS apellido_estudiante,

        g.nombre_grupo,

        c.id_curso,
        c.nombre_curso

      FROM pago p

      INNER JOIN obligacion_pago o
        ON p.id_obligacion = o.id_obligacion

      INNER JOIN inscripcion i
        ON o.id_inscripcion = i.id_inscripcion

      INNER JOIN estudiante e
        ON i.id_estudiante = e.id_estudiante

      INNER JOIN grupo g
        ON i.id_grupo = g.id_grupo

      INNER JOIN curso c
        ON g.id_curso = c.id_curso

      ORDER BY
        p.fecha_pago DESC,
        p.id_pago DESC;
    `);

    return result.recordset;
  }

  // ============================================================
  // OBTENER UN PAGO
  // ============================================================

  async getPago(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', sql.Int, id).query(`
      SELECT
        p.*,

        o.id_inscripcion,
        o.tipo_obligacion,
        o.numero_cuota,
        o.periodo,
        o.fecha_vencimiento,
        o.monto AS monto_obligacion,
        o.estado AS estado_obligacion,

        i.id_estudiante,
        i.id_grupo,

        e.nombres AS nombre_estudiante,
        e.apellidos AS apellido_estudiante,

        g.nombre_grupo,

        c.id_curso,
        c.nombre_curso

      FROM pago p

      INNER JOIN obligacion_pago o
        ON p.id_obligacion = o.id_obligacion

      INNER JOIN inscripcion i
        ON o.id_inscripcion = i.id_inscripcion

      INNER JOIN estudiante e
        ON i.id_estudiante = e.id_estudiante

      INNER JOIN grupo g
        ON i.id_grupo = g.id_grupo

      INNER JOIN curso c
        ON g.id_curso = c.id_curso

      WHERE p.id_pago = @id;
    `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `El pago con id ${id} no fue encontrado.`,
      );
    }

    return result.recordset[0];
  }

  // ============================================================
  // OBTENER PAGOS DE UNA OBLIGACIÓN
  // ============================================================

  async getPagosPorObligacion(idObligacion: number) {
    const pool = this.databaseService.getPool();

    // ----------------------------------------------------------
    // Verificar obligación
    // ----------------------------------------------------------

    const obligacion = await pool
      .request()
      .input('id_obligacion', sql.Int, idObligacion)
      .query(`
        SELECT
          id_obligacion
        FROM obligacion_pago WITH (UPDLOCK, HOLDLOCK)
        WHERE id_obligacion = @id_obligacion;
      `);

    if (obligacion.recordset.length === 0) {
      throw new NotFoundException(
        `La obligación de pago con id ${idObligacion} no fue encontrada.`,
      );
    }

    // ----------------------------------------------------------
    // Obtener pagos
    // ----------------------------------------------------------

    const result = await pool
      .request()
      .input('id_obligacion', sql.Int, idObligacion)
      .query(`
        SELECT
          *
        FROM pago
        WHERE id_obligacion = @id_obligacion
        ORDER BY
          fecha_pago,
          id_pago;
      `);

    return result.recordset;
  }

  // ============================================================
  // CREAR PAGO
  // ============================================================

  async createPago(pago: CreatePagoDto) {
    const pool = this.databaseService.getPool();

    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // ========================================================
      // OBTENER OBLIGACIÓN
      // ========================================================

      const obligacionResult = await transaction.request()
        .input('id_obligacion', sql.Int, pago.id_obligacion)
        .query<DatosObligacion>(`
          SELECT
            id_obligacion,
            id_inscripcion,
            tipo_obligacion,
            numero_cuota,
            periodo,
            fecha_vencimiento,
            monto,
            estado
          FROM obligacion_pago WITH (UPDLOCK, HOLDLOCK)
          WHERE id_obligacion = @id_obligacion;
        `);

      if (obligacionResult.recordset.length === 0) {
        throw new NotFoundException(
          `La obligación de pago con id ${pago.id_obligacion} no fue encontrada.`,
        );
      }

      const obligacion = obligacionResult.recordset[0];

      // ========================================================
      // VERIFICAR ESTADO DE LA OBLIGACIÓN
      // ========================================================

      if (obligacion.estado === 'ANULADA') {
        throw new BadRequestException(
          'No se pueden registrar pagos para una obligación anulada.',
        );
      }

      if (obligacion.estado === 'PAGADA') {
        throw new BadRequestException(
          'Esta obligación ya fue pagada completamente.',
        );
      }

      // ========================================================
      // VERIFICAR ESTADO DE LA INSCRIPCIÓN
      // ========================================================

      const inscripcionResult = await transaction.request()
        .input('id_inscripcion', sql.Int, obligacion.id_inscripcion)
        .query(`
          SELECT
            estado_inscripcion
          FROM inscripcion
          WHERE id_inscripcion = @id_inscripcion;
        `);

      if (inscripcionResult.recordset.length === 0) {
        throw new NotFoundException(
          `La inscripción con id ${obligacion.id_inscripcion} no fue encontrada.`,
        );
      }

      const estadoInscripcion =
        inscripcionResult.recordset[0].estado_inscripcion;

      if (estadoInscripcion === 'CANCELADA') {
        throw new BadRequestException(
          'No se pueden registrar pagos para una inscripción cancelada.',
        );
      }

      // ========================================================
      // VALIDAR MONTO
      // ========================================================

      if (pago.monto_pagado <= 0) {
        throw new BadRequestException(
          'El monto del pago debe ser mayor que cero.',
        );
      }

      // ========================================================
      // OBTENER TOTAL PAGADO
      // ========================================================

      const pagosResult = await transaction.request()
        .input('id_obligacion', sql.Int, pago.id_obligacion)
        .query(`
          SELECT
            ISNULL(
              SUM(monto_pagado),
              0
            ) AS total_pagado
          FROM pago
          WHERE id_obligacion = @id_obligacion;
        `);

      const totalPagado = Number(
        pagosResult.recordset[0].total_pagado,
      );

      const ajustada = await transaction.request().input('id', obligacion.id_obligacion)
      .query('SELECT monto_ajustado FROM dbo.vw_estado_cuenta WHERE id_obligacion = @id');
    const montoObligacion = Number(ajustada.recordset[0].monto_ajustado);

      const saldoPendiente =
        Math.round((montoObligacion - totalPagado) * 100) / 100;

      // ========================================================
      // VERIFICAR CONSISTENCIA DEL ESTADO
      // ========================================================

      if (saldoPendiente <= 0) {
        throw new BadRequestException(
          'La obligación ya está completamente pagada.',
        );
      }

      // ========================================================
      // EVITAR SOBREPAGO
      // ========================================================

      if (pago.monto_pagado > saldoPendiente) {
        throw new BadRequestException(
          `El pago excede el saldo pendiente de la obligación. Saldo pendiente: C$${saldoPendiente.toFixed(2)}.`,
        );
      }

      // ========================================================
      // CREAR PAGO
      // ========================================================

      const request = transaction.request()
        .input('id_obligacion', sql.Int, pago.id_obligacion)
        .input(
          'monto_pagado',
          sql.Numeric(10, 2),
          pago.monto_pagado,
        )
        .input(
          'metodo_pago',
          sql.VarChar(50),
          pago.metodo_pago,
        )
        .input(
          'observacion',
          sql.VarChar(sql.MAX),
          pago.observacion ?? null,
        );

      let result;

      if (pago.fecha_pago) {
        request.input(
          'fecha_pago',
          sql.Date,
          pago.fecha_pago,
        );

        result = await request.query(`
          INSERT INTO pago (
            id_obligacion,
            fecha_pago,
            monto_pagado,
            metodo_pago,
            observacion
          )
          OUTPUT INSERTED.*
          VALUES (
            @id_obligacion,
            @fecha_pago,
            @monto_pagado,
            @metodo_pago,
            @observacion
          );
        `);
      } else {
        result = await request.query(`
          INSERT INTO pago (
            id_obligacion,
            monto_pagado,
            metodo_pago,
            observacion
          )
          OUTPUT INSERTED.*
          VALUES (
            @id_obligacion,
            @monto_pagado,
            @metodo_pago,
            @observacion
          );
        `);
      }

      const nuevoPago = result.recordset[0];

      // ========================================================
      // CALCULAR NUEVO SALDO
      // ========================================================

      const nuevoTotalPagado =
        Math.round(
          (totalPagado + Number(pago.monto_pagado)) * 100,
        ) / 100;

      const nuevoSaldo =
        Math.round(
          (montoObligacion - nuevoTotalPagado) * 100,
        ) / 100;

      // ========================================================
      // ACTUALIZAR ESTADO DE LA OBLIGACIÓN
      // ========================================================

      let nuevoEstado: 'PENDIENTE' | 'PAGADA' = 'PENDIENTE';

      if (nuevoSaldo <= 0) {
        nuevoEstado = 'PAGADA';

        await transaction.request()
          .input(
            'id_obligacion',
            sql.Int,
            pago.id_obligacion,
          )
          .query(`
            UPDATE obligacion_pago
            SET estado = 'PAGADA'
            WHERE id_obligacion = @id_obligacion;
          `);
      }

      // ========================================================
      // CONFIRMAR TRANSACCIÓN
      // ========================================================

      await transaction.commit();

      // ========================================================
      // RETORNAR RESULTADO
      // ========================================================

      return {
        mensaje: 'Pago registrado correctamente.',

        pago: nuevoPago,

        obligacion: {
          id_obligacion: obligacion.id_obligacion,
          tipo_obligacion: obligacion.tipo_obligacion,
          numero_cuota: obligacion.numero_cuota,
          periodo: obligacion.periodo,
          monto: montoObligacion,
          estado: nuevoEstado,
        },

        resumen: {
          total_pagado: nuevoTotalPagado,
          saldo_pendiente: nuevoSaldo,
          pagada: nuevoEstado === 'PAGADA',
        },
      };
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {}

      throw error;
    }
  }

  // ============================================================
  // REGISTRAR PAGO DENTRO DE UNA TRANSACCIÓN
  // ============================================================
  //
  // Este método NO abre ni confirma una transacción.
  //
  // La transacción es responsabilidad del servicio que lo utiliza.
  //
  // ============================================================

  async registrarPagoEnTransaccion(
    transaction: sql.Transaction,
    idObligacion: number,
    montoPagado: number,
    metodoPago: string,
    observacion?: string,
  ) {
    // ========================================================
    // OBTENER OBLIGACIÓN
    // ========================================================

    const obligacionResult = await transaction.request()
      .input('id_obligacion', sql.Int, idObligacion)
      .query<DatosObligacion>(`
        SELECT
          id_obligacion,
          id_inscripcion,
          tipo_obligacion,
          numero_cuota,
          periodo,
          fecha_vencimiento,
          monto,
          estado
        FROM obligacion_pago WITH (UPDLOCK, HOLDLOCK)
        WHERE id_obligacion = @id_obligacion;
      `);

    if (obligacionResult.recordset.length === 0) {
      throw new NotFoundException(
        `La obligación de pago con id ${idObligacion} no fue encontrada.`,
      );
    }

    const obligacion = obligacionResult.recordset[0];

    // ========================================================
    // VERIFICAR ESTADO DE LA OBLIGACIÓN
    // ========================================================

    if (obligacion.estado === 'ANULADA') {
      throw new BadRequestException(
        'No se pueden registrar pagos para una obligación anulada.',
      );
    }

    if (obligacion.estado === 'PAGADA') {
      throw new BadRequestException(
        'Esta obligación ya fue pagada completamente.',
      );
    }

    // ========================================================
    // VALIDAR MONTO
    // ========================================================

    if (montoPagado <= 0) {
      throw new BadRequestException(
        'El monto del pago debe ser mayor que cero.',
      );
    }

    // ========================================================
    // OBTENER TOTAL PAGADO
    // ========================================================

    const pagosResult = await transaction.request()
      .input('id_obligacion', sql.Int, idObligacion)
      .query(`
        SELECT
          ISNULL(
            SUM(monto_pagado),
            0
          ) AS total_pagado
        FROM pago
        WHERE id_obligacion = @id_obligacion;
      `);

    const totalPagado = Number(
      pagosResult.recordset[0].total_pagado,
    );

    const ajustada = await transaction.request().input('id', obligacion.id_obligacion)
      .query('SELECT monto_ajustado FROM dbo.vw_estado_cuenta WHERE id_obligacion = @id');
    const montoObligacion = Number(ajustada.recordset[0].monto_ajustado);

    const saldoPendiente =
      Math.round(
        (montoObligacion - totalPagado) * 100,
      ) / 100;

    // ========================================================
    // VERIFICAR CONSISTENCIA DEL ESTADO
    // ========================================================

    if (saldoPendiente <= 0) {
      throw new BadRequestException(
        'La obligación ya está completamente pagada.',
      );
    }

    // ========================================================
    // EVITAR SOBREPAGO
    // ========================================================

    if (montoPagado > saldoPendiente) {
      throw new BadRequestException(
        `El pago excede el saldo pendiente de la obligación. Saldo pendiente: C$${saldoPendiente.toFixed(2)}.`,
      );
    }

    // ========================================================
    // CREAR PAGO
    // ========================================================

    const result = await transaction.request()
      .input('id_obligacion', sql.Int, idObligacion)
      .input(
        'monto_pagado',
        sql.Numeric(10, 2),
        montoPagado,
      )
      .input(
        'metodo_pago',
        sql.VarChar(50),
        metodoPago,
      )
      .input(
        'observacion',
        sql.VarChar(sql.MAX),
        observacion ?? null,
      )
      .query(`
        INSERT INTO pago (
          id_obligacion,
          monto_pagado,
          metodo_pago,
          observacion
        )
        OUTPUT INSERTED.*
        VALUES (
          @id_obligacion,
          @monto_pagado,
          @metodo_pago,
          @observacion
        );
      `);

    // ========================================================
    // CALCULAR NUEVO SALDO
    // ========================================================

    const nuevoTotalPagado =
      Math.round(
        (totalPagado + Number(montoPagado)) * 100,
      ) / 100;

    const nuevoSaldo =
      Math.round(
        (montoObligacion - nuevoTotalPagado) * 100,
      ) / 100;

    // ========================================================
    // ACTUALIZAR ESTADO
    // ========================================================

    if (nuevoSaldo <= 0) {
      await transaction.request()
        .input(
          'id_obligacion',
          sql.Int,
          idObligacion,
        )
        .query(`
          UPDATE obligacion_pago
          SET estado = 'PAGADA'
          WHERE id_obligacion = @id_obligacion;
        `);
    }

    // ========================================================
    // RETORNAR PAGO
    // ========================================================

    return result.recordset[0];
  }
}
