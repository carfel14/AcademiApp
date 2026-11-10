import { Link } from "react-router-dom";
import { EditForm } from "../../pages/gestion/ui";
import { User, BookOpen, Layers, Calendar, FileText } from "lucide-react";
import type { Inscripcion } from "../../types/inscripcion";

interface DetalleInscripcionModalProps {
  inscripcion: Inscripcion;
  onClose: () => void;
  onSave: (observacion: string | null) => Promise<void>;
}

function DetalleInscripcionModal({ inscripcion, onClose, onSave }: DetalleInscripcionModalProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-50 p-4 border border-gray-200 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-900" />
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Estudiante</p>
              <p className="text-sm font-bold text-gray-900">
                {inscripcion.nombres} {inscripcion.apellidos}
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              inscripcion.estado === "ACTIVA"
                ? "bg-emerald-100 text-emerald-800"
                : inscripcion.estado === "FINALIZADA"
                ? "bg-blue-100 text-blue-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            {inscripcion.estado}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-500 font-medium">Curso:</p>
            <p className="font-semibold text-gray-800 text-sm mt-0.5 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-blue-800" />
              {inscripcion.curso}
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Grupo asignado:</p>
            <p className="font-semibold text-gray-800 text-sm mt-0.5 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-blue-800" />
              {inscripcion.grupo}
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Fecha de inscripción:</p>
            <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              {String(inscripcion.fecha_inscripcion).substring(0, 10)}
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium">ID de Inscripción:</p>
            <p className="font-mono font-semibold text-gray-800 mt-0.5">
              #{inscripcion.id_inscripcion}
            </p>
          </div>
        </div>

        {inscripcion.observacion && (
          <div className="border-t border-gray-200 pt-2.5">
            <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Observaciones:
            </p>
            <p className="text-xs text-gray-700 mt-1 italic">{inscripcion.observacion}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-blue-950 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-900 transition"
        >
          Cerrar
        </button>
      </div>
      {inscripcion.estado === "ACTIVA" && <EditForm
        key={inscripcion.id_inscripcion}
        fields={[{ name: "observacion", label: "Editar observación", type: "textarea", required: false }]}
        initial={{ observacion: inscripcion.observacion ?? null }}
        onSave={data => onSave(data.observacion === null ? null : String(data.observacion))}
      />}
      <Link className="work-link" to={`/cobros?inscripcion=${inscripcion.id_inscripcion}`}>Ver obligaciones de pago</Link>
    </div>
  );
}

export default DetalleInscripcionModal;