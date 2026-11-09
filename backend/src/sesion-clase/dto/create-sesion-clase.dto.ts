import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateSesionClaseDto {
  @IsInt()
  id_grupo!: number;

  @IsOptional()
  @IsInt()
  id_horario?: number;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha_programada!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  hora_inicio!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  hora_fin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tema?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}