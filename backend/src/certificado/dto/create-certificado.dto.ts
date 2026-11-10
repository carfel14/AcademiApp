import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCertificadoDto {
  @IsInt()
  id_inscripcion!: number;

  // Si se omite, la base usa la fecha actual (DF_CERTIFICADO_fecha_emision).
  @IsOptional()
  @IsDateString()
  fecha_emision?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  codigo!: string;
}
