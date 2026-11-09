import type { Horario } from "../types/horario";
import { api } from "./api";

type HorarioData = Omit<Horario, "id_horario" | "id_grupo">;
export const obtenerHorariosPorGrupo = (id: number) => api<Horario[]>(`/grupos/${id}/horarios`);
export const crearHorario = (id: number, horario: HorarioData) => api<Horario>(`/grupos/${id}/horarios`, "POST", horario);
export const actualizarHorario = (id: number, horario: Partial<HorarioData>) => api<Horario>(`/horarios/${id}`, "PATCH", horario);
export const eliminarHorario = (id: number) => api<void>(`/horarios/${id}`, "DELETE");
