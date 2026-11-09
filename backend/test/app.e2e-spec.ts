import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Acceso a la API', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('requiere sesión para consultar cursos', async () => {
    await request(app.getHttpServer()).get('/cursos').expect(401);
  });

  it('requiere sesión para registrar un pago', async () => {
    await request(app.getHttpServer()).post('/pagos').send({}).expect(401);
  });

  afterAll(async () => {
    await app?.close();
  });
});
