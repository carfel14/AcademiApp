import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import { api } from "../../services/api";
import type { Inscripcion } from "../../types/inscripcion";
import type { ObligacionPagoItem } from "../../types/obligacionPago";
import type { ProrrogaItem } from "../../types/prorroga";
import { Catalog, EditForm, Heading, Select, Status, Table, type Field, type Row } from "./ui";
import { date, label, money, options, today, useData } from "./datos";

type Obligacion = ObligacionPagoItem & { vencimiento_efectivo: string; monto_ajustado: number; total_descuento: number; total_recargo: number };
type Pago = { id_pago: number; fecha_pago: string; monto_pagado: number; metodo_pago: string; observacion: string | null };
type Cuenta = { obligacion: Obligacion; pagos: Pago[]; prorroga: ProrrogaItem | null; descuentos: Row[]; recargos: Row[] };
const estado: Field = { name: "estado", label: "Estado", options: options(["ACTIVO", "INACTIVO"]) };
const concepto = (o: Obligacion) => o.tipo_obligacion === "MATRICULA" ? "Matrícula" : `Mensualidad ${o.numero_cuota}`;

export function CobrosPage() {
  const [params, setParams] = useSearchParams();
  const inscripcion = Number(params.get("inscripcion")) || 0;
  const id = Number(params.get("obligacion")) || 0;
  const [search, setSearch] = useState("");
  const [catalogo, setCatalogo] = useState(false);
  const inscripciones = useData<Inscripcion[]>("/inscripciones");
  const obligaciones = useData<Obligacion[]>(inscripcion ? `/obligaciones-pago/inscripcion/${inscripcion}` : null);
  const descuentos = useData<Row[]>("/cobros/catalogos/descuentos");
  const cuenta = useData<Cuenta>(id ? `/cobros/${id}` : null);
  const coincidencias = (inscripciones.data ?? []).filter(i =>
    `${i.nombre_estudiante} ${i.apellido_estudiante} ${i.nombre_grupo} ${i.nombre_curso}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    || i.id_inscripcion === inscripcion);
  const [action, setAction] = useState<"pago" | "prórroga" | "descuento" | "recargo" | null>(null);
  const o = cuenta.data?.obligacion;
  const fields: Record<string, Field[]> = {
    pago: [{ name: "monto_pagado", label: "Monto (C$)", type: "number", min: 0.01, max: o?.saldo_pendiente, step: "0.01" },
      { name: "fecha_pago", label: "Fecha del pago", type: "date", max: today() },
      { name: "metodo_pago", label: "Método de pago", options: options(["EFECTIVO", "TRANSFERENCIA", "TARJETA"]) }],
    "prórroga": [{ name: "fecha_inicio", label: "Desde", type: "date" }, { name: "fecha_fin", label: "Hasta", type: "date" }],
    descuento: [{ name: "id_descuento", label: "Descuento", options: (descuentos.data ?? []).filter(d => d.estado === "ACTIVO")
      .map(d => ({ value: Number(d.id_descuento), label: `${d.nombre} · ${d.tipo === "PORCENTAJE" ? `${d.valor}%` : money(Number(d.valor))}` })) }],
    recargo: [{ name: "monto", label: "Monto (C$)", type: "number", min: 0.01, max: 99999999.99, step: "0.01" }, { name: "motivo", label: "Motivo", max: 200 }],
  };
  return <>
    <Heading title="Cobros" detail="Consulta matrícula, mensualidades y saldos por inscripción."
      action={<button className="work-secondary" onClick={() => setCatalogo(!catalogo)}>{catalogo ? "Volver a cobros" : "Catálogo de descuentos"}</button>} />
    {catalogo ? <Catalog title="Descuentos" singular="descuento" path="/cobros/catalogos/descuentos" id="id_descuento"
      fields={[{ name: "nombre", label: "Nombre", max: 100 }, { name: "tipo", label: "Tipo", options: options(["PORCENTAJE", "MONTO_FIJO"]) },
        { name: "valor", label: "Valor", type: "number", min: 0.01, step: "0.01" }, estado]} defaults={{ estado: "ACTIVO" }} />
      : <>
        <div className="work-toolbar">
          <label className="work-filter">Buscar estudiante<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o curso" /></label>
          <Select name="Inscripción" value={inscripcion || ""} onChange={value => setParams(value ? { inscripcion: value } : {})}
            items={coincidencias.map(i => ({ value: i.id_inscripcion, label: `${i.nombre_estudiante} ${i.apellido_estudiante} · ${i.nombre_grupo}` }))} />
        </div>
        <Status {...inscripciones} retry={inscripciones.reload} />
        {!inscripcion && inscripciones.data && <p className="work-muted">{coincidencias.length ? "Selecciona la inscripción que quieres consultar." : "No hay inscripciones que coincidan."}</p>}
        <Status {...obligaciones} retry={obligaciones.reload} />
        {obligaciones.data && <section className="work-section"><h2>Obligaciones de pago</h2>
          <Table rows={obligaciones.data} rowKey={row => row.id_obligacion} columns={[
            { label: "Concepto", cell: concepto },
            { label: "Vencimiento", cell: row => date(row.vencimiento_efectivo) },
            { label: "Total", numeric: true, cell: row => money(row.monto_ajustado) },
            { label: "Pagado", numeric: true, cell: row => money(row.total_pagado) },
            { label: "Saldo", numeric: true, cell: row => money(row.saldo_pendiente) },
            { label: "Estado", cell: row => <span className="work-tag">{row.estado === "PENDIENTE" && date(row.vencimiento_efectivo) < today() ? "Vencida" : label(row.estado)}</span> },
            { label: "Acción", cell: row => <button className="work-link" onClick={() => setParams({ inscripcion: String(inscripcion), obligacion: String(row.id_obligacion) })}>Ver detalle</button> },
          ]} />
        </section>}
        {id > 0 && <Modal isOpen title={o ? concepto(o) : "Detalle de obligación"} maxWidth="max-w-3xl"
          onClose={() => { setAction(null); setParams({ inscripcion: String(inscripcion) }); }}>
          <Status {...cuenta} retry={cuenta.reload} />
          {cuenta.data && o && <>
            <dl className="work-summary">
              <div><dt>Monto original</dt><dd>{money(o.monto)}</dd></div>
              <div><dt>Descuentos</dt><dd>{money(o.total_descuento)}</dd></div>
              <div><dt>Recargos</dt><dd>{money(o.total_recargo)}</dd></div>
              <div><dt>Saldo pendiente</dt><dd>{money(o.saldo_pendiente)}</dd></div>
            </dl>
            {cuenta.data.prorroga && <p className="work-muted">Prórroga del {date(cuenta.data.prorroga.fecha_inicio)} al {date(cuenta.data.prorroga.fecha_fin)}.</p>}
            {cuenta.data.descuentos.length > 0 && <p className="work-muted">Descuentos aplicados · {cuenta.data.descuentos.map(d => d.nombre).join(", ")}</p>}
            {cuenta.data.recargos.length > 0 && <p className="work-muted">Recargos · {cuenta.data.recargos.map(r => `${r.motivo} (${money(Number(r.monto))})`).join(", ")}</p>}
            {o.estado === "PENDIENTE" && <div className="work-inline my-4">
              <button className="work-primary" onClick={() => setAction("pago")}>Registrar abono</button>
              <button className="work-secondary" onClick={() => setAction("prórroga")}>{cuenta.data.prorroga ? "Editar prórroga" : "Conceder prórroga"}</button>
              <button className="work-secondary" onClick={() => { descuentos.reload(); setAction("descuento"); }}>Aplicar descuento</button>
              <button className="work-secondary" onClick={() => setAction("recargo")}>Agregar recargo</button>
            </div>}
            {action && <section className="work-section">
              <div className="work-section-title"><h2>{label(action)}</h2><button className="work-link" onClick={() => setAction(null)}>Volver al detalle</button></div>
              {action === "descuento" && <Status {...descuentos} retry={descuentos.reload} />}
              {action === "descuento" && descuentos.data && !fields.descuento[0].options?.length
                ? <p className="work-muted">Crea un descuento activo en el catálogo para aplicarlo.</p>
                : <EditForm key={action} fields={[...fields[action], ...(["pago", "prórroga"].includes(action) ? [{ name: "observacion", label: "Observación", type: "textarea" as const, required: false }] : [])]}
                  initial={action === "pago" ? { fecha_pago: today() } : action === "prórroga" && cuenta.data.prorroga ? { ...cuenta.data.prorroga } : {}}
                  onSave={async data => {
                    const prorroga = cuenta.data?.prorroga;
                    if (action === "pago") await api("/pagos", "POST", { ...data, id_obligacion: id });
                    else if (action === "prórroga") await api(prorroga ? `/prorrogas/${prorroga.id_prorroga}` : "/prorrogas", prorroga ? "PATCH" : "POST", { ...data, id_obligacion: id });
                    else await api(`/cobros/${id}/${action}`, "POST", data);
                    setAction(null); cuenta.reload(); obligaciones.reload();
                  }} />}
            </section>}
            <section className="work-section"><h2>Pagos recibidos</h2>
              <Table rows={cuenta.data.pagos} rowKey={p => p.id_pago} columns={[
                { label: "Fecha", cell: p => date(p.fecha_pago) }, { label: "Método", cell: p => label(p.metodo_pago) },
                { label: "Monto", numeric: true, cell: p => money(p.monto_pagado) },
                { label: "Observación", cell: p => p.observacion ?? "—" },
              ]} />
            </section>
          </>}
        </Modal>}
      </>}
  </>;
}

export function RecordatoriosPage() {
  const [tab, setTab] = useState("generados");
  const [notice, setNotice] = useState("");
  const [cancela, setCancela] = useState<Row | null>(null);
  const lista = useData<Row[]>(tab === "generados" ? "/recordatorios" : null);
  const plantillas = useData<Row[]>(tab === "reglas" ? "/recordatorios/catalogos/plantillas" : null);
  return <>
    <Heading title="Recordatorios" detail="Configura y registra avisos de vencimiento. El registro queda disponible para revisión." />
    <div className="work-tabs" aria-label="Vista de recordatorios">
      {[["generados", "Generados"], ["plantillas", "Plantillas"], ["reglas", "Reglas"]].map(([value, title]) =>
        <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{title}</button>)}
    </div>
    {tab === "plantillas" && <Catalog key={tab} title="Plantillas de mensajes" singular="plantilla" path="/recordatorios/catalogos/plantillas" id="id_plantilla"
      fields={[{ name: "nombre", label: "Nombre", max: 100 }, { name: "canal", label: "Canal", options: options(["EMAIL", "WHATSAPP", "SMS"]) },
        { name: "asunto", label: "Asunto", max: 150, required: false }, { name: "cuerpo", label: "Mensaje", type: "textarea", max: 5000 }, estado]}
      defaults={{ estado: "ACTIVO" }} />}
    {tab === "reglas" && <>
      <Status {...plantillas} retry={plantillas.reload} />
      <p className="work-muted">Días relativos al vencimiento: −3 avisa tres días antes, 0 el mismo día y 3 tres días después.</p>
      {plantillas.data?.length ? <Catalog key={tab} title="Reglas de vencimiento" singular="regla" path="/recordatorios/catalogos/reglas" id="id_regla"
        fields={[{ name: "id_plantilla", label: "Plantilla", options: plantillas.data.map(p => ({ value: Number(p.id_plantilla), label: String(p.nombre) })) },
          { name: "dias_respecto_vencimiento", label: "Días relativos al vencimiento", type: "number", min: -365, max: 365 }, estado]}
        defaults={{ estado: "ACTIVO", dias_respecto_vencimiento: 0 }} /> : <p className="work-muted">Crea primero una plantilla.</p>}
    </>}
    {tab === "generados" && <>
      <section className="work-section"><h2>Generar por fecha</h2>
        <EditForm fields={[{ name: "fecha", label: "Fecha programada", type: "date" }]} initial={{ fecha: today() }}
          saveLabel="Generar recordatorios" onSave={async data => {
            const result = await api<{ total: number }>("/recordatorios/generar", "POST", data);
            setNotice(result.total ? `Recordatorios generados: ${result.total}.` : "No hay recordatorios nuevos para esa fecha.");
            lista.reload();
          }} />
        {notice && <p className="work-notice" role="status">{notice}</p>}
      </section>
      <section className="work-section"><h2>Historial de recordatorios</h2>
        <Status {...lista} retry={lista.reload} />
        {lista.data && <Table rows={lista.data} rowKey={n => Number(n.id_notificacion)} columns={[
          { label: "Fecha", cell: n => date(String(n.fecha_programada)) }, { label: "Estudiante", cell: n => n.estudiante },
          { label: "Plantilla", cell: n => n.plantilla }, { label: "Destino", cell: n => <>{n.destino}<small className="block work-muted">{n.canal}</small></> },
          { label: "Estado", cell: n => <span className="work-tag">{label(String(n.estado_envio))}</span> },
          { label: "Acciones", cell: n => <div className="work-inline">
            {n.id_obligacion && <Link className="work-link" to={`/cobros?inscripcion=${n.id_inscripcion}&obligacion=${n.id_obligacion}`}>Ver cobro</Link>}
            {n.estado_envio === "PENDIENTE" && <button className="work-link" onClick={() => setCancela(n)}>Cancelar</button>}
          </div> },
        ]} />}
      </section>
    </>}
    {cancela && <Modal isOpen onClose={() => setCancela(null)} title="Cancelar recordatorio">
      <p className="work-muted">Se cancelará el recordatorio de {cancela.estudiante}.</p>
      <EditForm fields={[]} saveLabel="Cancelar recordatorio" onSave={async () => {
        await api(`/recordatorios/${cancela.id_notificacion}/cancelar`, "PATCH"); setCancela(null); lista.reload();
      }} />
    </Modal>}
  </>;
}
