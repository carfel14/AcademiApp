import { z } from "zod";

const duracionMesesSchema = z
  .number({
    error: "La duración debe ser un número",
  })
  .int("La duración debe ser un número entero")
  .min(1, "La duración debe ser mayor a 0");

export const crearGrupoSchema = z.object({
  nombre_grupo: z
    .string()
    .min(1, "El nombre del grupo es obligatorio")
    .max(100, "El nombre no puede superar los 100 caracteres"),

  duracion_meses: duracionMesesSchema,

  fecha_inicio: z
    .string()
    .min(1, "La fecha de inicio es obligatoria"),
});

export const actualizarGrupoSchema = z.object({
  nombre_grupo: z
    .string()
    .min(1, "El nombre del grupo es obligatorio")
    .max(100, "El nombre no puede superar los 100 caracteres"),

  duracion_meses: duracionMesesSchema,
});

export function esCrearGrupoFormData(
  data: CrearGrupoFormData | ActualizarGrupoFormData
): data is CrearGrupoFormData {
  return "fecha_inicio" in data;
}

export type CrearGrupoFormData = z.infer<typeof crearGrupoSchema>;

export type ActualizarGrupoFormData = z.infer<
  typeof actualizarGrupoSchema
>;
