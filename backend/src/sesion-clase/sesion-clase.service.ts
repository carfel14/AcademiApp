import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import type { Transaction } from 'mssql';
import {
  DIA_SEMANA,
  FECHA_FIN_ESTIMADA,
  HORA,
  fechaISO,
} from 'src/database/consultas';
import { DatabaseService } from 'src/database/database.service';
import { CreateContenidoDto, UpdateContenidoDto } from './dto/contenido.dto';
import { CreateSesionClaseDto } from './dto/create-sesion-clase.dto';
import { GenerarSesionesDto } from './dto/generar-sesiones.dto';
import { UpdateSesionClaseDto } from './dto/update-sesion-clase.dto';

interface GrupoSesion {
  id_grupo: number;
  estado: 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
  fecha_inicio: string | Date;
  fecha_fin_estimada: string | Date;
}

interface ResultadoEvaluacion {
  id_inscripcion: number;
  nota: number | null;
  estado_resultado: 'CALIFICADO' | 'NO_SE_PRESENTO';
}

interface AsistenciaSesion {
  id_inscripcion: number;
  estado_asistencia:
    'PRESENTE' | 'AUSENTE' | 'JUSTIFICADA' | 'SUSPENDIDO_POR_MORA';
}

const SELECT_SESION = `
  SELECT s.id_sesion, s.id_grupo, s.fecha_programada,
    ${HORA('s.hora_inicio')}, ${HORA('s.hora_finalizacion')},
    s.tipo_sesion, s.estado, s.observacion,
    g.nombre AS grupo, p.id_curso, c.nombre AS curso,
    ${DIA_SEMANA('s.fecha_programada')} AS dia_semana,
    (SELECT COUNT(*) FROM PROGRAMACION_CONTENIDO pc WHERE pc.id_sesion = s.id_sesion) AS total_contenidos
  FROM SESION_CLASE s
  JOIN GRUPO g ON g.id_grupo = s.id_grupo
  JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
  JOIN CURSO c ON c.id_curso = p.id_curso`;

const SELECT_CONTENIDO = `
  SELECT pc.*, t.nombre AS tema, t.orden, t.modalidad, t.horas_estimadas,
    u.id_unidad, u.nombre AS unidad, u.orden AS orden_unidad
  FROM PROGRAMACION_CONTENIDO pc
  JOIN TEMA_ESTUDIO t ON t.id_tema = pc.id_tema
  JOIN UNIDAD_ESTUDIO u ON u.id_unidad = t.id_unidad`;

@Injectable()
export class SesionClaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSesiones() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_SESION} ORDER BY s.fecha_programada, s.hora_inicio
    `);
    return result.recordset;
  }

  async getSesion(
    id: number,
    request = this.databaseService.getPool().request(),
  ) {
    const result = await request.input('id', sql.Int, id).query(`
      ${SELECT_SESION} WHERE s.id_sesion = @id
    `);
    if (!result.recordset.length)
      throw new NotFoundException(`La sesión con id ${id} no fue encontrada.`);
    return result.recordset[0];
  }

  async getSesionesPorGrupo(idGrupo: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id_grupo', sql.Int, idGrupo).query(`
        ${SELECT_SESION} WHERE s.id_grupo = @id_grupo
        ORDER BY s.fecha_programada, s.hora_inicio
      `);
    return result.recordset;
  }

  // ============================================================
  // CREAR SESIÓN MANUAL / EXTRACURRICULAR
  // ============================================================

  async createSesion(sesion: CreateSesionClaseDto) {
    return this.databaseService.transaction(async (tx) => {
      const grupo = await this.bloquearGrupo(tx, sesion.id_grupo);
      this.validarPeriodo(grupo, sesion.fecha_programada);
      this.validarHoras(sesion.hora_inicio, sesion.hora_finalizacion);
      await this.validarSolapamiento(
        tx,
        sesion.id_grupo,
        sesion.fecha_programada,
        sesion.hora_inicio,
        sesion.hora_finalizacion,
      );

      const result = await tx
        .request()
        .input('id_grupo', sql.Int, sesion.id_grupo)
        .input('fecha', sql.VarChar(10), sesion.fecha_programada)
        .input('inicio', sql.VarChar(8), sesion.hora_inicio)
        .input('fin', sql.VarChar(8), sesion.hora_finalizacion)
        .input('tipo', sql.VarChar(10), sesion.tipo_sesion)
        .input('observacion', sql.NVarChar(500), sesion.observacion ?? null)
        .query(`
          INSERT INTO SESION_CLASE (id_grupo, fecha_programada, hora_inicio, hora_finalizacion, tipo_sesion, observacion)
          OUTPUT INSERTED.id_sesion
          VALUES (@id_grupo, CONVERT(DATE, @fecha, 23), CAST(@inicio AS TIME(0)), CAST(@fin AS TIME(0)), @tipo, @observacion);
        `);
      return this.getSesion(result.recordset[0].id_sesion, tx.request());
    });
  }

  /**
   * Genera las sesiones del grupo a partir de HORARIO_CLASE, desde fecha_inicio
   * hasta antes de la fecha estimada de cierre. No duplica sesiones que ya
   * ocupan ese horario (en cualquier estado).
   */
  async generarSesiones(idGrupo: number, datos: GenerarSesionesDto = {}) {
    return this.databaseService.transaction(async (tx) => {
      const grupo = await this.bloquearGrupo(tx, idGrupo);
      const horarios = await tx.request().input('grupo', sql.Int, idGrupo)
        .query(`
        SELECT TOP (1) id_horario FROM HORARIO_CLASE WHERE id_grupo = @grupo
      `);
      if (!horarios.recordset.length)
        throw new BadRequestException('Agrega un horario semanal al grupo.');

      const result = await tx
        .request()
        .input('grupo', sql.Int, idGrupo)
        .input('tipo', sql.VarChar(10), datos.tipo_sesion ?? 'TEORICA').query(`
          DECLARE @inicio DATE, @fin DATE;
          SELECT @inicio = g.fecha_inicio, @fin = ${FECHA_FIN_ESTIMADA('g')}
          FROM GRUPO g WHERE g.id_grupo = @grupo;
          ;WITH fechas AS (
            SELECT @inicio AS fecha
            UNION ALL SELECT DATEADD(DAY, 1, fecha) FROM fechas WHERE DATEADD(DAY, 1, fecha) < @fin
          )
          INSERT INTO SESION_CLASE (id_grupo, fecha_programada, hora_inicio, hora_finalizacion, tipo_sesion)
          OUTPUT INSERTED.id_sesion
          SELECT h.id_grupo, f.fecha, h.hora_inicio, h.hora_finalizacion, @tipo
          FROM fechas f
          JOIN HORARIO_CLASE h ON h.id_grupo = @grupo AND h.dia_semana = ${DIA_SEMANA('f.fecha')}
          WHERE NOT EXISTS (
            SELECT 1 FROM SESION_CLASE s
            WHERE s.id_grupo = @grupo AND s.fecha_programada = f.fecha
              AND s.hora_inicio < h.hora_finalizacion AND s.hora_finalizacion > h.hora_inicio
          )
          OPTION (MAXRECURSION 0);
        `);
      const total = (
        await tx.request().input('grupo', sql.Int, idGrupo).query(`
          SELECT COUNT(*) AS total FROM SESION_CLASE WHERE id_grupo = @grupo
        `)
      ).recordset[0].total;
      return {
        mensaje: 'Calendario de sesiones actualizado.',
        sesiones_existentes: total - result.recordset.length,
        sesiones_creadas: result.recordset.length,
        fecha_inicio: fechaISO(grupo.fecha_inicio),
        fecha_fin_estimada: fechaISO(grupo.fecha_fin_estimada),
        sesiones: result.recordset,
      };
    });
  }

  async updateSesion(id: number, sesion: UpdateSesionClaseDto) {
    const { id_grupo } = await this.getSesion(id);
    return this.databaseService.transaction(async (tx) => {
      const grupo = await this.bloquearGrupo(tx, id_grupo, false);
      const actual = (
        await tx.request().input('id', sql.Int, id).query(`
          SELECT id_sesion, id_grupo, fecha_programada, ${HORA('hora_inicio')},
            ${HORA('hora_finalizacion')}, tipo_sesion, estado, observacion
          FROM SESION_CLASE WITH (UPDLOCK, HOLDLOCK) WHERE id_sesion = @id
        `)
      ).recordset[0];
      if (!actual)
        throw new NotFoundException(
          `La sesión con id ${id} no fue encontrada.`,
        );
      if (actual.estado !== 'PROGRAMADA')
        throw new BadRequestException(
          'Solo se pueden modificar sesiones que están programadas.',
        );

      const fechaActual = fechaISO(actual.fecha_programada)!;
      const fecha = sesion.fecha_programada ?? fechaActual;
      if (fecha !== fechaActual) {
        const historial = await tx.request().input('id', sql.Int, id).query(`
          SELECT TOP (1) id_asistencia FROM ASISTENCIA WHERE id_sesion = @id
        `);
        if (historial.recordset.length)
          throw new BadRequestException(
            'La fecha no puede cambiar porque ya se registró la asistencia.',
          );
      }
      const inicio = sesion.hora_inicio ?? actual.hora_inicio;
      const fin = sesion.hora_finalizacion ?? actual.hora_finalizacion;
      this.validarPeriodo(grupo, fecha);
      this.validarHoras(inicio, fin);
      await this.validarSolapamiento(
        tx,
        actual.id_grupo,
        fecha,
        inicio,
        fin,
        id,
      );

      await tx
        .request()
        .input('id', sql.Int, id)
        .input('fecha', sql.VarChar(10), fecha)
        .input('inicio', sql.VarChar(8), inicio)
        .input('fin', sql.VarChar(8), fin)
        .input(
          'tipo',
          sql.VarChar(10),
          sesion.tipo_sesion ?? actual.tipo_sesion,
        )
        .input(
          'observacion',
          sql.NVarChar(500),
          sesion.observacion !== undefined
            ? sesion.observacion
            : actual.observacion,
        ).query(`
          UPDATE SESION_CLASE
          SET fecha_programada = CONVERT(DATE, @fecha, 23),
            hora_inicio = CAST(@inicio AS TIME(0)),
            hora_finalizacion = CAST(@fin AS TIME(0)),
            tipo_sesion = @tipo,
            observacion = @observacion
          WHERE id_sesion = @id;
        `);
      return this.getSesion(id, tx.request());
    });
  }

  async cancelarSesion(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id).query(`
        UPDATE SESION_CLASE SET estado = 'CANCELADA'
        OUTPUT INSERTED.id_sesion
        WHERE id_sesion = @id AND estado = 'PROGRAMADA';
      `);
    if (!result.recordset.length)
      throw new NotFoundException(
        `La sesión con id ${id} no fue encontrada o ya no está programada.`,
      );
    return this.getSesion(id);
  }

  async finalizarSesion(id: number) {
    return this.databaseService.transaction(async (tx) => {
      const sesion = (
        await tx.request().input('id', sql.Int, id).query(`
          SELECT id_sesion, id_grupo, estado, fecha_programada
          FROM SESION_CLASE WITH (UPDLOCK, HOLDLOCK) WHERE id_sesion = @id
        `)
      ).recordset[0];
      if (!sesion)
        throw new NotFoundException(
          `La sesión con id ${id} no fue encontrada.`,
        );
      if (sesion.estado !== 'PROGRAMADA')
        throw new BadRequestException(
          'Solo se puede finalizar una sesión que está programada.',
        );

      const inscripciones = await this.inscripcionesDeSesion(
        tx,
        id,
        sesion.id_grupo,
        sesion.fecha_programada,
      );
      const asistencias = (
        await tx.request().input('id', sql.Int, id).query<AsistenciaSesion>(`
          SELECT id_inscripcion, estado_asistencia FROM ASISTENCIA WHERE id_sesion = @id
        `)
      ).recordset;
      this.validarAsistenciasCompletas(inscripciones, asistencias);
      await this.validarEvaluacionesCompletas(
        tx,
        id,
        inscripciones,
        asistencias,
      );

      await tx.request().input('id', sql.Int, id).query(`
        UPDATE SESION_CLASE SET estado = 'REALIZADA'
        WHERE id_sesion = @id AND estado = 'PROGRAMADA';
      `);
      return {
        mensaje: 'Sesión finalizada correctamente.',
        sesion: await this.getSesion(id, tx.request()),
      };
    });
  }

  // ============================================================
  // PROGRAMACIÓN DE CONTENIDO (temas del plan por sesión)
  // ============================================================

  async getContenidos(idSesion: number) {
    await this.getSesion(idSesion);
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, idSesion).query(`
        ${SELECT_CONTENIDO} WHERE pc.id_sesion = @id
        ORDER BY u.orden, t.orden
      `);
    return result.recordset;
  }

  async createContenido(idSesion: number, datos: CreateContenidoDto) {
    const sesion = await this.getSesion(idSesion);
    if (sesion.estado === 'CANCELADA')
      throw new BadRequestException('La sesión está cancelada.');
    const result = await this.databaseService
      .getPool()
      .request()
      .input('sesion', sql.Int, idSesion)
      .input('tema', sql.Int, datos.id_tema)
      .input(
        'estado',
        sql.VarChar(10),
        datos.estado_cumplimiento ?? 'PENDIENTE',
      )
      .input('observacion', sql.NVarChar(500), datos.observacion ?? null)
      .query(
        `
        INSERT INTO PROGRAMACION_CONTENIDO (id_sesion, id_tema, estado_cumplimiento, observacion)
        VALUES (@sesion, @tema, @estado, @observacion);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS id_programacion;
      `,
      )
      .catch((error) => this.errorContenido(error));
    return this.getContenido(result.recordset[0].id_programacion);
  }

  async updateContenido(id: number, datos: UpdateContenidoDto) {
    const actual = await this.getContenido(id);
    await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .input(
        'estado',
        sql.VarChar(10),
        datos.estado_cumplimiento ?? actual.estado_cumplimiento,
      )
      .input(
        'observacion',
        sql.NVarChar(500),
        datos.observacion !== undefined
          ? datos.observacion
          : actual.observacion,
      ).query(`
        UPDATE PROGRAMACION_CONTENIDO
        SET estado_cumplimiento = @estado, observacion = @observacion
        WHERE id_programacion = @id;
      `);
    return this.getContenido(id);
  }

  async deleteContenido(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query('DELETE PROGRAMACION_CONTENIDO WHERE id_programacion = @id');
    if (!result.rowsAffected[0])
      throw new NotFoundException('El contenido programado no existe.');
    return {
      mensaje: 'Contenido eliminado de la sesión.',
      id_programacion: id,
    };
  }

  private async getContenido(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(`${SELECT_CONTENIDO} WHERE pc.id_programacion = @id`);
    if (!result.recordset.length)
      throw new NotFoundException('El contenido programado no existe.');
    return result.recordset[0];
  }

  private errorContenido(error: { number?: number; message?: string }): never {
    // TR_PROGRAMACION_CONTENIDO_ValidarPlan
    if (error.number === 50001) throw new BadRequestException(error.message);
    if ([2601, 2627].includes(error.number ?? 0))
      throw new BadRequestException(
        'El tema ya está programado en esta sesión.',
      );
    if (error.number === 547)
      throw new BadRequestException('El tema seleccionado no existe.');
    throw error;
  }

  // ============================================================
  // VALIDACIONES
  // ============================================================

  private async bloquearGrupo(tx: Transaction, id: number, enCurso = true) {
    const grupo = (
      await tx.request().input('id', sql.Int, id).query<GrupoSesion>(`
        SELECT g.id_grupo, g.estado, g.fecha_inicio, ${FECHA_FIN_ESTIMADA('g')} AS fecha_fin_estimada
        FROM GRUPO g WITH (UPDLOCK, HOLDLOCK) WHERE g.id_grupo = @id
      `)
    ).recordset[0];
    if (!grupo)
      throw new NotFoundException(`El grupo con id ${id} no fue encontrado.`);
    if (enCurso && grupo.estado !== 'EN_CURSO')
      throw new BadRequestException('El grupo debe estar en curso.');
    return grupo;
  }

  private validarPeriodo(grupo: GrupoSesion, fecha: string) {
    if (fecha < fechaISO(grupo.fecha_inicio)!)
      throw new BadRequestException(
        'La fecha de la sesión no puede ser anterior a la fecha de inicio del grupo.',
      );
    if (fecha >= fechaISO(grupo.fecha_fin_estimada)!)
      throw new BadRequestException(
        'La fecha de la sesión debe ser anterior a la fecha estimada de cierre del grupo.',
      );
  }

  private validarHoras(inicio: string, fin: string) {
    if (inicio.padEnd(8, ':00') >= fin.padEnd(8, ':00'))
      throw new BadRequestException(
        'La hora de inicio debe ser menor que la hora de finalización.',
      );
  }

  private async validarSolapamiento(
    tx: Transaction,
    grupo: number,
    fecha: string,
    inicio: string,
    fin: string,
    excluir?: number,
  ) {
    const conflicto = await tx
      .request()
      .input('grupo', sql.Int, grupo)
      .input('fecha', sql.VarChar(10), fecha)
      .input('inicio', sql.VarChar(8), inicio)
      .input('fin', sql.VarChar(8), fin)
      .input('excluir', sql.Int, excluir ?? null).query(`
        SELECT TOP (1) id_sesion FROM SESION_CLASE
        WHERE id_grupo = @grupo AND fecha_programada = CONVERT(DATE, @fecha, 23)
          AND hora_inicio < CAST(@fin AS TIME(0)) AND hora_finalizacion > CAST(@inicio AS TIME(0))
          AND estado <> 'CANCELADA' AND (@excluir IS NULL OR id_sesion <> @excluir)
      `);
    if (conflicto.recordset.length)
      throw new BadRequestException(
        'Ya existe una sesión que se solapa con este horario.',
      );
  }

  private async inscripcionesDeSesion(
    tx: Transaction,
    idSesion: number,
    idGrupo: number,
    fecha: Date,
  ) {
    const result = await tx
      .request()
      .input('grupo', sql.Int, idGrupo)
      .input('fecha', sql.Date, fecha)
      .input('sesion', sql.Int, idSesion).query<{ id_inscripcion: number }>(`
        SELECT i.id_inscripcion FROM INSCRIPCION i
        WHERE i.id_grupo = @grupo
          AND ((i.estado = 'ACTIVA' AND i.fecha_inscripcion <= @fecha)
            OR EXISTS (SELECT 1 FROM ASISTENCIA a WHERE a.id_sesion = @sesion AND a.id_inscripcion = i.id_inscripcion))
      `);
    return result.recordset.map((i) => i.id_inscripcion);
  }

  private validarAsistenciasCompletas(
    inscripciones: number[],
    asistencias: AsistenciaSesion[],
  ) {
    const validas = new Set(inscripciones);
    for (const asistencia of asistencias) {
      if (!validas.has(asistencia.id_inscripcion))
        throw new BadRequestException(
          `La asistencia pertenece a la inscripción ${asistencia.id_inscripcion}, que no está activa en el grupo.`,
        );
    }
    const registradas = new Set(asistencias.map((a) => a.id_inscripcion));
    const faltantes = inscripciones.filter((id) => !registradas.has(id));
    if (faltantes.length)
      throw new BadRequestException(
        `No se puede finalizar la sesión. Faltan asistencias para las inscripciones: ${faltantes.join(', ')}.`,
      );
  }

  private async validarEvaluacionesCompletas(
    tx: Transaction,
    idSesion: number,
    inscripciones: number[],
    asistencias: AsistenciaSesion[],
  ) {
    const evaluaciones = (
      await tx.request().input('id', sql.Int, idSesion).query<{
        id_evaluacion: number;
      }>(`
        SELECT id_evaluacion FROM EVALUACION WHERE id_sesion = @id
      `)
    ).recordset;
    const asistencia = new Map(
      asistencias.map((a) => [a.id_inscripcion, a.estado_asistencia]),
    );
    const validas = new Set(inscripciones);

    for (const { id_evaluacion } of evaluaciones) {
      const resultados = (
        await tx.request().input('id', sql.Int, id_evaluacion)
          .query<ResultadoEvaluacion>(`
          SELECT id_inscripcion, nota, estado_resultado
          FROM RESULTADO_EVALUACION WHERE id_evaluacion = @id
        `)
      ).recordset;
      const porInscripcion = new Map<number, ResultadoEvaluacion>(
        resultados.map((r) => [r.id_inscripcion, r]),
      );
      for (const resultado of resultados) {
        if (!validas.has(resultado.id_inscripcion))
          throw new BadRequestException(
            `La evaluación ${id_evaluacion} contiene un resultado para la inscripción ${resultado.id_inscripcion}, que no está activa en el grupo.`,
          );
      }
      const faltantes = inscripciones.filter((id) => !porInscripcion.has(id));
      if (faltantes.length)
        throw new BadRequestException(
          `No se puede finalizar la sesión. La evaluación ${id_evaluacion} no tiene resultado para las inscripciones: ${faltantes.join(', ')}.`,
        );
      for (const id of inscripciones) {
        const resultado = porInscripcion.get(id)!;
        if (asistencia.get(id) === 'PRESENTE') {
          if (
            resultado.estado_resultado !== 'CALIFICADO' ||
            resultado.nota === null
          )
            throw new BadRequestException(
              `La inscripción ${id} estuvo presente y debe tener una nota CALIFICADO en la evaluación ${id_evaluacion}.`,
            );
        } else if (
          resultado.estado_resultado !== 'NO_SE_PRESENTO' ||
          resultado.nota !== null
        ) {
          throw new BadRequestException(
            `La inscripción ${id} no estuvo presente y debe tener resultado NO_SE_PRESENTO sin nota en la evaluación ${id_evaluacion}.`,
          );
        }
      }
    }
  }
}
