import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";

import type { AsignacionProfesor } from "../../types/asignacionProfesor";
import type { Grupo } from "../../types/grupo";
import type { Profesor } from "../../types/profesor";
import { crearAsignacion, eliminarAsignacion } from "../../services/asignacionProfesorService";
import { formatearFecha } from "./formato";

interface ProfesoresGrupoProps {
  grupo: Grupo;
  asignaciones: AsignacionProfesor[];
  profesores: Profesor[];
  editable: boolean;
  onCambio: () => void;
}

/** ASIGNACION_PROFESOR del grupo: quién da clases y desde cuándo. */
function ProfesoresGrupo({ grupo, asignaciones, profesores, editable, onCambio }: ProfesoresGrupoProps) {
  const [seleccion, setSeleccion] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const delGrupo = asignaciones.filter((a) => a.id_grupo === grupo.id_grupo);
  const asignados = new Set(delGrupo.map((a) => a.id_profesor));
  const disponibles = profesores.filter((p) => p.estado === "ACTIVO" && !asignados.has(p.id_profesor));
  const puedeEditar = editable && grupo.estado === "EN_CURSO";

  async function ejecutar(trabajo: () => Promise<unknown>) {
    setError("");
    setOcupado(true);
    try {
      await trabajo();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      {delGrupo.length === 0 && <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">Este grupo todavía no tiene profesores asignados.</p>}
      <ul className="space-y-2">
        {delGrupo.map((a) => {
          const profesor = profesores.find((p) => p.id_profesor === a.id_profesor);
          return (
            <li key={a.id_asignacion} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-gray-900">{a.profesor ?? `${profesor?.nombres ?? ""} ${profesor?.apellidos ?? ""}`}</span>
                {profesor?.especialidades.length ? <span className="block text-xs text-gray-500">{profesor.especialidades.map((e) => e.nombre).join(", ")}</span> : null}
                {a.fecha_asignacion && <span className="block text-xs text-gray-400">Asignado el {formatearFecha(a.fecha_asignacion)}</span>}
              </span>
              {puedeEditar && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void ejecutar(() => eliminarAsignacion(a.id_asignacion))}
                  aria-label={`Quitar a ${a.profesor ?? "este profesor"} del grupo`}
                  title="Quitar del grupo"
                  className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {puedeEditar && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!seleccion) return setError("Selecciona un profesor.");
            void ejecutar(async () => {
              await crearAsignacion({ id_profesor: Number(seleccion), id_grupo: grupo.id_grupo });
              setSeleccion("");
            });
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Profesor a asignar</span>
            <select
              value={seleccion}
              onChange={(e) => setSeleccion(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{disponibles.length ? "Selecciona un profesor" : "No hay profesores disponibles"}</option>
              {disponibles.map((p) => (
                <option key={p.id_profesor} value={p.id_profesor}>
                  {p.nombres} {p.apellidos}{p.especialidades.length ? ` · ${p.especialidades.map((e) => e.nombre).join(", ")}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={ocupado || !disponibles.length}
            className="flex items-center justify-center gap-1.5 rounded-md bg-blue-950 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4 text-blue-200" /> Asignar
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export default ProfesoresGrupo;
