import { useState } from "react";
import { Pencil, Trash2, Eye, Phone, Calendar, AlertCircle } from "lucide-react";
import type { Estudiante } from "../../types/estudiante";

interface EstudianteTableProps {
  estudiantes: Estudiante[];
  onVerDetalle: (estudiante: Estudiante) => void;
  onEditar: (estudiante: Estudiante) => void;
  onDesactivar: (id: number) => void;
}

function EstudianteTable({
  estudiantes,
  onVerDetalle,
  onEditar,
  onDesactivar,
}: EstudianteTableProps) {
  const [estudianteAEliminar, setEstudianteAEliminar] = useState<Estudiante | null>(null);

  function confirmarDesactivacion() {
    if (estudianteAEliminar) {
      onDesactivar(estudianteAEliminar.id_estudiante);
      setEstudianteAEliminar(null);
    }
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="border-b border-gray-200 bg-blue-950 text-xs uppercase text-white font-semibold tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4">Estudiante</th>
                <th scope="col" className="px-6 py-4">Teléfono</th>
                <th scope="col" className="px-6 py-4">Fecha de Registro</th>
                <th scope="col" className="px-6 py-4 text-center">Estado</th>
                <th scope="col" className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estudiantes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    No se encontraron estudiantes registrados.
                  </td>
                </tr>
              ) : (
                estudiantes.map((estudiante) => (
                  <tr key={estudiante.id_estudiante} className="transition hover:bg-slate-50/80">
                    {/* Estudiante & Código */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-900 font-bold text-xs">
                          {estudiante.nombres.charAt(0)}
                          {estudiante.apellidos.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {estudiante.nombres} {estudiante.apellidos}
                          </div>
                          <div className="text-xs text-blue-900/70 font-mono">
                            {estudiante.codigo}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Teléfono */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Phone className="h-4 w-4 text-blue-800" />
                        <span>{estudiante.telefono || "N/D"}</span>
                      </div>
                    </td>

                    {/* Fecha de Registro */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>{estudiante.fecha_registro}</span>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          estudiante.estado === "ACTIVO"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {estudiante.estado}
                      </span>
                    </td>

                    {/* Acciones Homogéneas */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Ver Expediente */}
                        <button
                          type="button"
                          onClick={() => onVerDetalle(estudiante)}
                          title="Ver expediente académico"
                          className="rounded-md p-1.5 text-blue-900 hover:bg-blue-50 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => onEditar(estudiante)}
                          title="Editar estudiante"
                          className="rounded-md p-1.5 text-yellow-600 hover:bg-yellow-50 transition"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {/* Desactivar */}
                        <button
                          type="button"
                          onClick={() => setEstudianteAEliminar(estudiante)}
                          title="Desactivar estudiante"
                          className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmación Desactivar */}
      {estudianteAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900">Desactivar estudiante</h3>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              ¿Estás seguro de que deseas desactivar a{" "}
              <span className="font-semibold text-gray-900">
                {estudianteAEliminar.nombres} {estudianteAEliminar.apellidos}
              </span>
              ?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEstudianteAEliminar(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarDesactivacion}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
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

export default EstudianteTable;