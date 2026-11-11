import { api } from "./api";
import type { Grupo } from "../types/grupo";

const API_URL = "/grupos";

/** Sin estado: en curso y finalizados. "TODOS" incluye también los cancelados. */
export const obtenerGrupos = (estado?: "EN_CURSO" | "FINALIZADO" | "CANCELADO" | "TODOS") =>
  api<Grupo[]>(estado ? `${API_URL}?estado=${estado}` : API_URL);

export const crearGrupo = (grupo: {
  id_plan: number;
  nombre: string;
  fecha_inicio: string;
  duracion_meses: number;
}) => api<Grupo>(API_URL, "POST", grupo);

export const actualizarGrupo = (
  id: number,
  grupo: { nombre: string; duracion_meses?: number; fecha_inicio?: string },
) => api<Grupo>(`${API_URL}/${id}`, "PATCH", grupo);

export const eliminarGrupo = (id: number) => api<void>(`${API_URL}/${id}`, "DELETE");

export const finalizarGrupo = (id: number) => api<void>(`${API_URL}/${id}/finalizar`, "PATCH");
