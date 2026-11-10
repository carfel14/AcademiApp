import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateInscripcionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;
}
