// src/types/resultadoEvaluacion.ts
export interface ResultadoEvaluacionItem {
  id_resultado: number;
  id_evaluacion: number;
  id_inscripcion: number;
  nota: number | null;
  estado_resultado: "CALIFICADO" | "NO_SE_PRESENTO";
  tipo?: "EXAMEN" | "TAREA" | "PROYECTO";
  id_sesion?: number;
  id_estudiante?: number;
  codigo?: string;
  nombres?: string;
  apellidos?: string;
}
