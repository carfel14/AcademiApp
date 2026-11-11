import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { mergeMap } from 'rxjs';
import { contextoUsuario } from '../database/database.service';
import { type Alcance, AlcanceService } from './alcance';
import { AuthRequest } from './seguridad.controller';
import { SeguridadService } from './seguridad.service';

type Regla = { escritura: string[]; lectura: string[] };

/**
 * Permisos según la descripción de cada rol en los datos iniciales del script.
 * ADMINISTRADOR tiene acceso total. Un usuario con varios roles suma permisos.
 */
const permisos: Record<string, Regla> = {
  // Registra asistencia, notas y avance del plan
  DOCENTE: {
    escritura: [
      'sesiones',
      'asistencias',
      'evaluaciones',
      'resultados-evaluacion',
    ],
    lectura: [
      'cursos',
      'grupos',
      'estudiantes',
      'inscripciones',
      'profesores',
      'asignaciones-profesor',
      'horarios',
      'planes',
    ],
  },
  // Registra pagos, prórrogas y descuentos
  CAJERO: {
    escritura: [
      'obligaciones-pago',
      'pagos',
      'prorrogas',
      'cobros',
      'recordatorios',
    ],
    lectura: ['estudiantes', 'inscripciones', 'cursos', 'grupos'],
  },
  // Registra estudiantes e inscripciones
  RECEPCION: {
    escritura: ['estudiantes', 'inscripciones'],
    lectura: ['cursos', 'grupos', 'planes', 'obligaciones-pago', 'pagos'],
  },
};

const permite = (rol: string, metodo: string, recurso: string) => {
  const regla = permisos[rol];
  return Boolean(
    regla &&
      (regla.escritura.includes(recurso) ||
        (metodo === 'GET' && regla.lectura.includes(recurso))),
  );
};

@Injectable()
export class SeguridadGuard implements CanActivate {
  constructor(
    private readonly seguridad: SeguridadService,
    private readonly alcance: AlcanceService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const [, recurso, accion, catalogo] = req.path.toLowerCase().split('/');
    if (
      req.method === 'POST' &&
      recurso === 'auth' &&
      ['login', 'configurar'].includes(accion)
    )
      return true;

    req.token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1] ?? '';
    req.usuario = await this.seguridad.session(req.token);
    const store = contextoUsuario.getStore();
    if (store) store.id_usuario = req.usuario.id_usuario;

    if (req.usuario.roles.includes('ADMINISTRADOR')) return true;
    if (recurso === 'auth' && ['sesion', 'logout'].includes(accion))
      return true;

    if (
      recurso === 'planes' &&
      !['planes', 'unidades', 'temas'].includes(accion)
    )
      throw new ForbiddenException();
    if (
      recurso === 'cobros' &&
      accion === 'catalogos' &&
      catalogo !== 'descuentos'
    )
      throw new ForbiddenException();
    if (
      recurso === 'recordatorios' &&
      accion === 'catalogos' &&
      !['plantillas', 'reglas'].includes(catalogo)
    )
      throw new ForbiddenException();

    const otros = req.usuario.roles.filter((rol) => rol !== 'DOCENTE');
    if (otros.some((rol) => permite(rol, req.method, recurso))) return true;
    if (req.usuario.roles.includes('DOCENTE') && permite('DOCENTE', req.method, recurso)) {
      // Solo por ser docente: queda limitado a sus grupos asignados.
      const r = req as AuthRequest & { alcance?: Alcance; body?: Record<string, unknown> };
      r.alcance = await this.alcance.calcular(req.usuario.id_profesor);
      await this.alcance.verificar(r);
      return true;
    }
    throw new ForbiddenException(
      'Tu rol no tiene permiso para esta operación.',
    );
  }
}

const catalogos: Record<string, [string, string]> = {
  planes: ['PLAN_ESTUDIO', 'id_plan'],
  unidades: ['UNIDAD_ESTUDIO', 'id_unidad'],
  temas: ['TEMA_ESTUDIO', 'id_tema'],
  descuentos: ['DESCUENTO', 'id_descuento'],
  plantillas: ['PLANTILLA_NOTIFICACION', 'id_plantilla'],
  reglas: ['REGLA_RECORDATORIO', 'id_regla'],
};

const recursos: Record<string, [string, string]> = {
  cursos: ['CURSO', 'id_curso'],
  grupos: ['GRUPO', 'id_grupo'],
  horarios: ['HORARIO_CLASE', 'id_horario'],
  estudiantes: ['ESTUDIANTE', 'id_estudiante'],
  profesores: ['PROFESOR', 'id_profesor'],
  especialidades: ['ESPECIALIDAD', 'id_especialidad'],
  'asignaciones-profesor': ['ASIGNACION_PROFESOR', 'id_asignacion'],
  inscripciones: ['INSCRIPCION', 'id_inscripcion'],
  sesiones: ['SESION_CLASE', 'id_sesion'],
  contenidos: ['PROGRAMACION_CONTENIDO', 'id_programacion'],
  asistencias: ['ASISTENCIA', 'id_asistencia'],
  evaluaciones: ['EVALUACION', 'id_evaluacion'],
  'resultados-evaluacion': ['RESULTADO_EVALUACION', 'id_resultado'],
  'obligaciones-pago': ['OBLIGACION_PAGO', 'id_obligacion'],
  pagos: ['PAGO', 'id_pago'],
  prorrogas: ['PRORROGA', 'id_prorroga'],
  certificados: ['CERTIFICADO', 'id_certificado'],
  descuento: ['OBLIGACION_DESCUENTO', 'id_obligacion'],
  recargo: ['RECARGO', 'id_recargo'],
  recordatorios: ['NOTIFICACION', 'id_notificacion'],
};

/** Tablas que el script ya audita con sus propios triggers. */
const auditadasPorTrigger = new Set([
  'PAGO',
  'OBLIGACION_PAGO',
  'PRORROGA',
  'RECARGO',
  'RESULTADO_EVALUACION',
  'CERTIFICADO',
]);

@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  private readonly logger = new Logger(BitacoraInterceptor.name);

  constructor(private readonly seguridad: SeguridadService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const partes = req.path.split('/');
    const [, recurso, parametro, subrecurso] = partes;
    const operacion = {
      POST: 'INSERT',
      PATCH: 'UPDATE',
      PUT: 'UPDATE',
      DELETE: 'DELETE',
    }[req.method];
    if (!operacion || recurso === 'auth' || !req.usuario) return next.handle();

    const catalogo =
      recurso === 'planes'
        ? parametro
        : parametro === 'catalogos'
          ? subrecurso
          : '';
    const destino =
      catalogos[catalogo] ??
      (['horarios', 'contenidos', 'descuento', 'recargo'].includes(subrecurso)
        ? recursos[subrecurso]
        : undefined) ??
      (['especialidades', 'contenidos'].includes(parametro)
        ? recursos[parametro]
        : undefined) ??
      recursos[recurso];
    const [tabla, campo] = destino ?? [recurso.toUpperCase(), 'id'];
    if (auditadasPorTrigger.has(tabla)) return next.handle();

    return next.handle().pipe(
      mergeMap(async (result) => {
        const id =
          result?.[campo] ??
          result?.inscripcion?.[campo] ??
          result?.sesion?.[campo] ??
          (Number(parametro) || Number(subrecurso) || null);
        const accion =
          req.method === 'DELETE' &&
          [
            'cursos',
            'inscripciones',
            'sesiones',
            'grupos',
            'estudiantes',
            'profesores',
          ].includes(recurso) &&
          !['horarios', 'contenidos'].includes(subrecurso) &&
          parametro !== 'contenidos'
            ? 'UPDATE'
            : operacion;
        try {
          const detalle = `${req.method} ${req.path}`;
          if (recurso === 'asistencias' && Array.isArray(result?.asistencias)) {
            const nuevas = new Set(result.creadas);
            for (const registro of result.asistencias) {
              await this.seguridad.audit(
                req.usuario.id_usuario,
                tabla,
                registro.id_asistencia,
                nuevas.has(registro.id_asistencia) ? 'INSERT' : 'UPDATE',
                detalle,
              );
            }
          } else {
            await this.seguridad.audit(
              req.usuario.id_usuario,
              tabla,
              typeof id === 'number' ? id : null,
              accion,
              detalle,
            );
          }
        } catch (error) {
          this.logger.error(
            'No se pudo registrar la operación en bitácora.',
            error,
          );
        }
        return result;
      }),
    );
  }
}
