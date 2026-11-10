export interface Curso {
  id_curso: number;
  nombre: string;
  descripcion: string;
  precio_total: number;
  precio_matricula: number;
  estado: "ACTIVO" | "INACTIVO";
  planes?: number;
}

export interface PlanEstudio {
  id_plan: number;
  id_curso: number;
  nombre: string;
  descripcion?: string | null;
  version: number;
  estado: "ACTIVO" | "INACTIVO";
}
