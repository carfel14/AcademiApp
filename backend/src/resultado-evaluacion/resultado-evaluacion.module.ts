import { Module } from '@nestjs/common';
import { ResultadoEvaluacionController } from './resultado-evaluacion.controller';
import { ResultadoEvaluacionService } from './resultado-evaluacion.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ResultadoEvaluacionController],
  providers: [ResultadoEvaluacionService],
})
export class ResultadoEvaluacionModule {}
