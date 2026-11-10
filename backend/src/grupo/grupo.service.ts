import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { FECHA_FIN_ESTIMADA, fechaISO } from 'src/database/consultas';
import { DatabaseService } from 'src/database/database.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update_grupo.dto';

/**
 * GRUPO -> PLAN_ESTUDIO -> CURSO. `fecha_fin` es la fecha real de cierre
 * (NULL mientras el grupo está EN_CURSO); `fecha_fin_estimada` se calcula
 * como DATEADD(MONTH, duracion_meses, fecha_inicio).
 */
const SELECT_GRUPO = `
  SELECT g.*, p.id_curso, c.nombre AS curso, p.nombre AS plan_estudio, p.version,
    ${FECHA_FIN_ESTIMADA('g')} AS fecha_fin_estimada,
    (SELECT COUNT(*) FROM INSCRIPCION i WHERE i.id_grupo = g.id_grupo AND i.estado = 'ACTIVA') AS inscritos,
    (SELECT COUNT(DISTINCT a.id_profesor) FROM ASIGNACION_PROFESOR a WHERE a.id_grupo = g.id_grupo) AS profesores_asignados
  FROM GRUPO g
  JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
  JOIN CURSO c ON c.id_curso = p.id_curso`;

@Injectable()
export class GrupoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getGrupos() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_GRUPO}
      WHERE g.estado IN ('EN_CURSO', 'FINALIZADO')
      ORDER BY g.fecha_inicio, g.id_grupo
    `);
    return result.recordset;
  }

  async getGrupo(
    id: number,
    request = this.databaseService.getPool().request(),
  ) {
    const result = await request.input('id', sql.Int, id).query(`
      ${SELECT_GRUPO} WHERE g.id_grupo = @id
    `);
    if (!result.recordset.length)
      throw new NotFoundException(`El grupo con id ${id} no fue encontrado.`);
    return result.recordset[0];
  }

  async createGrupo(grupo: CreateGrupoDto) {
    const pool = this.databaseService.getPool();
    const plan = await pool.request().input('id', sql.Int, grupo.id_plan)
      .query(`
      SELECT p.estado, c.estado AS estado_curso
      FROM PLAN_ESTUDIO p JOIN CURSO c ON c.id_curso = p.id_curso
      WHERE p.id_plan = @id
    `);
    if (!plan.recordset.length)
      throw new NotFoundException(
        `El plan de estudio con id ${grupo.id_plan} no fue encontrado.`,
      );
    if (plan.recordset[0].estado_curso !== 'ACTIVO')
      throw new BadRequestException(
        'No se puede crear un grupo para un curso que no está activo.',
      );
    if (plan.recordset[0].estado !== 'ACTIVO')
      throw new BadRequestException(
        'No se puede crear un grupo con un plan de estudio inactivo.',
      );

    const { recordset } = await pool
      .request()
      .input('id_plan', sql.Int, grupo.id_plan)
      .input('nombre', sql.NVarChar(100), grupo.nombre.trim())
      .input('fecha_inicio', sql.VarChar(10), grupo.fecha_inicio.slice(0, 10))
      .input('duracion_meses', sql.TinyInt, grupo.duracion_meses).query(`
        INSERT INTO GRUPO (id_plan, nombre, fecha_inicio, duracion_meses)
        OUTPUT INSERTED.id_grupo
        VALUES (@id_plan, @nombre, CONVERT(DATE, @fecha_inicio, 23), @duracion_meses);
      `);
    return this.getGrupo(recordset[0].id_grupo);
  }

  async updateGrupo(id: number, grupo: UpdateGrupoDto) {
    const actual = await this.getGrupo(id);
    if (actual.estado !== 'EN_CURSO') {
      throw new BadRequestException(
        'No se puede modificar un grupo que ya fue finalizado o cancelado.',
      );
    }
    const hoy = await this.hoy();
    if (
      fechaISO(actual.fecha_inicio)! <= hoy &&
      (grupo.fecha_inicio !== undefined || grupo.duracion_meses !== undefined)
    ) {
      throw new BadRequestException(
        'No se puede modificar la fecha de inicio ni la duración de un grupo que ya ha iniciado.',
      );
    }

    const campos: string[] = [];
    const request = this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id);
    if (grupo.nombre !== undefined) {
      campos.push('nombre = @nombre');
      request.input('nombre', sql.NVarChar(100), grupo.nombre.trim());
    }
    if (grupo.fecha_inicio !== undefined) {
      campos.push('fecha_inicio = CONVERT(DATE, @fecha_inicio, 23)');
      request.input(
        'fecha_inicio',
        sql.VarChar(10),
        grupo.fecha_inicio.slice(0, 10),
      );
    }
    if (grupo.duracion_meses !== undefined) {
      campos.push('duracion_meses = @duracion_meses');
      request.input('duracion_meses', sql.TinyInt, grupo.duracion_meses);
    }
    if (!campos.length) return actual;

    await request.query(
      `UPDATE GRUPO SET ${campos.join(', ')} WHERE id_grupo = @id`,
    );
    return this.getGrupo(id);
  }

  /** Cancela el grupo. fecha_fin registra el cierre si el grupo ya había iniciado. */
  async deleteGrupo(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id).query(`
        UPDATE GRUPO
        SET estado = 'CANCELADO',
          fecha_fin = CASE WHEN CAST(GETDATE() AS DATE) >= fecha_inicio
            THEN CAST(GETDATE() AS DATE) ELSE NULL END
        OUTPUT INSERTED.id_grupo
        WHERE id_grupo = @id AND estado = 'EN_CURSO';
      `);
    if (!result.recordset.length) {
      await this.getGrupo(id);
      throw new BadRequestException('El grupo ya no se encuentra en curso.');
    }
    return { mensaje: 'Grupo cancelado correctamente.', id_grupo: id };
  }

  /** Cierra el grupo: fecha_fin = hoy, inscripciones FINALIZADAS y sesiones pendientes CANCELADAS. */
  async finalizarGrupo(id: number) {
    return this.databaseService.transaction(async (tx) => {
      const grupo = await this.getGrupo(id, tx.request());
      if (grupo.estado !== 'EN_CURSO')
        throw new BadRequestException('El grupo ya no se encuentra en curso.');
      const hoy = await this.hoy(tx.request());
      if (fechaISO(grupo.fecha_inicio)! > hoy)
        throw new BadRequestException(
          'No se puede finalizar un grupo que todavía no inicia.',
        );

      await tx.request().input('id', sql.Int, id).query(`
        UPDATE GRUPO SET estado = 'FINALIZADO', fecha_fin = CAST(GETDATE() AS DATE)
        WHERE id_grupo = @id;

        UPDATE INSCRIPCION SET estado = 'FINALIZADA'
        WHERE id_grupo = @id AND estado = 'ACTIVA';

        UPDATE SESION_CLASE SET estado = 'CANCELADA'
        WHERE id_grupo = @id AND estado = 'PROGRAMADA';
      `);
      return { mensaje: 'Grupo finalizado correctamente.', id_grupo: id };
    });
  }

  private async hoy(request = this.databaseService.getPool().request()) {
    const { recordset } = await request.query(
      'SELECT CONVERT(VARCHAR(10), CAST(GETDATE() AS DATE), 23) AS hoy',
    );
    return recordset[0].hoy as string;
  }
}
