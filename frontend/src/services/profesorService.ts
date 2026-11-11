// src/services/profesorService.ts
import { api } from "./api";
import type { Especialidad, Profesor } from "../types/profesor";
import type { ProfesorFormData } from "../schema/profesorSchema";

const API_URL = "/profesores";

const payload = (data: ProfesorFormData) => ({
  nombres: data.nombres,
  apellidos: data.apellidos,
  telefono: data.telefono || null,
  especialidades: data.especialidades,
});

export const nombresEspecialidades = (profesor: Pick<Profesor, "especialidades">) =>
  profesor.especialidades.map((e) => e.nombre).join(", ");

export const obtenerProfesores = () => api<Profesor[]>(API_URL);
export const obtenerProfesor = (id: number) => api<Profesor>(`${API_URL}/${id}`);
export const crearProfesor = (data: ProfesorFormData) => api<Profesor>(API_URL, "POST", payload(data));
export const actualizarProfesor = (id: number, data: ProfesorFormData) =>
  api<Profesor>(`${API_URL}/${id}`, "PATCH", payload(data));
export const eliminarProfesor = (id: number) => api<void>(`${API_URL}/${id}`, "DELETE");

// Catálogo ESPECIALIDAD
export const obtenerEspecialidades = () => api<(Especialidad & { profesores: number })[]>(`${API_URL}/especialidades`);
export const crearEspecialidad = (nombre: string) => api<Especialidad>(`${API_URL}/especialidades`, "POST", { nombre });
export const renombrarEspecialidad = (id: number, nombre: string) =>
  api<Especialidad>(`${API_URL}/especialidades/${id}`, "PATCH", { nombre });
export const eliminarEspecialidad = (id: number) => api<void>(`${API_URL}/especialidades/${id}`, "DELETE");
