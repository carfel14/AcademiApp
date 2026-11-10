export interface AsignacionProfesor {
  id_asignacion: number;
  id_profesor: number;
  id_grupo: number;
  fecha_asignacion?: string;
  profesor?: string;
  grupo?: string;
  curso?: string;
}
