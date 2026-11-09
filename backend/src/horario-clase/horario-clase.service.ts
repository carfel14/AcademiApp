import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';

const columns = `id_horario, id_grupo, dia_semana,
  CONVERT(VARCHAR(5), hora_inicio, 108) AS hora_inicio,
  CONVERT(VARCHAR(5), hora_fin, 108) AS hora_fin`;

@Injectable()
export class HorarioClaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getHorariosPorGrupo(idGrupo: number) {
    return (
      await this.databaseService.getPool().request().input('grupo', idGrupo)
        .query(`
      SELECT ${columns} FROM horario_clase WHERE id_grupo = @grupo
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
      const result = await tx.request().input('id', id).query(`
        SELECT TOP (1) id_sesion FROM sesion_clase WHERE id_horario = @id
      `);
      if (result.recordset.length) {
        throw new BadRequestException('El horario tiene sesiones asociadas.');
      }
      const deleted = await tx
        .request()
        .input('id', id)
        .query('DELETE horario_clase WHERE id_horario = @id');
      if (!deleted.rowsAffected[0])
        throw new NotFoundException('El horario no existe.');
      return { mensaje: 'Horario eliminado.' };
    });
  }

  private async guardar(grupo: number, cambios: UpdateHorarioDto, id?: number) {
    return this.databaseService.transaction(async (tx) => {
      await this.bloquearGrupo(tx, grupo);
      const actual = id ? await this.buscar(id, tx.request()) : undefined;
      if (id && !actual) throw new NotFoundException('El horario no existe.');
      const dia = cambios.dia_semana ?? actual?.dia_semana;
      const inicio = cambios.hora_inicio ?? actual?.hora_inicio;
      const fin = cambios.hora_fin ?? actual?.hora_fin;
      if (inicio >= fin) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la de inicio.',
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
        SELECT TOP (1) id_horario FROM horario_clase
        WHERE id_grupo = @grupo AND dia_semana = @dia
          AND (@id IS NULL OR id_horario <> @id)
          AND hora_inicio < CAST(@fin AS time) AND hora_fin > CAST(@inicio AS time)
      `);
      if (conflicto.recordset.length) {
        throw new BadRequestException(
          'El horario se cruza con otro del mismo grupo.',
        );
      }

      return (
        await request.query(`
        IF @id IS NULL
        BEGIN
          INSERT INTO horario_clase (id_grupo, dia_semana, hora_inicio, hora_fin)
          VALUES (@grupo, @dia, CAST(@inicio AS time), CAST(@fin AS time));
          SET @id = SCOPE_IDENTITY();
        END
        ELSE
          UPDATE horario_clase SET dia_semana = @dia,
            hora_inicio = CAST(@inicio AS time), hora_fin = CAST(@fin AS time)
          WHERE id_horario = @id;
        SELECT ${columns} FROM horario_clase WHERE id_horario = @id;
      `)
      ).recordset[0];
    });
  }

  private async bloquearGrupo(tx: sql.Transaction, id: number) {
    const { recordset } = await tx.request().input('id', id).query(`
      SELECT estado FROM grupo WITH (UPDLOCK, HOLDLOCK) WHERE id_grupo = @id
    `);
    if (!recordset.length) throw new NotFoundException('El grupo no existe.');
    if (recordset[0].estado !== 'ACTIVO')
      throw new BadRequestException('El grupo debe estar activo.');
  }

  private async buscar(id: number, request: sql.Request) {
    return (
      await request.input('id', id).query(`
      SELECT ${columns} FROM horario_clase WHERE id_horario = @id
    `)
    ).recordset[0];
  }
}
