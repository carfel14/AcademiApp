// src/schema/profesorSchema.ts
import { z } from "zod";

export const profesorSchema = z.object({
  nombres: z
    .string()
    .trim()
    .min(1, "Los nombres son requeridos")
    .max(100, "Máximo 100 caracteres"),
  apellidos: z
    .string()
    .trim()
    .min(1, "Los apellidos son requeridos")
    .max(100, "Máximo 100 caracteres"),
  telefono: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .optional()
    .or(z.literal("")),
  // Nombres de ESPECIALIDAD separados por coma
  especialidades: z
    .string()
    .trim()
    .max(1000, "Demasiadas especialidades")
    .refine(
      (v) => v.split(",").every((e) => e.trim().length <= 100),
      "Cada especialidad admite hasta 100 caracteres",
    )
    .optional()
    .or(z.literal("")),
});

export type ProfesorFormData = z.infer<typeof profesorSchema>;