import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseService } from '../database/database.service';

const derive = promisify(scrypt);
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export interface UsuarioSesion {
  id_usuario: number;
  username: string;
  nombres: string;
  apellidos: string;
  rol: string;
}

export interface UsuarioDatos {
  username: string;
  nombres: string;
  apellidos: string;
  id_rol: number;
  activo: boolean;
  password?: string;
}

@Injectable()
export class SeguridadService {
  constructor(private readonly db: DatabaseService) {}

  async setup(secret: string, user: Omit<UsuarioDatos, 'id_rol' | 'activo'>) {
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
    const hash = await this.hash(user.password);
    const id = await this.db.transaction(async (tx) => {
      const count = await tx
        .request()
        .query(
          'SELECT COUNT(*) AS total FROM usuario WITH (UPDLOCK, HOLDLOCK)',
        );
      if (count.recordset[0].total)
        throw new ConflictException('La aplicación ya está configurada.');
      const { recordset } = await this.usuarioRequest(
        tx.request(),
        { ...user, id_rol: 0, activo: true },
        hash,
      )
        .query(`INSERT INTO usuario (username, nombres, apellidos, id_rol, activo, password_hash)
          OUTPUT INSERTED.id_usuario
          SELECT @username, @nombres, @apellidos, id_rol, 1, @hash FROM rol WHERE nombre = 'ADMIN'`);
      return recordset[0].id_usuario;
    });
    return this.abrirSesion(id);
  }

  async login(username: string, password: string) {
    const { recordset } = await this.db
      .getPool()
      .request()
      .input('username', username).query(`
      SELECT id_usuario, password_hash FROM usuario WHERE username = @username AND activo = 1
    `);
    const user = recordset[0];
    const [salt, expected] = (user?.password_hash ?? '').split(':');
    const validFormat =
      /^[a-f0-9]{32}$/.test(salt ?? '') &&
      /^[a-f0-9]{128}$/.test(expected ?? '');
    const value = (await derive(
      password,
      validFormat ? salt : 'academiapp',
      64,
    )) as Buffer;
    if (!validFormat || !timingSafeEqual(value, Buffer.from(expected, 'hex'))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    return this.abrirSesion(user.id_usuario);
  }

  async session(token?: string): Promise<UsuarioSesion> {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Inicia sesión.');
    const { recordset } = await this.db
      .getPool()
      .request()
      .input('token', digest(token)).query<UsuarioSesion>(`
      SELECT u.id_usuario, u.username, u.nombres, u.apellidos, r.nombre AS rol
      FROM usuario_sesion s JOIN usuario u ON u.id_usuario = s.id_usuario
      JOIN rol r ON r.id_rol = u.id_rol
      WHERE s.token_hash = @token AND s.expira > SYSUTCDATETIME() AND u.activo = 1
        AND r.nombre IN ('ADMIN', 'PROFESOR', 'CAJA')
    `);
    if (!recordset.length)
      throw new UnauthorizedException(
        'Tu sesión expiró. Inicia sesión nuevamente.',
      );
    return recordset[0];
  }

  async logout(token: string, id: number) {
    await this.db.transaction(async (tx) => {
      await tx
        .request()
        .input('token', digest(token))
        .query('DELETE usuario_sesion WHERE token_hash = @token');
      await this.audit(
        id,
        'usuario',
        id,
        'LOGOUT',
        'Cierre de sesión',
        tx.request(),
      );
    });
    return { mensaje: 'Sesión cerrada.' };
  }

  async usuarios() {
    return (
      await this.db.getPool().request().query(`
      SELECT u.id_usuario, u.username, u.nombres, u.apellidos, u.activo, u.id_rol, r.nombre AS rol
      FROM usuario u JOIN rol r ON r.id_rol = u.id_rol ORDER BY u.username
    `)
    ).recordset;
  }

  async roles() {
    return (
      await this.db
        .getPool()
        .request()
        .query(
          "SELECT id_rol, nombre, descripcion FROM rol WHERE nombre IN ('ADMIN', 'PROFESOR', 'CAJA') ORDER BY nombre",
        )
    ).recordset;
  }

  async guardarUsuario(data: UsuarioDatos, actor: number, id?: number) {
    if (id === actor) {
      const actual = (
        await this.db
          .getPool()
          .request()
          .input('id', id)
          .query('SELECT id_rol FROM usuario WHERE id_usuario = @id')
      ).recordset[0];
      if (!data.activo || data.id_rol !== actual.id_rol) {
        throw new BadRequestException(
          'Tu cuenta debe conservar su rol y permanecer activa.',
        );
      }
    }
    const hash = id && !data.password ? null : await this.hash(data.password);
    return this.db.transaction(async (tx) => {
      const rol = await tx
        .request()
        .input('id', data.id_rol)
        .query(
          "SELECT id_rol FROM rol WHERE id_rol = @id AND nombre IN ('ADMIN', 'PROFESOR', 'CAJA')",
        );
      if (!rol.recordset.length)
        throw new BadRequestException('El rol seleccionado no existe.');
      const result = await this.usuarioRequest(tx.request(), data, hash)
        .input('id', id ?? null)
        .query(
          `
        IF @id IS NULL
          INSERT INTO usuario (username, nombres, apellidos, id_rol, activo, password_hash)
          OUTPUT INSERTED.id_usuario VALUES (@username, @nombres, @apellidos, @rol, @activo, @hash);
        ELSE
          UPDATE usuario SET username = @username, nombres = @nombres, apellidos = @apellidos,
            id_rol = @rol, activo = @activo, password_hash = COALESCE(@hash, password_hash)
          OUTPUT INSERTED.id_usuario WHERE id_usuario = @id;
      `,
        )
        .catch((error) => {
          if ([2601, 2627].includes(error.number))
            throw new ConflictException('Ese nombre de usuario ya existe.');
          throw error;
        });
      const row = result.recordset[0];
      if (!row) throw new NotFoundException('El usuario no existe.');
      if (id && (hash || !data.activo)) {
        await tx
          .request()
          .input('id', id)
          .query('DELETE usuario_sesion WHERE id_usuario = @id');
      }
      await this.audit(
        actor,
        'usuario',
        row.id_usuario,
        id ? 'UPDATE' : 'INSERT',
        'Administración de usuarios',
        tx.request(),
      );
      return row;
    });
  }

  async audit(
    usuario: number,
    tabla: string,
    registro: number | null,
    accion: string,
    detalle: string,
    request = this.db.getPool().request(),
  ) {
    await request
      .input('usuario', usuario)
      .input('tabla', tabla)
      .input('registro', registro)
      .input('accion', accion)
      .input('detalle', detalle).query(`
        INSERT INTO bitacora (id_usuario, tabla, id_registro, accion, detalle, fecha)
        VALUES (@usuario, @tabla, @registro, @accion, @detalle, SYSUTCDATETIME())
      `);
  }

  private usuarioRequest(
    request: import('mssql').Request,
    data: UsuarioDatos,
    hash: string | null,
  ) {
    return request
      .input('username', data.username.trim())
      .input('nombres', data.nombres.trim())
      .input('apellidos', data.apellidos.trim())
      .input('rol', data.id_rol)
      .input('activo', data.activo)
      .input('hash', hash);
  }

  private async hash(password?: string) {
    if (!password || password.length < 10)
      throw new BadRequestException(
        'Usa al menos 10 caracteres para la contraseña.',
      );
    const salt = randomBytes(16).toString('hex');
    const hash = (await derive(password, salt, 64)) as Buffer;
    return `${salt}:${hash.toString('hex')}`;
  }

  private async abrirSesion(id: number) {
    const token = randomBytes(32).toString('hex');
    await this.db.transaction(async (tx) => {
      await tx.request().input('id', id).input('token', digest(token)).query(`
        DELETE usuario_sesion WHERE expira <= SYSUTCDATETIME();
        INSERT INTO usuario_sesion (id_usuario, token_hash, expira)
        VALUES (@id, @token, DATEADD(hour, 12, SYSUTCDATETIME()));
      `);
      await this.audit(
        id,
        'usuario',
        id,
        'LOGIN',
        'Inicio de sesión',
        tx.request(),
      );
    });
    return { token, usuario: await this.session(token) };
  }
}
