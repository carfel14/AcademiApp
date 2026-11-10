import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateAsignacionProfesorDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  id_profesor!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  id_grupo!: number;
}
