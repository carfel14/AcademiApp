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
import { AuthRequest } from './seguridad.controller';
import { SeguridadService } from './seguridad.service';

@Injectable()
export class SeguridadGuard implements CanActivate {
  constructor(private readonly seguridad: SeguridadService) {}

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
    if (req.usuario.rol === 'ADMIN') return true;
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
    const academico = [
      'cursos',
      'grupos',
      'estudiantes',
      'inscripciones',
      'profesores',
      'asignaciones-profesor',
      'horarios',
      'sesiones',
      'asistencias',
      'evaluaciones',
      'resultados-evaluacion',
      'planes',
    ];
    const docencia = [
      'sesiones',
      'asistencias',
      'evaluaciones',
      'resultados-evaluacion',
    ];
    const caja = [
      'estudiantes',
      'inscripciones',
      'obligaciones-pago',
      'pagos',
      'prorrogas',
      'cobros',
      'recordatorios',
    ];
    if (
      req.usuario.rol === 'PROFESOR' &&
      (docencia.includes(recurso) ||
        (req.method === 'GET' && academico.includes(recurso)))
    )
      return true;
    if (
      req.usuario.rol === 'CAJA' &&
      (caja.includes(recurso) ||
        (req.method === 'GET' && ['cursos', 'grupos'].includes(recurso)))
    )
      return true;
    throw new ForbiddenException(
      'Tu rol no tiene permiso para esta operación.',
    );
  }
}

const catalogos: Record<string, [string, string]> = {
  planes: ['plan_estudio', 'id_plan'],
  unidades: ['unidad_estudio', 'id_unidad'],
  temas: ['tema_estudio', 'id_tema'],
  descuentos: ['descuento', 'id_descuento'],
  plantillas: ['plantilla_notificacion', 'id_plantilla'],
  reglas: ['regla_recordatorio', 'id_regla'],
};

const recursos: Record<string, [string, string]> = {
  cursos: ['curso', 'id_curso'],
  grupos: ['grupo', 'id_grupo'],
  horarios: ['horario_clase', 'id_horario'],
  estudiantes: ['estudiante', 'id_estudiante'],
  profesores: ['profesor', 'id_profesor'],
  'asignaciones-profesor': ['asignacion_profesor', 'id_asignacion'],
  inscripciones: ['inscripcion', 'id_inscripcion'],
  sesiones: ['sesion_clase', 'id_sesion'],
  asistencias: ['asistencia', 'id_asistencia'],
  evaluaciones: ['evaluacion', 'id_evaluacion'],
  'resultados-evaluacion': ['resultado_evaluacion', 'id_resultado'],
  'obligaciones-pago': ['obligacion_pago', 'id_obligacion'],
  pagos: ['pago', 'id_pago'],
  prorrogas: ['prorroga', 'id_prorroga'],
  certificados: ['certificado', 'id_certificado'],
};

@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  private readonly logger = new Logger(BitacoraInterceptor.name);

  constructor(private readonly seguridad: SeguridadService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const [, recurso, parametro, subrecurso] = req.path.split('/');
    const operacion = {
      POST: 'INSERT',
      PATCH: 'UPDATE',
      PUT: 'UPDATE',
      DELETE: 'DELETE',
    }[req.method];
    const catalogo =
      recurso === 'planes'
        ? parametro
        : parametro === 'catalogos'
          ? subrecurso
          : '';
    const destino =
      subrecurso === 'horarios'
        ? recursos.horarios
        : (catalogos[catalogo] ?? recursos[recurso]);
    const [tabla, campo] = destino ?? [recurso, 'id'];
    if (!operacion || recurso === 'auth' || !req.usuario) return next.handle();

    return next.handle().pipe(
      mergeMap(async (result) => {
        const id =
          result?.[campo] ??
          result?.pago?.[campo] ??
          result?.inscripcion?.[campo] ??
          result?.sesion?.[campo] ??
          (Number(parametro) || Number(subrecurso) || null);
        const accion =
          req.method === 'DELETE' &&
          [
            'inscripciones',
            'sesiones',
            'grupos',
            'estudiantes',
            'profesores',
          ].includes(recurso) &&
          subrecurso !== 'horarios'
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
              id,
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
