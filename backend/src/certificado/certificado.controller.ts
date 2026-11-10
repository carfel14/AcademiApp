import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CertificadoService } from './certificado.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';

@Controller('certificados')
export class CertificadoController {
  constructor(private readonly certificadoService: CertificadoService) {}

  // ============================================================
  // OBTENER TODOS
  // ============================================================

  @Get()
  getCertificados() {
    return this.certificadoService.getCertificados();
  }

  // ============================================================
  // OBTENER UNO
  // ============================================================

  @Get(':id')
  getCertificado(@Param('id', ParseIntPipe) id: number) {
    return this.certificadoService.getCertificado(id);
  }

  // ============================================================
  // EMITIR CERTIFICADO
  // ============================================================

  @Post()
  createCertificado(@Body() data: CreateCertificadoDto) {
    return this.certificadoService.createCertificado(data);
  }

  // ============================================================
  // ACTUALIZAR ESTADO
  // ============================================================

  @Patch(':id')
  updateCertificado(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateCertificadoDto,
  ) {
    return this.certificadoService.updateCertificado(id, data);
  }

  // ============================================================
  // ELIMINAR
  // ============================================================

  @Delete(':id')
  deleteCertificado(@Param('id', ParseIntPipe) id: number) {
    return this.certificadoService.deleteCertificado(id);
  }
}
