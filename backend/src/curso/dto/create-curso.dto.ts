import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCursoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  // Regla de la academia: el curso no puede ser gratuito.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'El precio total debe ser mayor que 0.' })
  @Max(99999999.99)
  precio_total!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'El precio de matrícula debe ser mayor que 0.' })
  @Max(99999999.99)
  precio_matricula!: number;
}
