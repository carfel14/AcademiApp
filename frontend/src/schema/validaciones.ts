import { z } from "zod";

/** Solo letras (incluidas las tildadas, ñ y ü) separadas por un espacio. */
export const NOMBRE_PERSONA = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?: [A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
/** Números, espacios y los símbolos + - ( ). */
export const TELEFONO = /^[0-9+\-() ]+$/;

export const nombrePersona = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `${campo} son requeridos`)
    .max(100, "Máximo 100 caracteres")
    .regex(NOMBRE_PERSONA, `${campo}: solo letras (con o sin tilde) y espacios`);

export const telefono = z
  .string()
  .trim()
  .max(20, "Máximo 20 caracteres")
  .regex(TELEFONO, "Solo números, espacios y los símbolos + - ( )")
  .optional()
  .or(z.literal(""));

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
