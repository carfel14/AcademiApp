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
import { SesionClaseService } from './sesion-clase.service';
import { CreateContenidoDto, UpdateContenidoDto } from './dto/contenido.dto';
import { CreateSesionClaseDto } from './dto/create-sesion-clase.dto';
import { GenerarSesionesDto } from './dto/generar-sesiones.dto';
import { UpdateSesionClaseDto } from './dto/update-sesion-clase.dto';

@Controller('sesiones')
export class SesionClaseController {
  constructor(private readonly sesionClaseService: SesionClaseService) {}

  @Get()
  getSesiones() {
    return this.sesionClaseService.getSesiones();
  }

  @Get('grupo/:idGrupo')
  getSesionesPorGrupo(@Param('idGrupo', ParseIntPipe) idGrupo: number) {
    return this.sesionClaseService.getSesionesPorGrupo(idGrupo);
  }

  // PROGRAMACION_CONTENIDO ------------------------------------------------

  @Patch('contenidos/:id')
  updateContenido(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: UpdateContenidoDto,
  ) {
    return this.sesionClaseService.updateContenido(id, datos);
  }

  @Delete('contenidos/:id')
  deleteContenido(@Param('id', ParseIntPipe) id: number) {
    return this.sesionClaseService.deleteContenido(id);
  }

  @Get(':id/contenidos')
  getContenidos(@Param('id', ParseIntPipe) id: number) {
    return this.sesionClaseService.getContenidos(id);
  }

  @Post(':id/contenidos')
  createContenido(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: CreateContenidoDto,
  ) {
    return this.sesionClaseService.createContenido(id, datos);
  }

  // SESION_CLASE ----------------------------------------------------------

  @Get(':id')
  getSesion(@Param('id', ParseIntPipe) id: number) {
    return this.sesionClaseService.getSesion(id);
  }

  @Post()
  createSesion(@Body() sesion: CreateSesionClaseDto) {
    return this.sesionClaseService.createSesion(sesion);
  }

  @Post('generar/:idGrupo')
  generarSesiones(
    @Param('idGrupo', ParseIntPipe) idGrupo: number,
    @Body() datos: GenerarSesionesDto,
  ) {
    return this.sesionClaseService.generarSesiones(idGrupo, datos);
  }

  @Patch(':id')
  updateSesion(
    @Param('id', ParseIntPipe) id: number,
    @Body() sesion: UpdateSesionClaseDto,
  ) {
    return this.sesionClaseService.updateSesion(id, sesion);
  }

  @Patch(':id/finalizar')
  finalizarSesion(@Param('id', ParseIntPipe) id: number) {
    return this.sesionClaseService.finalizarSesion(id);
  }

  @Delete(':id')
  cancelarSesion(@Param('id', ParseIntPipe) id: number) {
    return this.sesionClaseService.cancelarSesion(id);
  }
}
