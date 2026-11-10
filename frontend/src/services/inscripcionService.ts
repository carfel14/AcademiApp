// src/services/inscripcionService.ts
import { api } from "./api";
import type { Inscripcion } from "../types/inscripcion";

const API_URL = "/inscripciones";

export const obtenerInscripciones = () => api<Inscripcion[]>(API_URL);

export const crearInscripcion = (data: {
  id_estudiante: number;
  id_grupo: number;
  observacion?: string | null;
}) => api<{ inscripcion: Inscripcion }>(API_URL, "POST", {
  ...data,
  observacion: data.observacion || undefined,
});

export const cancelarInscripcion = (id: number) => api<void>(`${API_URL}/${id}`, "DELETE");

export const actualizarInscripcion = (id: number, observacion: string | null) =>
  api<Inscripcion>(`${API_URL}/${id}`, "PATCH", { observacion });
