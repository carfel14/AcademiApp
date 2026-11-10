// src/types/inscripcion.ts
export interface Inscripcion {
  id_inscripcion: number;
  id_estudiante: number;
  id_grupo: number;
  fecha_inscripcion: string;
  estado: "ACTIVA" | "CANCELADA" | "FINALIZADA";
  observacion?: string | null;
  codigo?: string;
  nombres?: string;
  apellidos?: string;
  grupo?: string;
  id_plan?: number;
  id_curso?: number;
  curso?: string;
}
