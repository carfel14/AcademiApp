import { Module } from '@nestjs/common';
import { ObligacionPagoController } from './obligacion-pago.controller';
import { ObligacionPagoService } from './obligacion-pago.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ObligacionPagoController],
  providers: [ObligacionPagoService],
})
export class ObligacionPagoModule {}
