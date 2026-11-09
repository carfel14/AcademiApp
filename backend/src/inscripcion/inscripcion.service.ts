import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as sql from 'mssql';

import { DatabaseService } from 'src/database/database.service';
import { PagoService } from 'src/pago/pago.service';

import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { UpdateInscripcionDto } from './dto/update-inscripcion.dto';

interface DatosGrupo {
  id_grupo: number;
  nombre_grupo: string;
  estado: 'ACTIVO' | 'FINALIZADO' | 'CANCELADO';
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  duracion_meses: number;
  id_curso: number;
}

interface DatosCurso {
  id_curso: number;
  nombre_curso: string;
  precio: number;
  precio_matricula: number;
}

@Injectable()
export class InscripcionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pagoService: PagoService,
  ) {}

  // ============================================================
  // OBTENER TODAS
  // ============================================================

  async getInscripciones() {
    const pool = this.databaseService.getPool();

    const result = await pool.request().query(`
      SELECT
        i.*,
        e.nombres AS nombre_estudiante,
        e.apellidos AS apellido_estudiante,
        g.nombre_grupo,
        c.nombre_curso
      FROM inscripcion i
      INNER JOIN estudiante e
        ON i.id_estudiante = e.id_estudiante
      INNER JOIN grupo g
        ON i.id_grupo = g.id_grupo
      INNER JOIN curso c
        ON g.id_curso = c.id_curso
      ORDER BY i.id_inscripcion DESC;
    `);

    return result.recordset;
  }

  // ============================================================
  // OBTENER UNA
  // ============================================================

  async getInscripcion(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', sql.Int, id).query(`
        SELECT
          i.*,
          e.nombres AS nombre_estudiante,
          e.apellidos AS apellido_estudiante,
          g.nombre_grupo,
          c.nombre_curso
        FROM inscripcion i
        INNER JOIN estudiante e
          ON i.id_estudiante = e.id_estudiante
        INNER JOIN grupo g
          ON i.id_grupo = g.id_grupo
        INNER JOIN curso c
          ON g.id_curso = c.id_curso
        WHERE i.id_inscripcion = @id;
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `La inscripción con id ${id} no fue encontrada.`,
      );
    }

    return result.recordset[0];
  }

  async getInscripcionesPorGrupo(idGrupo: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id_grupo', idGrupo).query(`
      SELECT
        i.id_inscripcion,
        i.id_estudiante,
        i.id_grupo,
        i.fecha_inscripcion,
        i.estado_inscripcion,
        i.observacion,

        e.nombres,
        e.apellidos,

        g.nombre_grupo,

        c.id_curso,
        c.nombre_curso

      FROM inscripcion i

      INNER JOIN estudiante e
        ON i.id_estudiante = e.id_estudiante

      INNER JOIN grupo g
        ON i.id_grupo = g.id_grupo

      INNER JOIN curso c
        ON g.id_curso = c.id_curso

      WHERE i.id_grupo = @id_grupo

      ORDER BY
        e.apellidos,
        e.nombres;
    `);

    return result.recordset;
  }

  // ============================================================
  // CREAR INSCRIPCIÓN
  //
  // Flujo:
  //
  // 1. Validar estudiante
  // 2. Validar grupo
  // 3. Validar fecha
  // 4. Evitar duplicados
  // 5. Obtener curso
  // 6. Crear inscripción
  // 7. Crear obligación de matrícula
  // 8. Pagar automáticamente la matrícula
  // 9. Generar mensualidades
  // 10. COMMIT
  //
  // Todo ocurre dentro de una única transacción.
  // ============================================================

  async createInscripcion(inscripcion: CreateInscripcionDto) {
    const pool = this.databaseService.getPool();

    // ==========================================================
    // VERIFICAR ESTUDIANTE
    // ==========================================================

    const estudiante = await pool
      .request()
      .input('id_estudiante', sql.Int, inscripcion.id_estudiante).query(`
        SELECT
          id_estudiante,
          estado
        FROM estudiante
        WHERE id_estudiante = @id_estudiante;
      `);

    if (estudiante.recordset.length === 0) {
      throw new NotFoundException(
        `El estudiante con id ${inscripcion.id_estudiante} no fue encontrado.`,
      );
    }

    if (estudiante.recordset[0].estado !== 'ACTIVO') {
      throw new BadRequestException(
        'No se puede inscribir un estudiante que no está activo.',
      );
    }

    // ==========================================================
    // OBTENER Y VALIDAR GRUPO
    // ==========================================================

    const grupoResult = await pool
      .request()
      .input('id_grupo', sql.Int, inscripcion.id_grupo).query<DatosGrupo>(`
        SELECT
          g.id_grupo,
          g.nombre_grupo,
          g.estado,
          g.fecha_inicio,
          g.fecha_fin,
          g.duracion_meses,
          g.id_curso
        FROM grupo g
        WHERE g.id_grupo = @id_grupo;
      `);

    if (grupoResult.recordset.length === 0) {
      throw new NotFoundException(
        `El grupo con id ${inscripcion.id_grupo} no fue encontrado.`,
      );
    }

    const grupo = grupoResult.recordset[0];

    if (grupo.estado !== 'ACTIVO') {
      throw new BadRequestException(
        'No se puede inscribir un estudiante en un grupo que no está activo.',
      );
    }

    // ==========================================================
    // VALIDAR DURACIÓN
    // ==========================================================

    if (!grupo.duracion_meses || grupo.duracion_meses <= 0) {
      throw new BadRequestException('El grupo tiene una duración inválida.');
    }

    const duracionMeses = Number(grupo.duracion_meses);

    // ==========================================================
    // VALIDAR FECHA DE INSCRIPCIÓN
    //
    // Permitido:
    // - Antes del inicio
    // - El mismo día del inicio
    //
    // No permitido:
    // - Después del inicio
    // ==========================================================

    const fechaActualResult = await pool.request().query(`
        SELECT CAST(GETDATE() AS DATE) AS fecha_actual;
      `);

    const hoy = this.formatearFecha(
      fechaActualResult.recordset[0].fecha_actual,
    );

    const fechaInicio = this.formatearFecha(grupo.fecha_inicio);

    if (hoy > fechaInicio) {
      throw new BadRequestException(
        'No se puede inscribir un estudiante después de la fecha de inicio del grupo.',
      );
    }

    // ==========================================================
    // VERIFICAR INSCRIPCIÓN DUPLICADA
    // ==========================================================

    const existente = await pool
      .request()
      .input('id_estudiante', sql.Int, inscripcion.id_estudiante)
      .input('id_grupo', sql.Int, inscripcion.id_grupo).query(`
        SELECT
          id_inscripcion
        FROM inscripcion
        WHERE id_estudiante = @id_estudiante
          AND id_grupo = @id_grupo
          AND estado_inscripcion = 'ACTIVA';
      `);

    if (existente.recordset.length > 0) {
      throw new BadRequestException(
        'El estudiante ya está inscrito en este grupo.',
      );
    }

    // ==========================================================
    // OBTENER CURSO
    //
    // Necesitamos:
    // - precio del curso
    // - precio de matrícula
    // ==========================================================

    const cursoResult = await pool
      .request()
      .input('id_curso', sql.Int, grupo.id_curso).query<DatosCurso>(`
        SELECT
          id_curso,
          nombre_curso,
          precio,
          precio_matricula
        FROM curso
        WHERE id_curso = @id_curso;
      `);

    if (cursoResult.recordset.length === 0) {
      throw new NotFoundException(
        `El curso con id ${grupo.id_curso} no fue encontrado.`,
      );
    }

    const curso = cursoResult.recordset[0];

    // ==========================================================
    // VALIDAR PRECIOS
    // ==========================================================

    const precioCurso = Number(curso.precio);
    const precioMatricula = Number(curso.precio_matricula);

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
    // CALCULAR MENSUALIDAD
    // ==========================================================

    const montoMensualidadBase =
      Math.floor((precioCurso / duracionMeses) * 100) / 100;

    const montoMensualidadBaseTotal = montoMensualidadBase * duracionMeses;

    const diferencia =
      Math.round((precioCurso - montoMensualidadBaseTotal) * 100) / 100;

    // ==========================================================
    // TRANSACCIÓN
    // ==========================================================

    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // ========================================================
      // CREAR INSCRIPCIÓN
      // ========================================================

      const inscripcionResult = await transaction.request()
        .input('id_estudiante', sql.Int, inscripcion.id_estudiante)
        .input('id_grupo', sql.Int, inscripcion.id_grupo)
        .input(
          'observacion',
          sql.VarChar(sql.MAX),
          inscripcion.observacion ?? null,
        ).query(`
            INSERT INTO inscripcion (
              id_estudiante,
              id_grupo,
              observacion
            )
            OUTPUT INSERTED.*
            VALUES (
              @id_estudiante,
              @id_grupo,
              @observacion
            );
          `);

      const nuevaInscripcion = inscripcionResult.recordset[0];

      const idInscripcion = nuevaInscripcion.id_inscripcion;

      // ========================================================
      // CREAR OBLIGACIÓN DE MATRÍCULA
      //
      // La matrícula vence el día de inicio del grupo.
      //
      // Ejemplo:
      // Grupo inicia 10/08
      // Matrícula vence 10/08
      // ========================================================

      const matriculaResult = await transaction.request()
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

      const matricula = matriculaResult.recordset[0];

      // ========================================================
      // PAGAR AUTOMÁTICAMENTE LA MATRÍCULA
      //
      // No usamos createPago(), porque necesitamos que el pago
      // pertenezca a esta misma transacción.
      // ========================================================

      const pagoMatricula = await this.pagoService.registrarPagoEnTransaccion(
        transaction,
        matricula.id_obligacion,
        precioMatricula,
        'EFECTIVO',
        'Pago automático de matrícula al realizar la inscripción.',
      );

      const matriculaActualizadaResult = await transaction.request().input('id_obligacion', sql.Int, matricula.id_obligacion).query(`
      SELECT *
      FROM obligacion_pago
      WHERE id_obligacion = @id_obligacion;
    `);

      const matriculaActualizada = matriculaActualizadaResult.recordset[0];

      // ========================================================
      // GENERAR MENSUALIDADES
      //
      // Si inicia 10/08:
      //
      // cuota 1 -> 10/09
      // cuota 2 -> 10/10
      // cuota 3 -> 10/11
      //
      // La fecha de inscripción NO interviene.
      // ========================================================

      const mensualidades: object[] = [];

      for (let numeroCuota = 1; numeroCuota <= duracionMeses; numeroCuota++) {
        const fechaVencimiento = this.calcularFechaMensual(
          fechaInicio,
          numeroCuota,
        );

        const periodo = this.generarPeriodo(fechaVencimiento);

        const esUltimaCuota = numeroCuota === duracionMeses;

        const montoMensualidad = esUltimaCuota
          ? Math.round((montoMensualidadBase + diferencia) * 100) / 100
          : montoMensualidadBase;

        const mensualidadResult = await transaction.request()
          .input('id_inscripcion', sql.Int, idInscripcion)
          .input('tipo_obligacion', sql.VarChar(20), 'MENSUALIDAD')
          .input('numero_cuota', sql.Int, numeroCuota)
          .input('periodo', sql.VarChar(50), periodo)
          .input('fecha_vencimiento', sql.Date, fechaVencimiento)
          .input('monto', sql.Numeric(10, 2), montoMensualidad).query(`
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

        mensualidades.push(mensualidadResult.recordset[0]);
      }

      // ========================================================
      // COMMIT
      // ========================================================

      await transaction.commit();

      // ========================================================
      // RETORNAR RESULTADO
      // ========================================================

      return {
        mensaje:
          'Inscripción creada, matrícula pagada y obligaciones de pago generadas correctamente.',

        inscripcion: nuevaInscripcion,

        curso: {
          id_curso: curso.id_curso,
          nombre_curso: curso.nombre_curso,
          precio: precioCurso,
          precio_matricula: precioMatricula,
        },

        grupo: {
          id_grupo: grupo.id_grupo,
          nombre_grupo: grupo.nombre_grupo,
          fecha_inicio: fechaInicio,
          fecha_fin: this.formatearFecha(grupo.fecha_fin),
          duracion_meses: duracionMeses,
        },

        obligaciones: {
          matricula: matriculaActualizada,
          mensualidades,
          total: 1 + mensualidades.length,
        },

        pago_matricula: pagoMatricula,
      };
    } catch (error) {
      // ========================================================
      // ROLLBACK
      // ========================================================

      if (transaction._aborted === false) {
        await transaction.rollback();
      }

      throw error;
    }
  }

  // ============================================================
  // ACTUALIZAR INSCRIPCIÓN
  // ============================================================

  async updateInscripcion(id: number, inscripcion: UpdateInscripcionDto) {
    const pool = this.databaseService.getPool();

    // ----------------------------------------------------------
    // Verificar existencia
    // ----------------------------------------------------------

    const existente = await pool.request().input('id', sql.Int, id).query(`
        SELECT *
        FROM inscripcion
        WHERE id_inscripcion = @id;
      `);

    if (existente.recordset.length === 0) {
      throw new NotFoundException(
        `La inscripción con id ${id} no fue encontrada.`,
      );
    }

    // ----------------------------------------------------------
    // Solo activas
    // ----------------------------------------------------------

    if (existente.recordset[0].estado_inscripcion !== 'ACTIVA') {
      throw new BadRequestException(
        'No se puede modificar una inscripción que ya fue finalizada o cancelada.',
      );
    }

    // ----------------------------------------------------------
    // Actualizar observación
    // ----------------------------------------------------------

    await pool
      .request()
      .input('id', sql.Int, id)
      .input(
        'observacion',
        sql.VarChar(sql.MAX),
        inscripcion.observacion ?? null,
      ).query(`
        UPDATE inscripcion
        SET observacion = @observacion
        WHERE id_inscripcion = @id;
      `);

    // ----------------------------------------------------------
    // Obtener actualizada
    // ----------------------------------------------------------

    const actualizado = await pool.request().input('id', sql.Int, id).query(`
        SELECT
          i.*,
          e.nombres AS nombre_estudiante,
          e.apellidos AS apellido_estudiante,
          g.nombre_grupo,
          c.nombre_curso
        FROM inscripcion i
        INNER JOIN estudiante e
          ON i.id_estudiante = e.id_estudiante
        INNER JOIN grupo g
          ON i.id_grupo = g.id_grupo
        INNER JOIN curso c
          ON g.id_curso = c.id_curso
        WHERE i.id_inscripcion = @id;
      `);

    return actualizado.recordset[0];
  }

  // ============================================================
  // CANCELAR INSCRIPCIÓN
  // ============================================================

  async deleteInscripcion(id: number) {
    const pool = this.databaseService.getPool();

    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // ==========================================================
      // VERIFICAR INSCRIPCIÓN
      // ==========================================================

      const inscripcionResult = await transaction.request().input(
        'id_inscripcion',
        sql.Int,
        id,
      ).query(`
          SELECT
            id_inscripcion,
            estado_inscripcion
          FROM inscripcion
          WHERE id_inscripcion = @id_inscripcion;
        `);

      if (inscripcionResult.recordset.length === 0) {
        throw new NotFoundException(
          `La inscripción con id ${id} no fue encontrada.`,
        );
      }

      const inscripcion = inscripcionResult.recordset[0];

      if (inscripcion.estado_inscripcion !== 'ACTIVA') {
        throw new BadRequestException(
          'La inscripción ya fue finalizada o cancelada.',
        );
      }

      // ==========================================================
      // VERIFICAR PAGOS DE MENSUALIDADES
      //
      // IMPORTANTE:
      //
      // El pago de matrícula NO impide cancelar.
      //
      // Solamente los pagos asociados a una MENSUALIDAD
      // bloquean la cancelación.
      // ==========================================================

      const pagosMensualidadResult = await transaction.request().input(
        'id_inscripcion',
        sql.Int,
        id,
      ).query(`
          SELECT
            COUNT(*) AS cantidad_pagos
          FROM pago p

          INNER JOIN obligacion_pago o
            ON p.id_obligacion = o.id_obligacion

          WHERE o.id_inscripcion = @id_inscripcion
            AND o.tipo_obligacion = 'MENSUALIDAD';
        `);

      const cantidadPagosMensualidad = Number(
        pagosMensualidadResult.recordset[0].cantidad_pagos,
      );

      if (cantidadPagosMensualidad > 0) {
        throw new BadRequestException(
          'No se puede cancelar la inscripción porque existen pagos registrados en una o más mensualidades.',
        );
      }

      // ==========================================================
      // ANULAR MENSUALIDADES
      //
      // La matrícula NO se toca.
      //
      // Matrícula:
      // PAGADA
      //
      // Mensualidades:
      // PENDIENTE -> ANULADA
      // ==========================================================

      await transaction.request().input('id_inscripcion', sql.Int, id)
        .query(`
        UPDATE obligacion_pago
        SET estado = 'ANULADA'
        WHERE id_inscripcion = @id_inscripcion
          AND tipo_obligacion = 'MENSUALIDAD'
          AND estado = 'PENDIENTE';
      `);

      // ==========================================================
      // CANCELAR INSCRIPCIÓN
      // ==========================================================

      const cancelacionResult = await transaction.request().input(
        'id_inscripcion',
        sql.Int,
        id,
      ).query(`
          UPDATE inscripcion
          SET estado_inscripcion = 'CANCELADA'
          OUTPUT INSERTED.*
          WHERE id_inscripcion = @id_inscripcion
            AND estado_inscripcion = 'ACTIVA';
        `);

      if (cancelacionResult.recordset.length === 0) {
        throw new BadRequestException(
          'La inscripción ya no se encuentra activa.',
        );
      }

      // ==========================================================
      // COMMIT
      // ==========================================================

      await transaction.commit();

      return {
        mensaje: 'Inscripción cancelada correctamente.',
        inscripcion: cancelacionResult.recordset[0],
      };
    } catch (error) {
      // ==========================================================
      // ROLLBACK
      // ==========================================================

      if (transaction._aborted === false) {
        await transaction.rollback();
      }

      throw error;
    }
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
  //
  // Ejemplo:
  //
  // inicio = 2026-08-10
  //
  // meses = 1 -> 2026-09-10
  // meses = 2 -> 2026-10-10
  // meses = 3 -> 2026-11-10
  // ============================================================

  private calcularFechaMensual(fechaInicio: string, meses: number): string {
    const [year, month, day] = fechaInicio.split('-').map(Number);

    const fecha = new Date(Date.UTC(year, month - 1, 1));

    fecha.setUTCMonth(fecha.getUTCMonth() + meses);

    const ultimoDiaMes = new Date(
      Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0),
    ).getUTCDate();

    fecha.setUTCDate(Math.min(day, ultimoDiaMes));

    return this.formatearFecha(fecha);
  }

  // ============================================================
  // HELPER: GENERAR PERIODO
  //
  // 2026-09-10 -> SEPTIEMBRE 2026
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
