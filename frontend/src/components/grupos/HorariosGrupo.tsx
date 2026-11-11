import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { Grupo } from "../../types/grupo";
import type { Horario } from "../../types/horario";
import Modal from "../ui/Modal";
import HorarioForm from "./HorarioForm";
import {
  actualizarHorario,
  crearHorario,
  eliminarHorario,
  resumenCambio,
  resumenEliminacion,
} from "../../services/horarioService";
import { formatearDia, formatearHora } from "./formato";

interface HorariosGrupoProps {
  grupo: Grupo;
  horarios: Horario[];
  editable: boolean;
  /** Se llama después de cada cambio para recargar horarios y sesiones. */
  onCambio: () => void;
}

/** Horario semanal de un grupo. Editarlo o eliminarlo actualiza sus sesiones futuras. */
function HorariosGrupo({ grupo, horarios, editable, onCambio }: HorariosGrupoProps) {
  const [formulario, setFormulario] = useState<Horario | "nuevo" | null>(null);
  const [aEliminar, setAEliminar] = useState<Horario | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const enCurso = grupo.estado === "EN_CURSO";
  const puedeEditar = editable && enCurso;

  async function guardar(data: Omit<Horario, "id_horario" | "id_grupo">) {
    setError("");
    if (formulario === "nuevo") {
      await crearHorario(grupo.id_grupo, data);
      setAviso("Horario agregado. Usa Generar sesiones en el calendario para crear sus sesiones.");
    } else if (formulario) {
      const actualizado = await actualizarHorario(formulario.id_horario, data);
      setAviso(resumenCambio(actualizado.sesiones));
    }
    setFormulario(null);
    onCambio();
  }

  async function eliminar() {
    if (!aEliminar) return;
    try {
      const result = await eliminarHorario(aEliminar.id_horario);
      setAviso(resumenEliminacion(result.sesiones_canceladas));
      setAEliminar(null);
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el horario.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {puedeEditar
            ? "Al cambiar o eliminar un horario se actualizan sus sesiones futuras programadas."
            : enCurso
              ? "Solo la administración puede modificar los horarios."
              : "El grupo ya no está en curso: su horario es de solo lectura."}
        </p>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => setFormulario("nuevo")}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-900"
          >
            <Plus className="h-3.5 w-3.5 text-blue-200" /> Agregar horario
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {aviso && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">{aviso}</p>}

      <div className="space-y-2">
        {horarios.length === 0 && <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">No hay horarios registrados.</p>}
        {horarios.map((horario) => (
          <div key={horario.id_horario} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            <span>{formatearDia(horario.dia_semana)} · {formatearHora(horario.hora_inicio)} – {formatearHora(horario.hora_finalizacion)}</span>
            {puedeEditar && (
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => setFormulario(horario)} aria-label={`Editar horario del ${formatearDia(horario.dia_semana)}`} title="Editar horario" className="rounded p-1 text-yellow-600 hover:bg-yellow-50"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => setAEliminar(horario)} aria-label={`Eliminar horario del ${formatearDia(horario.dia_semana)}`} title="Eliminar horario" className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </span>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={Boolean(formulario)} onClose={() => setFormulario(null)} zIndex={70} title={formulario === "nuevo" ? "Agregar horario" : "Editar horario"}>
        <HorarioForm horario={formulario && formulario !== "nuevo" ? formulario : undefined} onSubmit={guardar} />
      </Modal>

      <Modal isOpen={Boolean(aEliminar)} onClose={() => setAEliminar(null)} zIndex={70} title="Eliminar horario">
        <p className="text-sm text-gray-600">
          ¿Eliminar el horario del {aEliminar && formatearDia(aEliminar.dia_semana).toLowerCase()}? Sus sesiones futuras programadas se cancelarán.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setAEliminar(null)} className="rounded-md border px-4 py-2 text-sm">Volver</button>
          <button type="button" onClick={eliminar} className="rounded-md bg-red-600 px-4 py-2 text-sm text-white">Eliminar horario</button>
        </div>
      </Modal>
    </div>
  );
}

export default HorariosGrupo;
