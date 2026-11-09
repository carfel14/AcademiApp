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

import { EvaluacionService } from './evaluacion.service';
import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { UpdateEvaluacionDto } from './dto/update-evaluacion.dto';

@Controller('evaluaciones')
export class EvaluacionController {
  constructor(
    private readonly evaluacionService: EvaluacionService,
  ) {}

  @Get()
  getEvaluaciones(@Query('sesion', new ParseIntPipe({ optional: true })) sesion?: number) {
    return this.evaluacionService.getEvaluaciones(sesion);
  }

  @Get(':id')
  getEvaluacion(@Param('id', ParseIntPipe) id: number) {
    return this.evaluacionService.getEvaluacion(id);
  }

  @Post()
  createEvaluacion(@Body() evaluacion: CreateEvaluacionDto) {
    return this.evaluacionService.createEvaluacion(evaluacion);
  }

  @Patch(':id')
  updateEvaluacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() evaluacion: UpdateEvaluacionDto,
  ) {
    return this.evaluacionService.updateEvaluacion(
      id,
      evaluacion,
    );
  }
}