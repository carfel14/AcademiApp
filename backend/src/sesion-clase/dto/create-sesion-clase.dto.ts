import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const TIPOS_SESION = ['TEORICA', 'PRACTICA', 'REPASO'];
export const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CreateSesionClaseDto {
  @IsInt()
  id_grupo!: number;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha_programada!: string;

  @IsString()
  @Matches(HORA_VALIDA)
  hora_inicio!: string;

  @IsString()
  @Matches(HORA_VALIDA)
  hora_finalizacion!: string;

  @IsIn(TIPOS_SESION)
  tipo_sesion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
