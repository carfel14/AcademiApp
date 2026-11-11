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
    <div className="work-toolbar"><Select name="Curso" value={curso} onChange={setCurso} items={(cursos.data ?? []).map(c => ({ value: c.id_curso, label: c.nombre }))} /></div>
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
    <Catalog title="Planes del curso" singular="plan" path="/planes/planes" id="id_plan" editable={editable} eliminable
      parent={{ key: "id_curso", id: curso }} onChange={() => setVersion(v => v + 1)}
      fields={[nombre, descripcion, { name: "version", label: "Versión", type: "number", min: 1, max: 32767 },
        { name: "estado", label: "Estado", options: options(["ACTIVO", "INACTIVO"]) }]}
      defaults={{ version: 1, estado: "ACTIVO" }} />
    <Status {...planes} retry={planes.reload} />
    <div className="work-toolbar"><Select name="Plan" value={plan} onChange={v => { setPlan(v); setUnidad(""); }}
      items={(planes.data ?? []).map(p => ({ value: Number(p.id_plan), label: `${p.nombre} · versión ${p.version}` }))} /></div>
    {plan && <>
      <Catalog key={plan} title="Unidades del plan" singular="unidad" path="/planes/unidades" id="id_unidad" editable={editable} eliminable
        parent={{ key: "id_plan", id: Number(plan) }} fields={[nombre, descripcion, orden]} onChange={() => setVersion(v => v + 1)} />
      <Status {...unidades} retry={unidades.reload} />
      <div className="work-toolbar"><Select name="Unidad" value={unidad} onChange={setUnidad}
        items={(unidades.data ?? []).map(u => ({ value: Number(u.id_unidad), label: `${u.orden}. ${u.nombre}` }))} /></div>
      {unidad && <Catalog key={unidad} title="Temas de la unidad" singular="tema" path="/planes/temas" id="id_tema" editable={editable} eliminable
        parent={{ key: "id_unidad", id: Number(unidad) }} fields={[nombre, descripcion, orden, {
          name: "modalidad", label: "Modalidad", options: [{ value: "TEORICO", label: "Teórico" }, { value: "PRACTICO", label: "Práctico" }, { value: "DEMOSTRACION", label: "Demostración" }],
        }, { name: "horas_estimadas", label: "Horas estimadas", type: "number", required: false, min: 0.01, max: 999.99, step: "0.01" }]} />}
    </>}
  </>;
}

type Rol = { id_rol: number; nombre: string; descripcion: string | null };
type UsuarioFila = {
  id_usuario: number; id_profesor: number | null; usuario: string; email: string | null;
  ultimo_acceso: string | null; estado: "ACTIVO" | "INACTIVO"; profesor: string | null; roles: Rol[];
};
type ProfesorOpcion = { id_profesor: number; nombres: string; apellidos: string };

export function UsuariosPage() {
  const users = useData<UsuarioFila[]>("/auth/usuarios");
  const roles = useData<Rol[]>("/auth/roles");
  const profesores = useData<ProfesorOpcion[]>("/profesores");
  const [edit, setEdit] = useState<UsuarioFila | "nuevo" | null>(null);
  const actual = edit === "nuevo" ? null : edit;
  return <>
    <Heading title="Usuarios y roles" detail="Administra las cuentas que pueden ingresar al sistema. Un usuario puede tener varios roles."
      action={<button className="work-primary" disabled={!roles.data?.length} onClick={() => setEdit("nuevo")}>Crear usuario</button>} />
    <Status {...roles} retry={roles.reload} /><Status {...users} retry={users.reload} />
    {roles.data && <dl className="work-summary">{roles.data.map(r => <div key={r.id_rol}><dt>{r.nombre}</dt><dd className="text-sm">{r.descripcion}</dd></div>)}</dl>}
    {users.data && <Table rows={users.data} rowKey={u => u.id_usuario} columns={[
      { label: "Usuario", cell: u => <>{u.usuario}{u.email && <small className="block work-muted">{u.email}</small>}</> },
      { label: "Profesor", cell: u => u.profesor ?? "—" },
      { label: "Roles", cell: u => u.roles.map(r => r.nombre).join(", ") || "—" },
      { label: "Último acceso", cell: u => u.ultimo_acceso ? new Intl.DateTimeFormat("es-NI", { dateStyle: "short", timeStyle: "short" }).format(new Date(u.ultimo_acceso)) : "—" },
      { label: "Estado", cell: u => <span className="work-tag">{label(u.estado)}</span> },
      { label: "Acción", cell: u => <button className="work-link" onClick={() => setEdit(u)}>Editar</button> },
    ]} />}
    {edit && <Modal isOpen onClose={() => setEdit(null)} title={actual ? "Editar usuario" : "Crear usuario"}>
      <EditForm fields={[
        { name: "usuario", label: "Usuario", max: 50 },
        { name: "email", label: "Correo electrónico", max: 150, required: false },
        { name: "id_profesor", label: "Profesor vinculado (opcional)", required: false,
          options: (profesores.data ?? []).map(p => ({ value: p.id_profesor, label: `${p.nombres} ${p.apellidos}` })) },
        ...(roles.data ?? []).map(r => ({ name: `rol_${r.id_rol}`, label: `Rol ${r.nombre}`, type: "checkbox" as const })),
        { name: "contrasena", label: actual ? "Nueva contraseña (opcional)" : "Contraseña (mínimo 10 caracteres)", type: "password", min: 10, max: 128, required: !actual },
        { name: "estado", label: "Estado", options: options(["ACTIVO", "INACTIVO"]) },
      ]} initial={{
        usuario: actual?.usuario ?? "", email: actual?.email ?? "", id_profesor: actual?.id_profesor ?? "", estado: actual?.estado ?? "ACTIVO",
        ...Object.fromEntries((actual?.roles ?? []).map(r => [`rol_${r.id_rol}`, true])),
      }} onSave={async data => {
        const seleccionados = (roles.data ?? []).filter(r => data[`rol_${r.id_rol}`]).map(r => r.id_rol);
        if (!seleccionados.length) throw new Error("Selecciona al menos un rol.");
        const body = {
          usuario: data.usuario, email: data.email || null, id_profesor: data.id_profesor || null,
          estado: data.estado, roles: seleccionados, ...(data.contrasena ? { contrasena: data.contrasena } : {}),
        };
        await api(actual ? `/auth/usuarios/${actual.id_usuario}` : "/auth/usuarios", actual ? "PATCH" : "POST", body);
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
    {query.data && <Table rows={query.data.filter(r => [r.usuario, r.tabla, r.accion, r.id_registro].join(" ").toLowerCase().includes(search.trim().toLowerCase()))}
      rowKey={r => String(r.id_bitacora)} columns={[
        { label: "Fecha", cell: r => new Intl.DateTimeFormat("es-NI", { dateStyle: "short", timeStyle: "short", timeZone: "America/Managua" }).format(new Date(String(r.fecha))) },
        { label: "Usuario", cell: r => r.usuario ?? "—" }, { label: "Operación", cell: r => ({ INSERT: "Creación", UPDATE: "Modificación", DELETE: "Eliminación", LOGIN: "Inicio de sesión", LOGOUT: "Cierre de sesión" })[String(r.accion)] ?? r.accion },
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
    <div className="work-toolbar"><Select name="Curso" value={curso} onChange={setCurso} placeholder="Todos los cursos" items={(cursos.data ?? []).map(c => ({ value: c.id_curso, label: c.nombre }))} /></div>
    <div className="work-tabs" aria-label="Reporte">{tabs.map(([value, title]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{title}</button>)}</div>
    <Status {...cursos} retry={cursos.reload} /><Status {...data} retry={data.reload} />
    {data.data && <section className="work-section"><h2>{tabs.find(t => t[0] === tab)?.[1]}</h2>
      {tab === "cursos" && <Table rows={data.data.cursos} rowKey={r => Number(r.id_curso)} columns={[
        { label: "Curso", cell: r => r.curso }, { label: "Estudiantes", numeric: true, cell: r => r.estudiantes },
        { label: "Inscripciones", numeric: true, cell: r => r.inscripciones }, { label: "Ingresos", numeric: true, cell: r => money(Number(r.ingresos)) },
      ]} />}
      {tab === "estudiantes" && <Table rows={data.data.estudiantes} rowKey={r => Number(r.id_inscripcion)} columns={[
        { label: "Estudiante", cell: r => r.estudiante }, { label: "Curso / grupo", cell: r => `${r.curso} · ${r.grupo}` },
        { label: "Inscripción", cell: r => label(String(r.estado)) },
        { label: "Presentes / registros", numeric: true, cell: r => `${r.presentes} / ${r.asistencias}` },
        { label: "Promedio / 100", numeric: true, cell: r => r.promedio ?? "—" },
      ]} />}
      {tab === "vencidas" && <Table rows={data.data.vencidas} rowKey={r => Number(r.id_obligacion)} columns={[
        { label: "Estudiante", cell: r => r.estudiante }, { label: "Curso", cell: r => `${r.curso} · ${r.grupo}` },
        { label: "Concepto", cell: r => r.tipo === "MATRICULA" ? "Matrícula" : "Mensualidad" },
        { label: "Vencimiento", cell: r => date(String(r.fecha_vencimiento_efectiva)) },
        { label: "Días de mora", numeric: true, cell: r => r.dias_mora },
        { label: "Saldo", numeric: true, cell: r => money(Number(r.saldo_neto)) },
      ]} />}
      {tab === "pagos" && <Table rows={data.data.pagos} rowKey={r => Number(r.id_pago)} columns={[
        { label: "Fecha", cell: r => date(String(r.fecha_pago)) }, { label: "Estudiante", cell: r => r.estudiante },
        { label: "Curso", cell: r => r.curso }, { label: "Método", cell: r => label(String(r.metodo_pago)) },
        { label: "Monto", numeric: true, cell: r => money(Number(r.monto_pagado)) },
      ]} />}
    </section>}
  </>;
}
