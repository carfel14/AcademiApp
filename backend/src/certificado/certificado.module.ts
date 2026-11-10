import { Module } from '@nestjs/common';
import { CertificadoController } from './certificado.controller';
import { CertificadoService } from './certificado.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CertificadoController],
  providers: [CertificadoService],
})
export class CertificadoModule {}
