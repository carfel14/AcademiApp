import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateHorarioDto {
  //No guardamos el id_grupo porque lo recibiremos desde la URL
  //de la siguiente manera. POST /grupos/id/horarios

  @IsNotEmpty()
  @IsString()
  @IsIn([
    'LUNES',
    'MARTES',
    'MIERCOLES',
    'JUEVES',
    'VIERNES',
    'SABADO',
    'DOMINGO',
  ])
  dia_semana!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  hora_inicio!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  hora_finalizacion!: string;
}
