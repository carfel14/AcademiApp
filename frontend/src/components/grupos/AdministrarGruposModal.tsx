import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { Grupo } from "../../types/grupo";
import type { Horario } from "../../types/horario";
import Modal from "../ui/Modal";
import HorarioForm from "./HorarioForm";
import {
  actualizarHorario,
  crearHorario,
  eliminarHorario,
  obtenerHorariosPorGrupo,
} from "../../services/horarioService";

interface AdministrarGruposModalProps {
  cursoNombre: string;
  grupos: Grupo[];
  onAgregarGrupo: () => void;
  onEditarGrupo: (grupo: Grupo) => void;
  onEliminarGrupo: (id: number) => Promise<void>;
  onFinalizarGrupo: (id: number) => Promise<void>;
  onClose: () => void;
}

function formatearDia(dia: string) {
  return dia.charAt(0) + dia.slice(1).toLowerCase();
}

function obtenerHora(hora: unknown) {
  if (hora instanceof Date) {
    return `${String(hora.getHours()).padStart(2, "0")}:${String(hora.getMinutes()).padStart(2, "0")}`;
  }

  const coincidencia = String(hora ?? "").match(/(\d{2}):(\d{2})/);
  return coincidencia ? `${coincidencia[1]}:${coincidencia[2]}` : "";
}

function formatearHora(hora: unknown) {
  const horaNormalizada = obtenerHora(hora);
  if (!horaNormalizada) return "Hora no disponible";

  const [horas, minutos] = horaNormalizada.split(":");
  const horaNumero = Number(horas);
  const periodo = horaNumero >= 12 ? "PM" : "AM";
  const hora12 = horaNumero % 12 || 12;
  return `${hora12}:${minutos} ${periodo}`;
}

function AdministrarGruposModal({
  cursoNombre,
  grupos,
  onAgregarGrupo,
  onEditarGrupo,
  onEliminarGrupo,
  onFinalizarGrupo,
  onClose,
}: AdministrarGruposModalProps) {
  const [horarios, setHorarios] = useState<Record<number, Horario[]>>({});
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<Horario>();
  const [grupoParaHorario, setGrupoParaHorario] = useState<Grupo>();
  const [error, setError] = useState("");
  const [grupoAEliminar, setGrupoAEliminar] = useState<Grupo>();
  const [grupoAFinalizar, setGrupoAFinalizar] = useState<Grupo>();
  const [horarioAEliminar, setHorarioAEliminar] = useState<Horario>();

  useEffect(() => {
    async function cargarHorarios() {
      try {
        const resultados = await Promise.all(
          grupos.map(async (grupo) => [grupo.id_grupo, await obtenerHorariosPorGrupo(grupo.id_grupo)] as const)
        );
        setHorarios(Object.fromEntries(resultados));
      } catch {
        setError("No se pudieron cargar los horarios.");
      }
    }

    void cargarHorarios();
  }, [grupos]);

  function abrirNuevoHorario(grupo: Grupo) {
    setGrupoParaHorario(grupo);
    setHorarioSeleccionado(undefined);
  }

  function abrirEditarHorario(grupo: Grupo, horario: Horario) {
    setGrupoParaHorario(grupo);
    setHorarioSeleccionado(horario);
  }

  async function guardarHorario(data: { dia_semana: string; hora_inicio: string; hora_fin: string }) {
    if (!grupoParaHorario) return;

    try {
      if (horarioSeleccionado) {
        const actualizado = await actualizarHorario(horarioSeleccionado.id_horario, data);
        setHorarios((actuales) => ({
          ...actuales,
          [grupoParaHorario.id_grupo]: (actuales[grupoParaHorario.id_grupo] ?? []).map((horario) =>
            horario.id_horario === actualizado.id_horario ? actualizado : horario
          ),
        }));
      } else {
        const nuevo = await crearHorario(grupoParaHorario.id_grupo, data);
        setHorarios((actuales) => ({
          ...actuales,
          [grupoParaHorario.id_grupo]: [...(actuales[grupoParaHorario.id_grupo] ?? []), nuevo],
        }));
      }
      setGrupoParaHorario(undefined);
      setHorarioSeleccionado(undefined);
    } catch (submitError) {
      throw submitError instanceof Error ? submitError : new Error("No se pudo guardar el horario");
    }
  }

  async function confirmarEliminarHorario() {
    if (!horarioAEliminar) return;

    try {
      await eliminarHorario(horarioAEliminar.id_horario);
      setHorarios((actuales) => ({
        ...actuales,
        [horarioAEliminar.id_grupo]: actuales[horarioAEliminar.id_grupo].filter(
          (horario) => horario.id_horario !== horarioAEliminar.id_horario
        ),
      }));
      setHorarioAEliminar(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo eliminar el horario.");
    }
  }

  async function confirmarFinalizarGrupo() {
    if (!grupoAFinalizar) return;

    try {
      await onFinalizarGrupo(grupoAFinalizar.id_grupo);
      setGrupoAFinalizar(undefined);
    } catch {
      setError("No se pudo finalizar el grupo.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 border-b border-gray-100 pb-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-400">Curso</p>
          <p className="truncate font-semibold text-gray-900">{cursoNombre}</p>
        </div>
        <button
          type="button"
          onClick={onAgregarGrupo}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        >
          <Plus className="h-3.5 w-3.5 text-blue-200" />
          Agregar grupo
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {grupos.length === 0 ? (
          <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">Este curso todavía no tiene grupos.</p>
        ) : grupos.map((grupo) => (
          <section key={grupo.id_grupo} className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-md shadow-gray-900/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">{grupo.nombre_grupo}</h3>
                <p className="mt-1 text-sm text-gray-500">Inicio: {grupo.fecha_inicio.slice(0, 10)}</p>
                <p className="mt-1 text-sm text-gray-500">
                  Duración: {grupo.duracion_meses ? `${grupo.duracion_meses} meses` : "Sin duración"}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">{grupo.estado}</span>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Horarios:</p>
                <button
                  type="button"
                  onClick={() => abrirNuevoHorario(grupo)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-blue-950 transition hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar horario
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {(horarios[grupo.id_grupo] ?? []).map((horario) => (
                  <div key={horario.id_horario} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                    <span>{formatearDia(horario.dia_semana)} {formatearHora(horario.hora_inicio)} - {formatearHora(horario.hora_fin)}</span>
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => abrirEditarHorario(grupo, horario)} aria-label="Editar horario" title="Editar horario" className="rounded p-1 text-yellow-500 hover:bg-yellow-100"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setHorarioAEliminar(horario)} aria-label="Eliminar horario" title="Eliminar horario" className="rounded p-1 text-red-600 hover:bg-red-100"><Trash2 className="h-4 w-4" /></button>
                    </span>
                  </div>
                ))}
                {(horarios[grupo.id_grupo] ?? []).length === 0 && <p className="text-sm text-gray-600">No hay horarios registrados.</p>}
                <Link className="work-link" to={`/calendario?grupo=${grupo.id_grupo}`}>Abrir calendario</Link>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm">
              <p className="text-gray-600"><strong className="text-gray-900">0</strong> estudiantes</p>
              <p className="text-gray-600"><strong className="text-gray-900">0</strong> profesores</p>
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => onEditarGrupo(grupo)}
                className="flex-1 rounded-md px-3 py-2.5 text-sm font-semibold text-blue-950 transition hover:bg-blue-50"
              >
                Editar grupo
              </button>

              {grupo.estado.toUpperCase() === "ACTIVO" && (
                <button
                  type="button"
                  onClick={() => setGrupoAFinalizar(grupo)}
                  className="flex-1 rounded-md px-3 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                >
                  Finalizar grupo
                </button>
              )}

              <button
                type="button"
                onClick={() => setGrupoAEliminar(grupo)}
                className="flex-1 rounded-md px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Eliminar grupo
              </button>
            </div>
          </section>
        ))}
      </div>

      <button type="button" onClick={onClose} className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Regresar</button>

      <Modal isOpen={Boolean(grupoParaHorario)} onClose={() => setGrupoParaHorario(undefined)} title={horarioSeleccionado ? "Editar horario" : "Agregar horario"}>
        <HorarioForm horario={horarioSeleccionado} onSubmit={guardarHorario} />
      </Modal>

      <Modal isOpen={Boolean(horarioAEliminar)} onClose={() => setHorarioAEliminar(undefined)} title="Eliminar horario">
        <p className="text-sm text-gray-600">¿Deseas eliminar este horario?</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setHorarioAEliminar(undefined)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button type="button" onClick={confirmarEliminarHorario} className="rounded-md bg-red-600 px-4 py-2 text-sm text-white">Eliminar</button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(grupoAEliminar)} onClose={() => setGrupoAEliminar(undefined)} title="Eliminar grupo">
        <p className="text-sm text-gray-600">¿Deseas eliminar el grupo {grupoAEliminar?.nombre_grupo}?</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setGrupoAEliminar(undefined)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button type="button" onClick={async () => { if (grupoAEliminar) await onEliminarGrupo(grupoAEliminar.id_grupo); setGrupoAEliminar(undefined); }} className="rounded-md bg-red-600 px-4 py-2 text-sm text-white">Eliminar</button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(grupoAFinalizar)} onClose={() => setGrupoAFinalizar(undefined)} title="Finalizar grupo">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-gray-600">
            ¿Deseas finalizar el grupo <strong className="text-gray-900">{grupoAFinalizar?.nombre_grupo}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Esta acción finalizará sus inscripciones activas y cancelará sus sesiones programadas.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGrupoAFinalizar(undefined)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarFinalizarGrupo}
              className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              Finalizar grupo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdministrarGruposModal;
