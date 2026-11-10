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

import { ProrrogaService } from './prorroga.service';

import { CreateProrrogaDto } from './dto/create-prorroga.dto';
import { UpdateProrrogaDto } from './dto/update-prorroga.dto';

@Controller('prorrogas')
export class ProrrogaController {
  constructor(private readonly prorrogaService: ProrrogaService) {}

  // ============================================================
  // OBTENER TODAS
  // ============================================================

  @Get()
  getProrrogas() {
    return this.prorrogaService.getProrrogas();
  }

  // ============================================================
  // OBTENER UNA
  // ============================================================

  @Get(':id')
  getProrroga(@Param('id', ParseIntPipe) id: number) {
    return this.prorrogaService.getProrroga(id);
  }

  // ============================================================
  // OBTENER POR OBLIGACIÓN
  // ============================================================

  @Get('obligacion/:idObligacion')
  getProrrogasPorObligacion(
    @Param('idObligacion', ParseIntPipe) idObligacion: number,
  ) {
    return this.prorrogaService.getProrrogasPorObligacion(idObligacion);
  }

  // ============================================================
  // CREAR
  // ============================================================

  @Post()
  createProrroga(@Body() prorroga: CreateProrrogaDto) {
    return this.prorrogaService.createProrroga(prorroga);
  }

  // ============================================================
  // ACTUALIZAR
  // ============================================================

  @Patch(':id')
  updateProrroga(
    @Param('id', ParseIntPipe) id: number,
    @Body() prorroga: UpdateProrrogaDto,
  ) {
    return this.prorrogaService.updateProrroga(id, prorroga);
  }

  // ============================================================
  // ELIMINAR
  // ============================================================

  @Delete(':id')
  deleteProrroga(@Param('id', ParseIntPipe) id: number) {
    return this.prorrogaService.deleteProrroga(id);
  }
}
