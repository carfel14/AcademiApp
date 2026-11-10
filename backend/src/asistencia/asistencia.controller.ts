import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { AsistenciaService } from './asistencia.service';
import { RegistrarAsistenciasDto } from './dto/registrar-asistencias.dto';

@Controller('asistencias')
export class AsistenciaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  @Get()
  getAsistencias() {
    return this.asistenciaService.getAsistencias();
  }

  @Get(':id')
  getAsistencia(@Param('id', ParseIntPipe) id: number) {
    return this.asistenciaService.getAsistencia(id);
  }

  @Get('sesion/:id')
  getLista(@Param('id', ParseIntPipe) id: number) {
    return this.asistenciaService.getLista(id);
  }

  @Post('sesion/:id')
  registrarAsistencias(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: RegistrarAsistenciasDto,
  ) {
    return this.asistenciaService.registrarAsistencias(id, data);
  }
}
