import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import * as sql from 'mssql';

import { DatabaseService } from 'src/database/database.service';

import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { UpdateEstudianteDto } from './dto/update-estudiante.dto';

@Injectable()
export class EstudianteService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) {}

    async getEstudiantes() {
        const pool = this.databaseService.getPool();

        const result = await pool.request()
            .query(`
                SELECT *
                FROM estudiante
                WHERE estado = 'ACTIVO'
            `);

        return result.recordset;
    }

    async getEstudiante(id: number) {
        const pool = this.databaseService.getPool();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT *
                FROM estudiante
                WHERE id_estudiante = @id
            `);

        if (result.recordset.length === 0) {
            throw new NotFoundException(
                `El estudiante con id ${id} no fue encontrado.`,
            );
        }

        return result.recordset[0];
    }

    async createEstudiante(estudiante: CreateEstudianteDto) {
        const pool = this.databaseService.getPool();

        const result = await pool.request()
            .input(
                'nombres',
                sql.VarChar(100),
                estudiante.nombres,
            )
            .input(
                'apellidos',
                sql.VarChar(100),
                estudiante.apellidos,
            )
            .input(
                'fecha_nacimiento',
                sql.Date,
                estudiante.fecha_nacimiento ?? null,
            )
            .input(
                'telefono',
                sql.VarChar(20),
                estudiante.telefono ?? null,
            )
            .input('email', sql.NVarChar(150), estudiante.email ?? null)
            .query(`
                INSERT INTO estudiante (
                    nombres,
                    apellidos,
                    fecha_nacimiento,
                    telefono, email
                )
                OUTPUT INSERTED.*
                VALUES (
                    @nombres,
                    @apellidos,
                    @fecha_nacimiento,
                    @telefono, @email
                );
            `);

        return result.recordset[0];
    }

    async updateEstudiante(
    id: number,
    estudiante: UpdateEstudianteDto,
    ) {
        const pool = this.databaseService.getPool();

        const campos: string[] = [];
        const request = pool.request();

        request.input('id', id);

        if (estudiante.nombres !== undefined) {
            campos.push('nombres = @nombres');
            request.input('nombres', estudiante.nombres);
        }

        if (estudiante.apellidos !== undefined) {
            campos.push('apellidos = @apellidos');
            request.input('apellidos', estudiante.apellidos);
        }

        if (estudiante.fecha_nacimiento !== undefined) {
            campos.push('fecha_nacimiento = @fecha_nacimiento');
            request.input(
                'fecha_nacimiento',
                estudiante.fecha_nacimiento,
            );
        }

        if (estudiante.telefono !== undefined) {
            campos.push('telefono = @telefono');
            request.input('telefono', estudiante.telefono);
        }

        if (estudiante.email !== undefined) {
            campos.push('email = @email');
            request.input('email', sql.NVarChar(150), estudiante.email);
        }

        if (campos.length === 0) {
            throw new BadRequestException(
                'No se proporcionaron datos para actualizar.',
            );
        }

        const result = await request.query(`
            UPDATE estudiante
            SET ${campos.join(', ')}
            WHERE id_estudiante = @id
        `);

        if (result.rowsAffected[0] === 0) {
            throw new NotFoundException(
                `El estudiante con id ${id} no fue encontrado.`,
            );
        }

        const actualizado = await pool.request()
            .input('id', id)
            .query(`
                SELECT *
                FROM estudiante
                WHERE id_estudiante = @id
            `);

        return actualizado.recordset[0];
    }

    async deleteEstudiante(id: number) {
        const pool = this.databaseService.getPool();

        const result = await pool.request()
            .input('id', id)
            .query(`
                UPDATE estudiante
                SET estado = 'INACTIVO'
                WHERE id_estudiante = @id
            `);

        if (result.rowsAffected[0] === 0) {
            throw new NotFoundException(
                `El estudiante con id \${id} no fue encontrado.`,
            );
        }

        const actualizado = await pool.request()
            .input('id', id)
            .query(`
                SELECT *
                FROM estudiante
                WHERE id_estudiante = @id
            `);

        return actualizado.recordset[0];
    }
}