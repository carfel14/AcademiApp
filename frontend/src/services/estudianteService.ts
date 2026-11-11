// src/services/estudianteService.ts
import { api } from "./api";
import type { Estudiante } from "../types/estudiante";
import type { EstudianteFormData } from "../schema/estudianteSchema";

const API_URL = "/estudiantes";

function normalizarEstudiante(e: Estudiante): Estudiante {
  return {
    ...e,
    fecha_nacimiento: e.fecha_nacimiento ? e.fecha_nacimiento.substring(0, 10) : null,
    fecha_registro: e.fecha_registro ? e.fecha_registro.substring(0, 10) : "",
  };
}

function payload(data: EstudianteFormData) {
  return {
    ...(data.codigo ? { codigo: data.codigo } : {}),
    nombres: data.nombres,
    apellidos: data.apellidos,
    fecha_nacimiento: data.fecha_nacimiento || null,
    email: data.email || null,
    telefono: data.telefono || null,
    canal_preferido: data.canal_preferido,
  };
}

/** Sin estado: solo activos. "TODOS" incluye también a los inactivos. */
export async function obtenerEstudiantes(estado?: "ACTIVO" | "INACTIVO" | "TODOS"): Promise<Estudiante[]> {
  const data = await api<Estudiante[]>(estado ? `${API_URL}?estado=${estado}` : API_URL);
  return Array.isArray(data) ? data.map(normalizarEstudiante) : [];
}

export async function obtenerEstudiante(id: number): Promise<Estudiante> {
  return normalizarEstudiante(await api<Estudiante>(`${API_URL}/${id}`));
}

export async function crearEstudiante(data: EstudianteFormData): Promise<Estudiante> {
  return normalizarEstudiante(await api<Estudiante>(API_URL, "POST", payload(data)));
}

export async function actualizarEstudiante(id: number, data: EstudianteFormData): Promise<Estudiante> {
  return normalizarEstudiante(await api<Estudiante>(`${API_URL}/${id}`, "PATCH", payload(data)));
}

export async function eliminarEstudiante(id: number): Promise<void> {
  await api(`${API_URL}/${id}`, "DELETE");
}
