import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateResultadoEvaluacionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nota?: number;
}
