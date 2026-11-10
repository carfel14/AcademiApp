import { useState } from "react";
import {
  Eye,
  XCircle,
  User,
  BookOpen,
  Calendar,
  Layers,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { Inscripcion } from "../../types/inscripcion";

interface InscripcionCardListProps {
  inscripciones: Inscripcion[];
  onVerDetalle: (inscripcion: Inscripcion) => void;
  onCancelar: (id: number) => void;
}

function InscripcionCardList({
  inscripciones,
  onVerDetalle,
  onCancelar,
}: InscripcionCardListProps) {
  const [inscripcionACancelar, setInscripcionACancelar] = useState<Inscripcion | null>(null);

  function confirmarCancelacion() {
    if (inscripcionACancelar) {
      onCancelar(inscripcionACancelar.id_inscripcion);
      setInscripcionACancelar(null);
    }
  }

  if (inscripciones.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-900">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-gray-900">No hay inscripciones registradas</h3>
        <p className="mt-1 text-sm text-gray-500">
          No se encontraron registros que coincidan con la búsqueda o filtro aplicado.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 space-y-3">
        {inscripciones.map((item) => {
          const esActiva = item.estado === "ACTIVA";

          return (
            <div
              key={item.id_inscripcion}
              className="group flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:border-blue-200 hover:shadow-md hover:bg-slate-50/40"
            >
              {/* Bloque 1: Estudiante */}
              <div className="flex items-center gap-3.5 min-w-[240px]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-950 font-bold text-xs">
                  <User className="h-5 w-5 text-blue-900" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Estudiante</p>
                  <p className="font-bold text-gray-900 text-sm">
                    {item.nombres} {item.apellidos}
                  </p>
                </div>
              </div>

              {/* Bloque 2: Grupo y Curso */}
              <div className="flex-1 min-w-[240px]">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Grupo & Curso</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 font-semibold text-sm text-gray-900">
                    <Layers className="h-4 w-4 text-blue-800" />
                    {item.grupo}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                    <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                    {item.curso}
                  </span>
                </div>
              </div>

              {/* Bloque 3: Fecha & Estado */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-left lg:text-right">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Fecha</p>
                  <p className="flex items-center lg:justify-end gap-1 text-xs font-medium text-gray-700 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {String(item.fecha_inscripcion).substring(0, 10)}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    item.estado === "ACTIVA"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : item.estado === "FINALIZADA"
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.estado === "ACTIVA"
                        ? "bg-emerald-500"
                        : item.estado === "FINALIZADA"
                        ? "bg-blue-500"
                        : "bg-rose-500"
                    }`}
                  />
                  {item.estado}
                </span>
              </div>

              {/* Bloque 4: Acciones */}
              <div className="flex items-center justify-end gap-1 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-100">
                <button
                  type="button"
                  onClick={() => onVerDetalle(item)}
                  title="Ver detalle de la inscripción"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-blue-950 shadow-2xs transition hover:bg-blue-50 hover:border-blue-200 focus:outline-none"
                >
                  <Eye className="h-4 w-4" />
                </button>

                {esActiva && (
                  <button
                    type="button"
                    onClick={() => setInscripcionACancelar(item)}
                    title="Cancelar inscripción"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-rose-600 shadow-2xs transition hover:bg-rose-50 hover:border-rose-200 focus:outline-none"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Confirmar Cancelación */}
      {inscripcionACancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Cancelar Inscripción</h3>
            </div>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              ¿Estás seguro de cancelar la inscripción de{" "}
              <span className="font-semibold text-gray-900">
                {inscripcionACancelar.nombres} {inscripcionACancelar.apellidos}
              </span>{" "}
              en el grupo <span className="font-semibold text-gray-900">{inscripcionACancelar.grupo}</span>?
            </p>
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Nota: Solo se puede cancelar si no existen mensualidades pagadas. Se anularán las cuotas pendientes.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setInscripcionACancelar(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={confirmarCancelacion}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 shadow-sm transition"
              >
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InscripcionCardList;