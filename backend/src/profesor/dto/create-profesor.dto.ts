import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProfesorDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombres!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  apellidos!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string | null;

  // Nombres de ESPECIALIDAD; las que no existan se crean.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  especialidades?: string[];
}

export class CreateEspecialidadDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre!: string;
}
