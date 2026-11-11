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
import {
  MENSAJE_NOMBRE,
  MENSAJE_TELEFONO,
  NOMBRE_PERSONA,
  TELEFONO,
} from '../../common/validaciones';

export class CreateEstudianteDto {
  // Opcional: si no se envía, el servicio asigna EST-000000.
  @IsOptional()
  @Matches(/^\S+$/)
  @MaxLength(20)
  codigo?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Matches(NOMBRE_PERSONA, { message: `Los nombres ${MENSAJE_NOMBRE}` })
  nombres!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Matches(NOMBRE_PERSONA, { message: `Los apellidos ${MENSAJE_NOMBRE}` })
  apellidos!: string;

  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(TELEFONO, { message: MENSAJE_TELEFONO })
  telefono?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @IsOptional()
  @IsIn(['EMAIL', 'WHATSAPP', 'SMS'])
  canal_preferido?: string;
}
