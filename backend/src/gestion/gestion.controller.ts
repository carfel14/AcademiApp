import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsInt,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GestionService } from './gestion.service';

class RecargoDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(99999999.99) monto: number;
  @Matches(/\S/) @MaxLength(200) motivo: string;
}

class AplicarDescuentoDto {
  @IsInt() @Min(1) id_descuento: number;
}

class RecordatoriosDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha: string;
}

@Controller()
export class GestionController {
  constructor(private readonly gestion: GestionService) {}

  @Get([
    'planes/:catalogo',
    'cobros/catalogos/:catalogo',
    'recordatorios/catalogos/:catalogo',
  ])
  catalogo(
    @Param('catalogo') catalogo: string,
    @Query('padre', new ParseIntPipe({ optional: true })) padre?: number,
  ) {
    return this.gestion.catalogo(catalogo, padre);
  }

  @Post([
    'planes/:catalogo',
    'cobros/catalogos/:catalogo',
    'recordatorios/catalogos/:catalogo',
  ])
  crear(
    @Param('catalogo') catalogo: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.gestion.guardar(catalogo, data);
  }

  @Patch([
    'planes/:catalogo/:id',
    'cobros/catalogos/:catalogo/:id',
    'recordatorios/catalogos/:catalogo/:id',
  ])
  editar(
    @Param('catalogo') catalogo: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Record<string, unknown>,
  ) {
    return this.gestion.guardar(catalogo, data, id);
  }

  @Get('cobros/:id')
  cuenta(@Param('id', ParseIntPipe) id: number) {
    return this.gestion.cuenta(id);
  }

  @Post('cobros/:id/descuento')
  descuento(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: AplicarDescuentoDto,
  ) {
    return this.gestion.ajuste(id, data);
  }

  @Post('cobros/:id/recargo')
  recargo(@Param('id', ParseIntPipe) id: number, @Body() data: RecargoDto) {
    return this.gestion.ajuste(id, { ...data, motivo: data.motivo.trim() });
  }

  @Get('recordatorios')
  notificaciones() {
    return this.gestion.notificaciones();
  }

  @Post('recordatorios/generar')
  generar(@Body() { fecha }: RecordatoriosDto) {
    const date = new Date(fecha + 'T00:00:00Z');
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== fecha ||
      fecha.startsWith('0000')
    ) {
      throw new BadRequestException('Selecciona una fecha válida.');
    }
    return this.gestion.generarRecordatorios(fecha);
  }

  @Patch('recordatorios/:id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.gestion.cancelarNotificacion(id);
  }

  @Get('bitacora')
  bitacora() {
    return this.gestion.bitacora();
  }

  @Get('reportes')
  reportes(
    @Query('curso', new ParseIntPipe({ optional: true })) curso?: number,
  ) {
    return this.gestion.reportes(curso);
  }
}
