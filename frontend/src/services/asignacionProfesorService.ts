import { apiFetch } from "./api";
// src/services/asignacionProfesorService.ts
import type { AsignacionProfesor } from "../types/asignacionProfesor";
import type { AsignacionProfesorFormData } from "../schema/asignacionProfesorSchema";

const API_URL = "/asignaciones-profesor";

export async function obtenerAsignaciones(): Promise<AsignacionProfesor[]> {
  const response = await apiFetch(API_URL);

  if (!response.ok) {
    throw new Error("No se pudieron obtener las asignaciones");
  }

  return response.json();
}

export async function crearAsignacion(
  data: AsignacionProfesorFormData
): Promise<AsignacionProfesor> {
  const response = await apiFetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || "No se pudo asignar el grupo al profesor");
  }

  return response.json();
}

export async function eliminarAsignacion(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("No se pudo desvincular la asignación");
  }
}