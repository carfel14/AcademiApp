import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { contextoUsuario } from './database/database.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cada petición tiene su propio contexto; el guard asigna el id_usuario
  // que luego se envía a SESSION_CONTEXT para los triggers de bitácora.
  app.use((_req: unknown, _res: unknown, next: () => void) =>
    contextoUsuario.run({ id_usuario: null }, next),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
