import { Module } from '@nestjs/common';
import { HorarioClaseController } from './horario-clase.controller';
import { HorarioClaseService } from './horario-clase.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HorarioClaseController],
  providers: [HorarioClaseService],
})
export class HorarioClaseModule {}
