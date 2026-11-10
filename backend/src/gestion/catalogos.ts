import { BadRequestException } from '@nestjs/common';

type Field = {
  name: string;
  type: 'text' | 'number';
  max?: number;
  min?: number;
  options?: string[];
  optional?: boolean;
  integer?: boolean;
};
const text = (name: string, max: number, optional = false): Field => ({
  name,
  type: 'text',
  max,
  optional,
});
const select = (name: string, ...options: string[]): Field => ({
  name,
  type: 'text',
  options,
});
const integer = (name: string, min = 1, max = 2147483647): Field => ({
  name,
  type: 'number',
  min,
  max,
  integer: true,
});
const decimal = (name: string, max: number, optional = false): Field => ({
  name,
  type: 'number',
  min: 0.01,
  max,
  optional,
});
const estado = select('estado', 'ACTIVO', 'INACTIVO');

interface Catalogo {
  table: string;
  key: string;
  fields: Field[];
  parent?: string;
  sort?: string;
}
export const catalogos: Record<string, Catalogo> = {
  planes: {
    table: 'PLAN_ESTUDIO',
    key: 'id_plan',
    parent: 'id_curso',
    sort: 'version',
    fields: [
      integer('id_curso'),
      text('nombre', 150),
      text('descripcion', 500, true),
      integer('version', 1, 32767),
      estado,
    ],
  },
  unidades: {
    table: 'UNIDAD_ESTUDIO',
    key: 'id_unidad',
    parent: 'id_plan',
    sort: 'orden',
    fields: [
      integer('id_plan'),
      text('nombre', 150),
      text('descripcion', 500, true),
      integer('orden', 1, 32767),
    ],
  },
  temas: {
    table: 'TEMA_ESTUDIO',
    key: 'id_tema',
    parent: 'id_unidad',
    sort: 'orden',
    fields: [
      integer('id_unidad'),
      text('nombre', 150),
      text('descripcion', 500, true),
      integer('orden', 1, 32767),
      select('modalidad', 'TEORICO', 'PRACTICO', 'DEMOSTRACION'),
      decimal('horas_estimadas', 999.99, true),
    ],
  },
  descuentos: {
    table: 'DESCUENTO',
    key: 'id_descuento',
    fields: [
      text('nombre', 100),
      select('tipo', 'PORCENTAJE', 'MONTO_FIJO'),
      decimal('valor', 99999999.99),
      estado,
    ],
  },
  plantillas: {
    table: 'PLANTILLA_NOTIFICACION',
    key: 'id_plantilla',
    fields: [
      text('nombre', 100),
      select('canal', 'EMAIL', 'WHATSAPP', 'SMS'),
      text('asunto', 150, true),
      text('cuerpo', 5000),
      estado,
    ],
  },
  reglas: {
    table: 'REGLA_RECORDATORIO',
    key: 'id_regla',
    fields: [
      integer('id_plantilla'),
      integer('dias_respecto_vencimiento', -365, 365),
      estado,
    ],
  },
};

export function validar(field: Field, raw: unknown) {
  if ((raw === '' || raw == null) && field.optional) return null;
  if (field.type === 'text' && typeof raw === 'string') {
    const value = raw.trim();
    if (
      value &&
      (!field.max || value.length <= field.max) &&
      (!field.options || field.options.includes(value))
    )
      return value;
  }
  if (
    field.type === 'number' &&
    typeof raw === 'number' &&
    Number.isFinite(raw) &&
    raw >= field.min! &&
    raw <= field.max! &&
    (field.integer
      ? Number.isInteger(raw)
      : Math.abs(raw * 100 - Math.round(raw * 100)) < 0.00001)
  )
    return raw;
  throw new BadRequestException(
    `Revisa el campo ${field.name.replaceAll('_', ' ')}.`,
  );
}
