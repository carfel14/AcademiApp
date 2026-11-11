import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MENSAJE_NOMBRE,
  MENSAJE_TELEFONO,
  NOMBRE_PERSONA,
  TELEFONO,
} from '../../common/validaciones';

export class CreateProfesorDto {
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
  @IsString()
  @MaxLength(20)
  @Matches(TELEFONO, { message: MENSAJE_TELEFONO })
  telefono?: string | null;

  // id_especialidad elegidos del catálogo ESPECIALIDAD.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  especialidades?: number[];
}

export class CreateEspecialidadDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre!: string;
}
