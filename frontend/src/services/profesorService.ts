import { apiFetch } from "./api";
// src/services/profesorService.ts
import type { Profesor } from "../types/profesor";
import type { ProfesorFormData } from "../schema/profesorSchema";

const API_URL = "/profesores";

function normalizarProfesor(profesor: Partial<Profesor>): Profesor {
  return {
    id_profesor: profesor.id_profesor ?? 0,
    nombres: profesor.nombres ?? "",
    apellidos: profesor.apellidos ?? "",
    telefono: profesor.telefono ?? null,
    especialidad: profesor.especialidad ?? null,
    estado: profesor.estado ?? "ACTIVO",
  };
}

export async function obtenerProfesores(): Promise<Profesor[]> {
  const response = await apiFetch(API_URL);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los profesores");
  }

  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizarProfesor) : [];
}

export async function obtenerProfesor(id: number): Promise<Profesor> {
  const response = await apiFetch(`${API_URL}/${id}`);

  if (!response.ok) {
    throw new Error("No se pudo obtener el profesor");
  }

  const data = await response.json();
  return normalizarProfesor(data);
}

export async function crearProfesor(data: ProfesorFormData): Promise<Profesor> {
  const response = await apiFetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombres: data.nombres,
      apellidos: data.apellidos,
      telefono: data.telefono || null,
      especialidad: data.especialidad || null,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || "No se pudo crear el profesor");
  }

  const result = await response.json();
  return normalizarProfesor(result);
}

export async function actualizarProfesor(
  id: number,
  data: ProfesorFormData
): Promise<Profesor> {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombres: data.nombres,
      apellidos: data.apellidos,
      telefono: data.telefono || null,
      especialidad: data.especialidad || null,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || "No se pudo actualizar el profesor");
  }

  const result = await response.json();
  return normalizarProfesor(result);
}

export async function eliminarProfesor(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("No se pudo eliminar el profesor");
  }
}