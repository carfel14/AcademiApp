import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpen,
  DollarSign,
  FileText,
  Plus,
  Save,
  Wallet,
} from "lucide-react";

import {
  cursoSchema,
  type CursoFormData,
} from "../../schema/cursoSchema";

import type { Curso } from "../../types/curso";

interface CursoFormProps {
  curso?: Curso;
  onSubmit: (data: CursoFormData) => Promise<void>;
}

function CursoForm({ curso, onSubmit }: CursoFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CursoFormData>({
    resolver: zodResolver(cursoSchema),
    defaultValues: {
      nombre_curso: "",
      descripcion: "",
      precio: 0,
      precio_matricula: 0,
    },
  });

  useEffect(() => {
    reset({
      nombre_curso: curso?.nombre_curso ?? "",
      descripcion: curso?.descripcion ?? "",
      precio: curso?.precio ?? 0,
      precio_matricula: curso?.precio_matricula ?? 0,
    });
  }, [curso, reset]);

  async function handleFormSubmit(data: CursoFormData) {
    await onSubmit(data);

    if (!curso) {
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
          <BookOpen className="h-5 w-5 text-blue-200" />
          <div>
            <p className="text-base font-semibold text-white">
              Información del curso
            </p>
            <p className="mt-1 text-sm text-blue-200">
              Completa la información comercial del curso y su estructura de pago.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <BookOpen className="h-4 w-4 text-blue-700" />
            Nombre del curso
          </label>
          <input
            {...register("nombre_curso")}
            placeholder="Ej. Maquillaje profesional"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
          />
          {errors.nombre_curso && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {errors.nombre_curso.message}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <FileText className="h-4 w-4 text-blue-700" />
            Descripción
          </label>
          <textarea
            {...register("descripcion")}
            rows={3}
            placeholder="Describe brevemente lo que aprenderán los estudiantes"
            className="mt-2 w-full resize-none rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
          />
          {errors.descripcion && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {errors.descripcion.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Wallet className="h-4 w-4 text-blue-700" />
              Precio del curso
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                C$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("precio", { valueAsNumber: true })}
                className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>
            {errors.precio && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.precio.message}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <DollarSign className="h-4 w-4 text-blue-700" />
              Precio de matrícula
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                C$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("precio_matricula", { valueAsNumber: true })}
                className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>
            {errors.precio_matricula && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.precio_matricula.message}
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
              {curso ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {curso ? "Guardar cambios" : "Crear curso"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default CursoForm;