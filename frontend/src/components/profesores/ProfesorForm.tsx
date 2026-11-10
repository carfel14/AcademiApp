// src/components/profesores/ProfesorForm.tsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, GraduationCap, Plus, Save } from "lucide-react";

import { profesorSchema, type ProfesorFormData } from "../../schema/profesorSchema";
import type { Profesor } from "../../types/profesor";

interface ProfesorFormProps {
  profesor?: Profesor;
  onSubmit: (data: ProfesorFormData) => Promise<void>;
}

function ProfesorForm({ profesor, onSubmit }: ProfesorFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfesorFormData>({
    resolver: zodResolver(profesorSchema),
    defaultValues: {
      nombres: "",
      apellidos: "",
      telefono: "",
      especialidad: "",
    },
  });

  useEffect(() => {
    reset({
      nombres: profesor?.nombres ?? "",
      apellidos: profesor?.apellidos ?? "",
      telefono: profesor?.telefono ?? "",
      especialidad: profesor?.especialidad ?? "",
    });
  }, [profesor, reset]);

  async function handleFormSubmit(data: ProfesorFormData) {
    await onSubmit(data);
    if (!profesor) {
      reset();
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm"
    >
      <div className="bg-blue-950 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-blue-200" />
          <div>
            <p className="text-base font-semibold text-white">
              Información del docente
            </p>
            <p className="mt-1 text-sm text-blue-200">
              Registra los datos personales y área de especialidad del profesor.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <User className="h-4 w-4 text-blue-700" />
              Nombres
            </label>
            <input
              {...register("nombres")}
              placeholder="Ej. Juan Carlos"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.nombres && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.nombres.message}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <User className="h-4 w-4 text-blue-700" />
              Apellidos
            </label>
            <input
              {...register("apellidos")}
              placeholder="Ej. Pérez Silva"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.apellidos && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.apellidos.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Phone className="h-4 w-4 text-blue-700" />
              Teléfono
            </label>
            <input
              {...register("telefono")}
              placeholder="Ej. +505 8888 8888"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.telefono && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.telefono.message}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <GraduationCap className="h-4 w-4 text-blue-700" />
              Especialidad
            </label>
            <input
              {...register("especialidad")}
              placeholder="Ej. Colorimetría / Corte"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.especialidad && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.especialidad.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-gray-100 bg-gray-50 px-6 py-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            "Guardando..."
          ) : (
            <>
              {profesor ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {profesor ? "Guardar cambios" : "Registrar profesor"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default ProfesorForm;