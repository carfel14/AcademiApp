import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateInscripcionDto {
  @IsInt()
  @Min(1)
  id_estudiante!: number;

  @IsInt()
  @Min(1)
  id_grupo!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
