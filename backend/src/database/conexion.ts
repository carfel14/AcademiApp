import { Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as sql from 'mssql';

const logger = new Logger('Conexion');

export interface ConfigConexion {
  DB_DATABASE?: string;
  DB_LOCALDB_INSTANCE?: string;
  DB_LOCALDB_PIPE?: string;
  DB_SERVER?: string;
  DB_PORT?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
}

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
  const pipes = [
    ...texto.matchAll(/\\\\\.\\pipe\\LOCALDB#[0-9A-F]+\\tsql\\query/gi),
  ];
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
export async function pipeLocalDb(instancia: string): Promise<string> {
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
 * Abre un pool contra LocalDB (named pipe, autenticación de Windows) o contra
 * SQL Server por TCP. `database` permite conectarse a otra base, como master.
 */
export async function abrirPool(
  config: ConfigConexion,
  opciones: { database?: string; max?: number } = {},
): Promise<sql.ConnectionPool> {
  const database =
    opciones.database ?? config.DB_DATABASE ?? 'AcademiaBellezaSilvia';
  const pool = opciones.max ? { max: opciones.max, min: 0 } : undefined;
  const localDb =
    config.DB_LOCALDB_PIPE ||
    (config.DB_LOCALDB_INSTANCE
      ? await pipeLocalDb(config.DB_LOCALDB_INSTANCE)
      : undefined);
  if (localDb) {
    // Carga opcional. Las conexiones TCP siguen usando el controlador habitual.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const driver = require('mssql/msnodesqlv8') as typeof sql;
    return new driver.ConnectionPool({
      connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${localDb};Database=${database};Trusted_Connection=yes;`,
      server: localDb,
      pool,
    }).connect();
  }
  return new sql.ConnectionPool({
    server: config.DB_SERVER ?? 'localhost',
    database,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    port: Number(config.DB_PORT ?? 1433),
    pool,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  }).connect();
}
