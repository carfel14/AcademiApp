/** Solo letras (incluidas las tildadas, ñ y ü) separadas por un espacio. */
export const NOMBRE_PERSONA = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?: [A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
export const MENSAJE_NOMBRE = 'solo puede contener letras (con o sin tilde) y espacios.';

/** Números, espacios y los símbolos + - ( ). */
export const TELEFONO = /^[0-9+\-() ]+$/;
export const MENSAJE_TELEFONO = 'El teléfono solo puede contener números, espacios y los símbolos + - ( ).';

/** Fecha local del servidor en formato YYYY-MM-DD. */
export function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
