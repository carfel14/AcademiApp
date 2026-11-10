export interface Grupo {
  id_grupo: number;
  id_plan: number;
  nombre: string;
  fecha_inicio: string;
  duracion_meses: number;
  /** Fecha real de cierre; NULL mientras el grupo está EN_CURSO. */
  fecha_fin: string | null;
  estado: "EN_CURSO" | "FINALIZADO" | "CANCELADO";
  // Datos relacionados (GRUPO -> PLAN_ESTUDIO -> CURSO)
  id_curso: number;
  curso?: string;
  plan_estudio?: string;
  version?: number;
  /** DATEADD(MONTH, duracion_meses, fecha_inicio) */
  fecha_fin_estimada: string;
  /** Inscripciones ACTIVAS */
  inscritos?: number;
  profesores_asignados?: number;
}
