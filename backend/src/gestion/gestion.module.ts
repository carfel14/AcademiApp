import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GestionController } from './gestion.controller';
import { GestionService } from './gestion.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GestionController],
  providers: [GestionService],
})
export class GestionModule {}
