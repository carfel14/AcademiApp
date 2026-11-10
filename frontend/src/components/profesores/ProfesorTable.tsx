import { useState } from "react";
import { Pencil, Trash2, Phone, UserCheck, GraduationCap, AlertCircle } from "lucide-react";
import type { Profesor } from "../../types/profesor";
import type { AsignacionProfesor } from "../../types/asignacionProfesor";

interface ProfesorTableProps {
  profesores: Profesor[];
  asignaciones: AsignacionProfesor[];
  onEditar: (profesor: Profesor) => void;
  onEliminar: (id: number) => void;
  onAdministrarAsignaciones: (profesor: Profesor) => void;
}

function ProfesorTable({
  profesores,
  asignaciones,
  onEditar,
  onEliminar,
  onAdministrarAsignaciones,
}: ProfesorTableProps) {
  const [profesorAEliminar, setProfesorAEliminar] = useState<Profesor | null>(null);

  function confirmarEliminacion() {
    if (profesorAEliminar) {
      onEliminar(profesorAEliminar.id_profesor);
      setProfesorAEliminar(null);
    }
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="border-b border-gray-200 bg-blue-950 text-xs uppercase text-white font-semibold tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4">Docente</th>
                <th scope="col" className="px-6 py-4">Especialidad</th>
                <th scope="col" className="px-6 py-4">Teléfono</th>
                <th scope="col" className="px-6 py-4 text-center">Grupos Asignados</th>
                <th scope="col" className="px-6 py-4 text-center">Estado</th>
                <th scope="col" className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profesores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                    No se encontraron profesores registrados.
                  </td>
                </tr>
              ) : (
                profesores.map((profesor) => {
                  const totalAsignaciones = asignaciones.filter(
                    (a) => a.id_profesor === profesor.id_profesor
                  ).length;
                  const tieneAsignaciones = totalAsignaciones > 0;

                  return (
                    <tr
                      key={profesor.id_profesor}
                      className="transition hover:bg-slate-50/80"
                    >
                      {/* Docente */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-900 font-bold text-sm">
                            {profesor.nombres.charAt(0)}
                            {profesor.apellidos.charAt(0)}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {profesor.nombres} {profesor.apellidos}
                          </span>
                        </div>
                      </td>

                      {/* Especialidad */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <GraduationCap className="h-4 w-4 text-blue-800" />
                          <span>{profesor.especialidades.map((e) => e.nombre).join(", ") || "Sin definir"}</span>
                        </div>
                      </td>

                      {/* Teléfono */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="h-4 w-4 text-blue-800" />
                          <span>{profesor.telefono || "N/D"}</span>
                        </div>
                      </td>

                      {/* Grupos Asignados */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            tieneAsignaciones
                              ? "bg-blue-50 text-blue-900 border border-blue-200"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {totalAsignaciones} {totalAsignaciones === 1 ? "grupo" : "grupos"}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            profesor.estado.toUpperCase() === "ACTIVO"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {profesor.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botón de Asignaciones */}
                          <button
                            type="button"
                            onClick={() => onAdministrarAsignaciones(profesor)}
                            aria-label={`Administrar asignaciones de ${profesor.nombres}`}
                            title="Administrar asignaciones"
                            className="rounded-md p-1.5 text-blue-800 hover:bg-blue-50 transition"
                          >
                            <UserCheck className="h-5 w-5" />
                          </button>

                          {/* Botón de Editar */}
                          <button
                            type="button"
                            onClick={() => onEditar(profesor)}
                            aria-label={`Editar ${profesor.nombres}`}
                            title="Editar profesor"
                            className="rounded-md p-1.5 text-yellow-600 hover:bg-yellow-50 transition"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>

                          {/* Botón de Eliminar */}
                          <button
                            type="button"
                            onClick={() => setProfesorAEliminar(profesor)}
                            disabled={tieneAsignaciones}
                            aria-label={`Eliminar ${profesor.nombres}`}
                            title={
                              tieneAsignaciones
                                ? "No puedes eliminar un profesor con grupos asignados"
                                : "Eliminar profesor"
                            }
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent transition"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      {profesorAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900">Eliminar profesor</h3>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              ¿Estás seguro de que deseas desactivar al profesor{" "}
              <span className="font-semibold text-gray-900">
                {profesorAEliminar.nombres} {profesorAEliminar.apellidos}
              </span>
              ? Esta acción cambiará su estado a inactivo.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProfesorAEliminar(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarEliminacion}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ProfesorTable;