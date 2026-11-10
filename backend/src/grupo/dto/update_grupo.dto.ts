import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateGrupoDto } from './create-grupo.dto';

// El plan de estudio de un grupo no cambia después de crearlo.
export class UpdateGrupoDto extends PartialType(
  OmitType(CreateGrupoDto, ['id_plan'] as const),
) {}
