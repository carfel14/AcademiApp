import { useState } from "react";
import Modal from "../../components/ui/Modal";
import { api } from "../../services/api";
import type { Curso } from "../../types/curso";
import { Catalog, EditForm, Heading, Select, Status, Table, type Field, type Row } from "./ui";
import { date, label, money, options, useData } from "./datos";

const nombre: Field = { name: "nombre", label: "Nombre", max: 150 };
const descripcion: Field = { name: "descripcion", label: "Descripción", type: "textarea", max: 500, required: false };
const orden: Field = { name: "orden", label: "Orden", type: "number", min: 1, max: 32767 };

export function PlanesPage({ editable }: { editable: boolean }) {
  const [curso, setCurso] = useState("");
  const cursos = useData<Curso[]>("/cursos");
  return <>
    <Heading title="Planes de estudio" detail="Organiza el contenido de cada curso en planes, unidades y temas." />
    <div className="work-toolbar"><Select name="Curso" value={curso} onChange={setCurso} items={(cursos.data ?? []).map(c => ({ value: c.id_curso, label: c.nombre_curso }))} /></div>
    <Status {...cursos} retry={cursos.reload} />
    {curso ? <PlanCurso key={curso} curso={Number(curso)} editable={editable} /> : <p className="work-muted">Selecciona un curso.</p>}
  </>;
}

function PlanCurso({ curso, editable }: { curso: number; editable: boolean }) {
  const [plan, setPlan] = useState("");
  const [unidad, setUnidad] = useState("");
  const [version, setVersion] = useState(0);
  const planes = useData<Row[]>(`/planes/planes?padre=${curso}&revision=${version}`);
  const unidades = useData<Row[]>(plan ? `/planes/unidades?padre=${plan}&revision=${version}` : null);
  return <>
    <Catalog title="Planes del curso" singular="plan" path="/planes/planes" id="id_plan" editable={editable}
      parent={{ key: "id_curso", id: curso }} onChange={() => setVersion(v => v + 1)}
      fields={[nombre, descripcion, { name: "version", label: "Versión", type: "number", min: 1, max: 32767 },
        { name: "estado", label: "Estado", options: options(["ACTIVO", "INACTIVO"]) }]}
      defaults={{ version: 1, estado: "ACTIVO" }} />
    <Status {...planes} retry={planes.reload} />
    <div className="work-toolbar"><Select name="Plan" value={plan} onChange={v => { setPlan(v); setUnidad(""); }}
      items={(planes.data ?? []).map(p => ({ value: Number(p.id_plan), label: `${p.nombre} · versión ${p.version}` }))} /></div>
    {plan && <>
      <Catalog key={plan} title="Unidades del plan" singular="unidad" path="/planes/unidades" id="id_unidad" editable={editable}
        parent={{ key: "id_plan", id: Number(plan) }} fields={[nombre, descripcion, orden]} onChange={() => setVersion(v => v + 1)} />
      <Status {...unidades} retry={unidades.reload} />
      <div className="work-toolbar"><Select name="Unidad" value={unidad} onChange={setUnidad}
        items={(unidades.data ?? []).map(u => ({ value: Number(u.id_unidad), label: String(u.nombre) }))} /></div>
      {unidad && <Catalog key={unidad} title="Temas de la unidad" singular="tema" path="/planes/temas" id="id_tema" editable={editable}
        parent={{ key: "id_unidad", id: Number(unidad) }} fields={[nombre, descripcion, orden, {
          name: "modalidad", label: "Modalidad", options: [{ value: "TEORICO", label: "Teórico" }, { value: "PRACTICO", label: "Práctico" }, { value: "DEMOSTRACION", label: "Demostración" }],
        }, { name: "horas_estimadas", label: "Horas estimadas", type: "number", required: false, min: 0.01, max: 999.99, step: "0.01" }]} />}
    </>}
  </>;
}

export function UsuariosPage() {
  const users = useData<Row[]>("/auth/usuarios");
  const roles = useData<Row[]>("/auth/roles");
  const [edit, setEdit] = useState<Row | null>(null);
  return <>
    <Heading title="Usuarios y roles" detail="Administra las cuentas que pueden ingresar al sistema."
      action={<button className="work-primary" disabled={!roles.data?.length} onClick={() => setEdit({ activo: true })}>Crear usuario</button>} />
    <Status {...roles} retry={roles.reload} /><Status {...users} retry={users.reload} />
    {roles.data && <dl className="work-summary">{roles.data.map(r => <div key={Number(r.id_rol)}><dt>{r.nombre}</dt><dd className="text-sm">{r.descripcion}</dd></div>)}</dl>}
    {users.data && <Table rows={users.data} rowKey={u => Number(u.id_usuario)} columns={[
      { label: "Usuario", cell: u => u.username }, { label: "Nombre", cell: u => `${u.nombres} ${u.apellidos}` },
      { label: "Rol", cell: u => u.rol }, { label: "Estado", cell: u => <span className="work-tag">{u.activo ? "Activo" : "Inactivo"}</span> },
      { label: "Acción", cell: u => <button className="work-link" onClick={() => setEdit(u)}>Editar</button> },
    ]} />}
    {edit && <Modal isOpen onClose={() => setEdit(null)} title={edit.id_usuario ? "Editar usuario" : "Crear usuario"}>
      <EditForm fields={[
        { name: "username", label: "Usuario", max: 50 },
        { name: "nombres", label: "Nombres", max: 100 },
        { name: "apellidos", label: "Apellidos", max: 100 },
        { name: "id_rol", label: "Rol", options: (roles.data ?? []).map(r => ({ value: Number(r.id_rol), label: String(r.nombre) })) },
        { name: "password", label: edit.id_usuario ? "Nueva contraseña (opcional)" : "Contraseña (mínimo 10 caracteres)", type: "password", min: 10, max: 128, required: !edit.id_usuario },
        { name: "activo", label: "Cuenta activa", type: "checkbox" },
      ]} initial={edit} onSave={async data => {
        await api(edit.id_usuario ? `/auth/usuarios/${edit.id_usuario}` : "/auth/usuarios", edit.id_usuario ? "PATCH" : "POST", data);
        setEdit(null); users.reload();
      }} />
    </Modal>}
  </>;
}

export function BitacoraPage() {
  const query = useData<Row[]>("/bitacora");
  const [search, setSearch] = useState("");
  return <>
    <Heading title="Bitácora" detail="Consulta las 500 operaciones más recientes." />
    <div className="work-toolbar"><label className="work-filter">Buscar operación<input value={search} type="search" onChange={e => setSearch(e.target.value)} placeholder="Usuario, tabla o acción" /></label></div>
    <Status {...query} retry={query.reload} />
    {query.data && <Table rows={query.data.filter(r => [r.username, r.tabla, r.accion, r.id_registro].join(" ").toLowerCase().includes(search.trim().toLowerCase()))}
      rowKey={r => String(r.id_bitacora)} columns={[
        { label: "Fecha", cell: r => new Intl.DateTimeFormat("es-NI", { dateStyle: "short", timeStyle: "short", timeZone: "America/Managua" }).format(new Date(String(r.fecha))) },
        { label: "Usuario", cell: r => r.username ?? "—" }, { label: "Operación", cell: r => ({ INSERT: "Creación", UPDATE: "Modificación", DELETE: "Eliminación", LOGIN: "Inicio de sesión", LOGOUT: "Cierre de sesión" })[String(r.accion)] ?? r.accion },
        { label: "Tabla", cell: r => r.tabla }, { label: "Registro", numeric: true, cell: r => r.id_registro ?? "—" },
        { label: "Detalle", cell: r => r.detalle ?? "—" },
      ]} />}
  </>;
}

export function ReportesPage() {
  const [curso, setCurso] = useState("");
  const [tab, setTab] = useState("cursos");
  const cursos = useData<Curso[]>("/cursos");
  const data = useData<Record<string, Row[]>>(`/reportes${curso ? `?curso=${curso}` : ""}`);
  const tabs = [["cursos", "Por curso"], ["estudiantes", "Estudiantes"], ["vencidas", "Obligaciones vencidas"], ["pagos", "Pagos recibidos"]];
  return <>
    <Heading title="Reportes" detail="Consulta ingresos, obligaciones vencidas y rendimiento académico." />
    <div className="work-toolbar"><Select name="Curso" value={curso} onChange={setCurso} placeholder="Todos los cursos" items={(cursos.data ?? []).map(c => ({ value: c.id_curso, label: c.nombre_curso }))} /></div>
    <div className="work-tabs" aria-label="Reporte">{tabs.map(([value, title]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{title}</button>)}</div>
    <Status {...cursos} retry={cursos.reload} /><Status {...data} retry={data.reload} />
    {data.data && <section className="work-section"><h2>{tabs.find(t => t[0] === tab)?.[1]}</h2>
      {tab === "cursos" && <Table rows={data.data.cursos} rowKey={r => Number(r.id_curso)} columns={[
        { label: "Curso", cell: r => r.nombre_curso }, { label: "Estudiantes", numeric: true, cell: r => r.estudiantes },
        { label: "Inscripciones", numeric: true, cell: r => r.inscripciones }, { label: "Ingresos", numeric: true, cell: r => money(Number(r.ingresos)) },
      ]} />}
      {tab === "estudiantes" && <Table rows={data.data.estudiantes} rowKey={r => Number(r.id_inscripcion)} columns={[
        { label: "Estudiante", cell: r => r.estudiante }, { label: "Curso / grupo", cell: r => `${r.nombre_curso} · ${r.nombre_grupo}` },
        { label: "Inscripción", cell: r => label(String(r.estado_inscripcion)) },
        { label: "Presentes / registros", numeric: true, cell: r => `${r.presentes} / ${r.asistencias}` },
        { label: "Promedio / 100", numeric: true, cell: r => r.promedio ?? "—" },
      ]} />}
      {tab === "vencidas" && <Table rows={data.data.vencidas} rowKey={r => Number(r.id_obligacion)} columns={[
        { label: "Estudiante", cell: r => r.estudiante }, { label: "Curso", cell: r => r.nombre_curso },
        { label: "Concepto", cell: r => r.tipo_obligacion === "MATRICULA" ? "Matrícula" : "Mensualidad" },
        { label: "Vencimiento", cell: r => date(String(r.vencimiento_efectivo)) },
        { label: "Saldo", numeric: true, cell: r => money(Number(r.saldo_pendiente)) },
      ]} />}
      {tab === "pagos" && <Table rows={data.data.pagos} rowKey={r => Number(r.id_pago)} columns={[
        { label: "Fecha", cell: r => date(String(r.fecha_pago)) }, { label: "Estudiante", cell: r => r.estudiante },
        { label: "Curso", cell: r => r.nombre_curso }, { label: "Método", cell: r => label(String(r.metodo_pago)) },
        { label: "Monto", numeric: true, cell: r => money(Number(r.monto_pagado)) },
      ]} />}
    </section>}
  </>;
}
