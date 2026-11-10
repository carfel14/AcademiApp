import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from 'src/database/database.service';
import { CreateProfesorDto } from './dto/create-profesor.dto';
import { UpdateProfesorDto } from './dto/update-profesor.dto';

/** Las especialidades viven en ESPECIALIDAD y PROFESOR_ESPECIALIDAD. */
const SELECT_PROFESOR = `
  SELECT p.*,
    (SELECT e.id_especialidad, e.nombre
      FROM PROFESOR_ESPECIALIDAD pe JOIN ESPECIALIDAD e ON e.id_especialidad = pe.id_especialidad
      WHERE pe.id_profesor = p.id_profesor ORDER BY e.nombre FOR JSON PATH) AS especialidades
  FROM PROFESOR p`;

type Fila = Record<string, unknown> & { especialidades: string | null };
const leer = (row: Fila) => ({
  ...row,
  especialidades: row.especialidades ? JSON.parse(row.especialidades) : [],
});

@Injectable()
export class ProfesorService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getProfesores() {
    const result = await this.databaseService.getPool().request().query<Fila>(`
      ${SELECT_PROFESOR} WHERE p.estado = 'ACTIVO' ORDER BY p.apellidos, p.nombres
    `);
    return result.recordset.map(leer);
  }

  async getProfesor(
    id: number,
    request = this.databaseService.getPool().request(),
  ) {
    const result = await request.input('id', sql.Int, id).query<Fila>(`
      ${SELECT_PROFESOR} WHERE p.id_profesor = @id
    `);
    if (!result.recordset.length)
      throw new NotFoundException(
        `El profesor con id ${id} no fue encontrado.`,
      );
    return leer(result.recordset[0]);
  }

  async getEspecialidades() {
    const result = await this.databaseService.getPool().request().query(`
      SELECT * FROM ESPECIALIDAD ORDER BY nombre
    `);
    return result.recordset;
  }

  async createEspecialidad(nombre: string) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('nombre', sql.NVarChar(100), nombre.trim()).query(`
        IF NOT EXISTS (SELECT 1 FROM ESPECIALIDAD WHERE nombre = @nombre)
          INSERT INTO ESPECIALIDAD (nombre) VALUES (@nombre);
        SELECT * FROM ESPECIALIDAD WHERE nombre = @nombre;
      `);
    return result.recordset[0];
  }

  async createProfesor(profesor: CreateProfesorDto) {
    return this.databaseService.transaction(async (tx) => {
      const { recordset } = await tx
        .request()
        .input('nombres', sql.NVarChar(100), profesor.nombres.trim())
        .input('apellidos', sql.NVarChar(100), profesor.apellidos.trim())
        .input('telefono', sql.VarChar(20), profesor.telefono || null).query(`
          INSERT INTO PROFESOR (nombres, apellidos, telefono)
          OUTPUT INSERTED.id_profesor
          VALUES (@nombres, @apellidos, @telefono);
        `);
      const id = recordset[0].id_profesor as number;
      await this.guardarEspecialidades(tx, id, profesor.especialidades ?? []);
      return this.getProfesor(id, tx.request());
    });
  }

  async updateProfesor(id: number, profesor: UpdateProfesorDto) {
    return this.databaseService.transaction(async (tx) => {
      await this.getProfesor(id, tx.request());
      const campos: string[] = [];
      const request = tx.request().input('id', sql.Int, id);
      if (profesor.nombres !== undefined) {
        campos.push('nombres = @nombres');
        request.input('nombres', sql.NVarChar(100), profesor.nombres.trim());
      }
      if (profesor.apellidos !== undefined) {
        campos.push('apellidos = @apellidos');
        request.input(
          'apellidos',
          sql.NVarChar(100),
          profesor.apellidos.trim(),
        );
      }
      if (profesor.telefono !== undefined) {
        campos.push('telefono = @telefono');
        request.input('telefono', sql.VarChar(20), profesor.telefono || null);
      }
      if (!campos.length && profesor.especialidades === undefined)
        throw new BadRequestException(
          'No se proporcionaron datos para actualizar.',
        );
      if (campos.length)
        await request.query(
          `UPDATE PROFESOR SET ${campos.join(', ')} WHERE id_profesor = @id`,
        );
      if (profesor.especialidades !== undefined)
        await this.guardarEspecialidades(tx, id, profesor.especialidades);
      return this.getProfesor(id, tx.request());
    });
  }

  async deleteProfesor(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(`UPDATE PROFESOR SET estado = 'INACTIVO' WHERE id_profesor = @id`);
    if (!result.rowsAffected[0])
      throw new NotFoundException(
        `El profesor con id ${id} no fue encontrado.`,
      );
    return this.getProfesor(id);
  }

  /** Reemplaza las especialidades del profesor; crea las que no existan. */
  private async guardarEspecialidades(
    tx: sql.Transaction,
    id: number,
    especialidades: string[],
  ) {
    const nombres = [
      ...new Set(especialidades.map((e) => e.trim()).filter(Boolean)),
    ];
    await tx
      .request()
      .input('id', sql.Int, id)
      .input('nombres', sql.NVarChar(sql.MAX), JSON.stringify(nombres)).query(`
        DECLARE @lista TABLE (nombre NVARCHAR(100) PRIMARY KEY);
        INSERT INTO @lista SELECT DISTINCT value FROM OPENJSON(@nombres);
        INSERT INTO ESPECIALIDAD (nombre)
        SELECT l.nombre FROM @lista l
        WHERE NOT EXISTS (SELECT 1 FROM ESPECIALIDAD e WHERE e.nombre = l.nombre);
        DELETE pe FROM PROFESOR_ESPECIALIDAD pe
        JOIN ESPECIALIDAD e ON e.id_especialidad = pe.id_especialidad
        WHERE pe.id_profesor = @id AND e.nombre NOT IN (SELECT nombre FROM @lista);
        INSERT INTO PROFESOR_ESPECIALIDAD (id_profesor, id_especialidad)
        SELECT @id, e.id_especialidad FROM ESPECIALIDAD e
        WHERE e.nombre IN (SELECT nombre FROM @lista)
          AND NOT EXISTS (SELECT 1 FROM PROFESOR_ESPECIALIDAD pe
            WHERE pe.id_profesor = @id AND pe.id_especialidad = e.id_especialidad);
      `);
  }
}
