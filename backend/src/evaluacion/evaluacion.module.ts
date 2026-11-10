import { Module } from '@nestjs/common';
import { EvaluacionController } from './evaluacion.controller';
import { EvaluacionService } from './evaluacion.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EvaluacionController],
  providers: [EvaluacionService],
})
export class EvaluacionModule {}
