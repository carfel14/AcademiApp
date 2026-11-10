import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { PagoService } from './pago.service';
import { CreatePagoDto } from './dto/create-pago.dto';

@Controller('pagos')
export class PagoController {
  constructor(private readonly pagoService: PagoService) {}

  // ============================================================
  // OBTENER TODOS LOS PAGOS
  // ============================================================

  @Get()
  getPagos() {
    return this.pagoService.getPagos();
  }

  // ============================================================
  // OBTENER UN PAGO
  // ============================================================

  @Get(':id')
  getPago(@Param('id', ParseIntPipe) id: number) {
    return this.pagoService.getPago(id);
  }

  // ============================================================
  // OBTENER PAGOS DE UNA OBLIGACIÓN
  // ============================================================

  @Get('obligacion/:idObligacion')
  getPagosPorObligacion(
    @Param('idObligacion', ParseIntPipe)
    idObligacion: number,
  ) {
    return this.pagoService.getPagosPorObligacion(idObligacion);
  }

  // ============================================================
  // CREAR PAGO
  // ============================================================

  @Post()
  createPago(@Body() pago: CreatePagoDto) {
    return this.pagoService.createPago(pago);
  }
}
