import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ObligacionPagoService } from './obligacion-pago.service';

/**
 * Las obligaciones nacen al crear la inscripción; su vencimiento solo se
 * extiende con PRORROGA. Por eso este recurso es de solo lectura.
 */
@Controller('obligaciones-pago')
export class ObligacionPagoController {
  constructor(private readonly obligacionPagoService: ObligacionPagoService) {}

  @Get()
  getObligaciones() {
    return this.obligacionPagoService.getObligaciones();
  }

  @Get('inscripcion/:idInscripcion')
  getObligacionesPorInscripcion(
    @Param('idInscripcion', ParseIntPipe) idInscripcion: number,
  ) {
    return this.obligacionPagoService.getObligacionesPorInscripcion(
      idInscripcion,
    );
  }

  @Get(':id')
  getObligacion(@Param('id', ParseIntPipe) id: number) {
    return this.obligacionPagoService.getObligacion(id);
  }
}
