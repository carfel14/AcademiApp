import { api } from "./api";
import type { Curso, PlanEstudio } from "../types/curso";
import type { CursoFormData } from "../schema/cursoSchema";

const API_URL = "/cursos";

function normalizarCurso(curso: Curso): Curso {
  return {
    ...curso,
    descripcion: curso.descripcion ?? "",
    precio_total: Number(curso.precio_total ?? 0),
    precio_matricula: Number(curso.precio_matricula ?? 0),
  };
}

function mapearPayload(curso: CursoFormData) {
  return {
    nombre: curso.nombre,
    descripcion: curso.descripcion || undefined,
    precio_total: Number(curso.precio_total),
    precio_matricula: Number(curso.precio_matricula),
  };
}

export async function obtenerCursos(): Promise<Curso[]> {
  const data = await api<Curso[]>(API_URL);
  return Array.isArray(data) ? data.map(normalizarCurso) : [];
}

export async function crearCurso(curso: CursoFormData): Promise<Curso> {
  return normalizarCurso(await api<Curso>(API_URL, "POST", mapearPayload(curso)));
}

export async function actualizarCurso(id: number, curso: Partial<CursoFormData>): Promise<Curso> {
  const payload: Record<string, unknown> = mapearPayload(curso as CursoFormData);
  for (const key of Object.keys(payload)) if (payload[key] === undefined || Number.isNaN(payload[key])) delete payload[key];
  return normalizarCurso(await api<Curso>(`${API_URL}/${id}`, "PATCH", payload));
}

export async function eliminarCurso(id: number): Promise<void> {
  await api(`${API_URL}/${id}`, "DELETE");
}

/** Planes de estudio del curso (GRUPO se crea sobre un PLAN_ESTUDIO). */
export const obtenerPlanesCurso = (idCurso: number) =>
  api<PlanEstudio[]>(`/planes/planes?padre=${idCurso}`);
