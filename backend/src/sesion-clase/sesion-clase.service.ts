import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Transaction } from 'mssql';
import { DatabaseService } from 'src/database/database.service';

import { CreateSesionClaseDto } from './dto/create-sesion-clase.dto';
import { UpdateSesionClaseDto } from './dto/update-sesion-clase.dto';

// ============================================================
// TIPOS INTERNOS
// ============================================================

interface GrupoSesion {
  id_grupo: number;
  estado: 'ACTIVO' | 'FINALIZADO' | 'CANCELADO';
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
}

interface HorarioGrupo {
  id_horario: number;
  dia_semana: string;
  hora_inicio: string | Date;
  hora_fin: string | Date;
}

interface EvaluacionSesion {
  id_evaluacion: number;
  tipo_evaluacion: string;
}

interface ResultadoEvaluacion {
  id_inscripcion: number;
  nota: number | null;
  estado_resultado: 'CALIFICADO' | 'NO_SE_PRESENTO';
}

interface AsistenciaSesion {
  id_inscripcion: number;
  estado_asistencia:
    'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO' | 'SUSPENDIDO_POR_MORA';
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class SesionClaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // OBTENER TODAS
  // ============================================================

  async getSesiones() {
    const pool = this.databaseService.getPool();

    const result = await pool.request().query(`
      SELECT
        s.*,
        g.nombre_grupo,
        h.dia_semana
      FROM sesion_clase s
      INNER JOIN grupo g
        ON s.id_grupo = g.id_grupo
      LEFT JOIN horario_clase h
        ON s.id_horario = h.id_horario
      ORDER BY
        s.fecha_programada,
        s.hora_inicio;
    `);

    return result.recordset;
  }

  // ============================================================
  // OBTENER UNA
  // ============================================================

  async getSesion(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', id).query(`
        SELECT
          s.*,
          g.nombre_grupo,
          h.dia_semana
        FROM sesion_clase s
        INNER JOIN grupo g
          ON s.id_grupo = g.id_grupo
        LEFT JOIN horario_clase h
          ON s.id_horario = h.id_horario
        WHERE s.id_sesion = @id;
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(`La sesión con id ${id} no fue encontrada.`);
    }

    return result.recordset[0];
  }

  async getSesionesPorGrupo(idGrupo: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id_grupo', idGrupo).query(`
      SELECT
        s.id_sesion,
        s.id_grupo,
        s.id_horario,
        s.fecha_programada,
        s.hora_inicio,
        s.hora_fin,
        s.estado_sesion,
        s.tema,
        s.observacion,

        g.nombre_grupo,

        c.id_curso,
        c.nombre_curso

      FROM sesion_clase s

      INNER JOIN grupo g
        ON s.id_grupo = g.id_grupo

      INNER JOIN curso c
        ON g.id_curso = c.id_curso

      WHERE s.id_grupo = @id_grupo

      ORDER BY
        s.fecha_programada,
        s.hora_inicio;
    `);

    return result.recordset;
  }

  // ============================================================
  // CREAR SESIÓN MANUAL / EXTRACURRICULAR
  // ============================================================

  async createSesion(sesion: CreateSesionClaseDto) {
    return this.databaseService.transaction(async (tx) => {
      // ----------------------------------------------------------
      // Verificar grupo
      // ----------------------------------------------------------

      const grupo = await tx.request().input('id_grupo', sesion.id_grupo)
        .query<GrupoSesion>(`
        SELECT
          id_grupo,
          estado,
          fecha_inicio,
          fecha_fin
        FROM grupo WITH (UPDLOCK, HOLDLOCK)
        WHERE id_grupo = @id_grupo;
      `);

      if (grupo.recordset.length === 0) {
        throw new NotFoundException(
          `El grupo con id ${sesion.id_grupo} no fue encontrado.`,
        );
      }

      const grupoActual = grupo.recordset[0];

      if (grupoActual.estado !== 'ACTIVO') {
        throw new BadRequestException(
          'No se puede crear una sesión para un grupo que no está activo.',
        );
      }

      // ----------------------------------------------------------
      // Verificar fecha dentro del período del grupo
      // ----------------------------------------------------------

      const fechaSesion = this.crearFechaUTC(sesion.fecha_programada);

      const fechaInicio = this.crearFechaUTC(
        this.formatearFechaDesdeValor(grupoActual.fecha_inicio),
      );

      const fechaFin = this.crearFechaUTC(
        this.formatearFechaDesdeValor(grupoActual.fecha_fin),
      );

      if (fechaSesion < fechaInicio) {
        throw new BadRequestException(
          'La fecha de la sesión no puede ser anterior a la fecha de inicio del grupo.',
        );
      }

      if (fechaSesion > fechaFin) {
        throw new BadRequestException(
          'La fecha de la sesión no puede ser posterior a la fecha de finalización del grupo.',
        );
      }

      // ----------------------------------------------------------
      // Verificar horario
      // ----------------------------------------------------------

      if (sesion.id_horario != null) {
        const horario = await tx
          .request()
          .input('id_horario', sesion.id_horario)
          .input('id_grupo', sesion.id_grupo).query(`
          SELECT
            id_horario,
            id_grupo,
            dia_semana,
            hora_inicio,
            hora_fin
          FROM horario_clase
          WHERE id_horario = @id_horario
            AND id_grupo = @id_grupo;
        `);

        if (horario.recordset.length === 0) {
          throw new BadRequestException(
            'El horario indicado no pertenece al grupo.',
          );
        }
      }

      if (
        sesion.hora_inicio.padEnd(8, ':00') >= sesion.hora_fin.padEnd(8, ':00')
      ) {
        throw new BadRequestException(
          'La hora de inicio debe ser menor que la hora de fin.',
        );
      }

      // ----------------------------------------------------------
      // Verificar solapamiento
      // ----------------------------------------------------------

      const conflicto = await tx
        .request()
        .input('id_grupo', sesion.id_grupo)
        .input('fecha_programada', sesion.fecha_programada)
        .input('hora_inicio', sesion.hora_inicio)
        .input('hora_fin', sesion.hora_fin).query(`
        SELECT id_sesion
        FROM sesion_clase
        WHERE id_grupo = @id_grupo
          AND fecha_programada = @fecha_programada
          AND hora_inicio < CAST(@hora_fin AS TIME)
          AND hora_fin > CAST(@hora_inicio AS TIME)
          AND estado_sesion <> 'CANCELADA';
      `);

      if (conflicto.recordset.length > 0) {
        throw new BadRequestException(
          'Ya existe una sesión que se solapa con este horario.',
        );
      }

      // ----------------------------------------------------------
      // Crear sesión
      // ----------------------------------------------------------

      const result = await tx
        .request()
        .input('id_grupo', sesion.id_grupo)
        .input('id_horario', sesion.id_horario ?? null)
        .input('fecha_programada', sesion.fecha_programada)
        .input('hora_inicio', sesion.hora_inicio)
        .input('hora_fin', sesion.hora_fin)
        .input('tema', sesion.tema ?? null)
        .input('observacion', sesion.observacion ?? null).query(`
        INSERT INTO sesion_clase (
          id_grupo,
          id_horario,
          fecha_programada,
          hora_inicio,
          hora_fin,
          tema,
          observacion
        )
        OUTPUT INSERTED.*
        VALUES (
          @id_grupo,
          @id_horario,
          @fecha_programada,
          CAST(@hora_inicio AS TIME),
          CAST(@hora_fin AS TIME),
          @tema,
          @observacion
        );
      `);

      return result.recordset[0];
    });
  }

  async generarSesiones(idGrupo: number) {
    return this.databaseService.transaction(async (tx) => {
      const grupo = (
        await tx.request().input('grupo', idGrupo).query<GrupoSesion>(`
        SELECT id_grupo, estado, fecha_inicio, fecha_fin
        FROM grupo WITH (UPDLOCK, HOLDLOCK) WHERE id_grupo = @grupo
      `)
      ).recordset[0];
      if (!grupo) throw new NotFoundException('El grupo no existe.');
      if (grupo.estado !== 'ACTIVO')
        throw new BadRequestException('El grupo debe estar activo.');
      const horarios = (
        await tx.request().input('grupo', idGrupo).query<HorarioGrupo>(`
        SELECT id_horario, dia_semana, hora_inicio, hora_fin FROM horario_clase WHERE id_grupo = @grupo
      `)
      ).recordset;
      if (!horarios.length)
        throw new BadRequestException('Agrega un horario semanal al grupo.');
      const fechaInicio = this.formatearFechaDesdeValor(grupo.fecha_inicio);
      const fechaFin = this.formatearFechaDesdeValor(grupo.fecha_fin);
      const result = await tx.request().input('grupo', idGrupo).query(`
        DECLARE @inicio date, @fin date;
        SELECT @inicio = fecha_inicio, @fin = fecha_fin FROM grupo WHERE id_grupo = @grupo;
        ;WITH fechas AS (
          SELECT @inicio AS fecha
          UNION ALL SELECT DATEADD(day, 1, fecha) FROM fechas WHERE fecha < @fin
        )
        INSERT INTO sesion_clase (id_grupo, id_horario, fecha_programada, hora_inicio, hora_fin)
        OUTPUT INSERTED.*
        SELECT h.id_grupo, h.id_horario, f.fecha, h.hora_inicio, h.hora_fin
        FROM fechas f JOIN horario_clase h ON h.id_grupo = @grupo
          AND h.dia_semana = CHOOSE((DATEDIFF(day, '19000101', f.fecha) % 7 + 7) % 7 + 1,
            'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO')
        WHERE NOT EXISTS (
          SELECT 1 FROM sesion_clase s WHERE s.id_grupo = @grupo AND s.fecha_programada = f.fecha
            AND (s.id_horario = h.id_horario OR (s.estado_sesion <> 'CANCELADA'
              AND s.hora_inicio < h.hora_fin AND s.hora_fin > h.hora_inicio))
        )
        OPTION (MAXRECURSION 0);
      `);
      const total = (
        await tx.request().input('grupo', idGrupo).query(`
        SELECT COUNT(*) AS total FROM sesion_clase WHERE id_grupo = @grupo AND id_horario IS NOT NULL
      `)
      ).recordset[0].total;
      return {
        mensaje: 'Calendario de sesiones actualizado.',
        sesiones_existentes: total - result.recordset.length,
        sesiones_creadas: result.recordset.length,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        sesiones: result.recordset,
      };
    });
  }

  async updateSesion(id: number, sesion: UpdateSesionClaseDto) {
    const { id_grupo } = await this.getSesion(id);
    return this.databaseService.transaction(async (tx) => {
      await tx.request().input('grupo', id_grupo).query(`
      SELECT id_grupo FROM grupo WITH (UPDLOCK, HOLDLOCK) WHERE id_grupo = @grupo
    `);

      // ----------------------------------------------------------
      // Obtener sesión
      // ----------------------------------------------------------

      const existente = await tx.request().input('id', id).query(`
        SELECT
          *
        FROM sesion_clase WITH (UPDLOCK, HOLDLOCK)
        WHERE id_sesion = @id;
      `);

      if (existente.recordset.length === 0) {
        throw new NotFoundException(
          `La sesión con id ${id} no fue encontrada.`,
        );
      }

      const actual = existente.recordset[0];

      // ----------------------------------------------------------
      // Solo sesiones programadas
      // ----------------------------------------------------------

      if (actual.estado_sesion !== 'PROGRAMADA') {
        throw new BadRequestException(
          'Solo se pueden modificar sesiones que están programadas.',
        );
      }

      // ----------------------------------------------------------
      // Obtener grupo
      // ----------------------------------------------------------

      const grupo = await tx.request().input('id_grupo', actual.id_grupo)
        .query<GrupoSesion>(`
        SELECT
          id_grupo,
          estado,
          fecha_inicio,
          fecha_fin
        FROM grupo
        WHERE id_grupo = @id_grupo;
      `);

      if (grupo.recordset.length === 0) {
        throw new NotFoundException(
          `El grupo con id ${actual.id_grupo} no fue encontrado.`,
        );
      }

      const grupoActual = grupo.recordset[0];

      // ----------------------------------------------------------
      // Mantener valores actuales
      // ----------------------------------------------------------

      const fechaProgramada =
        sesion.fecha_programada ??
        this.formatearFechaDesdeValor(actual.fecha_programada);

      if (
        fechaProgramada !==
        this.formatearFechaDesdeValor(actual.fecha_programada)
      ) {
        const historial = await tx.request().input('id', id).query(`
        SELECT id_asistencia FROM asistencia WHERE id_sesion = @id
      `);
        if (historial.recordset.length)
          throw new BadRequestException(
            'La fecha no puede cambiar porque ya se registró la asistencia.',
          );
      }

      const horaInicio =
        sesion.hora_inicio ?? this.formatearHora(actual.hora_inicio);

      const horaFin = sesion.hora_fin ?? this.formatearHora(actual.hora_fin);

      const tema = sesion.tema !== undefined ? sesion.tema : actual.tema;

      const observacion =
        sesion.observacion !== undefined
          ? sesion.observacion
          : actual.observacion;

      // ----------------------------------------------------------
      // Verificar fecha dentro del grupo
      // ----------------------------------------------------------

      const fechaSesion = this.crearFechaUTC(fechaProgramada);

      const fechaInicio = this.crearFechaUTC(
        this.formatearFechaDesdeValor(grupoActual.fecha_inicio),
      );

      const fechaFin = this.crearFechaUTC(
        this.formatearFechaDesdeValor(grupoActual.fecha_fin),
      );

      if (fechaSesion < fechaInicio || fechaSesion > fechaFin) {
        throw new BadRequestException(
          'La fecha de la sesión debe estar dentro del período del grupo.',
        );
      }

      // ----------------------------------------------------------
      // Verificar hora
      // ----------------------------------------------------------

      if (horaInicio.padEnd(8, ':00') >= horaFin.padEnd(8, ':00')) {
        throw new BadRequestException(
          'La hora de inicio debe ser menor que la hora de fin.',
        );
      }

      // ----------------------------------------------------------
      // Verificar solapamiento
      // ----------------------------------------------------------

      const conflicto = await tx
        .request()
        .input('id', id)
        .input('id_grupo', actual.id_grupo)
        .input('fecha_programada', fechaProgramada)
        .input('hora_inicio', horaInicio)
        .input('hora_fin', horaFin).query(`
        SELECT id_sesion
        FROM sesion_clase
        WHERE id_grupo = @id_grupo
          AND fecha_programada = @fecha_programada
          AND hora_inicio < CAST(@hora_fin AS TIME)
          AND hora_fin > CAST(@hora_inicio AS TIME)
          AND id_sesion <> @id
          AND estado_sesion <> 'CANCELADA';
      `);

      if (conflicto.recordset.length > 0) {
        throw new BadRequestException(
          'La sesión se solapa con otra sesión del mismo grupo.',
        );
      }

      // ----------------------------------------------------------
      // Actualizar
      // ----------------------------------------------------------

      await tx
        .request()
        .input('id', id)
        .input('fecha_programada', fechaProgramada)
        .input('hora_inicio', horaInicio)
        .input('hora_fin', horaFin)
        .input('tema', tema)
        .input('observacion', observacion).query(`
        UPDATE sesion_clase
        SET
          fecha_programada = @fecha_programada,
          hora_inicio = CAST(@hora_inicio AS TIME),
          hora_fin = CAST(@hora_fin AS TIME),
          tema = @tema,
          observacion = @observacion
        WHERE id_sesion = @id;
      `);

      // ----------------------------------------------------------
      // Obtener actualizado
      // ----------------------------------------------------------

      const actualizado = await tx.request().input('id', id).query(`
        SELECT *
        FROM sesion_clase
        WHERE id_sesion = @id;
      `);

      return actualizado.recordset[0];
    });
  }

  async cancelarSesion(id: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.request().input('id', id).query(`
        UPDATE sesion_clase
        SET estado_sesion = 'CANCELADA'
        OUTPUT INSERTED.*
        WHERE id_sesion = @id
          AND estado_sesion = 'PROGRAMADA';
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundException(
        `La sesión con id ${id} no fue encontrada o ya no está programada.`,
      );
    }

    return result.recordset[0];
  }

  // ============================================================
  // MARCAR COMO REALIZADA
  // ============================================================

  async finalizarSesion(id: number) {
    return this.databaseService.transaction(async (tx) => {
      // ----------------------------------------------------------
      // Obtener sesión
      // ----------------------------------------------------------

      const sesion = await tx.request().input('id_sesion', id).query(`
        SELECT
          id_sesion,
          id_grupo,
          estado_sesion,
          fecha_programada
        FROM sesion_clase WITH (UPDLOCK, HOLDLOCK)
        WHERE id_sesion = @id_sesion;
      `);

      if (sesion.recordset.length === 0) {
        throw new NotFoundException(
          `La sesión con id ${id} no fue encontrada.`,
        );
      }

      const sesionActual = sesion.recordset[0];

      // ----------------------------------------------------------
      // Solo programadas
      // ----------------------------------------------------------

      if (sesionActual.estado_sesion !== 'PROGRAMADA') {
        throw new BadRequestException(
          'Solo se puede finalizar una sesión que está programada.',
        );
      }

      // ----------------------------------------------------------
      // Validar asistencias
      // ----------------------------------------------------------

      await this.validarAsistenciasCompletas(
        id,
        sesionActual.id_grupo,
        sesionActual.fecha_programada,
        tx,
      );

      // ----------------------------------------------------------
      // Validar evaluaciones
      // ----------------------------------------------------------

      await this.validarEvaluacionesCompletas(
        id,
        sesionActual.id_grupo,
        sesionActual.fecha_programada,
        tx,
      );

      // ----------------------------------------------------------
      // Marcar como realizada
      // ----------------------------------------------------------

      const result = await tx.request().input('id_sesion', id).query(`
        UPDATE sesion_clase
        SET estado_sesion = 'REALIZADA'
        OUTPUT INSERTED.*
        WHERE id_sesion = @id_sesion
          AND estado_sesion = 'PROGRAMADA';
      `);

      if (result.recordset.length === 0) {
        throw new BadRequestException('La sesión no pudo ser finalizada.');
      }

      return {
        mensaje: 'Sesión finalizada correctamente.',
        sesion: result.recordset[0],
      };
    });
  }

  // ============================================================
  // VALIDAR ASISTENCIAS COMPLETAS
  // ============================================================

  private async validarAsistenciasCompletas(
    idSesion: number,
    idGrupo: number,
    fecha: Date,
    tx: Transaction,
  ): Promise<void> {
    // ----------------------------------------------------------
    // Inscripciones activas
    // ----------------------------------------------------------

    const inscripcionesResult = await tx
      .request()
      .input('id_grupo', idGrupo)
      .input('fecha', fecha)
      .input('sesion', idSesion).query<{ id_inscripcion: number }>(`
          SELECT
            i.id_inscripcion
          FROM inscripcion i
          WHERE i.id_grupo = @id_grupo
            AND ((i.estado_inscripcion = 'ACTIVA' AND i.fecha_inscripcion <= @fecha)
              OR EXISTS (SELECT 1 FROM asistencia a WHERE a.id_sesion = @sesion AND a.id_inscripcion = i.id_inscripcion));
        `);

    const idsInscripciones = inscripcionesResult.recordset.map(
      (inscripcion) => inscripcion.id_inscripcion,
    );

    const idsInscripcionesSet = new Set(idsInscripciones);

    // ----------------------------------------------------------
    // Asistencias
    // ----------------------------------------------------------

    const asistenciasResult = await tx.request().input('id_sesion', idSesion)
      .query<AsistenciaSesion>(`
          SELECT
            id_inscripcion,
            estado_asistencia
          FROM asistencia
          WHERE id_sesion = @id_sesion;
        `);

    const asistencias = asistenciasResult.recordset;

    // ----------------------------------------------------------
    // Verificar asistencias inválidas
    // ----------------------------------------------------------

    for (const asistencia of asistencias) {
      if (!idsInscripcionesSet.has(asistencia.id_inscripcion)) {
        throw new BadRequestException(
          `La asistencia pertenece a la inscripción ${asistencia.id_inscripcion}, que no está activa en el grupo.`,
        );
      }
    }

    // ----------------------------------------------------------
    // Detectar faltantes
    // ----------------------------------------------------------

    const idsConAsistencia = new Set(
      asistencias.map((asistencia) => asistencia.id_inscripcion),
    );

    const faltantes = idsInscripciones.filter(
      (idInscripcion) => !idsConAsistencia.has(idInscripcion),
    );

    if (faltantes.length > 0) {
      throw new BadRequestException(
        `No se puede finalizar la sesión. Faltan asistencias para las inscripciones: ${faltantes.join(', ')}.`,
      );
    }

    // ----------------------------------------------------------
    // Estados válidos
    // ----------------------------------------------------------

    const estadosValidos = [
      'PRESENTE',
      'AUSENTE',
      'JUSTIFICADO',
      'SUSPENDIDO_POR_MORA',
    ];

    for (const asistencia of asistencias) {
      if (!estadosValidos.includes(asistencia.estado_asistencia)) {
        throw new BadRequestException(
          `La asistencia de la inscripción ${asistencia.id_inscripcion} tiene un estado inválido.`,
        );
      }
    }
  }

  // ============================================================
  // VALIDAR EVALUACIONES COMPLETAS
  // ============================================================

  private async validarEvaluacionesCompletas(
    idSesion: number,
    idGrupo: number,
    fecha: Date,
    tx: Transaction,
  ): Promise<void> {
    // ----------------------------------------------------------
    // Evaluaciones de la sesión
    // ----------------------------------------------------------

    const evaluacionesResult = await tx.request().input('id_sesion', idSesion)
      .query<EvaluacionSesion>(`
          SELECT
            id_evaluacion,
            tipo_evaluacion
          FROM evaluacion
          WHERE id_sesion = @id_sesion;
        `);

    const evaluaciones = evaluacionesResult.recordset;

    if (evaluaciones.length === 0) {
      return;
    }

    // ----------------------------------------------------------
    // Inscripciones activas
    // ----------------------------------------------------------

    const inscripcionesResult = await tx
      .request()
      .input('id_grupo', idGrupo)
      .input('fecha', fecha)
      .input('sesion', idSesion).query<{ id_inscripcion: number }>(`
          SELECT
            i.id_inscripcion
          FROM inscripcion i
          WHERE i.id_grupo = @id_grupo
            AND ((i.estado_inscripcion = 'ACTIVA' AND i.fecha_inscripcion <= @fecha)
              OR EXISTS (SELECT 1 FROM asistencia a WHERE a.id_sesion = @sesion AND a.id_inscripcion = i.id_inscripcion));
        `);

    const idsInscripciones = inscripcionesResult.recordset.map(
      (inscripcion) => inscripcion.id_inscripcion,
    );

    const idsInscripcionesSet = new Set(idsInscripciones);

    // ----------------------------------------------------------
    // Asistencias
    // ----------------------------------------------------------

    const asistenciasResult = await tx.request().input('id_sesion', idSesion)
      .query<AsistenciaSesion>(`
          SELECT
            id_inscripcion,
            estado_asistencia
          FROM asistencia
          WHERE id_sesion = @id_sesion;
        `);

    const asistenciasPorInscripcion = new Map<
      number,
      AsistenciaSesion['estado_asistencia']
    >(
      asistenciasResult.recordset.map((asistencia) => [
        asistencia.id_inscripcion,
        asistencia.estado_asistencia,
      ]),
    );

    // ----------------------------------------------------------
    // Validar cada evaluación
    // ----------------------------------------------------------

    for (const evaluacion of evaluaciones) {
      const resultadosResult = await tx
        .request()
        .input('id_evaluacion', evaluacion.id_evaluacion)
        .query<ResultadoEvaluacion>(`
            SELECT
              id_inscripcion,
              nota,
              estado_resultado
            FROM resultado_evaluacion
            WHERE id_evaluacion = @id_evaluacion;
          `);

      const resultados = resultadosResult.recordset;

      const resultadosPorInscripcion = new Map<number, ResultadoEvaluacion>(
        resultados.map((resultado) => [resultado.id_inscripcion, resultado]),
      );

      // --------------------------------------------------------
      // Resultados inválidos
      // --------------------------------------------------------

      for (const resultado of resultados) {
        if (!idsInscripcionesSet.has(resultado.id_inscripcion)) {
          throw new BadRequestException(
            `La evaluación ${evaluacion.id_evaluacion} contiene un resultado para la inscripción ${resultado.id_inscripcion}, que no está activa en el grupo.`,
          );
        }
      }

      // --------------------------------------------------------
      // Faltantes
      // --------------------------------------------------------

      const faltantes = idsInscripciones.filter(
        (idInscripcion) => !resultadosPorInscripcion.has(idInscripcion),
      );

      if (faltantes.length > 0) {
        throw new BadRequestException(
          `No se puede finalizar la sesión. La evaluación ${evaluacion.id_evaluacion} no tiene resultado para las inscripciones: ${faltantes.join(', ')}.`,
        );
      }

      // --------------------------------------------------------
      // Validar cada resultado
      // --------------------------------------------------------

      for (const idInscripcion of idsInscripciones) {
        const resultado = resultadosPorInscripcion.get(idInscripcion);

        if (!resultado) {
          continue;
        }

        const estadoAsistencia = asistenciasPorInscripcion.get(idInscripcion);

        if (!estadoAsistencia) {
          throw new BadRequestException(
            `No existe asistencia para la inscripción ${idInscripcion}.`,
          );
        }

        // ------------------------------------------------------
        // NO PRESENTE
        // ------------------------------------------------------

        if (estadoAsistencia !== 'PRESENTE') {
          if (
            resultado.estado_resultado !== 'NO_SE_PRESENTO' ||
            resultado.nota !== null
          ) {
            throw new BadRequestException(
              `La inscripción ${idInscripcion} no estuvo presente y debe tener resultado NO_SE_PRESENTO con nota NULL en la evaluación ${evaluacion.id_evaluacion}.`,
            );
          }
        }

        // ------------------------------------------------------
        // PRESENTE
        // ------------------------------------------------------

        if (estadoAsistencia === 'PRESENTE') {
          if (resultado.estado_resultado !== 'CALIFICADO') {
            throw new BadRequestException(
              `La inscripción ${idInscripcion} estuvo presente y debe tener un resultado CALIFICADO en la evaluación ${evaluacion.id_evaluacion}.`,
            );
          }

          if (resultado.nota === null || resultado.nota === undefined) {
            throw new BadRequestException(
              `La inscripción ${idInscripcion} estuvo presente pero no tiene nota en la evaluación ${evaluacion.id_evaluacion}.`,
            );
          }

          if (resultado.nota < 0 || resultado.nota > 100) {
            throw new BadRequestException(
              `La nota de la inscripción ${idInscripcion} debe estar entre 0 y 100.`,
            );
          }
        }
      }
    }
  }

  // ============================================================
  // HELPER: DÍA DE LA SEMANA
  private formatearFecha(fecha: Date): string {
    const year = fecha.getUTCFullYear();

    const month = String(fecha.getUTCMonth() + 1).padStart(2, '0');

    const day = String(fecha.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // ============================================================
  // HELPER: CREAR FECHA UTC
  // ============================================================

  private crearFechaUTC(fecha: string): Date {
    const [year, month, day] = fecha.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day));
  }

  // ============================================================
  // HELPER: OBTENER FECHA YYYY-MM-DD
  // ============================================================

  private formatearFechaDesdeValor(valor: string | Date): string {
    if (typeof valor === 'string') {
      return valor.substring(0, 10);
    }

    return this.formatearFecha(valor);
  }

  // ============================================================
  // HELPER: FORMATEAR HORA
  // ============================================================

  private formatearHora(hora: any): string {
    // SQL Server TIME puede llegar como Date
    // dependiendo de mssql/tedious.

    if (hora instanceof Date) {
      const hours = String(hora.getUTCHours()).padStart(2, '0');

      const minutes = String(hora.getUTCMinutes()).padStart(2, '0');

      return `${hours}:${minutes}`;
    }

    if (typeof hora === 'string') {
      return hora.substring(0, 5);
    }

    return hora;
  }
}
