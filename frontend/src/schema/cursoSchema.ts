import { z } from "zod";

const precioSchema = z
  .number()
  .refine((val) => val > 0, {
    message: "El valor debe ser mayor a 0",
  });

export const cursoSchema = z.object({
  nombre_curso: z
    .string()
    .min(1, "El nombre del curso es obligatorio")
    .max(100, "El nombre no puede superar los 100 caracteres"),

  descripcion: z.string().optional(),

  precio: precioSchema,
  precio_matricula: precioSchema,
});

export type CursoFormData = z.infer<typeof cursoSchema>;