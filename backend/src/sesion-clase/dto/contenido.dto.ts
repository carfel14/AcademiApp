import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const ESTADOS = ['PENDIENTE', 'PARCIAL', 'CUBIERTO'];

export class UpdateContenidoDto {
  @IsOptional()
  @IsIn(ESTADOS)
  estado_cumplimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;
}

export class CreateContenidoDto extends UpdateContenidoDto {
  @IsInt()
  @Min(1)
  id_tema!: number;
}
