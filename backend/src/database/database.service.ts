import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as sql from 'mssql';

const logger = new Logger('DatabaseService');

/** Último canal np: que la instancia de LocalDB registró en su error.log. */
async function leerPipe(instancia: string) {
  const ruta = join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft',
    'Microsoft SQL Server Local DB',
    'Instances',
    instancia,
    'error.log',
  );
  const buffer = await readFile(ruta).catch(() => undefined);
  if (!buffer) return { pipe: undefined, ruta };
  const texto =
    buffer[0] === 0xff && buffer[1] === 0xfe
      ? buffer.toString('utf16le')
      : buffer.toString('utf8');
  const pipes = [...texto.matchAll(/\\\\\.\\pipe\\LOCALDB#[0-9A-F]+\\tsql\\query/gi)];
  return { pipe: pipes.at(-1)?.[0], ruta };
}

function pipeAccesible(pipe: string) {
  // En Windows, un named pipe activo se puede comprobar como archivo.
  return access(pipe).then(
    () => true,
    () => false,
  );
}

/**
 * LocalDB cambia de canal en cada inicio y `SqlLocalDB info` no siempre lo
 * informa. Se inicia la instancia si hace falta y se lee el canal de su log.
 */
async function pipeLocalDb(instancia: string): Promise<string> {
  let { pipe, ruta } = await leerPipe(instancia);
  if (pipe && (await pipeAccesible(pipe))) return `np:${pipe}`;

  logger.log(`Iniciando la instancia de LocalDB ${instancia}...`);
  await promisify(execFile)('sqllocaldb', ['start', instancia]).catch(
    () => undefined,
  );
  for (let intento = 0; intento < 30; intento++) {
    ({ pipe, ruta } = await leerPipe(instancia));
    if (pipe && (await pipeAccesible(pipe))) return `np:${pipe}`;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `No se encontró el canal de LocalDB "${instancia}". Revisa ${ruta} o define DB_LOCALDB_PIPE.`,
  );
}

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
    const database =
      this.configService.get<string>('DB_DATABASE') ?? 'AcademiaBellezaSilvia';
    const instancia = this.configService.get<string>('DB_LOCALDB_INSTANCE');
    const localDb =
      this.configService.get<string>('DB_LOCALDB_PIPE') ||
      (instancia ? await pipeLocalDb(instancia) : undefined);
    if (localDb) {
      // Carga opcional. Las conexiones TCP siguen usando el controlador habitual.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const driver = require('mssql/msnodesqlv8') as typeof sql;
      this.pool = await new driver.ConnectionPool({
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${localDb};Database=${database};Trusted_Connection=yes;`,
        server: localDb,
      }).connect();
    } else {
      this.pool = await new sql.ConnectionPool({
        server: this.configService.get<string>('DB_SERVER') ?? 'localhost',
        database,
        user: this.configService.get<string>('DB_USER'),
        password: this.configService.get<string>('DB_PASSWORD'),
        port: Number(this.configService.get<string>('DB_PORT') ?? 1433),
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      }).connect();
    }

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
