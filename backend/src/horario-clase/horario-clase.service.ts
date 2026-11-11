import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import {
  DIA_SEMANA,
  FECHA_FIN_ESTIMADA,
  fechaISO,
} from '../database/consultas';
import { DatabaseService } from '../database/database.service';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

type Horario = {
  id_horario: number;
  id_grupo: number;
  dia_semana: string;
  hora_inicio: string;
  hora_finalizacion: string;
};

export type SesionOmitida = { id_sesion: number; fecha: string; motivo: string };

/**
 * SESION_CLASE no referencia a HORARIO_CLASE en el script. Las sesiones de un
 * horario se reconocen por coincidir con él: mismo grupo, mismo día de la
 * semana y mismas horas. Solo se tocan las futuras, PROGRAMADAS y sin asistencia;
 * las editadas a mano con otra hora ya no coinciden y se conservan.
 */
const SESIONES_DEL_HORARIO = `
  SELECT s.id_sesion, s.fecha_programada
  FROM SESION_CLASE s WITH (UPDLOCK, HOLDLOCK)
  WHERE s.id_grupo = @grupo AND s.estado = 'PROGRAMADA'
    AND s.fecha_programada >= CAST(GETDATE() AS DATE)
    AND ${DIA_SEMANA('s.fecha_programada')} = @dia_anterior
    AND s.hora_inicio = CAST(@inicio_anterior AS TIME(0))
    AND s.hora_finalizacion = CAST(@fin_anterior AS TIME(0))
    AND NOT EXISTS (SELECT 1 FROM ASISTENCIA a WHERE a.id_sesion = s.id_sesion)
  ORDER BY s.fecha_programada`;

const columns = `id_horario, id_grupo, dia_semana,
  CONVERT(VARCHAR(5), hora_inicio, 108) AS hora_inicio,
  CONVERT(VARCHAR(5), hora_finalizacion, 108) AS hora_finalizacion`;

@Injectable()
export class HorarioClaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getHorariosPorGrupo(idGrupo: number) {
    return (
      await this.databaseService.getPool().request().input('grupo', idGrupo)
        .query(`
      SELECT ${columns} FROM HORARIO_CLASE WHERE id_grupo = @grupo
      ORDER BY CHARINDEX(dia_semana, 'LUNES MARTES MIERCOLES JUEVES VIERNES SABADO DOMINGO'), hora_inicio
    `)
    ).recordset;
  }

  async getHorario(id: number) {
    const row = await this.buscar(id, this.databaseService.getPool().request());
    if (!row) throw new NotFoundException('El horario no existe.');
    return row;
  }

  createHorario(idGrupo: number, horario: CreateHorarioDto) {
    return this.guardar(idGrupo, horario);
  }

  async updateHorario(id: number, cambios: UpdateHorarioDto) {
    const actual = await this.getHorario(id);
    return this.guardar(actual.id_grupo, cambios, id);
  }

  async deleteHorario(id: number) {
    const horario = await this.getHorario(id);
    return this.databaseService.transaction(async (tx) => {
      await this.bloquearGrupo(tx, horario.id_grupo);
      const deleted = await tx
        .request()
        .input('id', id)
        .query('DELETE HORARIO_CLASE WHERE id_horario = @id');
      if (!deleted.rowsAffected[0])
        throw new NotFoundException('El horario no existe.');
      const sesiones = await this.candidatas(tx, horario);
      if (sesiones.length) {
        await tx
          .request()
          .input('ids', sql.NVarChar(sql.MAX), JSON.stringify(sesiones.map((s) => s.id_sesion)))
          .query(`
            UPDATE SESION_CLASE
            SET estado = 'CANCELADA',
              observacion = LEFT(CONCAT(NULLIF(observacion + ' ', ' '), 'Cancelada al eliminar su horario semanal.'), 500)
            WHERE id_sesion IN (SELECT value FROM OPENJSON(@ids));
          `);
      }
      return {
        mensaje: 'Horario eliminado.',
        sesiones_canceladas: sesiones.length,
      };
    });
  }

  private async guardar(grupo: number, cambios: UpdateHorarioDto, id?: number) {
    return this.databaseService.transaction(async (tx) => {
      await this.bloquearGrupo(tx, grupo);
      const actual = id ? await this.buscar(id, tx.request()) : undefined;
      if (id && !actual) throw new NotFoundException('El horario no existe.');
      const dia = cambios.dia_semana ?? actual?.dia_semana;
      const inicio = cambios.hora_inicio ?? actual?.hora_inicio;
      const fin = cambios.hora_finalizacion ?? actual?.hora_finalizacion;
      if (inicio >= fin) {
        throw new BadRequestException(
          'La hora de finalización debe ser posterior a la de inicio.',
        );
      }

      const request = tx
        .request()
        .input('id', sql.Int, id ?? null)
        .input('grupo', grupo)
        .input('dia', dia)
        .input('inicio', inicio)
        .input('fin', fin);
      const conflicto = await request.query(`
        SELECT TOP (1) id_horario FROM HORARIO_CLASE
        WHERE id_grupo = @grupo AND dia_semana = @dia
          AND (@id IS NULL OR id_horario <> @id)
          AND hora_inicio < CAST(@fin AS time) AND hora_finalizacion > CAST(@inicio AS time)
      `);
      if (conflicto.recordset.length) {
        throw new BadRequestException(
          'El horario se cruza con otro del mismo grupo.',
        );
      }

      const horario = (
        await request.query(`
        IF @id IS NULL
        BEGIN
          INSERT INTO HORARIO_CLASE (id_grupo, dia_semana, hora_inicio, hora_finalizacion)
          VALUES (@grupo, @dia, CAST(@inicio AS time), CAST(@fin AS time));
          SET @id = SCOPE_IDENTITY();
        END
        ELSE
          UPDATE HORARIO_CLASE SET dia_semana = @dia,
            hora_inicio = CAST(@inicio AS time), hora_finalizacion = CAST(@fin AS time)
          WHERE id_horario = @id;
        SELECT ${columns} FROM HORARIO_CLASE WHERE id_horario = @id;
      `)
      ).recordset[0] as Horario;
      if (!actual) return horario;
      return { ...horario, sesiones: await this.moverSesiones(tx, actual, horario) };
    });
  }

  /** Sesiones futuras que todavía siguen el horario indicado. */
  private async candidatas(tx: sql.Transaction, horario: Horario) {
    const { recordset } = await tx
      .request()
      .input('grupo', sql.Int, horario.id_grupo)
      .input('dia_anterior', sql.VarChar(10), horario.dia_semana)
      .input('inicio_anterior', sql.VarChar(8), horario.hora_inicio)
      .input('fin_anterior', sql.VarChar(8), horario.hora_finalizacion)
      .query<{ id_sesion: number; fecha_programada: Date }>(SESIONES_DEL_HORARIO);
    return recordset;
  }

  /**
   * Lleva las sesiones del horario anterior al nuevo día y hora, dentro de la
   * misma semana (lunes a domingo). Se omiten las que quedarían en el pasado,
   * fuera del periodo del grupo o cruzadas con otra sesión.
   */
  private async moverSesiones(tx: sql.Transaction, anterior: Horario, nuevo: Horario) {
    const cambio =
      anterior.dia_semana !== nuevo.dia_semana ||
      anterior.hora_inicio !== nuevo.hora_inicio ||
      anterior.hora_finalizacion !== nuevo.hora_finalizacion;
    const resultado = { movidas: 0, omitidas: [] as SesionOmitida[] };
    if (!cambio) return resultado;

    const periodo = (
      await tx.request().input('grupo', sql.Int, nuevo.id_grupo).query(`
        SELECT CONVERT(VARCHAR(10), g.fecha_inicio, 23) AS inicio,
          CONVERT(VARCHAR(10), ${FECHA_FIN_ESTIMADA('g')}, 23) AS fin,
          CONVERT(VARCHAR(10), CAST(GETDATE() AS DATE), 23) AS hoy
        FROM GRUPO g WHERE g.id_grupo = @grupo
      `)
    ).recordset[0] as { inicio: string; fin: string; hoy: string };
    const delta = DIAS.indexOf(nuevo.dia_semana) - DIAS.indexOf(anterior.dia_semana);

    for (const sesion of await this.candidatas(tx, anterior)) {
      const fecha = fechaISO(sesion.fecha_programada)!;
      const d = new Date(`${fecha}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + delta);
      const nueva = d.toISOString().slice(0, 10);
      const omitir = (motivo: string) =>
        resultado.omitidas.push({ id_sesion: sesion.id_sesion, fecha, motivo });

      if (nueva < periodo.hoy) {
        omitir(`El nuevo día (${nueva}) ya pasó.`);
        continue;
      }
      if (nueva < periodo.inicio || nueva >= periodo.fin) {
        omitir(`El nuevo día (${nueva}) queda fuera del periodo del grupo.`);
        continue;
      }
      const choque = await tx
        .request()
        .input('grupo', sql.Int, nuevo.id_grupo)
        .input('id', sql.Int, sesion.id_sesion)
        .input('fecha', sql.VarChar(10), nueva)
        .input('inicio', sql.VarChar(8), nuevo.hora_inicio)
        .input('fin', sql.VarChar(8), nuevo.hora_finalizacion).query(`
          SELECT TOP (1) id_sesion FROM SESION_CLASE
          WHERE id_grupo = @grupo AND id_sesion <> @id AND estado <> 'CANCELADA'
            AND fecha_programada = CONVERT(DATE, @fecha, 23)
            AND hora_inicio < CAST(@fin AS TIME(0)) AND hora_finalizacion > CAST(@inicio AS TIME(0))
        `);
      if (choque.recordset.length) {
        omitir(`Se cruzaría con otra sesión del ${nueva}.`);
        continue;
      }
      await tx
        .request()
        .input('id', sql.Int, sesion.id_sesion)
        .input('fecha', sql.VarChar(10), nueva)
        .input('inicio', sql.VarChar(8), nuevo.hora_inicio)
        .input('fin', sql.VarChar(8), nuevo.hora_finalizacion).query(`
          UPDATE SESION_CLASE
          SET fecha_programada = CONVERT(DATE, @fecha, 23),
            hora_inicio = CAST(@inicio AS TIME(0)),
            hora_finalizacion = CAST(@fin AS TIME(0))
          WHERE id_sesion = @id;
        `);
      resultado.movidas++;
    }
    return resultado;
  }

  private async bloquearGrupo(tx: sql.Transaction, id: number) {
    const { recordset } = await tx.request().input('id', id).query(`
      SELECT estado FROM GRUPO WITH (UPDLOCK, HOLDLOCK) WHERE id_grupo = @id
    `);
    if (!recordset.length) throw new NotFoundException('El grupo no existe.');
    if (recordset[0].estado !== 'EN_CURSO')
      throw new BadRequestException('El grupo debe estar en curso.');
  }

  private async buscar(id: number, request: sql.Request) {
    return (
      await request.input('id', id).query(`
      SELECT ${columns} FROM HORARIO_CLASE WHERE id_horario = @id
    `)
    ).recordset[0];
  }
}
