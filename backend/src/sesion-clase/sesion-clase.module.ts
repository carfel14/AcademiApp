import { Module } from '@nestjs/common';
import { SesionClaseController } from './sesion-clase.controller';
import { SesionClaseService } from './sesion-clase.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SesionClaseController],
  providers: [SesionClaseService],
})
export class SesionClaseModule {}
