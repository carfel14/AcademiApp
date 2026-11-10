/**
 * Fragmentos SQL compartidos. Respetan el script AcademiaBellezaSilvia.sql
 * sin modificarlo.
 */

/**
 * vw_estado_cuenta del script calcula `saldo = monto + recargos - pagado` y no
 * considera OBLIGACION_DESCUENTO. Este derivado conserva todas las columnas de
 * la vista y agrega:
 *   - descuentos: suma de los descuentos aplicados a la obligación.
 *   - saldo_neto: saldo de la vista menos los descuentos.
 * Úsalo como `FROM ${ESTADO_CUENTA} o`.
 */
export const ESTADO_CUENTA = `(
  SELECT ec.*, d.descuentos,
    CAST(ec.saldo - d.descuentos AS DECIMAL(12,2)) AS saldo_neto
  FROM vw_estado_cuenta ec
  OUTER APPLY (
    SELECT CAST(ISNULL(SUM(CASE WHEN od.tipo_aplicado = 'PORCENTAJE'
        THEN ROUND(b.monto * od.valor_aplicado / 100, 2)
        ELSE od.valor_aplicado END), 0) AS DECIMAL(12,2)) AS descuentos
    FROM OBLIGACION_DESCUENTO od
    JOIN OBLIGACION_PAGO b ON b.id_obligacion = od.id_obligacion
    WHERE od.id_obligacion = ec.id_obligacion
  ) d
)`;

/** Fecha estimada de cierre del grupo, según el comentario del script. */
export const FECHA_FIN_ESTIMADA = (alias = 'g') =>
  `DATEADD(MONTH, ${alias}.duracion_meses, ${alias}.fecha_inicio)`;

/** Día de la semana en el formato de HORARIO_CLASE.dia_semana. */
export const DIA_SEMANA = (fecha: string) =>
  `CHOOSE((DATEDIFF(DAY, '19000101', ${fecha}) % 7 + 7) % 7 + 1,
    'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO')`;

/** TIME(0) como texto HH:MM. */
export const HORA = (columna: string, alias = columna.split('.').pop()) =>
  `CONVERT(VARCHAR(5), ${columna}, 108) AS ${alias}`;

/** Convierte un valor DATE devuelto por mssql a YYYY-MM-DD. */
export function fechaISO(valor: string | Date | null | undefined) {
  if (!valor) return null;
  if (typeof valor === 'string') return valor.substring(0, 10);
  return valor.toISOString().substring(0, 10);
}
