import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as sql from 'mssql';
import { abrirPool, type ConfigConexion } from './conexion';

/**
 * Usuario de la petición en curso. Los triggers de bitácora del script leen
 * SESSION_CONTEXT(N'id_usuario'), así que cada consulta lo fija en su conexión.
 */
export const contextoUsuario = new AsyncLocalStorage<{
  id_usuario: number | null;
}>();

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: sql.ConnectionPool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const claves: (keyof ConfigConexion)[] = [
      'DB_DATABASE',
      'DB_LOCALDB_INSTANCE',
      'DB_LOCALDB_PIPE',
      'DB_SERVER',
      'DB_PORT',
      'DB_USER',
      'DB_PASSWORD',
    ];
    this.pool = await abrirPool(
      Object.fromEntries(
        claves.map((clave) => [clave, this.configService.get<string>(clave)]),
      ),
    );

    const request = this.pool.request.bind(this.pool);
    this.pool.request = () => this.preparar(request());
    const transaction = this.pool.transaction.bind(this.pool);
    this.pool.transaction = () => {
      const tx = transaction();
      const txRequest = tx.request.bind(tx);
      tx.request = () => this.preparar(txRequest());
      return tx;
    };
  }

  async transaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = this.pool.transaction();
    await tx.begin();
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  }

  /**
   * - Fija SESSION_CONTEXT(N'id_usuario') antes de cada consulta.
   * - ODBC devuelve INT IDENTITY y BIGINT como texto; los convierte a número
   *   para conservar el mismo contrato que el controlador TCP.
   */
  private preparar(request: sql.Request) {
    const query = request.query.bind(request);
    request.query = (async (statement: string) => {
      const usuario = contextoUsuario.getStore()?.id_usuario ?? null;
      // Un mismo request puede ejecutar varias consultas.
      if (request.parameters.__id_usuario)
        request.replaceInput('__id_usuario', sql.Int, usuario);
      else request.input('__id_usuario', sql.Int, usuario);
      const result = await query(
        `EXEC sp_set_session_context @key = N'id_usuario', @value = @__id_usuario;\n${statement}`,
      );
      for (const rows of (result.recordsets ?? []) as (Record<
        string,
        unknown
      >[] & { columns?: Record<string, { type?: unknown }> })[]) {
        // El script registra DATETIME2 con SYSDATETIME() (hora local del
        // servidor). Se devuelven como fecha y hora local sin zona horaria.
        const locales = Object.entries(rows.columns ?? {})
          .filter(([, column]) => column.type === sql.DateTime2)
          .map(([name]) => name);
        for (const row of rows) {
          for (const name of locales) {
            const value = row[name];
            if (value instanceof Date)
              row[name] = value.toISOString().slice(0, 19);
          }
          for (const [key, value] of Object.entries(row)) {
            if (
              key.startsWith('id_') &&
              typeof value === 'string' &&
              /^\d+$/.test(value)
            ) {
              row[key] = Number(value);
            }
          }
        }
      }
      return result;
    }) as typeof request.query;
    return request;
  }

  async onModuleDestroy() {
    await this.pool?.close();
  }

  getPool(): sql.ConnectionPool {
    return this.pool;
  }
}
