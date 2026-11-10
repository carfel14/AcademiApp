import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, Calendar, Plus, Save } from "lucide-react";
import { estudianteSchema, type EstudianteFormData } from "../../schema/estudianteSchema";
import type { Estudiante } from "../../types/estudiante";

interface EstudianteFormProps {
  estudiante?: Estudiante;
  onSubmit: (data: EstudianteFormData) => Promise<void>;
}

function EstudianteForm({ estudiante, onSubmit }: EstudianteFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EstudianteFormData>({
    resolver: zodResolver(estudianteSchema),
    defaultValues: {
      codigo: "",
      canal_preferido: "WHATSAPP",
      nombres: "",
      apellidos: "",
      fecha_nacimiento: "",
      telefono: "",
      email: "",
    },
  });

  useEffect(() => {
    reset({
      codigo: estudiante?.codigo ?? "",
      canal_preferido: estudiante?.canal_preferido ?? "WHATSAPP",
      nombres: estudiante?.nombres ?? "",
      apellidos: estudiante?.apellidos ?? "",
      fecha_nacimiento: estudiante?.fecha_nacimiento ?? "",
      telefono: estudiante?.telefono ?? "",
      email: estudiante?.email ?? "",
    });
  }, [estudiante, reset]);

  async function handleFormSubmit(data: EstudianteFormData) {
    await onSubmit(data);
    if (!estudiante) reset();
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm"
    >
      <div className="bg-blue-950 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-blue-200" />
          <div>
            <p className="text-base font-semibold text-white">Información del Estudiante</p>
            <p className="mt-1 text-sm text-blue-200">
              Registra los datos personales para la ficha del estudiante.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <User className="h-4 w-4 text-blue-800" /> Nombres
            </label>
            <input
              {...register("nombres")}
              placeholder="Ej. María Elena"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.nombres && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errors.nombres.message}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <User className="h-4 w-4 text-blue-800" /> Apellidos
            </label>
            <input
              {...register("apellidos")}
              placeholder="Ej. Ruiz Morales"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.apellidos && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errors.apellidos.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Calendar className="h-4 w-4 text-blue-800" /> Fecha de Nacimiento
            </label>
            <input
              type="date"
              {...register("fecha_nacimiento")}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.fecha_nacimiento && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errors.fecha_nacimiento.message}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Phone className="h-4 w-4 text-blue-800" /> Teléfono
            </label>
            <input
              {...register("telefono")}
              placeholder="Ej. +505 8888 8888"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.telefono && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errors.telefono.message}</p>
            )}
          </div>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          Correo electrónico
          <input type="email" {...register("email")} maxLength={150}
            className="w-full rounded-md border border-gray-300 px-3 py-2.5 font-normal" />
          {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Código
            <input {...register("codigo")} maxLength={20} placeholder="Automático (EST-000000)"
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 font-normal" />
            {errors.codigo && <span className="text-xs text-red-600">{errors.codigo.message}</span>}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Canal preferido para recordatorios
            <select {...register("canal_preferido")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 font-normal">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Correo electrónico</option>
              <option value="SMS">SMS</option>
            </select>
            {errors.canal_preferido && <span className="text-xs text-red-600">{errors.canal_preferido.message}</span>}
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-gray-100 bg-gray-50 px-6 py-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:opacity-60"
        >
          {isSubmitting ? (
            "Guardando..."
          ) : (
            <>
              {estudiante ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {estudiante ? "Guardar cambios" : "Registrar estudiante"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default EstudianteForm;