// src/types/estudiante.ts
export type CanalPreferido = "EMAIL" | "WHATSAPP" | "SMS";

export interface Estudiante {
  id_estudiante: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento?: string | null;
  telefono?: string | null;
  email?: string | null;
  canal_preferido: CanalPreferido;
  fecha_registro: string;
  estado: "ACTIVO" | "INACTIVO";
}
