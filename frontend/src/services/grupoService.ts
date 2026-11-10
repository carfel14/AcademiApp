import { apiFetch } from "./api";
import type { Grupo } from "../types/grupo";

type ActualizarGrupoData = {
  nombre_grupo: string;
  duracion_meses?: number;
  fecha_inicio?: string;
};

const API_URL = "/grupos";

async function leerMensajeDeError(response: Response): Promise<string> {
  try {
    const texto = await response.text();
    return texto || "No se pudo completar la solicitud.";
  } catch {
    return "No se pudo completar la solicitud.";
  }
}

export async function obtenerGrupos(): Promise<Grupo[]> {
  const response = await apiFetch(API_URL);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los grupos");
  }

  return response.json();
}

export async function crearGrupo(
  grupo: Omit<Grupo, "id_grupo" | "estado">
): Promise<Grupo> {
  const response = await apiFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(grupo),
  });

  if (!response.ok) {
    const detalle = await leerMensajeDeError(response);
    throw new Error(detalle || "No se pudo crear el grupo");
  }

  return response.json();
}

export async function eliminarGrupo(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("No se pudo cancelar el grupo");
  }
}

export async function actualizarGrupo(
  id: number,
  grupo: ActualizarGrupoData
): Promise<Grupo> {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(grupo),
  });

  if (!response.ok) {
    const detalle = await leerMensajeDeError(response);
    throw new Error(detalle || "No se pudo actualizar el grupo");
  }

  return response.json();
}

export async function finalizarGrupo(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/${id}/finalizar`, {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("No se pudo finalizar el grupo");
  }
}
