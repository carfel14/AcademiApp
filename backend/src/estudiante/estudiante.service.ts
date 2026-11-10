import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from 'src/database/database.service';
import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { UpdateEstudianteDto } from './dto/update-estudiante.dto';

const conflicto = (error: { number?: number }) => {
  if ([2601, 2627].includes(error.number ?? 0))
    throw new ConflictException('Ya existe un estudiante con ese código.');
  throw error;
};

@Injectable()
export class EstudianteService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getEstudiantes() {
    const result = await this.databaseService.getPool().request().query(`
      SELECT * FROM ESTUDIANTE WHERE estado = 'ACTIVO' ORDER BY apellidos, nombres
    `);
    return result.recordset;
  }

  async getEstudiante(
    id: number,
    request = this.databaseService.getPool().request(),
  ) {
    const result = await request.input('id', sql.Int, id).query(`
      SELECT * FROM ESTUDIANTE WHERE id_estudiante = @id
    `);
    if (!result.recordset.length)
      throw new NotFoundException(
        `El estudiante con id ${id} no fue encontrado.`,
      );
    return result.recordset[0];
  }

  /**
   * ESTUDIANTE.codigo es obligatorio y único. Si no se envía, se asigna
   * EST-000001, EST-000002, ... a partir del id generado.
   */
  async createEstudiante(estudiante: CreateEstudianteDto) {
    return this.databaseService.transaction(async (tx) => {
      const codigo = estudiante.codigo?.trim();
      const { recordset } = await tx
        .request()
        .input('codigo', sql.VarChar(20), codigo || null)
        .input('nombres', sql.NVarChar(100), estudiante.nombres.trim())
        .input('apellidos', sql.NVarChar(100), estudiante.apellidos.trim())
        .input(
          'fecha_nacimiento',
          sql.VarChar(10),
          estudiante.fecha_nacimiento?.slice(0, 10) ?? null,
        )
        .input('telefono', sql.VarChar(20), estudiante.telefono || null)
        .input('email', sql.NVarChar(150), estudiante.email || null)
        .input(
          'canal',
          sql.VarChar(10),
          estudiante.canal_preferido ?? 'WHATSAPP',
        )
        .query(
          `
          INSERT INTO ESTUDIANTE (codigo, nombres, apellidos, fecha_nacimiento, telefono, email, canal_preferido)
          OUTPUT INSERTED.id_estudiante
          VALUES (COALESCE(@codigo, 'TMP-' + LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 16)),
            @nombres, @apellidos, CONVERT(DATE, @fecha_nacimiento, 23), @telefono, @email, @canal);
        `,
        )
        .catch(conflicto);
      const id = recordset[0].id_estudiante as number;
      if (!codigo) {
        await tx
          .request()
          .input('id', sql.Int, id)
          .query(
            `
          UPDATE ESTUDIANTE
          SET codigo = 'EST-' + RIGHT('000000' + CAST(id_estudiante AS VARCHAR(10)), 6)
          WHERE id_estudiante = @id;
        `,
          )
          .catch(conflicto);
      }
      return this.getEstudiante(id, tx.request());
    });
  }

  async updateEstudiante(id: number, estudiante: UpdateEstudianteDto) {
    const campos: string[] = [];
    const request = this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id);
    const texto = (
      campo: keyof UpdateEstudianteDto,
      tipo: sql.ISqlType,
      valor: unknown,
    ) => {
      campos.push(`${campo} = @${campo}`);
      request.input(campo, tipo, valor);
    };
    if (estudiante.codigo !== undefined)
      texto('codigo', sql.VarChar(20), estudiante.codigo.trim());
    if (estudiante.nombres !== undefined)
      texto('nombres', sql.NVarChar(100), estudiante.nombres.trim());
    if (estudiante.apellidos !== undefined)
      texto('apellidos', sql.NVarChar(100), estudiante.apellidos.trim());
    if (estudiante.fecha_nacimiento !== undefined) {
      campos.push('fecha_nacimiento = CONVERT(DATE, @fecha_nacimiento, 23)');
      request.input(
        'fecha_nacimiento',
        sql.VarChar(10),
        estudiante.fecha_nacimiento?.slice(0, 10) || null,
      );
    }
    if (estudiante.telefono !== undefined)
      texto('telefono', sql.VarChar(20), estudiante.telefono || null);
    if (estudiante.email !== undefined)
      texto('email', sql.NVarChar(150), estudiante.email || null);
    if (estudiante.canal_preferido !== undefined)
      texto('canal_preferido', sql.VarChar(10), estudiante.canal_preferido);
    if (!campos.length)
      throw new BadRequestException(
        'No se proporcionaron datos para actualizar.',
      );

    const result = await request
      .query(
        `UPDATE ESTUDIANTE SET ${campos.join(', ')} WHERE id_estudiante = @id`,
      )
      .catch(conflicto);
    if (!result.rowsAffected[0])
      throw new NotFoundException(
        `El estudiante con id ${id} no fue encontrado.`,
      );
    return this.getEstudiante(id);
  }

  async deleteEstudiante(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(
        `UPDATE ESTUDIANTE SET estado = 'INACTIVO' WHERE id_estudiante = @id`,
      );
    if (!result.rowsAffected[0])
      throw new NotFoundException(
        `El estudiante con id ${id} no fue encontrado.`,
      );
    return this.getEstudiante(id);
  }
}
