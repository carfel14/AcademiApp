import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEvaluacionDto } from './create-evaluacion.dto';

export class UpdateEvaluacionDto extends PartialType(
  OmitType(CreateEvaluacionDto, ['id_sesion'] as const),
) {}
