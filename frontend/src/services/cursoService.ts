import { apiFetch } from "./api";
import type { Curso } from "../types/curso";
import type { CursoFormData } from "../schema/cursoSchema";

const API_URL = "/cursos";

function normalizarCurso(
  curso: Partial<Curso> & {
    precio?: number;
    precio_matricula?: number;
    matricula?: number;
    mensualidad?: number;
  }
): Curso {
  return {
    id_curso: curso.id_curso ?? 0,
    nombre_curso: curso.nombre_curso ?? "",
    descripcion: curso.descripcion ?? "",
    precio: Number(curso.precio ?? curso.matricula ?? 0),
    precio_matricula: Number(curso.precio_matricula ?? curso.mensualidad ?? curso.matricula ?? 0),
    estado: curso.estado ?? "ACTIVO",
  };
}

function mapearPayload(curso: CursoFormData) {
  return {
    nombre_curso: curso.nombre_curso,
    descripcion: curso.descripcion ?? "",
    precio: Number(curso.precio),
    precio_matricula: Number(curso.precio_matricula),
  };
}

export async function obtenerCursos(): Promise<Curso[]> {
  const response = await apiFetch(API_URL);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los cursos");
  }

  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizarCurso) : [];
}

export async function crearCurso(
  curso: CursoFormData
): Promise<Curso> {
  const response = await apiFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mapearPayload(curso)),
  });

  if (!response.ok) {
    throw new Error("No se pudo crear el curso");
  }

  const data = await response.json();
  return normalizarCurso(data);
}

export async function actualizarCurso(
  id: number,
  curso: CursoFormData
): Promise<Curso> {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mapearPayload(curso)),
  });

  if (!response.ok) {
    throw new Error("No se pudo actualizar el curso");
  }

  const data = await response.json();
  return normalizarCurso(data);
}

export async function eliminarCurso(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("No se pudo eliminar el curso");
  }
}