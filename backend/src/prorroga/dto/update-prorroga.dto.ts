import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProrrogaDto } from './create-prorroga.dto';

export class UpdateProrrogaDto extends PartialType(
  OmitType(CreateProrrogaDto, ['id_obligacion'] as const),
) {}
