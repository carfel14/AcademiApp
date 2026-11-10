import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { AsistenciaRegistroDto } from './asistencia-registro.dto';

export class RegistrarAsistenciasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsistenciaRegistroDto)
  asistencias!: AsistenciaRegistroDto[];
}
