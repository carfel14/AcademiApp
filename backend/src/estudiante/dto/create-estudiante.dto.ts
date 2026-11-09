import {
    IsDateString,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class CreateEstudianteDto {

    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    nombres!: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    apellidos!: string;

    @IsOptional()
    @IsDateString()
    fecha_nacimiento?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    telefono?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(150)
    email?: string;
}