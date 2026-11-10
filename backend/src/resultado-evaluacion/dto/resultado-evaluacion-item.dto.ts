import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class ResultadoEvaluacionItemDto {
  @IsInt()
  id_inscripcion!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  nota!: number;
}
