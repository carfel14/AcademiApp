import { useState } from "react";

import type { Grupo } from "../../types/grupo";
import type { Profesor } from "../../types/profesor";
import type { AsignacionProfesor } from "../../types/asignacionProfesor";
import type { Horario } from "../../types/horario";

interface AsignarProfesorFormProps {
  grupos: Grupo[];
  profesores: Profesor[];
  asignaciones: AsignacionProfesor[];
  horarios: Horario[];
  onSubmit: (idGrupo: number, idProfesor: number) => Promise<void>;
}

function AsignarProfesorForm({
  grupos,
  profesores,
  asignaciones,
  horarios,
  onSubmit,
}: AsignarProfesorFormProps) {
  const [idGrupo, setIdGrupo] = useState("");
  const [idProfesor, setIdProfesor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function haySolapamiento(horario: Horario, otroHorario: Horario) {
    return (
      horario.dia_semana === otroHorario.dia_semana &&
      horario.hora_inicio < otroHorario.hora_finalizacion &&
      horario.hora_finalizacion > otroHorario.hora_inicio
    );
  }

  function validarAsignacion(idGrupoSeleccionado: number, idProfesorSeleccionado: number) {
    const asignacionRepetida = asignaciones.some(
      (asignacion) =>
        asignacion.id_grupo === idGrupoSeleccionado &&
        asignacion.id_profesor === idProfesorSeleccionado
    );

    if (asignacionRepetida) {
      return "Este profesor ya está asignado a ese grupo.";
    }

    const gruposDelProfesor = asignaciones
      .filter((asignacion) => asignacion.id_profesor === idProfesorSeleccionado)
      .map((asignacion) => asignacion.id_grupo);
    const horariosDelGrupo = horarios.filter(
      (horario) => horario.id_grupo === idGrupoSeleccionado
    );
    const horariosDeOtrosGrupos = horarios.filter(
      (horario) => gruposDelProfesor.includes(horario.id_grupo)
    );

    if (
      horariosDelGrupo.some((horario) =>
        horariosDeOtrosGrupos.some((otroHorario) =>
          haySolapamiento(horario, otroHorario)
        )
      )
    ) {
      return "No se puede asignar: el profesor tiene sesiones que se solapan con este grupo.";
    }

    return "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!idGrupo || !idProfesor) {
      setError("Selecciona un grupo y un profesor.");
      return;
    }

    const errorDeHorario = validarAsignacion(Number(idGrupo), Number(idProfesor));

    if (errorDeHorario) {
      setError(errorDeHorario);
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      await onSubmit(Number(idGrupo), Number(idProfesor));
    } catch {
      setError("No se pudo asignar el profesor. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="grupo" className="block text-sm font-medium text-gray-700">
          Grupo
        </label>
        <select
          id="grupo"
          value={idGrupo}
          onChange={(event) => setIdGrupo(event.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="">Selecciona un grupo</option>
          {grupos.map((grupo) => (
            <option key={grupo.id_grupo} value={grupo.id_grupo}>
              {grupo.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="profesor" className="block text-sm font-medium text-gray-700">
          Profesor disponible
        </label>
        <select
          id="profesor"
          value={idProfesor}
          onChange={(event) => setIdProfesor(event.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="">Selecciona un profesor</option>
          {profesores.map((profesor) => (
            <option key={profesor.id_profesor} value={profesor.id_profesor}>
              {profesor.nombres} {profesor.apellidos}
              {profesor.especialidades.length ? ` - ${profesor.especialidades.map((e) => e.nombre).join(", ")}` : ""}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || profesores.length === 0}
        className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Asignando..." : "Confirmar asignación"}
      </button>

      {profesores.length === 0 && (
        <p className="text-sm text-gray-500">
          No hay profesores activos disponibles.
        </p>
      )}
    </form>
  );
}

export default AsignarProfesorForm;