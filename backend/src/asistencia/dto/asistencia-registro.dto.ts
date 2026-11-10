import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class AsistenciaRegistroDto {
  @IsInt()
  id_inscripcion!: number;

  @IsIn(['PRESENTE', 'AUSENTE', 'JUSTIFICADA', 'SUSPENDIDO_POR_MORA'])
  estado_asistencia!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
