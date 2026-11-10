import { apiFetch } from "./api";
import type { AsistenciaItem } from "../types/asistencia";
import type { ResultadoEvaluacionItem } from "../types/resultadoEvaluacion";
import type { ObligacionPagoItem } from "../types/obligacionPago";
import type { ProrrogaItem } from "../types/prorroga";
import type { CertificadoItem } from "../types/certificado";

export async function obtenerAsistencias(): Promise<AsistenciaItem[]> {
  const res = await apiFetch("/asistencias");
  if (!res.ok) return [];
  return res.json();
}

export async function obtenerResultadosEvaluaciones(): Promise<ResultadoEvaluacionItem[]> {
  const res = await apiFetch("/resultados-evaluacion");
  if (!res.ok) return [];
  return res.json();
}

export async function obtenerObligacionesPorInscripcion(
  idInscripcion: number
): Promise<ObligacionPagoItem[]> {
  const res = await apiFetch(`/obligaciones-pago/inscripcion/${idInscripcion}`);
  if (!res.ok) return [];
  return res.json();
}

export async function obtenerProrrogas(): Promise<ProrrogaItem[]> {
  const res = await apiFetch("/prorrogas");
  if (!res.ok) return [];
  return res.json();
}

export async function obtenerCertificados(): Promise<CertificadoItem[]> {
  const res = await apiFetch("/certificados");
  if (!res.ok) return [];
  return res.json();
}