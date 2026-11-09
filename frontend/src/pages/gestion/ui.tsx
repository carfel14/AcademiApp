import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "../../services/api";
import { message, useData } from "./datos";
import Modal from "../../components/ui/Modal";

export type Row = Record<string, string | number | boolean | null>;
export type Option = { value: string | number; label: string };
export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "password" | "textarea" | "checkbox";
  options?: Option[];
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: string;
};
type Column<T> = { label: string; cell: (row: T) => ReactNode; numeric?: boolean };

export function Status({ error, loading, retry }: { error?: string; loading?: boolean; retry?: () => void }) {
  if (error) return <p className="work-error" role="alert">{error} {retry && <button onClick={retry} className="work-link">Reintentar</button>}</p>;
  return loading ? <p className="work-muted" role="status">Cargando…</p> : null;
}

export function Heading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="work-heading"><div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>;
}

export function Select({ name, value, onChange, items, placeholder = "Selecciona una opción" }: {
  name: string; value: string | number; onChange: (value: string) => void; items: Option[]; placeholder?: string;
}) {
  return <label className="work-filter">{name}<select value={value} onChange={e => onChange(e.target.value)}>
    <option value="">{placeholder}</option>
    {items.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select></label>;
}

export function Table<T>({ rows, columns, rowKey, stack = false, empty = "Todavía no hay registros." }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string | number; empty?: string; stack?: boolean;
}) {
  return <div className="work-table-wrap"><table className={stack ? "work-table work-table-stack" : "work-table"}>
    <thead><tr>{columns.map(col => <th key={col.label} scope="col" className={col.numeric ? "numeric" : ""}>{col.label}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map(row => <tr key={rowKey(row)}>{columns.map(col => <td key={col.label} className={col.numeric ? "numeric" : ""}>{stack && <span className="work-mobile-label" aria-hidden="true">{col.label}</span>}<div>{col.cell(row)}</div></td>)}</tr>)
      : <tr><td className="work-muted" colSpan={columns.length}>{empty}</td></tr>}</tbody>
  </table></div>;
}

export function EditForm({ fields, initial = {}, onSave, saveLabel = "Guardar" }: {
  fields: Field[]; initial?: Row; onSave: (data: Row) => Promise<void>; saveLabel?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(fields.map(field => {
      const raw = String(form.get(field.name) ?? "");
      const isNumber = field.type === "number" || typeof field.options?.[0]?.value === "number";
      return [field.name, field.type === "checkbox" ? form.has(field.name) : raw === "" ? null : isNumber ? Number(raw) : raw];
    }));
    setBusy(true);
    setError("");
    try { await onSave(data); } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <form className="work-form" onSubmit={submit}>
    {fields.map(field => {
      const value = initial[field.name];
      const inputValue = field.type === "date" ? String(value ?? "").slice(0, 10) : String(value ?? "");
      return <label key={field.name} className={field.type === "textarea" ? "work-span" : field.type === "checkbox" ? "work-check" : ""}>
        {field.label}
        {field.options ? <select name={field.name} required={field.required !== false} defaultValue={inputValue}>
          <option value="">Selecciona</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select> : field.type === "textarea"
          ? <textarea name={field.name} rows={3} required={field.required !== false} defaultValue={inputValue} maxLength={Number(field.max) || undefined} />
          : <input name={field.name} type={field.type ?? "text"} required={field.type !== "checkbox" && field.required !== false}
            defaultChecked={field.type === "checkbox" ? Boolean(value) : undefined}
            defaultValue={field.type === "checkbox" ? undefined : inputValue} min={field.min}
            max={field.type === "number" || field.type === "date" ? field.max : undefined}
            minLength={field.type === "password" ? Number(field.min) || undefined : undefined}
            maxLength={["text", "password", undefined].includes(field.type) ? Number(field.max) || undefined : undefined} step={field.step} />}
      </label>;
    })}
    {error && <p className="work-error work-span" role="alert">{error}</p>}
    <div className="work-actions"><button className="work-primary" disabled={busy}>{busy ? "Guardando…" : saveLabel}</button></div>
  </form>;
}

export function Catalog({ title, singular, path, id, fields, defaults, parent, editable = true, onChange }: {
  title: string; singular: string; path: string; id: string; fields: Field[]; defaults?: Row; parent?: { key: string; id: number };
  editable?: boolean; onChange?: () => void;
}) {
  const query = useData<Row[]>(parent?.id === 0 ? null : path + (parent ? `?padre=${parent.id}` : ""));
  const [editing, setEditing] = useState<Row | null>(null);
  const columns: Column<Row>[] = fields.filter(f => f.type !== "textarea").map(field => ({
    label: field.label, numeric: field.type === "number",
    cell: row => field.options?.find(option => option.value === row[field.name])?.label ?? String(row[field.name] ?? "—"),
  }));
  if (editable) columns.push({ label: "Acción", cell: row => <button className="work-link" onClick={() => setEditing(row)}>Editar</button> });
  return <section className="work-section">
    <div className="work-section-title"><h2>{title}</h2>
      {editable && parent?.id !== 0 && <button className="work-secondary" onClick={() => setEditing(defaults ?? {})}>Agregar {singular}</button>}
    </div>
    <Status {...query} retry={query.reload} />
    {query.data && <Table rows={query.data} columns={columns} rowKey={row => Number(row[id])} />}
    {parent?.id === 0 && <p className="work-muted">Selecciona el registro del que depende.</p>}
    {editing && <Modal isOpen onClose={() => setEditing(null)} title={editing[id] ? `Editar ${singular}` : `Agregar ${singular}`}>
      <EditForm fields={fields} initial={editing} onSave={async data => {
        const target = editing[id];
        await api(target ? `${path}/${target}` : path, target ? "PATCH" : "POST",
          { ...data, ...(parent ? { [parent.key]: parent.id } : {}) });
        setEditing(null);
        query.reload();
        onChange?.();
      }} />
    </Modal>}
  </section>;
}
