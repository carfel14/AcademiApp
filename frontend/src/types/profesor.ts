export interface Especialidad {
  id_especialidad: number;
  nombre: string;
}

export interface Profesor {
  id_profesor: number;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
  estado: "ACTIVO" | "INACTIVO";
  especialidades: Especialidad[];
}
