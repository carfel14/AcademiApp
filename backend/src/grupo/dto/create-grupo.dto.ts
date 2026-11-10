import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGrupoDto {
  @IsInt()
  @Min(1)
  id_plan!: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre!: string;

  @IsDateString({ strict: true })
  fecha_inicio!: string;

  // GRUPO.duracion_meses es TINYINT y debe ser mayor que 0.
  @IsInt()
  @Min(1)
  @Max(255)
  duracion_meses!: number;
}
