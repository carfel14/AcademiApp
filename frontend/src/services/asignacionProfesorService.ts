// src/services/asignacionProfesorService.ts
import { api } from "./api";
import type { AsignacionProfesor } from "../types/asignacionProfesor";
import type { AsignacionProfesorFormData } from "../schema/asignacionProfesorSchema";

const API_URL = "/asignaciones-profesor";

export const obtenerAsignaciones = () => api<AsignacionProfesor[]>(API_URL);
export const crearAsignacion = (data: AsignacionProfesorFormData) =>
  api<AsignacionProfesor>(API_URL, "POST", data);
export const eliminarAsignacion = (id: number) => api<void>(`${API_URL}/${id}`, "DELETE");
