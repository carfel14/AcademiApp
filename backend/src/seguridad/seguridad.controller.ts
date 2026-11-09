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
  IsBoolean,
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
  @IsString() @Length(1, 50) username: string;
  @IsString() @Length(1, 128) password: string;
}

class SetupDto extends LoginDto {
  @Matches(/\S/) @MaxLength(100) nombres: string;
  @Matches(/\S/) @MaxLength(100) apellidos: string;
  @IsString() @Length(1, 256) clave: string;
}

class UsuarioDto {
  @Matches(/^\S+$/) @Length(1, 50) username: string;
  @Matches(/\S/) @MaxLength(100) nombres: string;
  @Matches(/\S/) @MaxLength(100) apellidos: string;
  @IsInt() @Min(1) id_rol: number;
  @IsBoolean() activo: boolean;
  @IsOptional() @IsString() @Length(10, 128) password?: string;
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
    return this.seguridad.login(body.username.trim(), body.password);
  }

  @Get('sesion') sesion(@Req() req: AuthRequest) {
    return req.usuario;
  }

  @Post('logout') logout(@Req() req: AuthRequest) {
    return this.seguridad.logout(req.token, req.usuario.id_usuario);
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
