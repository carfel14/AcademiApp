// src/schema/estudianteSchema.ts
import { z } from "zod";

export const estudianteSchema = z.object({
  codigo: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .regex(/^\S*$/, "El código no puede tener espacios")
    .optional()
    .or(z.literal("")),
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
  canal_preferido: z.enum(["EMAIL", "WHATSAPP", "SMS"]),
});

export type EstudianteFormData = z.infer<typeof estudianteSchema>;