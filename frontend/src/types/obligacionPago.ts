// src/types/obligacionPago.ts
/** OBLIGACION_PAGO + columnas de vw_estado_cuenta + descuentos/saldo_neto. */
export interface ObligacionPagoItem {
  id_obligacion: number;
  id_inscripcion: number;
  tipo: "MATRICULA" | "MENSUALIDAD";
  numero_cuota: number | null;
  periodo: string | null;
  fecha_vencimiento: string;
  monto: number;
  estado: "PENDIENTE" | "PAGADA" | "ANULADA";
  recargos: number;
  pagado: number;
  /** saldo de vw_estado_cuenta: monto + recargos - pagado */
  saldo: number;
  fecha_vencimiento_efectiva: string;
  dias_mora: number;
  descuentos: number;
  /** saldo - descuentos */
  saldo_neto: number;
  id_estudiante?: number;
  codigo?: string;
  estudiante?: string;
  grupo?: string;
  id_grupo?: number;
  id_curso?: number;
  curso?: string;
}
