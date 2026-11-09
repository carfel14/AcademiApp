import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: sql.ConnectionPool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const localDb = this.configService.get<string>('DB_LOCALDB_PIPE');
    if (localDb) {
      // Carga opcional. Las conexiones TCP siguen usando el controlador habitual.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const driver = require('mssql/msnodesqlv8') as typeof sql;
      const database =
        this.configService.get<string>('DB_DATABASE') ?? 'AcademiApp';
      this.pool = await new driver.ConnectionPool({
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${localDb};Database=${database};Trusted_Connection=yes;`,
        server: localDb,
      }).connect();
      // ODBC etiqueta las columnas INT IDENTITY como un tipo distinto de INT.
      // Normaliza los identificadores para que conserven el contrato del controlador TCP.
      const request = this.pool.request.bind(this.pool);
      this.pool.request = () => this.normalizarIdentificadores(request());
      const transaction = this.pool.transaction.bind(this.pool);
      this.pool.transaction = () => {
        const tx = transaction();
        const request = tx.request.bind(tx);
        tx.request = () => this.normalizarIdentificadores(request());
        return tx;
      };
      return;
    }

    this.pool = await new sql.ConnectionPool({
      server: this.configService.get<string>('DB_SERVER'),
      database: this.configService.get<string>('DB_DATABASE'),
      user: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASSWORD'),
      port: Number(this.configService.get<string>('DB_PORT')),
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    }).connect();
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

  private normalizarIdentificadores(request: sql.Request) {
    const query = request.query.bind(request);
    request.query = (async (statement: string) => {
      const result = await query(statement);
      for (const rows of result.recordsets as Record<string, unknown>[][]) {
        for (const row of rows) {
          for (const [key, value] of Object.entries(row)) {
            if (
              key.startsWith('id_') &&
              key !== 'id_bitacora' &&
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
