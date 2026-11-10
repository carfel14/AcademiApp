// src/schema/estudianteSchema.ts
import { z } from "zod";

export const estudianteSchema = z.object({
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
  fecha_nacimiento: z
    .string()
    .optional()
    .or(z.literal("")),
  email: z.email("Ingresa un correo válido").max(150).optional().or(z.literal("")),
  telefono: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .optional()
    .or(z.literal("")),
});

export type EstudianteFormData = z.infer<typeof estudianteSchema>;