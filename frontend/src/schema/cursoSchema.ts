import { z } from "zod";

// CURSO: CHECK (precio_total >= 0) y CHECK (precio_matricula >= 0)
const precioSchema = z
  .number()
  .min(0, "El valor no puede ser negativo")
  .max(99999999.99, "El valor es demasiado alto");

export const cursoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del curso es obligatorio")
    .max(100, "El nombre no puede superar los 100 caracteres"),

  descripcion: z.string().max(500, "Máximo 500 caracteres").optional(),

  precio_total: precioSchema,
  precio_matricula: precioSchema,
});

export type CursoFormData = z.infer<typeof cursoSchema>;
