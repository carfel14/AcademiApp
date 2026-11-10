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
import { CursoService } from './curso.service';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';

@Controller('cursos')
export class CursoController {
  constructor(private readonly cursoService: CursoService) {}

  @Get()
  getCursos() {
    return this.cursoService.getCursos();
  }

  @Get(':id')
  getCurso(@Param('id', ParseIntPipe) id: number) {
    return this.cursoService.getCurso(id);
  }

  @Post()
  createCurso(@Body() curso: CreateCursoDto) {
    return this.cursoService.createCurso(curso);
  }

  @Patch(':id')
  updateCurso(
    @Param('id', ParseIntPipe) id: number,
    @Body() curso: UpdateCursoDto,
  ) {
    return this.cursoService.updateCurso(id, curso);
  }

  @Delete(':id')
  deleteCurso(@Param('id', ParseIntPipe) id: number) {
    return this.cursoService.deleteCurso(id);
  }
}
