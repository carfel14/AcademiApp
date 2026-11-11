import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { UpdateEstudianteDto } from './dto/update-estudiante.dto';

@Controller('estudiantes')
export class EstudianteController {
  constructor(private readonly estudianteService: EstudianteService) {}

  @Get()
  getEstudiantes(@Query('estado') estado?: string) {
    if (estado !== undefined && !['ACTIVO', 'INACTIVO', 'TODOS'].includes(estado))
      throw new BadRequestException('Estado de estudiante no válido.');
    return this.estudianteService.getEstudiantes(estado as 'ACTIVO' | 'INACTIVO' | 'TODOS' | undefined);
  }

  @Get(':id')
  getEstudiante(@Param('id', ParseIntPipe) id: number) {
    return this.estudianteService.getEstudiante(id);
  }

  @Post()
  createEstudiante(@Body() estudiante: CreateEstudianteDto) {
    return this.estudianteService.createEstudiante(estudiante);
  }

  @Patch(':id')
  updateEstudiante(
    @Param('id', ParseIntPipe) id: number,
    @Body() estudiante: UpdateEstudianteDto,
  ) {
    return this.estudianteService.updateEstudiante(id, estudiante);
  }

  @Delete(':id')
  deleteEstudiante(@Param('id', ParseIntPipe) id: number) {
    return this.estudianteService.deleteEstudiante(id);
  }
}
