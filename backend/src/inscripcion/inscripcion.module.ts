import { Module } from '@nestjs/common';
import { InscripcionController } from './inscripcion.controller';
import { InscripcionService } from './inscripcion.service';
import { DatabaseModule } from 'src/database/database.module';
import { PagoModule } from 'src/pago/pago.module';

@Module({
  imports: [DatabaseModule, PagoModule],
  controllers: [InscripcionController],
  providers: [InscripcionService],
})
export class InscripcionModule {}
