import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProrrogaDto {
  @IsInt()
  @Min(1)
  id_obligacion!: number;

  @IsDateString()
  fecha_inicio!: string;

  @IsDateString()
  fecha_finalizacion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;
}
