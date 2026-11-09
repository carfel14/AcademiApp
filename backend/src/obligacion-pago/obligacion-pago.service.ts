import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as sql from 'mssql';

import { DatabaseService } from 'src/database/database.service';

interface DatosInscripcion {
  id_inscripcion: number;
  id_estudiante: number;
  id_grupo: number;

  nombre_grupo: string;

  fecha_inicio: string | Date;
  fecha_fin: string | Date;

  duracion_meses: number;

  estado_grupo: 'ACTIVO' | 'FINALIZADO' | 'CANCELADO';

  id_curso: number;
  nombre_curso: string;

  precio: number;
  precio_matricula: number;

  estado_curso: string;
}

@Injectable()
export class ObligacionPagoService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // OBTENER TODAS LAS OBLIGACIONES
  // ============================================================

  async getObligaciones() {
    const pool = this.databaseService.getPool();

    const result = await pool.request().query(`
    SELECT
      o.id_obligacion,
      o.id_inscripcion,
      o.tipo_obligacion,
      o.numero_cuota,
      o.periodo,
      o.fecha_vencimiento,
      o.monto,
      o.estado,
      o.total_pagado, o.saldo_pendiente, o.monto_ajustado,
      o.total_recargo, o.total_descuento, o.vencimiento_efectivo,

      i.id_estudiante,
      i.id_grupo,
      g.nombre_grupo,
      c.id_curso,
      c.nombre_curso

    FROM dbo.vw_estado_cuenta o

    INNER JOIN inscripcion i
      ON o.id_inscripcion = i.id_inscripcion

    INNER JOIN grupo g
      ON i.id_grupo = g.id_grupo

    INNER JOIN curso c
      ON g.id_curso = c.id_curso

    ORDER BY
      o.fecha_vencimiento,
      o.id_obligacion;
  `);

    return result.recordset;
  }

  // ============================================================
  // OBTENER UNA OBLIGACIÓN
  // ============================================================

  async getObligacion(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', sql.Int, id).query(`
      SELECT
        o.id_obligacion,
        o.id_inscripcion,
        o.tipo_obligacion,
        o.numero_cuota,
        o.periodo,
        o.fecha_vencimiento,
        o.monto,
        o.estado,
      o.total_pagado, o.saldo_pendiente, o.monto_ajustado,
      o.total_recargo, o.total_descuento, o.vencimiento_efectivo,

        i.id_estudiante,
        i.id_grupo,
        g.nombre_grupo,
        c.id_curso,
        c.nombre_curso

      FROM dbo.vw_estado_cuenta o

      INNER JOIN inscripcion i
        ON o.id_inscripcion = i.id_inscripcion

      INNER JOIN grupo g
        ON i.id_grupo = g.id_grupo

      INNER JOIN curso c
        ON g.id_curso = c.id_curso

      WHERE o.id_obligacion = @id;
    `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `La obligación de pago con id ${id} no fue encontrada.`,
      );
    }

    return result.recordset[0];
  }

  // ============================================================
  // OBTENER OBLIGACIONES DE UNA INSCRIPCIÓN
  // ============================================================

  async getObligacionesPorInscripcion(idInscripcion: number) {
  const pool = this.databaseService.getPool();

  const inscripcion = await pool
    .request()
    .input('id_inscripcion', sql.Int, idInscripcion)
    .query(`
      SELECT id_inscripcion
      FROM inscripcion
      WHERE id_inscripcion = @id_inscripcion;
    `);

  if (inscripcion.recordset.length === 0) {
    throw new NotFoundException(
      `La inscripción con id ${idInscripcion} no fue encontrada.`,
    );
  }

  const result = await pool
    .request()
    .input('id_inscripcion', sql.Int, idInscripcion)
    .query(`
      SELECT
        o.id_obligacion,
        o.id_inscripcion,
        o.tipo_obligacion,
        o.numero_cuota,
        o.periodo,
        o.fecha_vencimiento,
        o.monto,
        o.estado,
      o.total_pagado, o.saldo_pendiente, o.monto_ajustado,
      o.total_recargo, o.total_descuento, o.vencimiento_efectivo

      FROM dbo.vw_estado_cuenta o

      WHERE o.id_inscripcion = @id_inscripcion

      ORDER BY
        CASE
          WHEN o.tipo_obligacion = 'MATRICULA' THEN 0
          ELSE 1
        END,
        o.numero_cuota;
    `);

  return result.recordset;
}

  // ============================================================
  // GENERAR OBLIGACIONES AUTOMÁTICAMENTE
  //
  // REGLAS:
  //
  // MATRÍCULA:
  //     vence el día de inicio del grupo.
  //
  // MENSUALIDAD:
  //     cuota 1 -> inicio + 1 mes
  //     cuota 2 -> inicio + 2 meses
  //     cuota 3 -> inicio + 3 meses
  //     ...
  //
  // La fecha de inscripción NO interviene.
  //
  // Todos los estudiantes del mismo grupo tienen
  // exactamente las mismas fechas de vencimiento.
  // ============================================================

  async generarObligaciones(idInscripcion: number) {
    const pool = this.databaseService.getPool();

    // ==========================================================
    // OBTENER INFORMACIÓN DE LA INSCRIPCIÓN
    // ==========================================================

    const inscripcionResult = await pool
      .request()
      .input('id_inscripcion', sql.Int, idInscripcion).query<DatosInscripcion>(`
        SELECT
          i.id_inscripcion,
          i.id_estudiante,
          i.id_grupo,

          g.nombre_grupo,
          g.fecha_inicio,
          g.fecha_fin,
          g.duracion_meses,
          g.estado AS estado_grupo,

          c.id_curso,
          c.nombre_curso,
          c.precio,
          c.precio_matricula,
          c.estado AS estado_curso

        FROM inscripcion i

        INNER JOIN grupo g
          ON i.id_grupo = g.id_grupo

        INNER JOIN curso c
          ON g.id_curso = c.id_curso

        WHERE i.id_inscripcion = @id_inscripcion;
      `);

    if (inscripcionResult.recordset.length === 0) {
      throw new NotFoundException(
        `La inscripción con id ${idInscripcion} no fue encontrada.`,
      );
    }

    const datos = inscripcionResult.recordset[0];

    // ==========================================================
    // VALIDACIONES
    // ==========================================================

    const duracionMeses = Number(datos.duracion_meses);

    const precioCurso = Number(datos.precio);

    const precioMatricula = Number(datos.precio_matricula);

    if (!Number.isInteger(duracionMeses) || duracionMeses <= 0) {
      throw new BadRequestException(
        'La duración del grupo debe ser un número entero mayor que cero.',
      );
    }

    if (precioCurso <= 0) {
      throw new BadRequestException(
        'El precio del curso debe ser mayor que cero.',
      );
    }

    if (precioMatricula <= 0) {
      throw new BadRequestException(
        'El precio de matrícula debe ser mayor que cero.',
      );
    }

    // ==========================================================
    // VERIFICAR QUE EL RANGO DEL GRUPO SEA VÁLIDO
    // ==========================================================

    const fechaInicio = this.formatearFecha(datos.fecha_inicio);

    const fechaFin = this.formatearFecha(datos.fecha_fin);

    if (fechaFin <= fechaInicio) {
      throw new BadRequestException(
        'El grupo tiene un rango de fechas inválido.',
      );
    }

    // ==========================================================
    // VERIFICAR SI YA EXISTEN OBLIGACIONES
    // ==========================================================

    const existentes = await pool
      .request()
      .input('id_inscripcion', sql.Int, idInscripcion).query(`
        SELECT
          id_obligacion
        FROM obligacion_pago
        WHERE id_inscripcion = @id_inscripcion;
      `);

    if (existentes.recordset.length > 0) {
      throw new BadRequestException(
        'La inscripción ya tiene obligaciones de pago generadas.',
      );
    }

    // ==========================================================
    // CALCULAR MENSUALIDADES
    // ==========================================================

    const montoMensualidadBase =
      Math.floor((precioCurso / duracionMeses) * 100) / 100;

    const montoMensualidadBaseTotal = montoMensualidadBase * duracionMeses;

    const diferencia =
      Math.round((precioCurso - montoMensualidadBaseTotal) * 100) / 100;

    // ==========================================================
    // MATRÍCULA
    //
    // Siempre vence el día de inicio del grupo.
    // ==========================================================

    const matriculaResult = await pool
      .request()
      .input('id_inscripcion', sql.Int, idInscripcion)
      .input('tipo_obligacion', sql.VarChar(20), 'MATRICULA')
      .input('fecha_vencimiento', sql.Date, fechaInicio)
      .input('monto', sql.Numeric(10, 2), precioMatricula).query(`
        INSERT INTO obligacion_pago (
          id_inscripcion,
          tipo_obligacion,
          numero_cuota,
          periodo,
          fecha_vencimiento,
          monto,
          estado
        )

        OUTPUT INSERTED.*

        VALUES (
          @id_inscripcion,
          @tipo_obligacion,
          NULL,
          NULL,
          @fecha_vencimiento,
          @monto,
          'PENDIENTE'
        );
      `);

    // ==========================================================
    // MENSUALIDADES
    //
    // IMPORTANTE:
    //
    // La primera mensualidad NO vence el día de inicio.
    //
    // Ejemplo:
    //
    // inicio: 2026-08-10
    //
    // matrícula -> 2026-08-10
    // cuota 1   -> 2026-09-10
    // cuota 2   -> 2026-10-10
    // cuota 3   -> 2026-11-10
    //
    // ==========================================================

    const mensualidades: object[] = [];

    for (let numeroCuota = 1; numeroCuota <= duracionMeses; numeroCuota++) {
      const fechaVencimiento = this.calcularFechaMensual(
        fechaInicio,
        numeroCuota,
      );

      const periodo = this.generarPeriodo(fechaVencimiento);

      // ========================================================
      // ÚLTIMA CUOTA
      //
      // Absorbe cualquier diferencia de centavos causada
      // por la división del precio total entre los meses.
      //
      // Ejemplo:
      //
      // 10000 / 3 = 3333.33
      //
      // cuota 1 = 3333.33
      // cuota 2 = 3333.33
      // cuota 3 = 3333.34
      //
      // Total = 10000.00
      // ========================================================

      const esUltimaCuota = numeroCuota === duracionMeses;

      const monto = esUltimaCuota
        ? Math.round((montoMensualidadBase + diferencia) * 100) / 100
        : montoMensualidadBase;

      const result = await pool
        .request()
        .input('id_inscripcion', sql.Int, idInscripcion)
        .input('tipo_obligacion', sql.VarChar(20), 'MENSUALIDAD')
        .input('numero_cuota', sql.Int, numeroCuota)
        .input('periodo', sql.VarChar(50), periodo)
        .input('fecha_vencimiento', sql.Date, fechaVencimiento)
        .input('monto', sql.Numeric(10, 2), monto).query(`
          INSERT INTO obligacion_pago (
            id_inscripcion,
            tipo_obligacion,
            numero_cuota,
            periodo,
            fecha_vencimiento,
            monto,
            estado
          )

          OUTPUT INSERTED.*

          VALUES (
            @id_inscripcion,
            @tipo_obligacion,
            @numero_cuota,
            @periodo,
            @fecha_vencimiento,
            @monto,
            'PENDIENTE'
          );
        `);

      mensualidades.push(result.recordset[0]);
    }

    // ==========================================================
    // RETORNAR RESULTADO
    // ==========================================================

    const montoTotalMensualidades = mensualidades.reduce(
      (total: number, obligacion: any) => total + Number(obligacion.monto),
      0,
    );

    return {
      mensaje: 'Obligaciones de pago generadas correctamente.',

      id_inscripcion: idInscripcion,

      curso: datos.nombre_curso,

      grupo: datos.nombre_grupo,

      fecha_inicio_grupo: fechaInicio,

      fecha_fin_grupo: fechaFin,

      precio_curso: precioCurso,

      precio_matricula: precioMatricula,

      duracion_meses: duracionMeses,

      monto_mensualidad: Math.round(montoMensualidadBase * 100) / 100,

      monto_total_mensualidades:
        Math.round(montoTotalMensualidades * 100) / 100,

      matricula: matriculaResult.recordset[0],

      mensualidades,

      total_obligaciones: 1 + mensualidades.length,
    };
  }

  // ============================================================
  // CREAR OBLIGACIÓN MANUAL
  //
  // NO SE PERMITE.
  //
  // Las obligaciones nacen automáticamente al inscribirse
  // un estudiante.
  // ============================================================

  async createObligacion() {
    throw new BadRequestException(
      'Las obligaciones de pago se generan automáticamente al realizar una inscripción.',
    );
  }

  // ============================================================
  // ACTUALIZAR OBLIGACIÓN
  //
  // NO SE PERMITE CAMBIAR LA FECHA DE VENCIMIENTO.
  //
  // Las modificaciones de vencimiento corresponden a una
  // PRÓRROGA y deben manejarse mediante la entidad prorroga.
  // ============================================================

  async updateObligacion(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', sql.Int, id).query(`
        SELECT *
        FROM obligacion_pago
        WHERE id_obligacion = @id;
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `La obligación de pago con id ${id} no fue encontrada.`,
      );
    }

    throw new BadRequestException(
      'La fecha de vencimiento de una obligación no puede modificarse. Para extender el plazo debe utilizarse una prórroga.',
    );
  }

  // ============================================================
  // HELPER: FORMATEAR FECHA
  // ============================================================

  private formatearFecha(fecha: string | Date): string {
    if (typeof fecha === 'string') {
      return fecha.substring(0, 10);
    }

    const year = fecha.getUTCFullYear();

    const month = String(fecha.getUTCMonth() + 1).padStart(2, '0');

    const day = String(fecha.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // ============================================================
  // HELPER: CALCULAR FECHA MENSUAL
  // ============================================================

  private calcularFechaMensual(fechaInicio: string, meses: number): string {
    const [year, month, day] = fechaInicio.split('-').map(Number);

    const fecha = new Date(Date.UTC(year, month - 1, day));

    fecha.setUTCMonth(fecha.getUTCMonth() + meses);

    // ==========================================================
    // CASO ESPECIAL:
    //
    // Si el grupo inicia un día que no existe en el mes siguiente,
    // JS puede saltar al mes posterior.
    //
    // Ejemplo:
    // 31/01 + 1 mes
    //
    // No queremos obtener 03/03.
    // Queremos el último día de febrero.
    // ==========================================================

    const ultimoDiaMes = new Date(
      Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0),
    ).getUTCDate();

    const diaFinal = Math.min(day, ultimoDiaMes);

    const fechaCorregida = new Date(
      Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), diaFinal),
    );

    return this.formatearFecha(fechaCorregida);
  }

  // ============================================================
  // HELPER: GENERAR PERIODO
  // ============================================================

  private generarPeriodo(fecha: string): string {
    const [year, month] = fecha.split('-').map(Number);

    const nombresMeses = [
      'ENERO',
      'FEBRERO',
      'MARZO',
      'ABRIL',
      'MAYO',
      'JUNIO',
      'JULIO',
      'AGOSTO',
      'SEPTIEMBRE',
      'OCTUBRE',
      'NOVIEMBRE',
      'DICIEMBRE',
    ];

    return `${nombresMeses[month - 1]} ${year}`;
  }
}
