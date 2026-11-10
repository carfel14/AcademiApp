import { IsIn, IsOptional } from 'class-validator';
import { TIPOS_SESION } from './create-sesion-clase.dto';

export class GenerarSesionesDto {
  // SESION_CLASE.tipo_sesion es obligatorio; por defecto se generan TEORICA.
  @IsOptional()
  @IsIn(TIPOS_SESION)
  tipo_sesion?: string;
}
