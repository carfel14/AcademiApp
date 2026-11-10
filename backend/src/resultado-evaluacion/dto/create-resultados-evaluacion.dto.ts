import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { ResultadoEvaluacionItemDto } from './resultado-evaluacion-item.dto';

export class CreateResultadosEvaluacionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultadoEvaluacionItemDto)
  resultados!: ResultadoEvaluacionItemDto[];
}
