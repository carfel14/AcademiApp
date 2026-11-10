import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePagoDto {
  @IsInt()
  id_obligacion!: number;

  // PAGO.fecha_pago es DATETIME2(0); si se omite, la base usa SYSDATETIME().
  @IsOptional()
  @IsDateString()
  fecha_pago?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  monto_pagado!: number;

  @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])
  metodo_pago!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
