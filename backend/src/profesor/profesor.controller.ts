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
import { ProfesorService } from './profesor.service';
import {
  CreateEspecialidadDto,
  CreateProfesorDto,
} from './dto/create-profesor.dto';
import { UpdateProfesorDto } from './dto/update-profesor.dto';

@Controller('profesores')
export class ProfesorController {
  constructor(private readonly profesorService: ProfesorService) {}

  @Get()
  getProfesores() {
    return this.profesorService.getProfesores();
  }

  @Get('especialidades')
  getEspecialidades() {
    return this.profesorService.getEspecialidades();
  }

  @Post('especialidades')
  createEspecialidad(@Body() body: CreateEspecialidadDto) {
    return this.profesorService.guardarEspecialidad(body.nombre);
  }

  @Patch('especialidades/:id')
  updateEspecialidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateEspecialidadDto,
  ) {
    return this.profesorService.guardarEspecialidad(body.nombre, id);
  }

  @Delete('especialidades/:id')
  deleteEspecialidad(@Param('id', ParseIntPipe) id: number) {
    return this.profesorService.deleteEspecialidad(id);
  }

  @Get(':id')
  getProfesor(@Param('id', ParseIntPipe) id: number) {
    return this.profesorService.getProfesor(id);
  }

  @Post()
  createProfesor(@Body() profesor: CreateProfesorDto) {
    return this.profesorService.createProfesor(profesor);
  }

  @Patch(':id')
  updateProfesor(
    @Param('id', ParseIntPipe) id: number,
    @Body() profesor: UpdateProfesorDto,
  ) {
    return this.profesorService.updateProfesor(id, profesor);
  }

  @Delete(':id')
  deleteProfesor(@Param('id', ParseIntPipe) id: number) {
    return this.profesorService.deleteProfesor(id);
  }
}
