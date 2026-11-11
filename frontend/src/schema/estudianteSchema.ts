// src/schema/estudianteSchema.ts
import { z } from "zod";
import { hoy, nombrePersona, telefono } from "./validaciones";

export const estudianteSchema = z.object({
  codigo: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .regex(/^\S*$/, "El código no puede tener espacios")
    .optional()
    .or(z.literal("")),
  nombres: nombrePersona("Los nombres"),
  apellidos: nombrePersona("Los apellidos"),
  fecha_nacimiento: z
    .string()
    .refine((fecha) => !fecha || fecha <= hoy(), "La fecha de nacimiento no puede ser posterior a hoy")
    .optional()
    .or(z.literal("")),
  email: z.email("Ingresa un correo válido").max(150).optional().or(z.literal("")),
  telefono,
  canal_preferido: z.enum(["EMAIL", "WHATSAPP", "SMS"]),
});

export type EstudianteFormData = z.infer<typeof estudianteSchema>;
