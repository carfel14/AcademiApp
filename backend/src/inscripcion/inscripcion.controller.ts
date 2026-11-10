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
import { InscripcionService } from './inscripcion.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { UpdateInscripcionDto } from './dto/update-inscripcion.dto';

@Controller('inscripciones')
export class InscripcionController {
  constructor(private readonly inscripcionService: InscripcionService) {}

  @Get()
  getInscripciones() {
    return this.inscripcionService.getInscripciones();
  }

  @Get('grupo/:idGrupo')
  getInscripcionesPorGrupo(@Param('idGrupo', ParseIntPipe) idGrupo: number) {
    return this.inscripcionService.getInscripcionesPorGrupo(idGrupo);
  }

  @Get(':id')
  getInscripcion(@Param('id', ParseIntPipe) id: number) {
    return this.inscripcionService.getInscripcion(id);
  }

  @Post()
  createInscripcion(@Body() inscripcion: CreateInscripcionDto) {
    return this.inscripcionService.createInscripcion(inscripcion);
  }

  @Patch(':id')
  updateInscripcion(
    @Param('id', ParseIntPipe) id: number,
    @Body() inscripcion: UpdateInscripcionDto,
  ) {
    return this.inscripcionService.updateInscripcion(id, inscripcion);
  }

  @Delete(':id')
  deleteInscripcion(@Param('id', ParseIntPipe) id: number) {
    return this.inscripcionService.deleteInscripcion(id);
  }
}
