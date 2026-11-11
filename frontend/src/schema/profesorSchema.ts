// src/schema/profesorSchema.ts
import { z } from "zod";
import { nombrePersona, telefono } from "./validaciones";

export const profesorSchema = z.object({
  nombres: nombrePersona("Los nombres"),
  apellidos: nombrePersona("Los apellidos"),
  telefono,
  // id_especialidad elegidos del catálogo ESPECIALIDAD
  especialidades: z.array(z.number().int().positive()).max(20, "Demasiadas especialidades"),
});

export type ProfesorFormData = z.infer<typeof profesorSchema>;
