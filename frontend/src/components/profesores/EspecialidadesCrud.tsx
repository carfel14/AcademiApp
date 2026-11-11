import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import type { Especialidad } from "../../types/profesor";
import { crearEspecialidad, eliminarEspecialidad, renombrarEspecialidad } from "../../services/profesorService";

interface EspecialidadesCrudProps {
  especialidades: (Especialidad & { profesores: number })[];
  /** Recarga el catálogo y los profesores después de cada cambio. */
  onCambio: () => Promise<void>;
}

/** Catálogo ESPECIALIDAD: crear, renombrar y eliminar (si nadie la usa). */
function EspecialidadesCrud({ especialidades, onCambio }: EspecialidadesCrudProps) {
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(trabajo: () => Promise<unknown>) {
    setError("");
    setOcupado(true);
    try {
      await trabajo();
      await onCambio();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const nombre = nueva.trim();
          if (!nombre) return setError("Escribe el nombre de la especialidad.");
          if (await ejecutar(() => crearEspecialidad(nombre))) setNueva("");
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Nueva especialidad</span>
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            maxLength={100}
            placeholder="Nueva especialidad. Ej. Barbería"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
          />
        </label>
        <button type="submit" disabled={ocupado} className="flex items-center gap-1.5 rounded-md bg-blue-950 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50">
          <Plus className="h-4 w-4 text-blue-200" aria-hidden="true" /> Agregar
        </button>
      </form>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {especialidades.length === 0 ? (
        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">Todavía no hay especialidades.</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
          {especialidades.map((e) => (
            <li key={e.id_especialidad} className="flex items-center gap-2 px-3 py-2 text-sm">
              {editando?.id === e.id_especialidad ? (
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    const nombre = editando.nombre.trim();
                    if (!nombre) return setError("El nombre no puede quedar vacío.");
                    if (await ejecutar(() => renombrarEspecialidad(e.id_especialidad, nombre))) setEditando(null);
                  }}
                >
                  <label className="flex-1">
                    <span className="sr-only">Nombre de la especialidad</span>
                    <input autoFocus value={editando.nombre} maxLength={100}
                      onChange={(ev) => setEditando({ id: e.id_especialidad, nombre: ev.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                  </label>
                  <button type="submit" disabled={ocupado} aria-label="Guardar nombre" className="rounded p-1 text-green-700 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setEditando(null)} aria-label="Cancelar edición" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                </form>
              ) : (
                <>
                  <span className="flex-1">
                    <span className="font-medium text-gray-900">{e.nombre}</span>
                    <span className="ml-2 text-xs text-gray-500">{e.profesores} {e.profesores === 1 ? "profesor" : "profesores"}</span>
                  </span>
                  <button type="button" onClick={() => { setError(""); setEditando({ id: e.id_especialidad, nombre: e.nombre }); }}
                    aria-label={`Renombrar ${e.nombre}`} title="Renombrar" className="rounded p-1 text-yellow-600 hover:bg-yellow-50">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={ocupado || e.profesores > 0}
                    onClick={() => void ejecutar(() => eliminarEspecialidad(e.id_especialidad))}
                    aria-label={`Eliminar ${e.nombre}`}
                    title={e.profesores > 0 ? "No se puede eliminar: hay profesores con esta especialidad" : "Eliminar"}
                    className="rounded p-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default EspecialidadesCrud;
