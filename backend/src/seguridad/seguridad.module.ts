import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { SeguridadController } from './seguridad.controller';
import { BitacoraInterceptor, SeguridadGuard } from './seguridad.guard';
import { SeguridadService } from './seguridad.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SeguridadController],
  providers: [
    SeguridadService,
    { provide: APP_GUARD, useClass: SeguridadGuard },
    { provide: APP_INTERCEPTOR, useClass: BitacoraInterceptor },
  ],
})
export class SeguridadModule {}
