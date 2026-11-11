/**
 * Datos de demostración para AcademiaBellezaSilvia.
 *
 *   npm run db:demo   -> recrea la base desde database/AcademiaBellezaSilvia.sql
 *                        y carga los datos (borra lo que haya).
 *   npm run db:seed   -> carga los datos en una base recién creada y vacía.
 *
 * Todos los datos son ficticios. Las fechas se calculan a partir de hoy, así que
 * la demostración siempre muestra grupos en curso, cobros por vencer, mora,
 * recordatorios y un grupo ya finalizado con certificados.
 *
 * Cuentas de demostración (contraseña para todas: Demo-Silvia-2026):
 *   admin           ADMINISTRADOR
 *   caja.lorena     CAJERO
 *   recepcion.ana   RECEPCION
 *   prof.karla      DOCENTE (Karla Mendoza)
 *   prof.mariajose  DOCENTE (María José Ortega)
 */
import { randomBytes, scrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as sql from 'mssql';
import { abrirPool, type ConfigConexion } from '../database/conexion';

const CONTRASENA_DEMO = 'Demo-Silvia-2026';
const RAIZ = join(__dirname, '..', '..', '..');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Generador pseudoaleatorio con semilla fija: los datos son reproducibles. */
function generador(semilla: number) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    entero: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    elegir: <T>(lista: readonly T[]) => lista[Math.floor(r() * lista.length)],
    prob: (p: number) => r() < p,
  };
}
const azar = generador(20261113);

const dos = (n: number) => String(n).padStart(2, '0');
const aFecha = (d: Date) =>
  `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
const deFecha = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const sumarDias = (s: string, n: number) => {
  const d = deFecha(s);
  d.setUTCDate(d.getUTCDate() + n);
  return aFecha(d);
};
/** Igual que la app: conserva el día y, si no existe, usa el último del mes. */
const sumarMeses = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return aFecha(base);
};
const diaSemana = (s: string) => deFecha(s).getUTCDay(); // 0 = domingo
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
/** Fecha del día de la semana indicado, en o antes (-1) / en o después (+1). */
const alinear = (s: string, dia: number, sentido: 1 | -1) => {
  let f = s;
  while (diaSemana(f) !== dia) f = sumarDias(f, sentido);
  return f;
};
const momento = (fecha: string, hora: string) => `${fecha}T${hora.length === 5 ? `${hora}:00` : hora}`;
const horaAzar = (desde: number, hasta: number) =>
  `${dos(azar.entero(desde, hasta - 1))}:${dos(azar.entero(0, 59))}:${dos(azar.entero(0, 59))}`;
const redondear = (n: number) => Math.round(n * 100) / 100;
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const HOY = hoyLocal();

// ---------------------------------------------------------------------------
// Catálogo ficticio
// ---------------------------------------------------------------------------

type Tema = [nombre: string, modalidad: 'TEORICO' | 'PRACTICO' | 'DEMOSTRACION', horas: number];
interface CursoDemo {
  clave: string;
  nombre: string;
  descripcion: string;
  precio_total: number;
  precio_matricula: number;
  unidades: [string, string, Tema[]][];
}

const CURSOS: CursoDemo[] = [
  {
    clave: 'color',
    nombre: 'Estilismo y colorimetría',
    descripcion:
      'Diagnóstico capilar, cortes base y aplicación segura de tintes, mechas y matizadores.',
    precio_total: 4800,
    precio_matricula: 600,
    unidades: [
      ['Fundamentos del cabello', 'Anatomía del cabello, diagnóstico y bioseguridad.', [
        ['Estructura y diagnóstico capilar', 'TEORICO', 2],
        ['Higiene, bioseguridad y atención al cliente', 'TEORICO', 2],
      ]],
      ['Teoría del color', 'Niveles, reflejos y química de la coloración.', [
        ['Círculo cromático y niveles de tono', 'TEORICO', 2],
        ['Neutralización y matizado', 'DEMOSTRACION', 2],
        ['Preparación y mezcla de tintes', 'PRACTICO', 3],
      ]],
      ['Técnicas de coloración', 'Aplicación en modelo y acabado.', [
        ['Retoque de raíz y tinte global', 'PRACTICO', 3],
        ['Mechas con gorro y papel aluminio', 'PRACTICO', 3],
        ['Balayage y degradados', 'PRACTICO', 4],
      ]],
    ],
  },
  {
    clave: 'unas',
    nombre: 'Manicure y uñas acrílicas',
    descripcion:
      'Manicure y pedicure spa, esmaltado semipermanente y extensiones en acrílico y gel.',
    precio_total: 2800,
    precio_matricula: 450,
    unidades: [
      ['Cuidado de manos y pies', 'Higiene, anatomía de la uña y servicios spa.', [
        ['Anatomía de la uña y afecciones comunes', 'TEORICO', 2],
        ['Manicure tradicional y spa', 'PRACTICO', 2],
        ['Pedicure spa', 'PRACTICO', 2],
      ]],
      ['Esmaltado', 'Técnicas de esmaltado y curado.', [
        ['Esmaltado tradicional y francés', 'PRACTICO', 2],
        ['Semipermanente y curado en lámpara', 'DEMOSTRACION', 2],
      ]],
      ['Uñas artificiales', 'Extensiones, mantenimiento y decoración.', [
        ['Tips y moldes', 'PRACTICO', 3],
        ['Esculpido en acrílico', 'PRACTICO', 3],
        ['Mantenimiento y retiro seguro', 'PRACTICO', 2],
        ['Decoración y nail art', 'PRACTICO', 2],
      ]],
    ],
  },
  {
    clave: 'maquillaje',
    nombre: 'Maquillaje profesional',
    descripcion:
      'Preparación de la piel, visagismo y maquillaje social, de novia y para fotografía.',
    precio_total: 3600,
    precio_matricula: 500,
    unidades: [
      ['Bases del maquillaje', 'Piel, visagismo e higiene del kit.', [
        ['Tipos de piel y preparación', 'TEORICO', 2],
        ['Visagismo y correcciones', 'TEORICO', 2],
        ['Higiene de brochas y productos', 'DEMOSTRACION', 1],
      ]],
      ['Maquillaje social', 'Looks de día y de noche.', [
        ['Maquillaje de día', 'PRACTICO', 3],
        ['Maquillaje de noche y ahumados', 'PRACTICO', 3],
      ]],
      ['Especialidades', 'Novias, fotografía y portafolio.', [
        ['Maquillaje de novia', 'PRACTICO', 3],
        ['Maquillaje para fotografía y video', 'DEMOSTRACION', 2],
        ['Portafolio final', 'PRACTICO', 3],
      ]],
    ],
  },
  {
    clave: 'cejas',
    nombre: 'Diseño de cejas y pestañas',
    descripcion:
      'Visagismo de cejas, depilación con hilo y cera, laminado, lifting y extensiones pelo a pelo.',
    precio_total: 2400,
    precio_matricula: 400,
    unidades: [
      ['Diseño de cejas', 'Medición, depilación y color.', [
        ['Visagismo y medición de cejas', 'TEORICO', 2],
        ['Depilación con hilo y cera', 'PRACTICO', 2],
        ['Tinte y henna', 'PRACTICO', 2],
      ]],
      ['Pestañas', 'Lifting y extensiones.', [
        ['Lifting de pestañas', 'DEMOSTRACION', 2],
        ['Extensiones pelo a pelo', 'PRACTICO', 3],
      ]],
      ['Laminado', 'Laminado y cuidados posteriores.', [
        ['Laminado de cejas', 'PRACTICO', 2],
      ]],
    ],
  },
];

const PROFESORES = [
  { clave: 'karla', nombres: 'Karla Vanessa', apellidos: 'Mendoza Ruiz', telefono: '8854-2176', especialidades: ['Colorimetría', 'Corte de cabello'] },
  { clave: 'jose', nombres: 'José Antonio', apellidos: 'Jarquín López', telefono: '8471-3390', especialidades: ['Colorimetría', 'Barbería'] },
  { clave: 'mariajose', nombres: 'María José', apellidos: 'Ortega Blandón', telefono: '7712-0485', especialidades: ['Manicure y pedicure', 'Uñas acrílicas'] },
  { clave: 'ingrid', nombres: 'Ingrid Sofía', apellidos: 'Castillo Pérez', telefono: '8630-9152', especialidades: ['Maquillaje profesional'] },
  { clave: 'daniela', nombres: 'Daniela Alejandra', apellidos: 'Rivas Obando', telefono: '5788-2643', especialidades: ['Diseño de cejas', 'Pestañas'] },
];

type Perfil = 'puntual' | 'tardio' | 'prorroga' | 'moroso' | 'becado' | 'contado' | 'referido' | 'retiro';
interface GrupoDemo {
  clave: string;
  curso: string;
  nombre: string;
  inicio: string;
  meses: number;
  horarios: [dia: number, inicio: string, fin: string][];
  profesores: string[];
  docenteUsuario?: string;
  finalizado?: boolean;
  alumnas: [nombres: string, apellidos: string, perfil: Perfil][];
}

const GRUPOS: GrupoDemo[] = [
  {
    clave: 'G4',
    curso: 'cejas',
    nombre: 'Cejas y pestañas · Viernes 9:00 a. m.',
    inicio: alinear(sumarDias(HOY, -105), 5, -1),
    meses: 2,
    horarios: [[5, '09:00', '11:30']],
    profesores: ['daniela'],
    finalizado: true,
    alumnas: [
      ['Gabriela Sofía', 'Reyes Molina', 'puntual'],
      ['Massiel Andrea', 'Chamorro Báez', 'puntual'],
      ['Kenia Patricia', 'Mejía Amador', 'tardio'],
      ['Ruth Noemí', 'Ortiz Flores', 'contado'],
      ['Cinthya Mariela', 'Guevara Rizo', 'puntual'],
      ['Ileana Beatriz', 'Somarriba Pineda', 'moroso'],
    ],
  },
  {
    clave: 'G1',
    curso: 'color',
    nombre: 'Colorimetría · Sábados 8:00 a. m.',
    inicio: alinear(sumarDias(HOY, -42), 6, -1),
    meses: 4,
    horarios: [[6, '08:00', '11:30']],
    profesores: ['karla', 'jose'],
    docenteUsuario: 'prof.karla',
    alumnas: [
      ['Ana Lucía', 'Martínez Gutiérrez', 'puntual'],
      ['Fernanda Isabel', 'López Castro', 'becado'],
      ['Yahoska Marina', 'Pérez Aráuz', 'tardio'],
      ['Katherine Paola', 'Sánchez Mairena', 'puntual'],
      ['Lesbia Carolina', 'Hernández Zeledón', 'prorroga'],
      ['Marisol de los Ángeles', 'Rocha Téllez', 'moroso'],
      ['Scarleth Junieth', 'Chavarría Mora', 'contado'],
      ['Valeria Nohemí', 'Cruz Espinoza', 'referido'],
    ],
  },
  {
    clave: 'G2',
    curso: 'unas',
    nombre: 'Uñas acrílicas · Martes y jueves 2:00 p. m.',
    inicio: alinear(sumarDias(HOY, -28), 2, -1),
    meses: 3,
    horarios: [
      [2, '14:00', '16:30'],
      [4, '14:00', '16:30'],
    ],
    profesores: ['mariajose'],
    docenteUsuario: 'prof.mariajose',
    alumnas: [
      ['Jessica Maribel', 'Torres Úbeda', 'puntual'],
      ['Heydi Raquel', 'Solórzano Membreño', 'tardio'],
      ['Nathalie Alejandra', 'Vargas Rojas', 'puntual'],
      ['Ingrid Massiel', 'Urbina Lacayo', 'referido'],
      ['Dayana Yolanda', 'Gómez Lanzas', 'tardio'],
      ['Rosa Elena', 'Picado Miranda', 'puntual'],
      ['Grethel Daniela', 'Obando Sequeira', 'retiro'],
    ],
  },
  {
    clave: 'G3',
    curso: 'maquillaje',
    nombre: 'Maquillaje profesional · Lunes y miércoles 5:30 p. m.',
    inicio: alinear(sumarDias(HOY, 10), 1, 1),
    meses: 2,
    horarios: [
      [1, '17:30', '19:30'],
      [3, '17:30', '19:30'],
    ],
    profesores: ['ingrid'],
    alumnas: [
      ['Carla Melissa', 'Bermúdez Navarro', 'puntual'],
      ['Eveling Yorleni', 'Aguirre Salgado', 'puntual'],
      ['Tania Lisseth', 'Morales Duarte', 'becado'],
      ['Jennifer Marcela', 'Ruiz Herrera', 'contado'],
      ['Dania Celeste', 'Fonseca Lira', 'puntual'],
      // Alumna que regresa: terminó Cejas y pestañas y ahora se inscribe aquí.
      ['Gabriela Sofía', 'Reyes Molina', 'puntual'],
    ],
  },
];

const USUARIOS = [
  { usuario: 'admin', email: 'direccion@academiasilvia.com.ni', roles: ['ADMINISTRADOR'] },
  { usuario: 'caja.lorena', email: 'caja@academiasilvia.com.ni', roles: ['CAJERO'] },
  { usuario: 'recepcion.ana', email: 'recepcion@academiasilvia.com.ni', roles: ['RECEPCION'] },
  { usuario: 'prof.karla', email: null, roles: ['DOCENTE'], profesor: 'karla' },
  { usuario: 'prof.mariajose', email: null, roles: ['DOCENTE'], profesor: 'mariajose' },
];

const DOMINIOS = ['gmail.com', 'gmail.com', 'hotmail.com', 'yahoo.com'];
const JUSTIFICACIONES = [
  'Cita médica, presentó constancia.',
  'Enfermedad de un familiar.',
  'Problema de transporte por lluvias.',
  'Compromiso laboral avisado con anticipación.',
];
const OBSERVACIONES_SESION = [
  'Práctica con modelo propia.',
  'Se trabajó en parejas.',
  'Demostración a cargo de la instructora.',
  null,
  null,
  null,
];

// ---------------------------------------------------------------------------
// Planificación en memoria (sin tocar la base)
// ---------------------------------------------------------------------------

interface Pago { ts: string; monto: number; metodo: string; observacion: string | null }
interface Obligacion {
  id?: number;
  tipo: 'MATRICULA' | 'MENSUALIDAD';
  numero_cuota: number | null;
  periodo: string | null;
  fecha_vencimiento: string;
  monto: number;
  descuentos: { nombre: string; ts: string; observacion: string | null }[];
  recargos: { monto: number; motivo: string; fecha: string }[];
  prorrogas: { inicio: string; fin: string; observacion: string; ts: string }[];
  pagos: Pago[];
  anulada?: string;
}
interface Estudiante {
  id?: number;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  canal: 'EMAIL' | 'WHATSAPP' | 'SMS';
  fecha_nacimiento: string;
  fecha_registro: string;
  asistencia: number;
  habilidad: number;
}
interface Inscripcion {
  id?: number;
  estudiante: Estudiante;
  grupo: GrupoPlan;
  perfil: Perfil;
  fecha: string;
  ts: string;
  observacion: string | null;
  obligaciones: Obligacion[];
  retiro?: string;
}
interface Sesion {
  id?: number;
  fecha: string;
  inicio: string;
  fin: string;
  tipo: 'TEORICA' | 'PRACTICA' | 'REPASO';
  observacion: string | null;
  estado: 'PROGRAMADA' | 'REALIZADA' | 'CANCELADA';
  temas: { indice: number; estado: 'PENDIENTE' | 'PARCIAL' | 'CUBIERTO' }[];
  evaluacion?: { id?: number; tipo: 'EXAMEN' | 'TAREA' | 'PROYECTO'; descripcion: string };
}
interface GrupoPlan extends GrupoDemo {
  id?: number;
  cursoDemo: CursoDemo;
  estimada: string;
  fecha_fin: string | null;
  sesiones: Sesion[];
  inscripciones: Inscripcion[];
}

const descuentoMonto = (o: Obligacion, nombre: string) =>
  nombre === 'Beca 50 %'
    ? redondear((o.monto * 50) / 100)
    : nombre === 'Pago de contado'
      ? redondear((o.monto * 10) / 100)
      : 500;
const neto = (o: Obligacion, hasta = '9999-12-31') =>
  redondear(
    o.monto +
      o.recargos.filter((r) => r.fecha <= hasta).reduce((s, r) => s + r.monto, 0) -
      o.descuentos.reduce((s, d) => s + descuentoMonto(o, d.nombre), 0),
  );
const pagado = (o: Obligacion, hasta = '9999-12-31T23:59:59') =>
  redondear(o.pagos.filter((p) => p.ts <= hasta).reduce((s, p) => s + p.monto, 0));
const metodo = () => azar.elegir(['EFECTIVO', 'EFECTIVO', 'EFECTIVO', 'TRANSFERENCIA', 'TRANSFERENCIA', 'TARJETA']);

function crearEstudiante(nombres: string, apellidos: string, registro: string): Estudiante {
  const [nombre] = sinAcentos(nombres).toLowerCase().split(' ');
  const [apellido] = sinAcentos(apellidos).toLowerCase().split(' ');
  const conEmail = azar.prob(0.7);
  const email = conEmail
    ? `${nombre}.${apellido}${azar.prob(0.5) ? azar.entero(1, 99) : ''}@${azar.elegir(DOMINIOS)}`
    : null;
  const canal = email && azar.prob(0.3) ? 'EMAIL' : azar.prob(0.06) ? 'SMS' : 'WHATSAPP';
  return {
    nombres,
    apellidos,
    telefono: `${azar.elegir(['8', '8', '8', '7', '5'])}${azar.entero(100, 999)}-${azar.entero(1000, 9999)}`,
    email,
    canal,
    fecha_nacimiento: `${azar.entero(1986, 2007)}-${dos(azar.entero(1, 12))}-${dos(azar.entero(1, 28))}`,
    fecha_registro: registro,
    asistencia: 0.82 + azar.r() * 0.16,
    habilidad: azar.entero(70, 94),
  };
}

function planificar() {
  const estudiantes = new Map<string, Estudiante>();
  const grupos: GrupoPlan[] = [];

  for (const g of GRUPOS) {
    const cursoDemo = CURSOS.find((c) => c.clave === g.curso)!;
    const estimada = sumarMeses(g.inicio, g.meses);
    const grupo: GrupoPlan = { ...g, cursoDemo, estimada, fecha_fin: null, sesiones: [], inscripciones: [] };

    // Sesiones a partir del horario semanal, hasta antes del cierre estimado.
    for (let f = g.inicio; f < estimada; f = sumarDias(f, 1)) {
      for (const [dia, inicio, fin] of g.horarios) {
        if (diaSemana(f) === dia)
          grupo.sesiones.push({ fecha: f, inicio, fin, tipo: 'TEORICA', observacion: null, estado: 'PROGRAMADA', temas: [] });
      }
    }
    if (g.finalizado) grupo.fecha_fin = sumarDias(grupo.sesiones.at(-1)!.fecha, 1);
    for (const s of grupo.sesiones) if (s.fecha < HOY) s.estado = 'REALIZADA';
    if (g.clave === 'G2') {
      const s = grupo.sesiones.filter((x) => x.estado === 'REALIZADA')[3];
      s.estado = 'CANCELADA';
      s.observacion = 'Suspendida por corte de energía en el local.';
    }

    // Contenido: cada tema ocupa sesiones según sus horas; las últimas son de repaso.
    const temas = cursoDemo.unidades.flatMap(([, , t]) => t);
    const activas = grupo.sesiones.filter((s) => s.estado !== 'CANCELADA');
    const repaso = activas.length > 12 ? 2 : 1;
    const conTema = activas.length - repaso;
    const horas = temas.reduce((s, t) => s + t[2], 0);
    let acumulado = 0;
    const limites = temas.map((t) => (acumulado += t[2]) / horas);
    activas.forEach((s, i) => {
      if (i >= conTema) {
        s.tipo = 'REPASO';
        return;
      }
      const indice = limites.findIndex((l) => (i + 0.5) / conTema <= l);
      const siguiente = activas[i + 1];
      const continua =
        siguiente && i + 1 < conTema && limites.findIndex((l) => (i + 1.5) / conTema <= l) === indice;
      s.tipo = temas[indice][1] === 'TEORICO' ? 'TEORICA' : 'PRACTICA';
      s.temas.push({ indice, estado: s.estado === 'REALIZADA' ? (continua ? 'PARCIAL' : 'CUBIERTO') : 'PENDIENTE' });
      if (s.estado === 'REALIZADA') s.observacion = azar.elegir(OBSERVACIONES_SESION);
    });
    // Solo se planifica el contenido de las próximas cuatro sesiones.
    activas.filter((s) => s.estado === 'PROGRAMADA').slice(4).forEach((s) => (s.temas = []));

    // Evaluaciones: tarea o examen cada tres sesiones y proyecto al cierre.
    activas.forEach((s, i) => {
      const tema = s.temas[0] ? temas[s.temas[0].indice][0] : '';
      if (g.finalizado && i === activas.length - 1)
        s.evaluacion = { tipo: 'PROYECTO', descripcion: 'Proyecto final: servicio completo a modelo.' };
      else if (i % 3 === 2 && tema)
        s.evaluacion = i % 2
          ? { tipo: 'EXAMEN', descripcion: `Examen teórico-práctico: ${tema}.` }
          : { tipo: 'TAREA', descripcion: `Tarea práctica: ${tema}.` };
    });
    // En los grupos en curso, solo hay evaluaciones hasta la próxima sesión.
    const proxima = activas.find((s) => s.estado === 'PROGRAMADA');
    activas.filter((s) => s.estado === 'PROGRAMADA' && s !== proxima).forEach((s) => delete s.evaluacion);

    // Inscripciones y su plan de cobro.
    for (const [nombres, apellidos, perfil] of g.alumnas) {
      // Entre 3 y 24 días antes del inicio, pero nunca después de ayer.
      const propuesta = sumarDias(g.inicio, -azar.entero(3, 24));
      const fecha =
        propuesta < HOY ? propuesta : sumarDias(HOY, -azar.entero(1, 9));
      const clave = `${nombres} ${apellidos}`;
      const estudiante =
        estudiantes.get(clave) ??
        crearEstudiante(nombres, apellidos, sumarDias(fecha, -azar.entero(0, 6)));
      estudiantes.set(clave, estudiante);
      const ts = momento(fecha, horaAzar(8, 17));
      const ins: Inscripcion = {
        estudiante,
        grupo,
        perfil,
        fecha,
        ts,
        observacion: perfil === 'becado' ? 'Beca por buen rendimiento en el curso de nivelación.' : null,
        obligaciones: [],
      };
      const precio = cursoDemo.precio_total;
      const base = Math.floor((precio / g.meses) * 100) / 100;
      const diferencia = redondear(precio - base * g.meses);
      ins.obligaciones.push({
        tipo: 'MATRICULA', numero_cuota: null, periodo: null, fecha_vencimiento: g.inicio,
        monto: cursoDemo.precio_matricula, descuentos: [], recargos: [], prorrogas: [],
        pagos: [{ ts, monto: cursoDemo.precio_matricula, metodo: 'EFECTIVO', observacion: 'Pago automático de matrícula al realizar la inscripción.' }],
      });
      for (let c = 1; c <= g.meses; c++) {
        const venc = sumarMeses(g.inicio, c);
        ins.obligaciones.push({
          tipo: 'MENSUALIDAD', numero_cuota: c, periodo: venc.slice(0, 7), fecha_vencimiento: venc,
          monto: c === g.meses ? redondear(base + diferencia) : base,
          descuentos: [], recargos: [], prorrogas: [], pagos: [],
        });
      }
      planificarCobros(ins);
      grupo.inscripciones.push(ins);
    }
    grupos.push(grupo);
  }
  return { grupos, estudiantes: [...estudiantes.values()] };
}

function planificarCobros(ins: Inscripcion) {
  const mensualidades = ins.obligaciones.filter((o) => o.tipo === 'MENSUALIDAD');
  const ahora = momento(HOY, '23:59:59');
  const pagar = (o: Obligacion, fecha: string, monto: number, observacion: string | null = null) => {
    // Nunca antes de la inscripción, que es cuando nacen las obligaciones.
    const ts = fecha <= ins.fecha ? ins.ts : momento(fecha, horaAzar(8, 18));
    if (ts <= ahora && monto > 0) o.pagos.push({ ts, monto: redondear(monto), metodo: metodo(), observacion });
  };
  const recargo = (o: Obligacion) => {
    const fecha = sumarDias(o.fecha_vencimiento, 6);
    if (fecha <= HOY)
      o.recargos.push({ monto: 100, motivo: `Recargo por pago tardío de la cuota ${o.numero_cuota}`, fecha });
  };

  if (ins.perfil === 'retiro') {
    ins.retiro = sumarDias(ins.grupo.inicio, 5);
    ins.observacion = 'Retiro voluntario por cambio de horario laboral.';
    for (const o of mensualidades) o.anulada = ins.retiro;
    return;
  }
  if (ins.perfil === 'contado') {
    for (const o of mensualidades) {
      o.descuentos.push({ nombre: 'Pago de contado', ts: ins.ts, observacion: 'Canceló el curso completo al inscribirse.' });
      o.pagos.push({ ts: ins.ts, monto: neto(o), metodo: 'TRANSFERENCIA', observacion: 'Pago de contado del curso.' });
    }
    return;
  }
  mensualidades.forEach((o, i) => {
    const v = o.fecha_vencimiento;
    if (ins.perfil === 'becado')
      o.descuentos.push({ nombre: 'Beca 50 %', ts: ins.ts, observacion: 'Beca aprobada por dirección.' });
    if (ins.perfil === 'referido' && i === 0)
      o.descuentos.push({ nombre: 'Referido', ts: ins.ts, observacion: 'Referida por una exalumna.' });

    if (ins.perfil === 'moroso' && (i > 0 || !ins.grupo.finalizado)) {
      // Dejó de pagar: en el grupo finalizado pagó solo la primera cuota.
      if (sumarDias(v, 6) <= HOY) recargo(o);
      return;
    }
    if (ins.perfil === 'prorroga' && i === 0) {
      const ts = momento(sumarDias(v, -2), horaAzar(9, 16));
      o.prorrogas.push({ inicio: sumarDias(v, 1), fin: sumarDias(v, 12), observacion: 'Solicitó prórroga por retraso en su pago de salario.', ts });
      pagar(o, sumarDias(v, 10), neto(o), 'Pago dentro de la prórroga.');
      return;
    }
    if (ins.perfil === 'tardio' || (ins.perfil === 'moroso' && i === 0)) {
      const atraso = azar.entero(3, 11);
      if (atraso > 5) recargo(o);
      if (azar.prob(0.5) && atraso > 5) {
        const abono = redondear(o.monto / 2);
        pagar(o, sumarDias(v, 3), abono, 'Primer abono.');
        pagar(o, sumarDias(v, atraso), neto(o, sumarDias(v, atraso)) - abono, 'Abono final.');
      } else pagar(o, sumarDias(v, atraso), neto(o, sumarDias(v, atraso)));
      return;
    }
    // Puntual, becada o referida: paga unos días antes de vencer.
    pagar(o, sumarDias(v, -azar.entero(0, 5)), neto(o));
  });
}

/** Mismo criterio que la app para SUSPENDIDO_POR_MORA. */
function enMora(ins: Inscripcion, fecha: string) {
  return ins.obligaciones.some(
    (o) =>
      !o.anulada &&
      o.fecha_vencimiento < fecha &&
      neto(o) > pagado(o, momento(fecha, '23:59:59')) &&
      !o.prorrogas.some((p) => p.inicio <= fecha && fecha <= p.fin),
  );
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

const tipoSql = (v: unknown) =>
  typeof v === 'number'
    ? Number.isInteger(v)
      ? sql.Int
      : sql.Decimal(12, 2)
    : typeof v === 'boolean'
      ? sql.Bit
      : sql.NVarChar(sql.MAX);

class Conexion {
  private ultimaBitacora = 0;
  constructor(private readonly tx: sql.Transaction) {}

  async q<T = Record<string, unknown>>(texto: string, params: Record<string, unknown> = {}) {
    const req = this.tx.request();
    for (const [k, v] of Object.entries(params)) req.input(k, tipoSql(v), v ?? null);
    return (await req.query<T>(texto)).recordset ?? [];
  }

  /** INSERT con SCOPE_IDENTITY(): las tablas con trigger no admiten OUTPUT. */
  async insertar(tabla: string, fila: Record<string, unknown>) {
    const cols = Object.keys(fila);
    const [r] = await this.q<{ id: number | null }>(
      `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')});
       SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`,
      fila,
    );
    return Number(r?.id);
  }

  /** Usuario que verán los triggers de bitácora del script. */
  async usuario(id: number | null) {
    // @value es sql_variant: no admite NVARCHAR(MAX), así que va como INT.
    await this.tx
      .request()
      .input('id', sql.Int, id)
      .query("EXEC sp_set_session_context @key = N'id_usuario', @value = @id");
  }

  /** Fecha real de las filas de bitácora creadas por la última operación. */
  async fechar(ts: string) {
    const [r] = await this.q<{ id: number }>(
      'UPDATE BITACORA SET fecha = @ts WHERE id_bitacora > @desde; SELECT CAST(ISNULL(MAX(id_bitacora), 0) AS INT) AS id FROM BITACORA;',
      { ts, desde: this.ultimaBitacora },
    );
    this.ultimaBitacora = Number(r.id);
  }
}

async function hashContrasena(contrasena: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await promisify(scrypt)(contrasena, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function recrearBase(config: ConfigConexion, nombre: string) {
  // El archivo se guarda con BOM; se descarta al leerlo.
  const script = readFileSync(join(RAIZ, 'database', 'AcademiaBellezaSilvia.sql'), 'utf8').replace(/^﻿/, '');
  if (!script.includes(`USE ${nombre};`))
    throw new Error(`El script crea otra base; DB_DATABASE debe ser la del script (${nombre}).`);
  // Una sola conexión: el script usa USE y SET que dependen de la sesión.
  const pool = await abrirPool(config, { database: 'master', max: 1 });
  try {
    console.log(`Recreando ${nombre} desde database/AcademiaBellezaSilvia.sql...`);
    await pool.request().batch(`
      IF DB_ID(N'${nombre}') IS NOT NULL
      BEGIN
        ALTER DATABASE [${nombre}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${nombre}];
      END`);
    for (const lote of script.split(/^\s*GO\s*$/im)) {
      if (lote.trim()) await pool.request().batch(lote);
    }
  } finally {
    await pool.close();
  }
}

async function cargar(pool: sql.ConnectionPool) {
  const { grupos, estudiantes } = planificar();
  const tx = pool.transaction();
  await tx.begin();
  const db = new Conexion(tx);
  try {
    // --- Catálogos del script -------------------------------------------
    const roles = new Map((await db.q<{ id_rol: number; nombre: string }>('SELECT id_rol, nombre FROM ROL')).map((r) => [r.nombre, Number(r.id_rol)]));
    const descuentos = new Map((await db.q<{ id_descuento: number; nombre: string }>('SELECT id_descuento, nombre FROM DESCUENTO')).map((d) => [d.nombre, Number(d.id_descuento)]));
    const reglas = (await db.q<{ id_plantilla: number; canal: string; dias: number }>(`
      SELECT r.id_plantilla, p.canal, r.dias_respecto_vencimiento AS dias
      FROM REGLA_RECORDATORIO r JOIN PLANTILLA_NOTIFICACION p ON p.id_plantilla = r.id_plantilla
      WHERE r.estado = 'ACTIVO' AND p.estado = 'ACTIVO'`)).map((r) => ({ ...r, id_plantilla: Number(r.id_plantilla), dias: Number(r.dias) }));
    if (roles.size < 4 || descuentos.size < 3)
      throw new Error('Faltan los datos iniciales del script (roles y descuentos).');

    // --- Profesores, especialidades y usuarios ---------------------------
    const profesores = new Map<string, number>();
    const especialidades = new Map<string, number>();
    for (const p of PROFESORES) {
      const id = await db.insertar('PROFESOR', { nombres: p.nombres, apellidos: p.apellidos, telefono: p.telefono });
      profesores.set(p.clave, id);
      for (const e of p.especialidades) {
        if (!especialidades.has(e)) especialidades.set(e, await db.insertar('ESPECIALIDAD', { nombre: e }));
        await db.insertar('PROFESOR_ESPECIALIDAD', { id_profesor: id, id_especialidad: especialidades.get(e) });
      }
    }
    const hash = await hashContrasena(CONTRASENA_DEMO);
    const usuarios = new Map<string, number>();
    for (const u of USUARIOS) {
      const id = await db.insertar('USUARIO', {
        id_profesor: u.profesor ? profesores.get(u.profesor) : null,
        usuario: u.usuario,
        contrasena_hash: hash,
        email: u.email,
        ultimo_acceso: momento(sumarDias(HOY, -azar.entero(0, 2)), horaAzar(7, 18)),
      });
      usuarios.set(u.usuario, id);
      for (const r of u.roles) await db.insertar('USUARIO_ROL', { id_usuario: id, id_rol: roles.get(r) });
    }
    const admin = usuarios.get('admin')!;
    const caja = usuarios.get('caja.lorena')!;
    const recepcion = usuarios.get('recepcion.ana')!;

    // --- Cursos y planes de estudio ---------------------------------------
    const planes = new Map<string, { id_plan: number; temas: number[] }>();
    for (const c of CURSOS) {
      const id_curso = await db.insertar('CURSO', { nombre: c.nombre, descripcion: c.descripcion, precio_total: c.precio_total, precio_matricula: c.precio_matricula });
      const id_plan = await db.insertar('PLAN_ESTUDIO', { id_curso, nombre: `Plan de estudio - ${c.nombre}`, descripcion: c.descripcion });
      const temas: number[] = [];
      let ordenUnidad = 0;
      for (const [nombre, descripcion, ts] of c.unidades) {
        const id_unidad = await db.insertar('UNIDAD_ESTUDIO', { id_plan, nombre, descripcion, orden: ++ordenUnidad });
        let orden = 0;
        for (const [tema, modalidad, horas] of ts)
          temas.push(await db.insertar('TEMA_ESTUDIO', { id_unidad, nombre: tema, orden: ++orden, modalidad, horas_estimadas: horas }));
      }
      planes.set(c.clave, { id_plan, temas });
    }

    // --- Estudiantes, en orden de registro (códigos EST-000001...) --------
    estudiantes.sort((a, b) => a.fecha_registro.localeCompare(b.fecha_registro));
    for (const e of estudiantes) {
      e.id = await db.insertar('ESTUDIANTE', {
        codigo: `TMP-${randomBytes(6).toString('hex')}`,
        nombres: e.nombres, apellidos: e.apellidos, fecha_nacimiento: e.fecha_nacimiento,
        telefono: e.telefono, email: e.email, canal_preferido: e.canal, fecha_registro: e.fecha_registro,
      });
      await db.q("UPDATE ESTUDIANTE SET codigo = 'EST-' + RIGHT('000000' + CAST(id_estudiante AS VARCHAR(10)), 6) WHERE id_estudiante = @id", { id: e.id });
    }

    // --- Grupos, horarios, sesiones, contenido y evaluaciones -------------
    for (const g of grupos) {
      const plan = planes.get(g.curso)!;
      g.id = await db.insertar('GRUPO', { id_plan: plan.id_plan, nombre: g.nombre, fecha_inicio: g.inicio, duracion_meses: g.meses });
      for (const [dia, inicio, fin] of g.horarios)
        await db.insertar('HORARIO_CLASE', { id_grupo: g.id, dia_semana: DIAS[dia], hora_inicio: inicio, hora_finalizacion: fin });
      for (const p of g.profesores)
        await db.insertar('ASIGNACION_PROFESOR', { id_profesor: profesores.get(p), id_grupo: g.id, fecha_asignacion: sumarDias(g.inicio, -20) });
      for (const s of g.sesiones) {
        s.id = await db.insertar('SESION_CLASE', {
          id_grupo: g.id, fecha_programada: s.fecha, hora_inicio: s.inicio, hora_finalizacion: s.fin,
          tipo_sesion: s.tipo, estado: s.estado === 'CANCELADA' ? 'CANCELADA' : 'PROGRAMADA', observacion: s.observacion,
        });
        for (const t of s.temas)
          await db.insertar('PROGRAMACION_CONTENIDO', {
            id_sesion: s.id, id_tema: plan.temas[t.indice], estado_cumplimiento: t.estado,
            observacion: t.estado === 'PARCIAL' ? 'Se continúa en la próxima sesión.' : null,
          });
        if (s.evaluacion)
          s.evaluacion.id = await db.insertar('EVALUACION', { id_sesion: s.id, tipo: s.evaluacion.tipo, descripcion: s.evaluacion.descripcion });
      }
    }

    // --- Historia en orden cronológico ------------------------------------
    type Evento = { ts: string; orden: number; hacer: () => Promise<void> };
    const eventos: Evento[] = [];
    const agregar = (ts: string, hacer: () => Promise<void>) => eventos.push({ ts, orden: eventos.length, hacer });

    for (const g of grupos) {
      for (const ins of g.inscripciones) {
        agregar(ins.ts, async () => {
          await db.usuario(recepcion);
          ins.id = await db.insertar('INSCRIPCION', { id_estudiante: ins.estudiante.id, id_grupo: g.id, fecha_inscripcion: ins.fecha, observacion: ins.observacion });
          for (const o of ins.obligaciones)
            o.id = await db.insertar('OBLIGACION_PAGO', { id_inscripcion: ins.id, tipo: o.tipo, numero_cuota: o.numero_cuota, periodo: o.periodo, fecha_vencimiento: o.fecha_vencimiento, monto: o.monto });
          await db.fechar(ins.ts);
        });
        for (const o of ins.obligaciones) {
          for (const d of o.descuentos)
            agregar(d.ts, async () => {
              await db.usuario(caja);
              const tipo = d.nombre === 'Referido' ? 'MONTO_FIJO' : 'PORCENTAJE';
              const valor = d.nombre === 'Beca 50 %' ? 50 : d.nombre === 'Pago de contado' ? 10 : 500;
              await db.insertar('OBLIGACION_DESCUENTO', { id_obligacion: o.id, id_descuento: descuentos.get(d.nombre), tipo_aplicado: tipo, valor_aplicado: valor, fecha_aplicacion: d.ts.slice(0, 10), observacion: d.observacion });
            });
          for (const p of o.prorrogas)
            agregar(p.ts, async () => {
              await db.usuario(caja);
              await db.insertar('PRORROGA', { id_obligacion: o.id, fecha_inicio: p.inicio, fecha_finalizacion: p.fin, observacion: p.observacion });
              await db.fechar(p.ts);
            });
          for (const r of o.recargos) {
            const ts = momento(r.fecha, '07:30:00');
            agregar(ts, async () => {
              await db.usuario(caja);
              await db.insertar('RECARGO', { id_obligacion: o.id, monto: r.monto, motivo: r.motivo, fecha_generacion: r.fecha });
              await db.fechar(ts);
            });
          }
          for (const p of o.pagos)
            agregar(p.ts, async () => {
              await db.usuario(o.tipo === 'MATRICULA' ? recepcion : caja);
              await db.insertar('PAGO', { id_obligacion: o.id, fecha_pago: p.ts, monto_pagado: p.monto, metodo_pago: p.metodo, observacion: p.observacion });
              if (pagado(o, p.ts) >= neto(o, p.ts.slice(0, 10)))
                await db.q("UPDATE OBLIGACION_PAGO SET estado = 'PAGADA' WHERE id_obligacion = @id", { id: o.id });
              await db.fechar(p.ts);
            });
        }
        if (ins.retiro) {
          const ts = momento(ins.retiro, '10:15:00');
          agregar(ts, async () => {
            await db.usuario(recepcion);
            await db.q("UPDATE OBLIGACION_PAGO SET estado = 'ANULADA' WHERE id_inscripcion = @id AND tipo = 'MENSUALIDAD' AND estado = 'PENDIENTE'", { id: ins.id });
            await db.q("UPDATE INSCRIPCION SET estado = 'CANCELADA' WHERE id_inscripcion = @id", { id: ins.id });
            await db.fechar(ts);
          });
        }
      }

      // Clases realizadas: asistencia, notas y cierre de la sesión.
      const docente = g.docenteUsuario ? usuarios.get(g.docenteUsuario)! : admin;
      for (const s of g.sesiones.filter((x) => x.estado === 'REALIZADA')) {
        const ts = momento(s.fecha, s.fin);
        agregar(ts, async () => {
          await db.usuario(docente);
          const presentes: Inscripcion[] = [];
          const lista = g.inscripciones.filter((i) => i.fecha <= s.fecha && !(i.retiro && i.retiro <= s.fecha));
          for (const ins of lista) {
            let estado = 'PRESENTE';
            let observacion: string | null = null;
            if (enMora(ins, s.fecha)) estado = 'SUSPENDIDO_POR_MORA';
            else if (!azar.prob(ins.estudiante.asistencia)) {
              estado = azar.prob(0.45) ? 'JUSTIFICADA' : 'AUSENTE';
              if (estado === 'JUSTIFICADA') observacion = azar.elegir(JUSTIFICACIONES);
            }
            if (estado === 'PRESENTE') presentes.push(ins);
            await db.insertar('ASISTENCIA', { id_inscripcion: ins.id, id_sesion: s.id, estado_asistencia: estado, observacion });
          }
          if (s.evaluacion) {
            for (const ins of lista) {
              const presente = presentes.includes(ins);
              const nota = presente
                ? Math.max(55, Math.min(100, Math.round(ins.estudiante.habilidad + (azar.r() - 0.5) * 18)))
                : null;
              await db.insertar('RESULTADO_EVALUACION', { id_evaluacion: s.evaluacion.id, id_inscripcion: ins.id, nota, estado_resultado: presente ? 'CALIFICADO' : 'NO_SE_PRESENTO' });
            }
          }
          await db.q("UPDATE SESION_CLASE SET estado = 'REALIZADA' WHERE id_sesion = @id", { id: s.id });
          await db.fechar(ts);
        });
      }

      // Cierre del grupo finalizado y certificados de quienes están al día.
      if (g.finalizado && g.fecha_fin) {
        const cierre = momento(g.fecha_fin, '17:00:00');
        agregar(cierre, async () => {
          await db.usuario(admin);
          await db.q(`
            UPDATE GRUPO SET estado = 'FINALIZADO', fecha_fin = @fin WHERE id_grupo = @id;
            UPDATE INSCRIPCION SET estado = 'FINALIZADA' WHERE id_grupo = @id AND estado = 'ACTIVA';
            UPDATE SESION_CLASE SET estado = 'CANCELADA' WHERE id_grupo = @id AND estado = 'PROGRAMADA';`,
          { id: g.id, fin: g.fecha_fin });
          await db.fechar(cierre);
        });
        const emision = sumarDias(g.fecha_fin, 4);
        let consecutivo = 0;
        for (const ins of g.inscripciones) {
          const alDia = ins.obligaciones.every((o) => o.anulada || pagado(o) >= neto(o));
          if (!alDia) continue;
          const ts = momento(emision, `10:${dos(10 + consecutivo)}:00`);
          const codigo = `ABS-${emision.slice(0, 4)}-${String(++consecutivo).padStart(4, '0')}`;
          agregar(ts, async () => {
            await db.usuario(admin);
            await db.insertar('CERTIFICADO', { id_inscripcion: ins.id, codigo, fecha_emision: emision });
            await db.fechar(ts);
          });
        }
      }

      // Recordatorios ya enviados (antes de hoy), con las reglas del script.
      for (const ins of g.inscripciones) {
        const e = ins.estudiante;
        const destino = e.canal === 'EMAIL' ? e.email : e.telefono;
        for (const o of ins.obligaciones) {
          if (!destino || o.anulada) continue;
          const efectiva = [o.fecha_vencimiento, ...o.prorrogas.map((p) => p.fin)].sort().at(-1)!;
          for (const r of reglas.filter((x) => x.canal === e.canal)) {
            const envio = sumarDias(efectiva, r.dias);
            const finCurso = g.fecha_fin ?? '9999-12-31';
            if (envio >= HOY || envio < sumarDias(HOY, -75) || envio < ins.fecha || envio > finCurso) continue;
            if (pagado(o, momento(envio, '07:00:00')) >= neto(o, envio)) continue;
            const ts = momento(envio, `07:${dos(azar.entero(0, 20))}:${dos(azar.entero(0, 59))}`);
            const fallido = e.canal === 'WHATSAPP' && azar.prob(0.08);
            agregar(ts, async () => {
              await db.insertar('NOTIFICACION', {
                id_estudiante: e.id, id_plantilla: r.id_plantilla, id_obligacion: o.id, destino,
                fecha_programada: ts,
                fecha_envio: fallido ? null : momento(envio, `07:${dos(azar.entero(21, 40))}:${dos(azar.entero(0, 59))}`),
                estado_envio: fallido ? 'FALLIDO' : 'ENVIADO',
                intentos: fallido ? 3 : 1,
                error: fallido ? 'El número no tiene WhatsApp activo.' : null,
              });
            });
          }
        }
      }
    }

    eventos.sort((a, b) => a.ts.localeCompare(b.ts) || a.orden - b.orden);
    for (const e of eventos) await e.hacer();

    // Recordatorios de hoy: los genera el procedimiento del script.
    await db.usuario(caja);
    const [generados] = await db.q<{ notificaciones_generadas: number }>('EXEC sp_generar_recordatorios');
    await db.usuario(null);

    await tx.commit();
    return { generados: Number(generados?.notificaciones_generadas ?? 0) };
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function main() {
  try {
    process.loadEnvFile(join(RAIZ, 'backend', '.env'));
  } catch {
    // Sin .env se usan las variables del entorno.
  }
  const config = process.env as ConfigConexion;
  const nombre = config.DB_DATABASE ?? 'AcademiaBellezaSilvia';
  const recrear = process.argv.includes('--reset');
  if (recrear) await recrearBase(config, nombre);

  const pool = await abrirPool(config);
  try {
    const [{ total }] = (await pool.request().query<{ total: number }>(
      'SELECT (SELECT COUNT(*) FROM USUARIO) + (SELECT COUNT(*) FROM CURSO) + (SELECT COUNT(*) FROM ESTUDIANTE) AS total',
    )).recordset;
    if (Number(total) > 0)
      throw new Error('La base ya tiene datos. Usa "npm run db:demo" para recrearla con los datos de demostración.');

    console.log(`Cargando datos de demostración (hoy: ${HOY})...`);
    const { generados } = await cargar(pool);
    const resumen = (await pool.request().query(`
      SELECT 'Cursos' AS dato, COUNT(*) AS total FROM CURSO UNION ALL
      SELECT 'Grupos', COUNT(*) FROM GRUPO UNION ALL
      SELECT 'Estudiantes', COUNT(*) FROM ESTUDIANTE UNION ALL
      SELECT 'Inscripciones', COUNT(*) FROM INSCRIPCION UNION ALL
      SELECT 'Sesiones', COUNT(*) FROM SESION_CLASE UNION ALL
      SELECT 'Asistencias', COUNT(*) FROM ASISTENCIA UNION ALL
      SELECT 'Notas', COUNT(*) FROM RESULTADO_EVALUACION UNION ALL
      SELECT 'Pagos', COUNT(*) FROM PAGO UNION ALL
      SELECT 'Obligaciones en mora', COUNT(*) FROM vw_estado_cuenta WHERE dias_mora > 0 UNION ALL
      SELECT 'Certificados', COUNT(*) FROM CERTIFICADO UNION ALL
      SELECT 'Recordatorios', COUNT(*) FROM NOTIFICACION UNION ALL
      SELECT 'Registros de bitácora', COUNT(*) FROM BITACORA`)).recordset;
    console.table(Object.fromEntries(resumen.map((r) => [r.dato, Number(r.total)])));
    console.log(`Recordatorios pendientes para hoy: ${generados}.`);
    console.log(`\nCuentas (contraseña: ${CONTRASENA_DEMO}):`);
    for (const u of USUARIOS) console.log(`  ${u.usuario.padEnd(16)} ${u.roles.join(', ')}`);
    if (recrear) console.log('\nSi el backend estaba corriendo, reinícialo para que vuelva a conectarse.');
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(`\nNo se pudieron cargar los datos: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
