import { z } from "zod";

// El script admite 0, pero la academia no ofrece cursos ni matrículas gratuitas.
const precioSchema = z
  .number({ error: "Ingresa un monto" })
  .gt(0, "El valor debe ser mayor que 0")
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
