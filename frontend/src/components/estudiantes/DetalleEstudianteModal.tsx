import { useEffect, useState, useMemo } from "react";
import {
  GraduationCap,
  CalendarCheck,
  Award,
  CreditCard,
  Clock,
  FileBadge,
  Layers,
  XCircle,
} from "lucide-react";
import type { Estudiante } from "../../types/estudiante";
import type { Inscripcion } from "../../types/inscripcion";
import type { AsistenciaItem } from "../../types/asistencia";
import type { ResultadoEvaluacionItem } from "../../types/resultadoEvaluacion";
import type { ObligacionPagoItem } from "../../types/obligacionPago";
import type { ProrrogaItem } from "../../types/prorroga";
import type { CertificadoItem } from "../../types/certificado";
import {
  obtenerAsistencias,
  obtenerResultadosEvaluaciones,
  obtenerObligacionesPorInscripcion,
  obtenerProrrogas,
  obtenerCertificados,
} from "../../services/academicoConsultasService";

interface DetalleEstudianteModalProps {
  estudiante: Estudiante;
  inscripciones: Inscripcion[];
  onCancelarInscripcion: (id_inscripcion: number) => Promise<void>;
  onClose: () => void;
}

type TabType = "inscripciones" | "asistencias" | "evaluaciones" | "pagos" | "prorrogas" | "certificados";

function DetalleEstudianteModal({
  estudiante,
  inscripciones,
  onCancelarInscripcion,
}: DetalleEstudianteModalProps) {
  const [tabActiva, setTabActiva] = useState<TabType>("inscripciones");
  const [filtroInscripcionId, setFiltroInscripcionId] = useState<number | "todas">("todas");

  const [asistencias, setAsistencias] = useState<AsistenciaItem[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<ResultadoEvaluacionItem[]>([]);
  const [obligaciones, setObligaciones] = useState<ObligacionPagoItem[]>([]);
  const [prorrogas, setProrrogas] = useState<ProrrogaItem[]>([]);
  const [certificados, setCertificados] = useState<CertificadoItem[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  const misInscripciones = useMemo(
    () => inscripciones.filter((i) => i.id_estudiante === estudiante.id_estudiante),
    [inscripciones, estudiante.id_estudiante]
  );

  const misInscripcionesIds = useMemo(
    () => new Set(misInscripciones.map((i) => i.id_inscripcion)),
    [misInscripciones]
  );

  useEffect(() => {
    async function cargarExpediente() {
      setCargandoDatos(true);
      try {
        const [asistData, evalData, prorrogasData, certData] = await Promise.all([
          obtenerAsistencias(),
          obtenerResultadosEvaluaciones(),
          obtenerProrrogas(),
          obtenerCertificados(),
        ]);

        setAsistencias(asistData.filter((a) => misInscripcionesIds.has(a.id_inscripcion)));
        setEvaluaciones(evalData.filter((e) => misInscripcionesIds.has(e.id_inscripcion)));
        setProrrogas(
          prorrogasData.filter((p) => p.id_inscripcion && misInscripcionesIds.has(p.id_inscripcion))
        );
        setCertificados(
          certData.filter((c) => c.id_estudiante === estudiante.id_estudiante || misInscripcionesIds.has(c.id_inscripcion))
        );

        const todasOblig: ObligacionPagoItem[] = [];
        for (const ins of misInscripciones) {
          const obligs = await obtenerObligacionesPorInscripcion(ins.id_inscripcion);
          todasOblig.push(...obligs);
        }
        setObligaciones(todasOblig);
      } finally {
        setCargandoDatos(false);
      }
    }

    cargarExpediente();
  }, [estudiante.id_estudiante, misInscripciones, misInscripcionesIds]);

  // Filtrado reactivo por Curso / Grupo
  const asistenciasFiltradas = useMemo(() => {
    if (filtroInscripcionId === "todas") return asistencias;
    return asistencias.filter((a) => a.id_inscripcion === filtroInscripcionId);
  }, [asistencias, filtroInscripcionId]);

  const evaluacionesFiltradas = useMemo(() => {
    if (filtroInscripcionId === "todas") return evaluaciones;
    return evaluaciones.filter((e) => e.id_inscripcion === filtroInscripcionId);
  }, [evaluaciones, filtroInscripcionId]);

  const obligacionesFiltradas = useMemo(() => {
    if (filtroInscripcionId === "todas") return obligaciones;
    return obligaciones.filter((o) => o.id_inscripcion === filtroInscripcionId);
  }, [obligaciones, filtroInscripcionId]);

  const prorrogasFiltradas = useMemo(() => {
    if (filtroInscripcionId === "todas") return prorrogas;
    return prorrogas.filter((p) => p.id_inscripcion === filtroInscripcionId);
  }, [prorrogas, filtroInscripcionId]);

  const certificadosFiltrados = useMemo(() => {
    if (filtroInscripcionId === "todas") return certificados;
    return certificados.filter((c) => c.id_inscripcion === filtroInscripcionId);
  }, [certificados, filtroInscripcionId]);

  // Métrica de asistencia
  const totalSesiones = asistenciasFiltradas.length;
  const totalPresentes = asistenciasFiltradas.filter((a) => a.estado_asistencia === "PRESENTE").length;
  const porcentajeAsistencia = totalSesiones > 0 ? Math.round((totalPresentes / totalSesiones) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Selector de Curso / Grupo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtrar por Inscripción</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            {estudiante.nombres} {estudiante.apellidos}
          </p>
        </div>

        <div className="sm:w-72">
          <select
            value={filtroInscripcionId}
            onChange={(e) =>
              setFiltroInscripcionId(e.target.value === "todas" ? "todas" : Number(e.target.value))
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
          >
            <option value="todas">Todos los cursos y grupos ({misInscripciones.length})</option>
            {misInscripciones.map((ins) => (
              <option key={ins.id_inscripcion} value={ins.id_inscripcion}>
                {ins.curso} — {ins.grupo} ({ins.estado})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra de pestañas fija */}
      <div className="flex border-b border-gray-200 text-xs font-semibold overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setTabActiva("inscripciones")}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition whitespace-nowrap ${
            tabActiva === "inscripciones"
              ? "border-blue-950 text-blue-950 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <GraduationCap className="h-4 w-4" /> Inscripciones ({misInscripciones.length})
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("asistencias")}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition whitespace-nowrap ${
            tabActiva === "asistencias"
              ? "border-blue-950 text-blue-950 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <CalendarCheck className="h-4 w-4" /> Asistencias ({asistenciasFiltradas.length})
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("evaluaciones")}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition whitespace-nowrap ${
            tabActiva === "evaluaciones"
              ? "border-blue-950 text-blue-950 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Award className="h-4 w-4" /> Evaluaciones ({evaluacionesFiltradas.length})
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("pagos")}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition whitespace-nowrap ${
            tabActiva === "pagos"
              ? "border-blue-950 text-blue-950 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <CreditCard className="h-4 w-4" /> Obligaciones ({obligacionesFiltradas.length})
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("prorrogas")}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition whitespace-nowrap ${
            tabActiva === "prorrogas"
              ? "border-blue-950 text-blue-950 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Clock className="h-4 w-4" /> Prórrogas ({prorrogasFiltradas.length})
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("certificados")}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition whitespace-nowrap ${
            tabActiva === "certificados"
              ? "border-blue-950 text-blue-950 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FileBadge className="h-4 w-4" /> Certificados ({certificadosFiltrados.length})
        </button>
      </div>

      {/* Contenido de la pestaña */}
      <div className="min-h-[260px] pt-1">
        {cargandoDatos ? (
          <p className="py-12 text-center text-xs text-gray-500">Cargando datos del expediente...</p>
        ) : (
          <>
            {/* 1. Inscripciones */}
            {tabActiva === "inscripciones" && (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {misInscripciones.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-500 border border-dashed rounded-lg">
                    Sin inscripciones registradas.
                  </p>
                ) : (
                  misInscripciones.map((ins) => (
                    <div
                      key={ins.id_inscripcion}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-xs hover:border-gray-300"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Layers className="h-4 w-4 text-blue-800 shrink-0" />
                          <span className="font-semibold text-sm text-gray-900 truncate">
                            {ins.curso}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                            {ins.grupo}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              ins.estado === "ACTIVA"
                                ? "bg-emerald-100 text-emerald-800"
                                : ins.estado === "FINALIZADA"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {ins.estado}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Fecha de inscripción: {String(ins.fecha_inscripcion).substring(0, 10)}
                          {ins.observacion && ` • ${ins.observacion}`}
                        </p>
                      </div>

                      {ins.estado === "ACTIVA" && (
                        <button
                          type="button"
                          onClick={() => onCancelarInscripcion(ins.id_inscripcion)}
                          title="Cancelar inscripción"
                          className="shrink-0 rounded-md p-1.5 text-rose-600 hover:bg-rose-50 transition"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 2. Asistencias */}
            {tabActiva === "asistencias" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-blue-50/80 p-3 rounded-xl border border-blue-100 text-xs">
                  <span className="font-semibold text-blue-900">
                    Asistencia: {totalPresentes} de {totalSesiones} clases registradas
                  </span>
                  <span className="text-sm font-bold text-blue-950">{porcentajeAsistencia}%</span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {asistenciasFiltradas.length === 0 ? (
                    <p className="py-8 text-center text-xs text-gray-500">Sin asistencias para el filtro seleccionado.</p>
                  ) : (
                    asistenciasFiltradas.map((a) => (
                      <div
                        key={a.id_asistencia}
                        className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-gray-100 bg-white shadow-2xs"
                      >
                        <div>
                          <p className="text-gray-900 font-medium">
                            Sesión: {a.fecha_programada ? String(a.fecha_programada).substring(0, 10) : ""}
                          </p>
                          {a.observacion && <p className="text-[11px] text-gray-400">{a.observacion}</p>}
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 font-semibold text-[11px] ${
                            a.estado_asistencia === "PRESENTE"
                              ? "bg-emerald-100 text-emerald-800"
                              : a.estado_asistencia === "JUSTIFICADA"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {a.estado_asistencia}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. Evaluaciones */}
            {tabActiva === "evaluaciones" && (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {evaluacionesFiltradas.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-500">No hay evaluaciones registradas.</p>
                ) : (
                  evaluacionesFiltradas.map((ev) => (
                    <div
                      key={ev.id_resultado}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white"
                    >
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          {ev.tipo || `Evaluación #${ev.id_evaluacion}`}
                        </p>
                        <span className="text-[11px] text-gray-500">
                          Estado: {ev.estado_resultado}
                        </span>
                      </div>

                      <span
                        className={`text-sm font-bold ${
                          ev.nota !== null && ev.nota >= 70 ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {ev.nota !== null ? `${ev.nota} pts` : "No se presentó"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 4. Pagos / Obligaciones */}
            {tabActiva === "pagos" && (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {obligacionesFiltradas.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-500">Sin obligaciones registradas.</p>
                ) : (
                  obligacionesFiltradas.map((o) => (
                    <div
                      key={o.id_obligacion}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-gray-900">
                            {o.tipo === "MATRICULA"
                              ? "Matrícula"
                              : `Cuota #${o.numero_cuota} - ${o.periodo}`}
                          </p>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              o.estado === "PAGADA"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.estado === "PENDIENTE"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {o.estado}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Vence: {String(o.fecha_vencimiento).substring(0, 10)} • Pagado: C$ {o.pagado} • Saldo: C$ {o.saldo_neto}{o.dias_mora > 0 ? ` • ${o.dias_mora} días de mora` : ""}
                        </p>
                      </div>

                      <p className="text-sm font-bold text-gray-900">C$ {o.monto}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 5. Prórrogas */}
            {tabActiva === "prorrogas" && (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {prorrogasFiltradas.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-500">Sin prórrogas registradas.</p>
                ) : (
                  prorrogasFiltradas.map((pr) => (
                    <div
                      key={pr.id_prorroga}
                      className="p-3 rounded-lg border border-gray-200 bg-white text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">
                          Prórroga para Obligación #{pr.id_obligacion} ({pr.tipo ?? "Cuota"})
                        </span>
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-900 font-semibold">
                          {String(pr.fecha_inicio).substring(0, 10)} al {String(pr.fecha_finalizacion).substring(0, 10)}
                        </span>
                      </div>
                      {pr.observacion && (
                        <p className="text-gray-500 text-[11px]">{pr.observacion}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 6. Certificados */}
            {tabActiva === "certificados" && (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {certificadosFiltrados.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-500">No cuenta con certificados emitidos.</p>
                ) : (
                  certificadosFiltrados.map((cert) => (
                    <div
                      key={cert.id_certificado}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-gray-200 bg-white"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <FileBadge className="h-4 w-4 text-blue-800" />
                          <span className="font-mono text-xs font-bold text-gray-900">
                            {cert.codigo}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              cert.estado === "EMITIDO"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {cert.estado}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Curso: <strong className="text-gray-700">{cert.curso}</strong> • Emisión:{" "}
                          {String(cert.fecha_emision).substring(0, 10)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DetalleEstudianteModal;