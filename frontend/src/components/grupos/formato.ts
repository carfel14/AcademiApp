const DIAS: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export const formatearDia = (dia: string) => DIAS[dia] ?? dia;

/** "14:30" -> "2:30 p. m." */
export function formatearHora(hora: string) {
  const coincidencia = String(hora ?? "").match(/(\d{2}):(\d{2})/);
  if (!coincidencia) return "—";
  const horas = Number(coincidencia[1]);
  return `${horas % 12 || 12}:${coincidencia[2]} ${horas >= 12 ? "p. m." : "a. m."}`;
}

export const formatearFecha = (fecha?: string | null) => {
  if (!fecha) return "—";
  const [y, m, d] = fecha.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const ESTADOS_GRUPO = {
  EN_CURSO: { texto: "En curso", clase: "bg-green-100 text-green-700" },
  FINALIZADO: { texto: "Finalizado", clase: "bg-gray-100 text-gray-600" },
  CANCELADO: { texto: "Cancelado", clase: "bg-red-100 text-red-700" },
} as const;
