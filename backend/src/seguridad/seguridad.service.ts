import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';

const derive = promisify(scrypt);
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/** Roles definidos en los datos iniciales del script. */
export const ROLES = ['ADMINISTRADOR', 'CAJERO', 'DOCENTE', 'RECEPCION'];

const DURACION_SESION_MS = 12 * 60 * 60 * 1000;

export interface UsuarioSesion {
  id_usuario: number;
  usuario: string;
  email: string | null;
  id_profesor: number | null;
  profesor: string | null;
  roles: string[];
}

export interface UsuarioDatos {
  usuario: string;
  email?: string | null;
  id_profesor?: number | null;
  estado: 'ACTIVO' | 'INACTIVO';
  roles: number[];
  contrasena?: string;
}

interface FilaUsuario {
  id_usuario: number;
  usuario: string;
  email: string | null;
  id_profesor: number | null;
  profesor: string | null;
  contrasena_hash: string;
  estado: string;
  roles: string | null;
}

/**
 * El script no incluye una tabla de sesiones, así que el token es un valor
 * firmado (HMAC) con el id del usuario, la expiración y una huella de
 * USUARIO.contrasena_hash. Cambiar la contraseña o desactivar la cuenta
 * invalida los tokens emitidos.
 */
@Injectable()
export class SeguridadService {
  private readonly secreto =
    process.env.APP_TOKEN_SECRET || randomBytes(32).toString('hex');

  constructor(private readonly db: DatabaseService) {}

  async setup(
    secret: string,
    user: { usuario: string; contrasena: string; email?: string },
  ) {
    const configured = process.env.APP_SETUP_KEY;
    if (
      !configured ||
      !secret ||
      !timingSafeEqual(
        Buffer.from(digest(secret)),
        Buffer.from(digest(configured)),
      )
    ) {
      throw new UnauthorizedException('Clave de configuración incorrecta.');
    }
    const hash = await this.hash(user.contrasena);
    const id = await this.db.transaction(async (tx) => {
      const count = await tx
        .request()
        .query(
          'SELECT COUNT(*) AS total FROM USUARIO WITH (UPDLOCK, HOLDLOCK)',
        );
      if (count.recordset[0].total)
        throw new ConflictException('La aplicación ya está configurada.');
      const { recordset } = await tx
        .request()
        .input('usuario', sql.VarChar(50), user.usuario.trim())
        .input('email', sql.NVarChar(150), user.email?.trim() || null)
        .input('hash', sql.NVarChar(255), hash).query(`
          INSERT INTO USUARIO (usuario, contrasena_hash, email)
          OUTPUT INSERTED.id_usuario
          VALUES (@usuario, @hash, @email);
        `);
      const nuevo = recordset[0].id_usuario as number;
      const rol = await tx.request().input('id', nuevo).query(`
        INSERT INTO USUARIO_ROL (id_usuario, id_rol)
        SELECT @id, id_rol FROM ROL WHERE nombre = 'ADMINISTRADOR';
      `);
      if (!rol.rowsAffected[0])
        throw new BadRequestException(
          'Falta el rol ADMINISTRADOR. Ejecuta los datos iniciales del script.',
        );
      return nuevo;
    });
    return this.abrirSesion(id);
  }

  async login(usuario: string, contrasena: string) {
    const user = await this.buscar(this.db.getPool().request(), {
      usuario,
    });
    const [salt, expected] = (user?.contrasena_hash ?? '').split(':');
    const validFormat =
      user?.estado === 'ACTIVO' &&
      /^[a-f0-9]{32}$/.test(salt ?? '') &&
      /^[a-f0-9]{128}$/.test(expected ?? '');
    const value = (await derive(
      contrasena,
      validFormat ? salt : 'academia-silvia',
      64,
    )) as Buffer;
    if (
      !user ||
      !validFormat ||
      !timingSafeEqual(value, Buffer.from(expected, 'hex'))
    ) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    return this.abrirSesion(user.id_usuario);
  }

  async session(token?: string): Promise<UsuarioSesion> {
    const [datos, firma] = (token ?? '').split('.');
    if (!datos || !firma || !this.firmaValida(datos, firma))
      throw new UnauthorizedException('Inicia sesión.');
    let payload: { u: number; e: number; h: string };
    try {
      payload = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Inicia sesión.');
    }
    const user =
      payload.e > Date.now()
        ? await this.buscar(this.db.getPool().request(), { id: payload.u })
        : undefined;
    if (
      !user ||
      user.estado !== 'ACTIVO' ||
      this.huella(user.contrasena_hash) !== payload.h ||
      !this.sesion(user).roles.length
    ) {
      throw new UnauthorizedException(
        'Tu sesión expiró. Inicia sesión nuevamente.',
      );
    }
    return this.sesion(user);
  }

  async logout(id: number) {
    await this.audit(id, 'USUARIO', id, 'LOGOUT', 'Cierre de sesión');
    return { mensaje: 'Sesión cerrada.' };
  }

  async usuarios() {
    const { recordset } = await this.db.getPool().request().query(`
      SELECT u.id_usuario, u.id_profesor, u.usuario, u.email, u.ultimo_acceso, u.estado,
        CONCAT(p.nombres, ' ', p.apellidos) AS profesor,
        (SELECT r.id_rol, r.nombre FROM USUARIO_ROL ur JOIN ROL r ON r.id_rol = ur.id_rol
          WHERE ur.id_usuario = u.id_usuario ORDER BY r.nombre FOR JSON PATH) AS roles
      FROM USUARIO u LEFT JOIN PROFESOR p ON p.id_profesor = u.id_profesor
      ORDER BY u.usuario
    `);
    return recordset.map((row) => ({
      ...row,
      profesor: row.id_profesor ? row.profesor : null,
      roles: row.roles ? JSON.parse(row.roles) : [],
    }));
  }

  async roles() {
    return (
      await this.db
        .getPool()
        .request()
        .query('SELECT id_rol, nombre, descripcion FROM ROL ORDER BY nombre')
    ).recordset;
  }

  async guardarUsuario(data: UsuarioDatos, actor: number, id?: number) {
    const roles = [...new Set(data.roles)];
    if (!roles.length)
      throw new BadRequestException('Selecciona al menos un rol.');
    if (id === actor) {
      const admin = await this.db
        .getPool()
        .request()
        .input('roles', JSON.stringify(roles))
        .query(
          "SELECT id_rol FROM ROL WHERE nombre = 'ADMINISTRADOR' AND id_rol IN (SELECT value FROM OPENJSON(@roles))",
        );
      if (data.estado !== 'ACTIVO' || !admin.recordset.length) {
        throw new BadRequestException(
          'Tu cuenta debe conservar el rol ADMINISTRADOR y permanecer activa.',
        );
      }
    }
    const hash =
      id && !data.contrasena ? null : await this.hash(data.contrasena);
    return this.db.transaction(async (tx) => {
      const validos = await tx
        .request()
        .input('roles', JSON.stringify(roles))
        .query(
          'SELECT COUNT(*) AS total FROM ROL WHERE id_rol IN (SELECT value FROM OPENJSON(@roles))',
        );
      if (validos.recordset[0].total !== roles.length)
        throw new BadRequestException('Uno de los roles no existe.');
      const result = await tx
        .request()
        .input('id', sql.Int, id ?? null)
        .input('usuario', sql.VarChar(50), data.usuario.trim())
        .input('email', sql.NVarChar(150), data.email?.trim() || null)
        .input('profesor', sql.Int, data.id_profesor ?? null)
        .input('estado', sql.VarChar(20), data.estado)
        .input('hash', sql.NVarChar(255), hash)
        .query(
          `
        IF @id IS NULL
          INSERT INTO USUARIO (id_profesor, usuario, contrasena_hash, email, estado)
          OUTPUT INSERTED.id_usuario VALUES (@profesor, @usuario, @hash, @email, @estado);
        ELSE
          UPDATE USUARIO SET id_profesor = @profesor, usuario = @usuario, email = @email,
            estado = @estado, contrasena_hash = COALESCE(@hash, contrasena_hash)
          OUTPUT INSERTED.id_usuario WHERE id_usuario = @id;
      `,
        )
        .catch((error) => {
          if ([2601, 2627].includes(error.number))
            throw new ConflictException(
              error.message?.includes('UX_USUARIO_id_profesor')
                ? 'Ese profesor ya tiene un usuario.'
                : 'Ese nombre de usuario ya existe.',
            );
          if (error.number === 547)
            throw new BadRequestException(
              'El profesor seleccionado no existe.',
            );
          throw error;
        });
      const row = result.recordset[0];
      if (!row) throw new NotFoundException('El usuario no existe.');
      await tx
        .request()
        .input('id', row.id_usuario)
        .input('roles', JSON.stringify(roles)).query(`
          DELETE USUARIO_ROL WHERE id_usuario = @id
            AND id_rol NOT IN (SELECT value FROM OPENJSON(@roles));
          INSERT INTO USUARIO_ROL (id_usuario, id_rol)
          SELECT @id, r.id_rol FROM ROL r
          WHERE r.id_rol IN (SELECT value FROM OPENJSON(@roles))
            AND NOT EXISTS (SELECT 1 FROM USUARIO_ROL ur WHERE ur.id_usuario = @id AND ur.id_rol = r.id_rol);
        `);
      await this.audit(
        actor,
        'USUARIO',
        row.id_usuario,
        id ? 'UPDATE' : 'INSERT',
        'Administración de usuarios',
        tx.request(),
      );
      return row;
    });
  }

  async audit(
    usuario: number | null,
    tabla: string,
    registro: number | null,
    accion: string,
    detalle: string,
    request = this.db.getPool().request(),
  ) {
    await request
      .input('usuario', sql.Int, usuario)
      .input('tabla', sql.VarChar(50), tabla)
      .input('registro', sql.Int, registro)
      .input('accion', sql.VarChar(10), accion)
      .input('detalle', sql.NVarChar(sql.MAX), detalle).query(`
        INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
        VALUES (@usuario, @tabla, @registro, @accion, @detalle)
      `);
  }

  private async buscar(
    request: sql.Request,
    filtro: { id?: number; usuario?: string },
  ) {
    const { recordset } = await request
      .input('id', sql.Int, filtro.id ?? null)
      .input('usuario', sql.VarChar(50), filtro.usuario ?? null)
      .query<FilaUsuario>(`
        SELECT u.id_usuario, u.usuario, u.email, u.id_profesor, u.contrasena_hash, u.estado,
          CASE WHEN p.id_profesor IS NULL THEN NULL ELSE CONCAT(p.nombres, ' ', p.apellidos) END AS profesor,
          (SELECT STRING_AGG(r.nombre, ',') FROM USUARIO_ROL ur JOIN ROL r ON r.id_rol = ur.id_rol
            WHERE ur.id_usuario = u.id_usuario) AS roles
        FROM USUARIO u LEFT JOIN PROFESOR p ON p.id_profesor = u.id_profesor
        WHERE (@id IS NOT NULL AND u.id_usuario = @id) OR (@id IS NULL AND u.usuario = @usuario)
      `);
    return recordset[0];
  }

  private sesion(user: FilaUsuario): UsuarioSesion {
    return {
      id_usuario: user.id_usuario,
      usuario: user.usuario,
      email: user.email,
      id_profesor: user.id_profesor,
      profesor: user.profesor,
      roles: (user.roles ?? '')
        .split(',')
        .filter((rol) => ROLES.includes(rol))
        .sort(),
    };
  }

  private async hash(contrasena?: string) {
    if (!contrasena || contrasena.length < 10)
      throw new BadRequestException(
        'Usa al menos 10 caracteres para la contraseña.',
      );
    const salt = randomBytes(16).toString('hex');
    const hash = (await derive(contrasena, salt, 64)) as Buffer;
    return `${salt}:${hash.toString('hex')}`;
  }

  private huella(hash: string) {
    return digest(hash).slice(0, 16);
  }

  private firmar(datos: string) {
    return createHmac('sha256', this.secreto).update(datos).digest('base64url');
  }

  private firmaValida(datos: string, firma: string) {
    const esperada = Buffer.from(this.firmar(datos));
    const recibida = Buffer.from(firma);
    return (
      esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
    );
  }

  private async abrirSesion(id: number) {
    const previo = await this.buscar(this.db.getPool().request(), { id });
    if (!previo || !this.sesion(previo).roles.length)
      throw new UnauthorizedException('Tu cuenta no tiene un rol asignado.');
    const user = await this.db.transaction(async (tx) => {
      await tx
        .request()
        .input('id', id)
        .query(
          'UPDATE USUARIO SET ultimo_acceso = SYSDATETIME() WHERE id_usuario = @id',
        );
      await this.audit(
        id,
        'USUARIO',
        id,
        'LOGIN',
        'Inicio de sesión',
        tx.request(),
      );
      return this.buscar(tx.request(), { id });
    });
    const usuario = this.sesion(user);
    const datos = Buffer.from(
      JSON.stringify({
        u: id,
        e: Date.now() + DURACION_SESION_MS,
        h: this.huella(user.contrasena_hash),
      }),
    ).toString('base64url');
    return { token: `${datos}.${this.firmar(datos)}`, usuario };
  }
}
