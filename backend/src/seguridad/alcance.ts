import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import * as sql from 'mssql';
import { map } from 'rxjs';
import { DatabaseService } from '../database/database.service';

/**
 * Lo que un docente puede ver: los grupos que tiene asignados en
 * ASIGNACION_PROFESOR y lo que depende de ellos.
 */
export interface Alcance {
  grupos: Set<number>;
  cursos: Set<number>;
  planes: Set<number>;
  unidades: Set<number>;
  estudiantes: Set<number>;
}

interface RequestConAlcance {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  alcance?: Alcance;
}

const DENEGADO = 'Solo puedes acceder a los grupos que tienes asignados.';
const numero = (v: unknown) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : NaN);

/** Grupo al que pertenece cada recurso, para validar rutas con id. */
const GRUPO_DE: Record<string, string> = {
  horario: 'SELECT id_grupo FROM HORARIO_CLASE WHERE id_horario = @id',
  sesion: 'SELECT id_grupo FROM SESION_CLASE WHERE id_sesion = @id',
  contenido: `SELECT s.id_grupo FROM PROGRAMACION_CONTENIDO pc
    JOIN SESION_CLASE s ON s.id_sesion = pc.id_sesion WHERE pc.id_programacion = @id`,
  asistencia: `SELECT s.id_grupo FROM ASISTENCIA a
    JOIN SESION_CLASE s ON s.id_sesion = a.id_sesion WHERE a.id_asistencia = @id`,
  evaluacion: `SELECT s.id_grupo FROM EVALUACION e
    JOIN SESION_CLASE s ON s.id_sesion = e.id_sesion WHERE e.id_evaluacion = @id`,
  resultado: `SELECT s.id_grupo FROM RESULTADO_EVALUACION r
    JOIN EVALUACION e ON e.id_evaluacion = r.id_evaluacion
    JOIN SESION_CLASE s ON s.id_sesion = e.id_sesion WHERE r.id_resultado = @id`,
  inscripcion: 'SELECT id_grupo FROM INSCRIPCION WHERE id_inscripcion = @id',
  asignacion: 'SELECT id_grupo FROM ASIGNACION_PROFESOR WHERE id_asignacion = @id',
};

@Injectable()
export class AlcanceService {
  constructor(private readonly db: DatabaseService) {}

  async calcular(idProfesor: number | null): Promise<Alcance> {
    const { recordsets } = await this.db
      .getPool()
      .request()
      .input('profesor', sql.Int, idProfesor ?? 0).query(`
        DECLARE @grupos TABLE (id_grupo INT PRIMARY KEY);
        INSERT INTO @grupos SELECT DISTINCT id_grupo FROM ASIGNACION_PROFESOR WHERE id_profesor = @profesor;
        SELECT g.id_grupo, g.id_plan, p.id_curso FROM GRUPO g
          JOIN @grupos x ON x.id_grupo = g.id_grupo JOIN PLAN_ESTUDIO p ON p.id_plan = g.id_plan;
        SELECT u.id_unidad FROM UNIDAD_ESTUDIO u
          WHERE u.id_plan IN (SELECT g.id_plan FROM GRUPO g JOIN @grupos x ON x.id_grupo = g.id_grupo);
        SELECT DISTINCT i.id_estudiante FROM INSCRIPCION i JOIN @grupos x ON x.id_grupo = i.id_grupo;
      `);
    const [grupos, unidades, estudiantes] = recordsets as unknown as Record<string, number>[][];
    return {
      grupos: new Set(grupos.map((g) => g.id_grupo)),
      cursos: new Set(grupos.map((g) => g.id_curso)),
      planes: new Set(grupos.map((g) => g.id_plan)),
      unidades: new Set(unidades.map((u) => u.id_unidad)),
      estudiantes: new Set(estudiantes.map((e) => e.id_estudiante)),
    };
  }

  /** Lanza 403 si la ruta apunta a un registro fuera del alcance del docente. */
  async verificar(req: RequestConAlcance) {
    const alcance = req.alcance!;
    const [, recurso, a, b] = req.path.toLowerCase().split('/');
    const permitido = (grupo: number | undefined) => {
      if (grupo === undefined || !alcance.grupos.has(grupo))
        throw new ForbiddenException(DENEGADO);
    };

    const tipo: string | undefined = {
      horarios: 'horario',
      asistencias: 'asistencia',
      evaluaciones: 'evaluacion',
      'resultados-evaluacion': 'resultado',
      inscripciones: 'inscripcion',
      'asignaciones-profesor': 'asignacion',
    }[recurso];

    if (recurso === 'grupos' && !Number.isNaN(numero(a))) return permitido(numero(a));
    if (recurso === 'cursos' && !Number.isNaN(numero(a))) {
      if (!alcance.cursos.has(numero(a))) throw new ForbiddenException(DENEGADO);
      return;
    }
    if (recurso === 'estudiantes' && !Number.isNaN(numero(a))) {
      if (!alcance.estudiantes.has(numero(a))) throw new ForbiddenException(DENEGADO);
      return;
    }
    if (recurso === 'sesiones') {
      if ((a === 'grupo' || a === 'generar') && !Number.isNaN(numero(b))) return permitido(numero(b));
      if (a === 'contenidos' && !Number.isNaN(numero(b))) return permitido(await this.grupo('contenido', numero(b)));
      if (!Number.isNaN(numero(a))) return permitido(await this.grupo('sesion', numero(a)));
      if (req.method === 'POST' && !a) return permitido(numero(req.body?.id_grupo));
      return;
    }
    if (recurso === 'asistencias' && a === 'sesion') return permitido(await this.grupo('sesion', numero(b)));
    if (recurso === 'evaluaciones' && req.method === 'POST' && !a)
      return permitido(await this.grupo('sesion', numero(req.body?.id_sesion)));
    if (recurso === 'resultados-evaluacion' && a === 'evaluacion')
      return permitido(await this.grupo('evaluacion', numero(b)));
    if (recurso === 'inscripciones' && a === 'grupo') return permitido(numero(b));
    if (tipo && !Number.isNaN(numero(a))) return permitido(await this.grupo(tipo, numero(a)));
  }

  private async grupo(tipo: string, id: number) {
    if (Number.isNaN(id)) return undefined;
    const { recordset } = await this.db
      .getPool()
      .request()
      .input('id', sql.Int, id)
      .query<{ id_grupo: number }>(GRUPO_DE[tipo]);
    return recordset[0]?.id_grupo;
  }
}

/** Filtra las listas que devuelve la API al alcance del docente. */
@Injectable()
export class AlcanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<RequestConAlcance>();
    const alcance = req.alcance;
    if (!alcance || req.method !== 'GET') return next.handle();
    const [, recurso, catalogo] = req.path.toLowerCase().split('/');

    const filtro: ((fila: Record<string, number>) => boolean) | undefined =
      recurso === 'cursos'
        ? (f) => alcance.cursos.has(f.id_curso)
        : recurso === 'estudiantes'
          ? (f) => alcance.estudiantes.has(f.id_estudiante)
          : recurso === 'planes' && catalogo === 'planes'
            ? (f) => alcance.planes.has(f.id_plan)
            : recurso === 'planes'
              ? (f) => alcance.unidades.has(f.id_unidad)
              : [
                    'grupos',
                    'sesiones',
                    'inscripciones',
                    'asistencias',
                    'evaluaciones',
                    'resultados-evaluacion',
                    'asignaciones-profesor',
                  ].includes(recurso)
                ? (f) => f.id_grupo === undefined || alcance.grupos.has(f.id_grupo)
                : undefined;

    return next
      .handle()
      .pipe(map((data) => (filtro && Array.isArray(data) ? data.filter(filtro) : data)));
  }
}
