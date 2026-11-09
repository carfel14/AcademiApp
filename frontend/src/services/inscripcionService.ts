import { api, apiFetch } from "./api";
// src/services/inscripcionService.ts
import type { Inscripcion } from "../types/inscripcion";

const API_URL = "/inscripciones";

export async function obtenerInscripciones(): Promise<Inscripcion[]> {
  const res = await apiFetch(API_URL);
  if (!res.ok) throw new Error("No se pudieron obtener las inscripciones");
  return res.json();
}

export async function crearInscripcion(data: {
  id_estudiante: number;
  id_grupo: number;
  observacion?: string | null;
}): Promise<{ inscripcion: Inscripcion }> {
  const res = await apiFetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || "No se pudo realizar la inscripción");
  }

  return res.json();
}

export async function cancelarInscripcion(id: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || "No se pudo cancelar la inscripción");
  }
}
export const actualizarInscripcion = (id: number, observacion: string | null) =>
  api<Inscripcion>(`/inscripciones/${id}`, "PATCH", { observacion });
