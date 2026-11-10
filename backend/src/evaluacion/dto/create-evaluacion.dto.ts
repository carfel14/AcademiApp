import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export const TIPOS_EVALUACION = ['EXAMEN', 'TAREA', 'PROYECTO'];

export class CreateEvaluacionDto {
  @IsInt()
  id_sesion!: number;

  @IsIn(TIPOS_EVALUACION)
  tipo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
