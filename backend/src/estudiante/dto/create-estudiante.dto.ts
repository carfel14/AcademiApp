import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEstudianteDto {
  // Opcional: si no se envía, el servicio asigna EST-000000.
  @IsOptional()
  @Matches(/^\S+$/)
  @MaxLength(20)
  codigo?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombres!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  apellidos!: string;

  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @IsOptional()
  @IsIn(['EMAIL', 'WHATSAPP', 'SMS'])
  canal_preferido?: string;
}
