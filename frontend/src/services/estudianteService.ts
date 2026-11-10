import { apiFetch } from "./api";
// src/services/estudianteService.ts
import type { Estudiante } from "../types/estudiante";
import type { EstudianteFormData } from "../schema/estudianteSchema";

const API_URL = "/estudiantes";

function normalizarEstudiante(e: Partial<Estudiante>): Estudiante {
  return {
    id_estudiante: e.id_estudiante ?? 0,
    codigo_estudiante: e.codigo_estudiante ?? `EST-${String(e.id_estudiante ?? 0).padStart(6, "0")}`,
    nombres: e.nombres ?? "",
    apellidos: e.apellidos ?? "",
    fecha_nacimiento: e.fecha_nacimiento ? e.fecha_nacimiento.substring(0, 10) : null,
    email: e.email ?? null,
    telefono: e.telefono ?? null,
    fecha_registro: e.fecha_registro ? e.fecha_registro.substring(0, 10) : "",
    estado: (e.estado as "ACTIVO" | "INACTIVO") ?? "ACTIVO",
  };
}

export async function obtenerEstudiantes(): Promise<Estudiante[]> {
  const res = await apiFetch(API_URL);
  if (!res.ok) throw new Error("No se pudieron obtener los estudiantes");
  const data = await res.json();
  return Array.isArray(data) ? data.map(normalizarEstudiante) : [];
}

export async function obtenerEstudiante(id: number): Promise<Estudiante> {
  const res = await apiFetch(`${API_URL}/${id}`);
  if (!res.ok) throw new Error("No se pudo obtener el estudiante");
  const data = await res.json();
  return normalizarEstudiante(data);
}

export async function crearEstudiante(data: EstudianteFormData): Promise<Estudiante> {
  const res = await apiFetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombres: data.nombres,
      apellidos: data.apellidos,
      fecha_nacimiento: data.fecha_nacimiento || null,
      email: data.email || null,
      telefono: data.telefono || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || "No se pudo registrar el estudiante");
  }

  return normalizarEstudiante(await res.json());
}

export async function actualizarEstudiante(
  id: number,
  data: EstudianteFormData
): Promise<Estudiante> {
  const res = await apiFetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombres: data.nombres,
      apellidos: data.apellidos,
      fecha_nacimiento: data.fecha_nacimiento || null,
      email: data.email || null,
      telefono: data.telefono || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || "No se pudo actualizar el estudiante");
  }

  return normalizarEstudiante(await res.json());
}

export async function eliminarEstudiante(id: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("No se pudo desactivar el estudiante");
}