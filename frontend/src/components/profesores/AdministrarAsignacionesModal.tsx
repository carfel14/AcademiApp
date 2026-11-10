import { useState, useMemo } from "react";
import { Plus, Trash2, BookOpen, Layers, AlertCircle } from "lucide-react";
import type { Profesor } from "../../types/profesor";
import type { AsignacionProfesor } from "../../types/asignacionProfesor";
import type { Grupo } from "../../types/grupo";
import type { Curso } from "../../types/curso";

interface AdministrarAsignacionesModalProps {
  profesor: Profesor;
  asignaciones: AsignacionProfesor[];
  grupos: Grupo[];
  cursos: Curso[];
  onAsignarGrupo: (id_grupo: number) => Promise<void>;
  onEliminarAsignacion: (id_asignacion: number) => Promise<void>;
  onClose: () => void;
}

function AdministrarAsignacionesModal({
  profesor,
  asignaciones,
  grupos,
  cursos,
  onAsignarGrupo,
  onEliminarAsignacion,
}: AdministrarAsignacionesModalProps) {
  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState<number | "">("");
  const [grupoSeleccionadoId, setGrupoSeleccionadoId] = useState<number | "">("");
  const [cargando, setCargando] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");

  const asignacionesDelProfesor = useMemo(
    () => asignaciones.filter((a) => a.id_profesor === profesor.id_profesor),
    [asignaciones, profesor.id_profesor]
  );

  const gruposAsignadosIds = useMemo(
    () => new Set(asignacionesDelProfesor.map((a) => a.id_grupo)),
    [asignacionesDelProfesor]
  );

  // Filtrar grupos activos del curso seleccionado que el profesor no tenga asignados
  const gruposDisponibles = useMemo(() => {
    if (!cursoSeleccionadoId) return [];
    return grupos.filter(
      (g) =>
        g.id_curso === Number(cursoSeleccionadoId) &&
        g.estado === "EN_CURSO" &&
        !gruposAsignadosIds.has(g.id_grupo)
    );
  }, [grupos, cursoSeleccionadoId, gruposAsignadosIds]);

  function handleCambioCurso(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value ? Number(e.target.value) : "";
    setCursoSeleccionadoId(val);
    setGrupoSeleccionadoId("");
  }

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault();
    if (!grupoSeleccionadoId) return;

    try {
      setCargando(true);
      setErrorLocal("");
      await onAsignarGrupo(Number(grupoSeleccionadoId));
      setGrupoSeleccionadoId("");
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : "Error al asignar grupo");
    } finally {
      setCargando(false);
    }
  }

  async function handleEliminar(id_asignacion: number) {
    try {
      setCargando(true);
      setErrorLocal("");
      await onEliminarAsignacion(id_asignacion);
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : "Error al desvincular");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      {errorLocal && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorLocal}</span>
        </div>
      )}

      {/* Formulario para asignar nuevo grupo */}
      <form
        onSubmit={handleAsignar}
        className="w-full rounded-lg border border-gray-200 bg-slate-50 p-4"
      >
        <p className="text-sm font-semibold text-gray-800 mb-3">
          Asignar a un nuevo grupo
        </p>

        <div className="flex flex-col gap-3">
          {/* Paso 1: Seleccionar Curso */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              1. Selecciona el curso
            </label>
            <select
              value={cursoSeleccionadoId}
              onChange={handleCambioCurso}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Selecciona un curso...</option>
              {cursos
                .filter((c) => c.estado === "ACTIVO")
                .map((curso) => (
                  <option key={curso.id_curso} value={curso.id_curso}>
                    {curso.nombre}
                  </option>
                ))}
            </select>
          </div>

          {/* Paso 2: Seleccionar Grupo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              2. Selecciona el grupo
            </label>
            <select
              value={grupoSeleccionadoId}
              onChange={(e) =>
                setGrupoSeleccionadoId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={!cursoSeleccionadoId}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {!cursoSeleccionadoId
                  ? "Primero elige un curso"
                  : gruposDisponibles.length === 0
                  ? "No hay grupos disponibles para asignar en este curso"
                  : "Selecciona el grupo..."}
              </option>
              {gruposDisponibles.map((grupo) => (
                <option key={grupo.id_grupo} value={grupo.id_grupo}>
                  {grupo.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Botón de Asignar estructurado con ancho completo para evitar overflow */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={!grupoSeleccionadoId || cargando}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {cargando ? "Asignando..." : "Asignar grupo"}
            </button>
          </div>
        </div>
      </form>

      {/* Lista de asignaciones actuales */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800">
            Grupos a cargo
          </h4>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-950 border border-blue-100">
            {asignacionesDelProfesor.length} asignados
          </span>
        </div>

        {asignacionesDelProfesor.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-500">
            Este docente aún no tiene grupos asignados.
          </div>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {asignacionesDelProfesor.map((asig) => {
              const grupo = grupos.find((g) => g.id_grupo === asig.id_grupo);
              const curso = grupo
                ? cursos.find((c) => c.id_curso === grupo.id_curso)
                : null;

              return (
                <div
                  key={asig.id_asignacion}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-gray-300"
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Layers className="h-4 w-4 text-blue-800 shrink-0" />
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {grupo ? grupo.nombre : `Grupo #${asig.id_grupo}`}
                      </p>
                      {grupo && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {grupo.duracion_meses} meses
                        </span>
                      )}
                    </div>

                    {curso && (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">
                          Curso: <strong className="font-medium text-gray-700">{curso.nombre}</strong>
                        </span>
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEliminar(asig.id_asignacion)}
                    disabled={cargando}
                    title="Desvincular grupo"
                    className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdministrarAsignacionesModal;