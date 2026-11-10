import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from 'src/database/database.service';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';

const SELECT_CURSO = `
  SELECT c.*,
    (SELECT COUNT(*) FROM PLAN_ESTUDIO p WHERE p.id_curso = c.id_curso) AS planes
  FROM CURSO c`;

@Injectable()
export class CursoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCursos() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_CURSO} WHERE c.estado = 'ACTIVO' ORDER BY c.nombre
    `);
    return result.recordset;
  }

  async getCurso(
    id: number,
    request = this.databaseService.getPool().request(),
  ) {
    const result = await request.input('id', sql.Int, id).query(`
      ${SELECT_CURSO} WHERE c.id_curso = @id
    `);
    if (!result.recordset.length)
      throw new NotFoundException(`El curso con id ${id} no fue encontrado.`);
    return result.recordset[0];
  }

  /**
   * GRUPO se relaciona con el curso a través de PLAN_ESTUDIO, así que cada
   * curso nuevo recibe su plan de estudio versión 1.
   */
  async createCurso(curso: CreateCursoDto) {
    return this.databaseService.transaction(async (tx) => {
      const { recordset } = await tx
        .request()
        .input('nombre', sql.NVarChar(100), curso.nombre.trim())
        .input('descripcion', sql.NVarChar(500), curso.descripcion ?? null)
        .input('precio_total', sql.Decimal(10, 2), curso.precio_total)
        .input('precio_matricula', sql.Decimal(10, 2), curso.precio_matricula)
        .query(`
          INSERT INTO CURSO (nombre, descripcion, precio_total, precio_matricula)
          OUTPUT INSERTED.id_curso
          VALUES (@nombre, @descripcion, @precio_total, @precio_matricula);
        `);
      const id = recordset[0].id_curso as number;
      await tx
        .request()
        .input('id', sql.Int, id)
        .input(
          'nombre',
          sql.NVarChar(150),
          `Plan de estudio - ${curso.nombre.trim()}`.slice(0, 150),
        ).query(`
          INSERT INTO PLAN_ESTUDIO (id_curso, nombre) VALUES (@id, @nombre);
        `);
      return this.getCurso(id, tx.request());
    });
  }

  async updateCurso(id: number, body: UpdateCursoDto) {
    const pool = this.databaseService.getPool();
    const actual = await this.getCurso(id);
    if (actual.estado !== 'ACTIVO') {
      throw new BadRequestException(
        'No se puede modificar un curso que no está activo.',
      );
    }

    // Una vez que existe una inscripción, los precios quedan congelados para
    // proteger las obligaciones ya generadas.
    const inscripciones = await pool.request().input('id', sql.Int, id).query(`
      SELECT TOP 1 i.id_inscripcion
      FROM INSCRIPCION i
      JOIN GRUPO g ON g.id_grupo = i.id_grupo
      JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
      WHERE p.id_curso = @id
    `);
    const cambiaPrecio =
      (body.precio_total !== undefined &&
        Number(body.precio_total) !== Number(actual.precio_total)) ||
      (body.precio_matricula !== undefined &&
        Number(body.precio_matricula) !== Number(actual.precio_matricula));
    if (inscripciones.recordset.length && cambiaPrecio) {
      throw new BadRequestException(
        'No se puede modificar el precio total ni el precio de matrícula porque ya existen inscripciones asociadas al curso.',
      );
    }

    const campos: string[] = [];
    const request = pool.request().input('id', sql.Int, id);
    if (body.nombre !== undefined) {
      campos.push('nombre = @nombre');
      request.input('nombre', sql.NVarChar(100), body.nombre.trim());
    }
    if (body.descripcion !== undefined) {
      campos.push('descripcion = @descripcion');
      request.input('descripcion', sql.NVarChar(500), body.descripcion);
    }
    if (body.precio_total !== undefined) {
      campos.push('precio_total = @precio_total');
      request.input('precio_total', sql.Decimal(10, 2), body.precio_total);
    }
    if (body.precio_matricula !== undefined) {
      campos.push('precio_matricula = @precio_matricula');
      request.input(
        'precio_matricula',
        sql.Decimal(10, 2),
        body.precio_matricula,
      );
    }
    if (!campos.length) return actual;

    await request.query(
      `UPDATE CURSO SET ${campos.join(', ')} WHERE id_curso = @id`,
    );
    return this.getCurso(id);
  }

  /** Baja lógica: CURSO.estado solo admite ACTIVO o INACTIVO. */
  async deleteCurso(id: number) {
    const actual = await this.getCurso(id);
    if (actual.estado !== 'ACTIVO') {
      throw new BadRequestException('El curso ya está inactivo.');
    }
    const grupos = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id).query(`
        SELECT TOP 1 g.id_grupo FROM GRUPO g
        JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
        WHERE p.id_curso = @id AND g.estado = 'EN_CURSO'
      `);
    if (grupos.recordset.length) {
      throw new BadRequestException(
        'El curso tiene grupos en curso. Finalízalos o cancélalos primero.',
      );
    }
    await this.databaseService.getPool().request().input('id', sql.Int, id)
      .query(`
      UPDATE CURSO SET estado = 'INACTIVO' WHERE id_curso = @id
    `);
    return this.getCurso(id);
  }
}
