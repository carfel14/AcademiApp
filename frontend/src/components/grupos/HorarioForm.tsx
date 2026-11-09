import { useState, type FormEvent } from "react";
import type { Horario } from "../../types/horario";

interface HorarioFormProps {
  horario?: Horario;
  onSubmit: (data: Omit<Horario, "id_horario" | "id_grupo">) => Promise<void>;
}

const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function HorarioForm({ horario, onSubmit }: HorarioFormProps) {
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const dia_semana = String(fields.get("dia"));
    const hora_inicio = String(fields.get("inicio"));
    const hora_fin = String(fields.get("fin"));
    if (hora_inicio >= hora_fin) {
      setError("La hora de fin debe ser posterior a la de inicio.");
      return;
    }
    setError("");
    setGuardando(true);
    try {
      await onSubmit({ dia_semana, hora_inicio, hora_fin });
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar el horario.");
    } finally {
      setGuardando(false);
    }
  }

  return <form className="work-form" onSubmit={submit}>
    <label>Día<select name="dia" defaultValue={horario?.dia_semana ?? "LUNES"}>
      {dias.map(dia => <option key={dia} value={dia.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()}>{dia}</option>)}
    </select></label>
    <label>Hora de inicio<input name="inicio" type="time" required defaultValue={horario?.hora_inicio.match(/\d{2}:\d{2}/)?.[0]} /></label>
    <label>Hora de fin<input name="fin" type="time" required defaultValue={horario?.hora_fin.match(/\d{2}:\d{2}/)?.[0]} /></label>
    {error && <p className="work-error" role="alert">{error}</p>}
    <div className="work-actions"><button className="work-primary" disabled={guardando}>{guardando ? "Guardando…" : horario ? "Guardar horario" : "Agregar horario"}</button></div>
  </form>;
}
