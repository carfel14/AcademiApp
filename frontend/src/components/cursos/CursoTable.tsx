import type { Curso } from "../../types/curso";
import type { Grupo } from "../../types/grupo";
import { useState } from "react";
import { Pencil, Trash2, Users } from "lucide-react";

interface CursoTableProps {
  cursos: Curso[];
  grupos: Grupo[];
  onEditar: (curso: Curso) => void;
  onEliminar: (id: number) => void;
  onAdministrarGrupos: (curso: Curso) => void;
}

function CursoTable({
  cursos,
  grupos,
  onEditar,
  onEliminar,
  onAdministrarGrupos,
}: CursoTableProps) {
  const [cursoAEliminar, setCursoAEliminar] = useState<Curso | null>(null);

  function confirmarEliminacion() {
    if (cursoAEliminar) {
      onEliminar(cursoAEliminar.id_curso);
      setCursoAEliminar(null);
    }
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cursos.map((curso) => (
          <div
            key={curso.id_curso}
            className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div className="border-b border-gray-100 bg-blue-950 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-semibold text-white">
                  {curso.nombre}
                </h2>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    curso.estado === "ACTIVO"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {curso.estado}
                </span>
              </div>
            </div>

            <div className="flex-1 px-6 py-5">
              <p className="min-h-[52px] text-sm leading-6 text-slate-600">
                {curso.descripcion || "Sin descripción disponible."}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <p className="text-sm font-semibold text-blue-700">
                    Precio del curso
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    C$ {curso.precio_total}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-700">
                    Precio de matrícula
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    C$ {curso.precio_matricula}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-500">
                  Grupos en curso
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {grupos.filter(
                    (grupo) =>
                      grupo.id_curso === curso.id_curso &&
                      grupo.estado === "EN_CURSO"
                  ).length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => onAdministrarGrupos(curso)}
                disabled={curso.estado === "INACTIVO"}
                className="min-w-0 flex-1 rounded-md bg-blue-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-950"
              >
                <Users className="mr-2 inline h-4 w-4 text-blue-200" /> Administrar grupos
              </button>

              <button
                type="button"
                onClick={() => onEditar(curso)}
                disabled={curso.estado === "INACTIVO"}
                aria-label={`Editar ${curso.nombre}`}
                title="Editar curso"
                className="rounded-md p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <Pencil aria-hidden="true" className="h-5 w-5 text-yellow-500" />
              </button>

              <button
                type="button"
                onClick={() => setCursoAEliminar(curso)}
                aria-label={`Desactivar ${curso.nombre}`}
                title="Desactivar curso"
                className="rounded-md p-2 text-red-600 transition hover:bg-red-50"
              >
                <Trash2 aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {cursoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Desactivar curso</h3>
            <p className="mt-2 text-sm text-gray-600">
              ¿Deseas desactivar{" "}
              <span className="font-medium">{cursoAEliminar.nombre}</span>
              ? El curso pasará a estado INACTIVO y dejará de mostrarse. Sus grupos en curso deben finalizarse o cancelarse antes.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCursoAEliminar(null)}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarEliminacion}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CursoTable;