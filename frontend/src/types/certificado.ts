// src/types/certificado.ts
export interface CertificadoItem {
  id_certificado: number;
  id_inscripcion: number;
  codigo: string;
  fecha_emision: string;
  estado: "EMITIDO" | "ANULADO";
  id_estudiante?: number;
  codigo_estudiante?: string;
  nombres?: string;
  apellidos?: string;
  id_grupo?: number;
  grupo?: string;
  id_curso?: number;
  curso?: string;
}
