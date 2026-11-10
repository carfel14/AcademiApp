import { useState, useMemo } from "react";
import {
  Search,
  Layers,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import type { Estudiante } from "../../types/estudiante";
import type { Curso } from "../../types/curso";
import type { Grupo } from "../../types/grupo";
import type { Inscripcion } from "../../types/inscripcion";

interface NuevaInscripcionWizardModalProps {
  estudiantes: Estudiante[];
  cursos: Curso[];
  grupos: Grupo[];
  inscripciones: Inscripcion[];
  onSubmit: (data: { id_estudiante: number; id_grupo: number; observacion?: string }) => Promise<void>;
  onClose: () => void;
}

function NuevaInscripcionWizardModal({
  estudiantes,
  cursos,
  grupos,
  inscripciones,
  onSubmit,
  onClose,
}: NuevaInscripcionWizardModalProps) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);

  // Selecciones
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<Estudiante | null>(null);
  const [cursoSeleccionado, setCursoSeleccionado] = useState<Curso | null>(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null);
  const [observacion, setObservacion] = useState("");

  // Búsquedas internas
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [cargandoEnvio, setCargandoEnvio] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");

  const hoyStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  // Filtrado de estudiantes activos
  const estudiantesFiltrados = useMemo(() => {
    if (!busquedaEstudiante.trim()) return [];
    const t = busquedaEstudiante.toLowerCase().trim();
    return estudiantes
      .filter((e) => e.estado === "ACTIVO")
      .filter((e) => {
        const nom = `${e.nombres} ${e.apellidos}`.toLowerCase();
        const cod = (e.codigo_estudiante || "").toLowerCase();
        const tel = (e.telefono || "").toLowerCase();
        return nom.includes(t) || cod.includes(t) || tel.includes(t);
      })
      .slice(0, 5);
  }, [estudiantes, busquedaEstudiante]);

  // Inscripciones activas del estudiante para no duplicar
  const gruposInscritosEstudiante = useMemo(() => {
    if (!estudianteSeleccionado) return new Set<number>();
    return new Set(
      inscripciones
        .filter(
          (i) =>
            i.id_estudiante === estudianteSeleccionado.id_estudiante &&
            i.estado_inscripcion === "ACTIVA"
        )
        .map((i) => i.id_grupo)
    );
  }, [inscripciones, estudianteSeleccionado]);

  // Grupos disponibles del curso seleccionado: activos, fecha_inicio >= hoy, y no inscritos por este alumno
  const gruposDisponibles = useMemo(() => {
    if (!cursoSeleccionado) return [];
    return grupos.filter((g) => {
      const fInicio = String(g.fecha_inicio).substring(0, 10);
      return (
        g.id_curso === cursoSeleccionado.id_curso &&
        g.estado.toUpperCase() === "ACTIVO" &&
        !gruposInscritosEstudiante.has(g.id_grupo) &&
        hoyStr <= fInicio
      );
    });
  }, [grupos, cursoSeleccionado, gruposInscritosEstudiante, hoyStr]);

  async function handleConfirmar() {
    if (!estudianteSeleccionado || !grupoSeleccionado) return;
    try {
      setCargandoEnvio(true);
      setErrorLocal("");
      await onSubmit({
        id_estudiante: estudianteSeleccionado.id_estudiante,
        id_grupo: grupoSeleccionado.id_grupo,
        observacion: observacion.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : "Error al procesar la inscripción");
    } finally {
      setCargandoEnvio(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Indicador de Pasos */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 text-xs font-semibold">
        <div className={`flex items-center gap-1.5 ${paso >= 1 ? "text-blue-950 font-bold" : "text-gray-400"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${paso >= 1 ? "bg-blue-950 text-white" : "bg-gray-200 text-gray-600"}`}>1</span>
          Estudiante
        </div>
        <div className="h-0.5 w-6 bg-gray-200" />
        <div className={`flex items-center gap-1.5 ${paso >= 2 ? "text-blue-950 font-bold" : "text-gray-400"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${paso >= 2 ? "bg-blue-950 text-white" : "bg-gray-200 text-gray-600"}`}>2</span>
          Curso
        </div>
        <div className="h-0.5 w-6 bg-gray-200" />
        <div className={`flex items-center gap-1.5 ${paso >= 3 ? "text-blue-950 font-bold" : "text-gray-400"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${paso >= 3 ? "bg-blue-950 text-white" : "bg-gray-200 text-gray-600"}`}>3</span>
          Grupo
        </div>
        <div className="h-0.5 w-6 bg-gray-200" />
        <div className={`flex items-center gap-1.5 ${paso >= 4 ? "text-blue-950 font-bold" : "text-gray-400"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${paso >= 4 ? "bg-blue-950 text-white" : "bg-gray-200 text-gray-600"}`}>4</span>
          Confirmar
        </div>
      </div>

      {errorLocal && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          {errorLocal}
        </div>
      )}

      {/* ======================================================== */}
      {/* PASO 1: SELECCIONAR ESTUDIANTE */}
      {/* ======================================================== */}
      {paso === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Buscar estudiante por nombre, apellido o carnet
            </label>
            {!estudianteSeleccionado ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={busquedaEstudiante}
                  onChange={(e) => setBusquedaEstudiante(e.target.value)}
                  placeholder="Escribe carnet o nombre..."
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />

                {estudiantesFiltrados.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    {estudiantesFiltrados.map((e) => (
                      <button
                        key={e.id_estudiante}
                        type="button"
                        onClick={() => {
                          setEstudianteSeleccionado(e);
                          setBusquedaEstudiante("");
                        }}
                        className="flex w-full items-center justify-between p-3 text-left hover:bg-blue-50/70 border-b border-gray-100 last:border-0 transition"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {e.nombres} {e.apellidos}
                          </p>
                          <p className="text-xs font-mono text-blue-900">{e.codigo_estudiante}</p>
                        </div>
                        <span className="text-xs text-gray-400">{e.telefono || "Sin tel."}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-950 text-white font-bold text-xs">
                    {estudianteSeleccionado.nombres.charAt(0)}
                    {estudianteSeleccionado.apellidos.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {estudianteSeleccionado.nombres} {estudianteSeleccionado.apellidos}
                    </p>
                    <p className="text-xs font-mono text-blue-900">
                      {estudianteSeleccionado.codigo_estudiante} • {estudianteSeleccionado.telefono || "Sin tel."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEstudianteSeleccionado(null)}
                  className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-gray-700 transition"
                  title="Cambiar estudiante"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              disabled={!estudianteSeleccionado}
              onClick={() => setPaso(2)}
              className="flex items-center gap-2 rounded-lg bg-blue-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition"
            >
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PASO 2: SELECCIONAR CURSO */}
      {/* ======================================================== */}
      {paso === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Selecciona el curso de interés
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
              {cursos
                .filter((c) => c.estado.toUpperCase() === "ACTIVO")
                .map((curso) => {
                  const seleccionado = cursoSeleccionado?.id_curso === curso.id_curso;

                  return (
                    <button
                      key={curso.id_curso}
                      type="button"
                      onClick={() => {
                        setCursoSeleccionado(curso);
                        setGrupoSeleccionado(null);
                      }}
                      className={`flex flex-col justify-between p-3.5 text-left rounded-xl border transition ${
                        seleccionado
                          ? "border-blue-950 bg-blue-50/70 ring-2 ring-blue-950/20"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-900">{curso.nombre_curso}</p>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{curso.descripcion}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs font-semibold text-blue-950 border-t border-gray-100 pt-2">
                        <span>Matrícula: C$ {curso.precio_matricula}</span>
                        <span>Total: C$ {curso.precio}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>

            <button
              type="button"
              disabled={!cursoSeleccionado}
              onClick={() => setPaso(3)}
              className="flex items-center gap-2 rounded-lg bg-blue-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition"
            >
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PASO 3: SELECCIONAR GRUPO */}
      {/* ======================================================== */}
      {paso === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Grupos disponibles para {cursoSeleccionado?.nombre_curso}
            </label>

            {gruposDisponibles.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-500 border border-dashed rounded-xl bg-gray-50">
                No hay grupos disponibles por iniciar para este curso (o el estudiante ya está inscrito).
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {gruposDisponibles.map((grupo) => {
                  const seleccionado = grupoSeleccionado?.id_grupo === grupo.id_grupo;

                  return (
                    <button
                      key={grupo.id_grupo}
                      type="button"
                      onClick={() => setGrupoSeleccionado(grupo)}
                      className={`flex w-full items-center justify-between p-3.5 text-left rounded-xl border transition ${
                        seleccionado
                          ? "border-blue-950 bg-blue-50/70 ring-2 ring-blue-950/20"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-blue-900" />
                          <p className="text-sm font-bold text-gray-900">{grupo.nombre_grupo}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {grupo.duracion_meses} meses
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span>Inicia: {String(grupo.fecha_inicio).substring(0, 10)}</span>
                          <span>•</span>
                          <span>Finaliza: {String(grupo.fecha_fin).substring(0, 10)}</span>
                        </p>
                      </div>

                      {seleccionado && <CheckCircle2 className="h-5 w-5 text-blue-950 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setPaso(2)}
              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>

            <button
              type="button"
              disabled={!grupoSeleccionado}
              onClick={() => setPaso(4)}
              className="flex items-center gap-2 rounded-lg bg-blue-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition"
            >
              Revisar resumen <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PASO 4: RESUMEN Y CONFIRMACIÓN */}
      {/* ======================================================== */}
      {paso === 4 && estudianteSeleccionado && cursoSeleccionado && grupoSeleccionado && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-slate-50 p-4 space-y-3">
            <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
              Resumen de la Nueva Inscripción
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-gray-200 pt-3">
              <div>
                <p className="text-gray-500 font-medium">Estudiante:</p>
                <p className="font-bold text-gray-900 text-sm mt-0.5">
                  {estudianteSeleccionado.nombres} {estudianteSeleccionado.apellidos}
                </p>
                <p className="text-blue-900 font-mono text-[11px]">
                  {estudianteSeleccionado.codigo_estudiante}
                </p>
              </div>

              <div>
                <p className="text-gray-500 font-medium">Curso & Grupo:</p>
                <p className="font-bold text-gray-900 text-sm mt-0.5">
                  {cursoSeleccionado.nombre_curso}
                </p>
                <p className="text-gray-600 font-medium">
                  {grupoSeleccionado.nombre_grupo} ({grupoSeleccionado.duracion_meses} meses)
                </p>
              </div>

              <div>
                <p className="text-gray-500 font-medium">Fecha de Inicio del Grupo:</p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {String(grupoSeleccionado.fecha_inicio).substring(0, 10)}
                </p>
              </div>

              <div>
                <p className="text-gray-500 font-medium">Condiciones Financieras:</p>
                <p className="font-semibold text-emerald-800 mt-0.5">
                  Matrícula: C$ {cursoSeleccionado.precio_matricula} (Pago auto)
                </p>
                <p className="text-gray-700">
                  Total Curso: C$ {cursoSeleccionado.precio} en {grupoSeleccionado.duracion_meses} cuotas
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Observación de matrícula (opcional):
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={2}
                placeholder="Acuerdos adicionales..."
                className="w-full resize-none rounded-lg border border-gray-300 p-2 text-xs text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={cargandoEnvio}
              onClick={() => setPaso(3)}
              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>

            <button
              type="button"
              disabled={cargandoEnvio}
              onClick={handleConfirmar}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 shadow-md transition disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {cargandoEnvio ? "Procesando..." : "Confirmar Inscripción"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NuevaInscripcionWizardModal;