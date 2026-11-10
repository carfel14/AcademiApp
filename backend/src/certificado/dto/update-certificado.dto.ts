import { IsIn, IsString } from 'class-validator';

export class UpdateCertificadoDto {
  @IsString()
  @IsIn(['EMITIDO', 'ANULADO'])
  estado!: string;
}
