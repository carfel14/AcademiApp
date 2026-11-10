import { PartialType } from '@nestjs/mapped-types';
import { CreateHorarioDto } from './create-horario.dto';

//PartialType significa que en un PATCH todos los campos son opcionales
export class UpdateHorarioDto extends PartialType(CreateHorarioDto) {}
