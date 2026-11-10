import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { SeguridadService, UsuarioSesion } from './seguridad.service';

class LoginDto {
  @IsString() @Length(1, 50) usuario: string;
  @IsString() @Length(1, 128) contrasena: string;
}

class SetupDto extends LoginDto {
  @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @IsString() @Length(1, 256) clave: string;
}

class UsuarioDto {
  @Matches(/^\S+$/) @Length(1, 50) usuario: string;
  @IsOptional() @IsEmail() @MaxLength(150) email?: string | null;
  @IsOptional() @IsInt() @Min(1) id_profesor?: number | null;
  @IsIn(['ACTIVO', 'INACTIVO']) estado: 'ACTIVO' | 'INACTIVO';
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  roles: number[];
  @IsOptional() @IsString() @Length(10, 128) contrasena?: string;
}

export interface AuthRequest {
  method: string;
  path: string;
  headers: { authorization?: string };
  usuario: UsuarioSesion;
  token: string;
}

@Controller('auth')
export class SeguridadController {
  constructor(private readonly seguridad: SeguridadService) {}

  @Post('configurar') setup(@Body() body: SetupDto) {
    return this.seguridad.setup(body.clave, body);
  }

  @Post('login') login(@Body() body: LoginDto) {
    return this.seguridad.login(body.usuario.trim(), body.contrasena);
  }

  @Get('sesion') sesion(@Req() req: AuthRequest) {
    return req.usuario;
  }

  @Post('logout') logout(@Req() req: AuthRequest) {
    return this.seguridad.logout(req.usuario.id_usuario);
  }

  @Get('usuarios') usuarios() {
    return this.seguridad.usuarios();
  }

  @Get('roles') roles() {
    return this.seguridad.roles();
  }

  @Post('usuarios') crear(@Body() body: UsuarioDto, @Req() req: AuthRequest) {
    return this.seguridad.guardarUsuario(body, req.usuario.id_usuario);
  }

  @Patch('usuarios/:id') editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UsuarioDto,
    @Req() req: AuthRequest,
  ) {
    return this.seguridad.guardarUsuario(body, req.usuario.id_usuario, id);
  }
}
