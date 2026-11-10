import { Module } from '@nestjs/common';
import { ProrrogaController } from './prorroga.controller';
import { ProrrogaService } from './prorroga.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProrrogaController],
  providers: [ProrrogaService],
})
export class ProrrogaModule {}
