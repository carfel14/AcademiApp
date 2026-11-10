import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from 'src/database/database.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';

const SELECT_CERTIFICADO = `
  SELECT c.*, i.id_estudiante, est.codigo AS codigo_estudiante, est.nombres, est.apellidos,
    i.id_grupo, g.nombre AS grupo, p.id_curso, cu.nombre AS curso
  FROM CERTIFICADO c
  JOIN INSCRIPCION i ON i.id_inscripcion = c.id_inscripcion
  JOIN ESTUDIANTE est ON est.id_estudiante = i.id_estudiante
  JOIN GRUPO g ON g.id_grupo = i.id_grupo
  JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan
  JOIN CURSO cu ON cu.id_curso = p.id_curso`;

@Injectable()
export class CertificadoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCertificados() {
    const result = await this.databaseService.getPool().request().query(`
      ${SELECT_CERTIFICADO} ORDER BY c.fecha_emision DESC, est.apellidos, est.nombres
    `);
    return result.recordset;
  }

  async getCertificado(id: number) {
    const result = await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query(`${SELECT_CERTIFICADO} WHERE c.id_certificado = @id`);
    if (!result.recordset.length)
      throw new NotFoundException(
        `El certificado con id ${id} no fue encontrado.`,
      );
    return result.recordset[0];
  }

  async createCertificado(data: CreateCertificadoDto) {
    const pool = this.databaseService.getPool();
    const inscripcion = (
      await pool
        .request()
        .input('id', sql.Int, data.id_inscripcion)
        .query('SELECT estado FROM INSCRIPCION WHERE id_inscripcion = @id')
    ).recordset[0];
    if (!inscripcion)
      throw new NotFoundException(
        `La inscripción ${data.id_inscripcion} no fue encontrada.`,
      );
    if (inscripcion.estado === 'CANCELADA')
      throw new BadRequestException(
        'No se puede emitir un certificado para una inscripción cancelada.',
      );

    // CERTIFICADO tiene trigger de bitácora: se usa SCOPE_IDENTITY() en lugar de OUTPUT.
    const result = await pool
      .request()
      .input('inscripcion', sql.Int, data.id_inscripcion)
      .input('codigo', sql.VarChar(30), data.codigo.trim())
      .input('fecha', sql.VarChar(10), data.fecha_emision?.slice(0, 10) ?? null)
      .query(
        `
        INSERT INTO CERTIFICADO (id_inscripcion, codigo, fecha_emision)
        VALUES (@inscripcion, @codigo, COALESCE(CONVERT(DATE, @fecha, 23), CAST(GETDATE() AS DATE)));
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS id_certificado;
      `,
      )
      .catch((error) => {
        if ([2601, 2627].includes(error.number))
          throw new BadRequestException(
            error.message?.includes('UQ_CERTIFICADO_id_inscripcion')
              ? `La inscripción ${data.id_inscripcion} ya tiene un certificado.`
              : `El código de certificado ${data.codigo} ya existe.`,
          );
        throw error;
      });
    return this.getCertificado(result.recordset[0].id_certificado);
  }

  async updateCertificado(id: number, data: UpdateCertificadoDto) {
    await this.getCertificado(id);
    await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .input('estado', sql.VarChar(10), data.estado)
      .query(
        'UPDATE CERTIFICADO SET estado = @estado WHERE id_certificado = @id',
      );
    return this.getCertificado(id);
  }

  async deleteCertificado(id: number) {
    await this.getCertificado(id);
    await this.databaseService
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM CERTIFICADO WHERE id_certificado = @id');
    return {
      mensaje: 'Certificado eliminado correctamente.',
      id_certificado: id,
    };
  }
}
