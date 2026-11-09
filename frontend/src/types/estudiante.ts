// src/types/estudiante.ts
export interface Estudiante {
  id_estudiante: number;
  codigo_estudiante?: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento?: string | null;
  email?: string | null;
  telefono?: string | null;
  fecha_registro: string;
  estado: "ACTIVO" | "INACTIVO";
}