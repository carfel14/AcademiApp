import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AsistenciaRegistroDto {
  @IsInt()
  id_inscripcion!: number;

  @IsIn([
    'PRESENTE',
    'AUSENTE',
    'JUSTIFICADO',
    'SUSPENDIDO_POR_MORA',
  ])
  estado_asistencia!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observacion?: string;
}