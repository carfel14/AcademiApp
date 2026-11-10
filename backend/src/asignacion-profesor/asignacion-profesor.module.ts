import { Module } from '@nestjs/common';
import { AsignacionProfesorController } from './asignacion-profesor.controller';
import { AsignacionProfesorService } from './asignacion-profesor.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AsignacionProfesorController],
  providers: [AsignacionProfesorService],
})
export class AsignacionProfesorModule {}
