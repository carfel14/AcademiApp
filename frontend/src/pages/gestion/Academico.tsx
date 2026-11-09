import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import HorarioForm from "../../components/grupos/HorarioForm";
import Modal from "../../components/ui/Modal";
import { api } from "../../services/api";
import { actualizarHorario, crearHorario, eliminarHorario } from "../../services/horarioService";
import type { Grupo } from "../../types/grupo";
import type { Horario } from "../../types/horario";
import type { AsistenciaItem } from "../../types/asistencia";
import type { ResultadoEvaluacionItem } from "../../types/resultadoEvaluacion";
import { EditForm, Heading, Select, Status, Table, type Row } from "./ui";
import { date, label, message, time, useData } from "./datos";

type Sesion = {
  id_sesion: number;
  id_grupo: number;
  fecha_programada: string;
  hora_inicio: string;
  hora_fin: string;
  tema: string | null;
  estado_sesion: string;
};

type Lista = {
  sesion: Sesion;
  estudiantes: (Pick<AsistenciaItem, "id_inscripcion" | "observacion"> & {
    nombres: string; apellidos: string; estado_asistencia: AsistenciaItem["estado_asistencia"] | null; tiene_mora: boolean;
  })[];
};

type Evaluacion = {
  id_evaluacion: number;
  id_sesion: number;
  tipo_evaluacion: string;
  descripcion: string | null;
};

export function CalendarioPage({ admin }: { admin: boolean }) {
  const [params, setParams] = useSearchParams();
  const grupo = Number(params.get("grupo")) || 0;
  const groups = useData<Grupo[]>("/grupos");
  const horarios = useData<Horario[]>(grupo ? `/grupos/${grupo}/horarios` : null);
  const sesiones = useData<Sesion[]>(grupo ? `/sesiones/grupo/${grupo}` : null);
  const [horario, setHorario] = useState<Horario | "nuevo" | null>(null);
  const [borrar, setBorrar] = useState<Horario | null>(null);
  const [cancelar, setCancelar] = useState<Sesion | null>(null);
  const [sesion, setSesion] = useState<Sesion | "nueva" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [estado, setEstado] = useState("");
  const activo = groups.data?.find(g => g.id_grupo === grupo)?.estado === "ACTIVO";

  async function action(work: () => Promise<void>) {
    setWorking(true);
    setError("");
    setNotice("");
    try { await work(); } catch (error) { setError(message(error)); } finally { setWorking(false); }
  }

  return <>
    <Heading title="Horarios y sesiones" detail="Define los turnos semanales y consulta el calendario de cada grupo." />
    <div className="work-toolbar"><Select name="Grupo" value={grupo || ""} items={(groups.data ?? []).map(g => ({ value: g.id_grupo, label: g.nombre_grupo }))}
      onChange={value => { setParams(value ? { grupo: value } : {}); setError(""); setNotice(""); }} /></div>
    <Status {...groups} retry={groups.reload} />
    {!grupo && groups.data && <p className="work-muted">{groups.data.length ? "Selecciona un grupo para ver sus horarios y sesiones." : "Crea un grupo desde Cursos para empezar."}</p>}
    {Boolean(grupo) && <>
      <section className="work-section">
        <div className="work-section-title"><h2>Horario semanal</h2>{admin && activo && <button className="work-secondary" onClick={() => setHorario("nuevo")}>Agregar horario</button>}</div>
        <Status {...horarios} retry={horarios.reload} />
        {horarios.data && <Table rows={horarios.data} rowKey={row => row.id_horario} empty="Este grupo todavía no tiene horarios." columns={[
          { label: "Día", cell: row => ({ MIERCOLES: "Miércoles", SABADO: "Sábado" })[row.dia_semana] ?? label(row.dia_semana) },
          { label: "Inicio", cell: row => time(row.hora_inicio) },
          { label: "Fin", cell: row => time(row.hora_fin) },
          ...(admin && activo ? [{ label: "Acciones", cell: (row: Horario) => <div className="work-inline"><button className="work-link" onClick={() => setHorario(row)}>Editar</button>
            <button className="work-link" onClick={() => { setError(""); setBorrar(row); }}>Eliminar</button></div> }] : []),
        ]} />}
        {admin && activo && Boolean(sesiones.data?.length) && <p className="work-muted">Las sesiones ya generadas se editan desde el calendario.</p>}
      </section>
      <section className="work-section">
        <div className="work-section-title"><h2>Calendario de sesiones</h2>
          {activo && <div className="work-inline">
            <button className="work-secondary" onClick={() => setSesion("nueva")}>Agregar sesión</button>
            <button className="work-primary" disabled={working || !horarios.data?.length} onClick={() => void action(async () => {
              const result = await api<{ sesiones_creadas: number }>(`/sesiones/generar/${grupo}`, "POST");
              setNotice(result.sesiones_creadas ? `Sesiones creadas: ${result.sesiones_creadas}.` : "El calendario ya está al día.");
              sesiones.reload();
            })}>Generar sesiones</button>
          </div>}
        </div>
        {!borrar && !cancelar && <Status error={error} />}
        {notice && <p className="work-notice" role="status">{notice}</p>}
        <div className="work-toolbar"><Select name="Estado" value={estado} onChange={setEstado} placeholder="Todos" items={["PROGRAMADA", "REALIZADA", "CANCELADA"].map(value => ({ value, label: label(value) }))} /></div>
        <Status {...sesiones} retry={sesiones.reload} />
        {sesiones.data && <Table stack rows={sesiones.data.filter(s => !estado || s.estado_sesion === estado)} rowKey={row => row.id_sesion} empty="No hay sesiones en esta vista." columns={[
          { label: "Fecha", cell: row => date(row.fecha_programada) },
          { label: "Hora", cell: row => `${time(row.hora_inicio)} – ${time(row.hora_fin)}` },
          { label: "Tema", cell: row => row.tema ?? "—" },
          { label: "Estado", cell: row => <span className="work-tag">{label(row.estado_sesion)}</span> },
          { label: "Acciones", cell: row => <div className="work-inline">
            <Link className="work-link" to={`/asistencia?grupo=${grupo}&sesion=${row.id_sesion}`}>Asistencia</Link>
            {row.estado_sesion === "PROGRAMADA" && <>
              <button className="work-link" onClick={() => setSesion(row)}>Editar</button>
              <button className="work-link" onClick={() => { setError(""); setCancelar(row); }}>Cancelar</button>
            </>}
          </div> },
        ]} />}
      </section>
    </>}
    {horario && <Modal isOpen onClose={() => setHorario(null)} title={horario === "nuevo" ? "Agregar horario" : "Editar horario"}>
      <HorarioForm horario={horario === "nuevo" ? undefined : horario} onSubmit={async data => {
        if (horario === "nuevo") await crearHorario(grupo, data);
        else await actualizarHorario(horario.id_horario, data);
        setHorario(null);
        horarios.reload();
      }} />
    </Modal>}
    {borrar && <Modal isOpen onClose={() => setBorrar(null)} title="Eliminar horario">
      <p>¿Eliminar el horario del {label(borrar.dia_semana).toLowerCase()} a las {time(borrar.hora_inicio)}?</p>
      <Status error={error} />
      <div className="work-inline mt-4"><button className="work-secondary" onClick={() => setBorrar(null)}>Volver</button>
        <button className="work-primary" disabled={working} onClick={() => void action(async () => {
          await eliminarHorario(borrar.id_horario); setBorrar(null); horarios.reload();
        })}>Eliminar horario</button></div>
    </Modal>}
    {cancelar && <Modal isOpen onClose={() => setCancelar(null)} title="Cancelar sesión">
      <p>¿Cancelar la sesión del {date(cancelar.fecha_programada)} a las {time(cancelar.hora_inicio)}?</p>
      <Status error={error} />
      <div className="work-inline mt-4"><button className="work-secondary" onClick={() => setCancelar(null)}>Volver</button>
        <button className="work-primary" disabled={working} onClick={() => void action(async () => {
          await api(`/sesiones/${cancelar.id_sesion}`, "DELETE");
          setCancelar(null);
          sesiones.reload();
        })}>Cancelar sesión</button></div>
    </Modal>}
    {sesion && <Modal isOpen onClose={() => setSesion(null)} title={sesion === "nueva" ? "Agregar sesión" : "Editar sesión"}>
      <EditForm fields={[
        { name: "fecha_programada", label: "Fecha", type: "date" },
        { name: "hora_inicio", label: "Hora de inicio", type: "time" },
        { name: "hora_fin", label: "Hora de fin", type: "time" },
        { name: "tema", label: "Tema", max: 200, required: false },
      ]} initial={sesion === "nueva" ? {} : { ...sesion, hora_inicio: time(sesion.hora_inicio), hora_fin: time(sesion.hora_fin) }} onSave={async data => {
        if (String(data.hora_inicio) >= String(data.hora_fin)) throw new Error("La hora de fin debe ser posterior a la de inicio.");
        if (sesion === "nueva") await api("/sesiones", "POST", { ...data, id_grupo: grupo });
        else await api(`/sesiones/${sesion.id_sesion}`, "PATCH", data);
        setSesion(null);
        sesiones.reload();
      }} />
    </Modal>}
  </>;
}

export function AsistenciaPage({ evaluaciones = false }: { evaluaciones?: boolean }) {
  const [params, setParams] = useSearchParams();
  const grupo = Number(params.get("grupo")) || 0;
  const id = Number(params.get("sesion")) || 0;
  const groups = useData<Grupo[]>("/grupos");
  const sesiones = useData<Sesion[]>(grupo ? `/sesiones/grupo/${grupo}` : null);
  const lista = useData<Lista>(id ? `/asistencias/sesion/${id}` : null);
  return <>
    <Heading title={evaluaciones ? "Evaluaciones" : "Asistencia"} detail={evaluaciones ? "Crea evaluaciones y registra las calificaciones por sesión." : "Consulta la lista y registra la asistencia de cada sesión."} />
    <div className="work-toolbar">
      <Select name="Grupo" value={grupo || ""} onChange={value => setParams(value ? { grupo: value } : {})}
        items={(groups.data ?? []).map(g => ({ value: g.id_grupo, label: g.nombre_grupo }))} />
      <Select name="Sesión" value={id || ""} onChange={value => setParams(value ? { grupo: String(grupo), sesion: value } : { grupo: String(grupo) })}
        placeholder={sesiones.data?.length === 0 ? "El grupo no tiene sesiones" : "Selecciona una sesión"}
        items={(sesiones.data ?? []).map(s => ({ value: s.id_sesion, label: `${date(s.fecha_programada)} · ${time(s.hora_inicio)}${s.tema ? ` · ${s.tema}` : ""}` }))} />
    </div>
    <Status {...groups} retry={groups.reload} /><Status {...sesiones} retry={sesiones.reload} /><Status {...lista} retry={lista.reload} />
    {!id && !sesiones.loading && <p className="work-muted">{grupo && !sesiones.data?.length ? <Link className="work-link" to={`/calendario?grupo=${grupo}`}>Ir al calendario del grupo</Link> : "Selecciona una sesión para continuar."}</p>}
    {lista.data && (evaluaciones
      ? <EvaluacionesSesion key={id} lista={lista.data} onChange={lista.reload} />
      : <ListaAsistencia key={`${id}:${lista.data.estudiantes.map(e => e.estado_asistencia).join(",")}`} lista={lista.data} onChange={lista.reload} />)}
  </>;
}

const estados: Record<string, string> = {
  PRESENTE: "Presente", AUSENTE: "Ausente", JUSTIFICADO: "Justificado", SUSPENDIDO_POR_MORA: "Suspendido por mora",
};

function ListaAsistencia({ lista, onChange }: { lista: Lista; onChange: () => void }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const id = lista.sesion.id_sesion;
  const editable = lista.sesion.estado_sesion !== "CANCELADA";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError(""); setNotice(""); setBusy(true);
    try {
      await api(`/asistencias/sesion/${id}`, "POST", { asistencias: lista.estudiantes.map(e => ({
        id_inscripcion: e.id_inscripcion,
        estado_asistencia: values.get(`estado-${e.id_inscripcion}`),
        observacion: values.get(`nota-${e.id_inscripcion}`) || null,
      })) });
      setNotice("Asistencia guardada.");
      onChange();
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }

  return <section className="work-section">
    <div className="work-section-title"><h2>Lista de asistencia</h2><span className="work-tag">{label(lista.sesion.estado_sesion)}</span></div>
    <form onSubmit={save}>
      <Table stack rows={lista.estudiantes} rowKey={e => e.id_inscripcion} empty="Esta sesión no tiene estudiantes en la lista." columns={[
        { label: "Estudiante", cell: e => `${e.nombres} ${e.apellidos}` },
        { label: "Asistencia", cell: e => editable ? <select aria-label={`Asistencia de ${e.nombres} ${e.apellidos}`} name={`estado-${e.id_inscripcion}`} required
          defaultValue={e.estado_asistencia ?? (e.tiene_mora ? "SUSPENDIDO_POR_MORA" : "")}>
          <option value="">Selecciona estado</option>
          {Object.entries(estados).filter(([estado]) => estado !== "SUSPENDIDO_POR_MORA" || e.tiene_mora || e.estado_asistencia === estado).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select> : estados[e.estado_asistencia ?? ""] ?? "—" },
        { label: "Observación", cell: e => editable ? <input aria-label={`Observación de ${e.nombres} ${e.apellidos}`} name={`nota-${e.id_inscripcion}`} defaultValue={e.observacion ?? ""} maxLength={5000} /> : e.observacion ?? "—" },
      ]} />
      <Status error={error} />{notice && <p className="work-notice" role="status">{notice}</p>}
      <div className="work-inline mt-4">
        {editable && Boolean(lista.estudiantes.length) && <button className="work-primary" disabled={busy}>Guardar asistencia</button>}
        <Link className="work-secondary" to={`/evaluaciones?grupo=${lista.sesion.id_grupo}&sesion=${id}`}>Ver evaluaciones</Link>
        {lista.sesion.estado_sesion === "PROGRAMADA" && <button type="button" className="work-secondary" disabled={busy} onClick={async () => {
          setError(""); setNotice(""); setBusy(true);
          try { await api(`/sesiones/${id}/finalizar`, "PATCH"); setNotice("Sesión finalizada."); onChange(); }
          catch (error) { setError(message(error)); } finally { setBusy(false); }
        }}>Finalizar sesión</button>}
      </div>
    </form>
  </section>;
}

function EvaluacionesSesion({ lista, onChange }: { lista: Lista; onChange: () => void }) {
  const id = lista.sesion.id_sesion;
  const evaluaciones = useData<Evaluacion[]>(`/evaluaciones?sesion=${id}`);
  const resultados = useData<ResultadoEvaluacionItem[]>(`/resultados-evaluacion?sesion=${id}`);
  const [edicion, setEdicion] = useState<Evaluacion | "nueva" | null>(null);
  const [calificar, setCalificar] = useState<Evaluacion | null>(null);
  const [nota, setNota] = useState<ResultadoEvaluacionItem | null>(null);
  const programada = lista.sesion.estado_sesion === "PROGRAMADA";
  const asistieron = lista.estudiantes.filter(e => e.estado_asistencia === "PRESENTE");
  const asistenciaCompleta = lista.estudiantes.length > 0 && lista.estudiantes.every(e => e.estado_asistencia);
  return <>
    <section className="work-section">
      <div className="work-section-title"><h2>Evaluaciones de la sesión</h2>
        {programada && <button className="work-primary" onClick={() => setEdicion("nueva")}>Crear evaluación</button>}</div>
      <Status {...evaluaciones} retry={evaluaciones.reload} /><Status {...resultados} retry={resultados.reload} />
      {evaluaciones.data && <Table rows={evaluaciones.data.filter(e => e.id_sesion === id)} rowKey={e => e.id_evaluacion} columns={[
        { label: "Tipo", cell: e => e.tipo_evaluacion },
        { label: "Descripción", cell: e => e.descripcion ?? "—" },
        { label: "Acciones", cell: e => <div className="work-inline">
          {programada && <button className="work-link" onClick={() => setEdicion(e)}>Editar</button>}
          {programada && asistenciaCompleta && resultados.data && !resultados.data.some(r => r.id_evaluacion === e.id_evaluacion) &&
            <button className="work-link" onClick={() => setCalificar(e)}>Registrar notas</button>}
        </div> },
      ]} />}
      {!asistenciaCompleta && programada && <p className="work-muted"><Link className="work-link" to={`/asistencia?grupo=${lista.sesion.id_grupo}&sesion=${id}`}>Completar asistencia para calificar</Link></p>}
    </section>
    {resultados.data && <section className="work-section"><h2>Calificaciones</h2>
      <Table rows={resultados.data.filter(r => r.id_sesion === id)} rowKey={r => r.id_resultado} columns={[
        { label: "Estudiante", cell: r => `${r.nombres} ${r.apellidos}` },
        { label: "Evaluación", cell: r => r.tipo_evaluacion },
        { label: "Nota", numeric: true, cell: r => r.nota ?? "—" },
        { label: "Estado", cell: r => label(r.estado_resultado) },
        { label: "Acción", cell: r => r.estado_resultado === "CALIFICADO" && lista.sesion.estado_sesion !== "CANCELADA" ? <button className="work-link" onClick={() => setNota(r)}>Editar nota</button> : "—" },
      ]} />
    </section>}
    {edicion && <Modal isOpen onClose={() => setEdicion(null)} title={edicion === "nueva" ? "Crear evaluación" : "Editar evaluación"}>
      <EditForm fields={[
        { name: "tipo_evaluacion", label: "Tipo de evaluación", max: 50 },
        { name: "descripcion", label: "Descripción", type: "textarea", required: false },
      ]} initial={edicion === "nueva" ? {} : edicion} onSave={async data => {
        await api(edicion === "nueva" ? "/evaluaciones" : `/evaluaciones/${edicion.id_evaluacion}`,
          edicion === "nueva" ? "POST" : "PATCH", { ...data, id_sesion: id });
        setEdicion(null); evaluaciones.reload();
      }} />
    </Modal>}
    {calificar && <Modal isOpen onClose={() => setCalificar(null)} title="Registrar calificaciones">
      <p className="work-muted mb-4">Las notas van de 0 a 100. Las ausencias se registran como «No se presentó».</p>
      <EditForm fields={asistieron.map(e => ({ name: String(e.id_inscripcion), label: `${e.nombres} ${e.apellidos}`, type: "number", min: 0, max: 100, step: "0.01" }))}
        onSave={async data => {
          await api(`/resultados-evaluacion/evaluacion/${calificar.id_evaluacion}`, "POST", {
            resultados: Object.entries(data).map(([inscripcion, nota]) => ({ id_inscripcion: Number(inscripcion), nota })),
          });
          setCalificar(null); resultados.reload(); onChange();
        }} />
    </Modal>}
    {nota && <Modal isOpen onClose={() => setNota(null)} title="Editar calificación">
      <EditForm fields={[{ name: "nota", label: "Nota", type: "number", min: 0, max: 100, step: "0.01" }]} initial={{ nota: nota.nota } as Row}
        onSave={async data => { await api(`/resultados-evaluacion/${nota.id_resultado}`, "PATCH", data); setNota(null); resultados.reload(); }} />
    </Modal>}
  </>;
}
