import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Patch,
  Post,
} from '@nestjs/common';

import { ResultadoEvaluacionService } from './resultado-evaluacion.service';
import { CreateResultadosEvaluacionDto } from './dto/create-resultados-evaluacion.dto';
import { UpdateResultadoEvaluacionDto } from './dto/update-resultado-evaluacion.dto';

@Controller('resultados-evaluacion')
export class ResultadoEvaluacionController {
  constructor(
    private readonly resultadoEvaluacionService: ResultadoEvaluacionService,
  ) {}

  @Get()
  getResultados(
    @Query('sesion', new ParseIntPipe({ optional: true })) sesion?: number,
  ) {
    return this.resultadoEvaluacionService.getResultados(sesion);
  }

  @Get(':id')
  getResultado(@Param('id', ParseIntPipe) id: number) {
    return this.resultadoEvaluacionService.getResultado(id);
  }

  @Post('evaluacion/:id')
  createResultados(
    @Param('id', ParseIntPipe) id: number,
    @Body() resultados: CreateResultadosEvaluacionDto,
  ) {
    return this.resultadoEvaluacionService.createResultados(id, resultados);
  }

  @Patch(':id')
  updateResultado(
    @Param('id', ParseIntPipe) id: number,
    @Body() resultado: UpdateResultadoEvaluacionDto,
  ) {
    return this.resultadoEvaluacionService.updateResultado(id, resultado);
  }
}
