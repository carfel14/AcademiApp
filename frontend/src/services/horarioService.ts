import type { Horario } from "../types/horario";
import { api } from "./api";

type HorarioData = Omit<Horario, "id_horario" | "id_grupo">;

/** Sesiones futuras que siguieron el cambio del horario semanal. */
export type CambioSesiones = {
  movidas: number;
  omitidas: { id_sesion: number; fecha: string; motivo: string }[];
};

export const obtenerHorariosPorGrupo = (id: number) => api<Horario[]>(`/grupos/${id}/horarios`);
export const crearHorario = (id: number, horario: HorarioData) => api<Horario>(`/grupos/${id}/horarios`, "POST", horario);
export const actualizarHorario = (id: number, horario: Partial<HorarioData>) =>
  api<Horario & { sesiones?: CambioSesiones }>(`/horarios/${id}`, "PATCH", horario);
export const eliminarHorario = (id: number) =>
  api<{ mensaje: string; sesiones_canceladas: number }>(`/horarios/${id}`, "DELETE");

export function resumenCambio(cambio?: CambioSesiones) {
  if (!cambio || (!cambio.movidas && !cambio.omitidas.length)) return "Horario actualizado. No había sesiones futuras que mover.";
  const partes = [`Horario actualizado. Sesiones futuras movidas: ${cambio.movidas}.`];
  if (cambio.omitidas.length)
    partes.push(`Se dejaron como estaban ${cambio.omitidas.length}: ${cambio.omitidas.map(o => `${o.fecha} (${o.motivo})`).join("; ")}`);
  return partes.join(" ");
}

export const resumenEliminacion = (canceladas: number) =>
  canceladas ? `Horario eliminado. Se cancelaron ${canceladas} sesiones futuras de ese horario.` : "Horario eliminado. No tenía sesiones futuras pendientes.";
