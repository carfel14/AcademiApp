import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Clock3, Pencil, Plus, Search, UserRound, Users } from "lucide-react";
import { useToast } from "../../context/ToastContext";

import { actualizarGrupo, crearGrupo, eliminarGrupo, finalizarGrupo, obtenerGrupos } from "../../services/grupoService";
import { obtenerCursos, obtenerPlanesCurso } from "../../services/cursoService";
import { obtenerHorariosPorGrupo } from "../../services/horarioService";
import { obtenerAsignaciones } from "../../services/asignacionProfesorService";
import { obtenerProfesores } from "../../services/profesorService";

import type { Grupo } from "../../types/grupo";
import type { Curso, PlanEstudio } from "../../types/curso";
import type { Horario } from "../../types/horario";
import type { AsignacionProfesor } from "../../types/asignacionProfesor";
import type { Profesor } from "../../types/profesor";
import { esCrearGrupoFormData, type ActualizarGrupoFormData, type CrearGrupoFormData } from "../../schema/grupoSchema";

import Modal from "../../components/ui/Modal";
import GrupoForm from "../../components/grupos/GrupoForm";
import HorariosGrupo from "../../components/grupos/HorariosGrupo";
import ProfesoresGrupo from "../../components/grupos/ProfesoresGrupo";
import { ESTADOS_GRUPO, formatearDia, formatearFecha, formatearHora } from "../../components/grupos/formato";

interface GruposPageProps {
  /** ADMINISTRADOR: crear, editar, horarios, profesores, finalizar y cancelar. */
  editable: boolean;
  verCalendario: boolean;
  verInscripciones: boolean;
}

type Confirmacion = { grupo: Grupo; accion: "finalizar" | "cancelar" };

const selectClass =
  "w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function GruposPage({ editable, verCalendario, verInscripciones }: GruposPageProps) {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const cursoFiltro = params.get("curso") ?? "";
  const estadoFiltro = params.get("estado") ?? "";
  const [busqueda, setBusqueda] = useState("");

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [horarios, setHorarios] = useState<Record<number, Horario[]>>({});
  const [asignaciones, setAsignaciones] = useState<AsignacionProfesor[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);

  const [formulario, setFormulario] = useState<Grupo | "nuevo" | null>(null);
  const [cursoNuevo, setCursoNuevo] = useState("");
  const [planes, setPlanes] = useState<PlanEstudio[]>([]);
  const [horariosDe, setHorariosDe] = useState<Grupo | null>(null);
  const [profesoresDe, setProfesoresDe] = useState<Grupo | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [gruposData, cursosData, asignacionesData, profesoresData] = await Promise.all([
        obtenerGrupos("TODOS"),
        obtenerCursos(),
        // Los roles sin acceso a profesores ven el grupo sin esa información.
        obtenerAsignaciones().catch(() => [] as AsignacionProfesor[]),
        obtenerProfesores().catch(() => [] as Profesor[]),
      ]);
      const horariosData = await Promise.all(
        gruposData.map(async (g) => [g.id_grupo, await obtenerHorariosPorGrupo(g.id_grupo).catch(() => [])] as const),
      );
      setGrupos(gruposData);
      setCursos(cursosData);
      setAsignaciones(asignacionesData);
      setProfesores(profesoresData);
      setHorarios(Object.fromEntries(horariosData));
    } catch {
      toast.warning("No se pudieron cargar los grupos");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void cargar(); });
    return () => { active = false; };
  }, [cargar]);

  // Mantiene los modales abiertos con la versión recargada del grupo.
  const actual = (g: Grupo | null) => (g ? grupos.find((x) => x.id_grupo === g.id_grupo) ?? g : null);

  function filtrar(clave: "curso" | "estado", valor: string) {
    const siguiente = new URLSearchParams(params);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    setParams(siguiente, { replace: true });
  }

  // Cursos para el filtro: los activos y los de cualquier grupo listado.
  const opcionesCurso = useMemo(() => {
    const mapa = new Map<number, string>(cursos.map((c) => [c.id_curso, c.nombre]));
    for (const g of grupos) if (!mapa.has(g.id_curso)) mapa.set(g.id_curso, g.curso ?? `Curso ${g.id_curso}`);
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1]));
  }, [cursos, grupos]);
  const nombreCurso = opcionesCurso.find(([id]) => String(id) === cursoFiltro)?.[1];

  const termino = busqueda.trim().toLowerCase();
  const filtrados = grupos
    .filter((g) => !cursoFiltro || String(g.id_curso) === cursoFiltro)
    .filter((g) => !estadoFiltro || g.estado === estadoFiltro)
    .filter((g) => !termino || `${g.nombre} ${g.curso ?? ""}`.toLowerCase().includes(termino))
    .sort((a, b) => {
      const orden = { EN_CURSO: 0, FINALIZADO: 1, CANCELADO: 2 };
      return orden[a.estado] - orden[b.estado] || a.fecha_inicio.localeCompare(b.fecha_inicio);
    });

  async function abrirNuevo() {
    setFormulario("nuevo");
    await elegirCurso(cursoFiltro && cursos.some((c) => String(c.id_curso) === cursoFiltro) ? cursoFiltro : "");
  }

  async function elegirCurso(id: string) {
    setCursoNuevo(id);
    setPlanes([]);
    if (!id) return;
    try {
      setPlanes((await obtenerPlanesCurso(Number(id))).filter((p) => p.estado === "ACTIVO"));
    } catch {
      toast.warning("No se pudieron cargar los planes de estudio del curso");
    }
  }

  async function guardarGrupo(data: CrearGrupoFormData | ActualizarGrupoFormData) {
    try {
      if (formulario === "nuevo") {
        if (!esCrearGrupoFormData(data)) return;
        await crearGrupo({ id_plan: data.id_plan, nombre: data.nombre, fecha_inicio: data.fecha_inicio, duracion_meses: Number(data.duracion_meses) });
        toast.success("Grupo creado con éxito");
      } else if (formulario) {
        await actualizarGrupo(formulario.id_grupo, { nombre: data.nombre, duracion_meses: Number(data.duracion_meses) });
        toast.info("Grupo actualizado con éxito");
      }
      setFormulario(null);
      await cargar();
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : "No se pudo guardar el grupo");
    }
  }

  async function confirmar() {
    if (!confirmacion) return;
    setTrabajando(true);
    try {
      if (confirmacion.accion === "finalizar") {
        await finalizarGrupo(confirmacion.grupo.id_grupo);
        toast.info("Grupo finalizado");
      } else {
        await eliminarGrupo(confirmacion.grupo.id_grupo);
        toast.error("Grupo cancelado");
      }
      setConfirmacion(null);
      await cargar();
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : "No se pudo completar la operación");
    } finally {
      setTrabajando(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-600">Cargando grupos...</p>;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grupos</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {nombreCurso ? `Grupos de ${nombreCurso}.` : "Secciones de cada curso con su horario, profesores e inscritos."}
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => void abrirNuevo()}
            className="group flex shrink-0 items-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-950/20 transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <Plus className="h-4 w-4 text-blue-200 transition group-hover:text-white" strokeWidth={2.5} />
            Nuevo grupo
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar grupos por nombre o curso</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por grupo o curso..."
            className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap font-medium">Curso</span>
          <select value={cursoFiltro} onChange={(e) => filtrar("curso", e.target.value)} className={selectClass}>
            <option value="">Todos los cursos</option>
            {opcionesCurso.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap font-medium">Estado</span>
          <select value={estadoFiltro} onChange={(e) => filtrar("estado", e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            <option value="EN_CURSO">En curso</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">
            {grupos.length ? "No hay grupos con estos filtros." : "Todavía no hay grupos."}
          </p>
          {editable && <button type="button" onClick={() => void abrirNuevo()} className="mt-3 text-sm font-semibold text-blue-900 hover:underline">Crear un grupo</button>}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((g) => {
            const estado = ESTADOS_GRUPO[g.estado];
            const horariosGrupo = horarios[g.id_grupo] ?? [];
            const profesoresGrupo = asignaciones.filter((a) => a.id_grupo === g.id_grupo);
            const enCurso = g.estado === "EN_CURSO";
            return (
              <article key={g.id_grupo} className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="bg-blue-950 px-5 py-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold">{g.nombre}</h2>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
                  </div>
                  <p className="mt-1 text-sm text-blue-200">{g.curso} · {g.plan_estudio ? `plan v${g.version}` : ""}</p>
                </div>

                <div className="flex-1 space-y-3 px-5 py-4 text-sm text-slate-700">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-blue-800" aria-hidden="true" />
                    <span>
                      {formatearFecha(g.fecha_inicio)} → {g.fecha_fin ? formatearFecha(g.fecha_fin) : `${formatearFecha(g.fecha_fin_estimada)} (estimado)`}
                      <span className="text-slate-500"> · {g.duracion_meses} {g.duracion_meses === 1 ? "mes" : "meses"}</span>
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" aria-hidden="true" />
                    <span>
                      {horariosGrupo.length
                        ? horariosGrupo.map((h) => `${formatearDia(h.dia_semana)} ${formatearHora(h.hora_inicio)}–${formatearHora(h.hora_finalizacion)}`).join(" · ")
                        : <span className="text-slate-500">Sin horario semanal</span>}
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" aria-hidden="true" />
                    <span>
                      {profesoresGrupo.length
                        ? profesoresGrupo.map((a) => a.profesor).join(", ")
                        : <span className="text-slate-500">{g.profesores_asignados ? `${g.profesores_asignados} profesor(es)` : "Sin profesor asignado"}</span>}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-blue-800" aria-hidden="true" />
                    <span><strong className="text-slate-900">{g.inscritos ?? 0}</strong> {g.inscritos === 1 ? "inscripción activa" : "inscripciones activas"}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm">
                  <button type="button" onClick={() => setHorariosDe(g)} className="font-semibold text-blue-950 hover:underline">Horarios</button>
                  <button type="button" onClick={() => setProfesoresDe(g)} className="font-semibold text-blue-950 hover:underline">Profesores</button>
                  {verCalendario && <Link to={`/calendario?grupo=${g.id_grupo}`} className="font-semibold text-blue-950 hover:underline">Calendario</Link>}
                  {verInscripciones && <Link to={`/inscripciones?grupo=${g.id_grupo}`} className="font-semibold text-blue-950 hover:underline">Inscripciones</Link>}
                  {editable && enCurso && (
                    <span className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={() => setFormulario(g)} aria-label={`Editar ${g.nombre}`} title="Editar grupo" className="rounded-md p-1.5 hover:bg-slate-100">
                        <Pencil className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setConfirmacion({ grupo: g, accion: "finalizar" })} className="rounded-md px-2 py-1 font-semibold text-green-700 hover:bg-green-50">Finalizar</button>
                      <button type="button" onClick={() => setConfirmacion({ grupo: g, accion: "cancelar" })} className="rounded-md px-2 py-1 font-semibold text-red-600 hover:bg-red-50">Cancelar</button>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={Boolean(formulario)}
        onClose={() => setFormulario(null)}
        title={formulario === "nuevo" ? "Nuevo grupo" : `Editar grupo${formulario ? `: ${formulario.nombre}` : ""}`}
      >
        {formulario === "nuevo" && (
          <label className="mb-4 block text-sm font-semibold text-gray-800">
            Curso
            <select value={cursoNuevo} onChange={(e) => void elegirCurso(e.target.value)} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal">
              <option value="">Selecciona un curso</option>
              {cursos.filter((c) => c.estado === "ACTIVO").map((c) => <option key={c.id_curso} value={c.id_curso}>{c.nombre}</option>)}
            </select>
          </label>
        )}
        {formulario === "nuevo" && cursoNuevo && !planes.length && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Este curso no tiene un plan de estudio activo. Créalo en Planes de estudio.</p>
        )}
        {(formulario !== "nuevo" || cursoNuevo) && formulario && (
          <GrupoForm key={formulario === "nuevo" ? `nuevo-${cursoNuevo}-${planes.length}` : formulario.id_grupo}
            grupo={formulario === "nuevo" ? undefined : formulario} planes={planes} onSubmit={guardarGrupo} />
        )}
      </Modal>

      <Modal isOpen={Boolean(horariosDe)} onClose={() => setHorariosDe(null)} title={`Horario semanal${horariosDe ? `: ${horariosDe.nombre}` : ""}`}>
        {horariosDe && <HorariosGrupo grupo={actual(horariosDe)!} horarios={horarios[horariosDe.id_grupo] ?? []} editable={editable} onCambio={() => void cargar()} />}
      </Modal>

      <Modal isOpen={Boolean(profesoresDe)} onClose={() => setProfesoresDe(null)} title={`Profesores${profesoresDe ? `: ${profesoresDe.nombre}` : ""}`}>
        {profesoresDe && <ProfesoresGrupo grupo={actual(profesoresDe)!} asignaciones={asignaciones} profesores={profesores} editable={editable} onCambio={() => void cargar()} />}
      </Modal>

      <Modal isOpen={Boolean(confirmacion)} onClose={() => setConfirmacion(null)} title={confirmacion?.accion === "finalizar" ? "Finalizar grupo" : "Cancelar grupo"}>
        {confirmacion && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-gray-600">
              {confirmacion.accion === "finalizar"
                ? <>Se finalizará <strong className="text-gray-900">{confirmacion.grupo.nombre}</strong>: sus inscripciones activas pasan a finalizadas, sus sesiones programadas se cancelan y se registra hoy como fecha de cierre.</>
                : <>Se cancelará <strong className="text-gray-900">{confirmacion.grupo.nombre}</strong>. Dejará de aceptar inscripciones y no se podrá volver a poner en curso.</>}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmacion(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Volver</button>
              <button
                type="button"
                disabled={trabajando}
                onClick={() => void confirmar()}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${confirmacion.accion === "finalizar" ? "bg-green-700 hover:bg-green-800" : "bg-red-600 hover:bg-red-700"}`}
              >
                {confirmacion.accion === "finalizar" ? "Finalizar grupo" : "Cancelar grupo"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default GruposPage;
