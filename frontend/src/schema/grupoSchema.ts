import { z } from "zod";

/** Fecha local YYYY-MM-DD desplazada `dias` días desde hoy. */
export function fechaLocal(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const duracionMesesSchema = z
  .number({
    error: "La duración debe ser un número",
  })
  .int("La duración debe ser un número entero")
  .min(1, "La duración debe ser mayor a 0")
  .max(255, "La duración máxima es de 255 meses");

export const crearGrupoSchema = z.object({
  // GRUPO.id_plan: el curso se obtiene a través del plan de estudio
  id_plan: z
    .number({ error: "Selecciona un plan de estudio" })
    .int()
    .min(1, "Selecciona un plan de estudio"),

  nombre: z
    .string()
    .min(1, "El nombre del grupo es obligatorio")
    .max(100, "El nombre no puede superar los 100 caracteres"),

  duracion_meses: duracionMesesSchema,

  fecha_inicio: z
    .string()
    .min(1, "La fecha de inicio es obligatoria")
    .refine((fecha) => fecha > fechaLocal(), "La fecha de inicio debe ser posterior a hoy"),
});

export const actualizarGrupoSchema = z.object({
  nombre: z
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
