import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useToast } from "../../context/ToastContext";

import {
  obtenerProfesores,
  crearProfesor,
  actualizarProfesor,
  eliminarProfesor as eliminarProfesorApi,
} from "../../services/profesorService";
import {
  obtenerAsignaciones,
  crearAsignacion,
  eliminarAsignacion,
} from "../../services/asignacionProfesorService";
import { obtenerGrupos } from "../../services/grupoService";
import { obtenerCursos } from "../../services/cursoService";

import type { Profesor } from "../../types/profesor";
import type { AsignacionProfesor } from "../../types/asignacionProfesor";
import type { Grupo } from "../../types/grupo";
import type { Curso } from "../../types/curso";
import type { ProfesorFormData } from "../../schema/profesorSchema";

import ProfesorTable from "../../components/profesores/ProfesorTable";
import ProfesorForm from "../../components/profesores/ProfesorForm";
import AdministrarAsignacionesModal from "../../components/profesores/AdministrarAsignacionesModal";
import Modal from "../../components/ui/Modal";

function ProfesoresPage() {
  const { toast } = useToast();

  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionProfesor[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [profesorSeleccionado, setProfesorSeleccionado] = useState<Profesor | undefined>();
  const [profesorParaAsignar, setProfesorParaAsignar] = useState<Profesor | undefined>();

  const cargarDatos = useCallback(async (refresh = true) => {
    try {
      if (refresh) setLoading(true);
      const [profesoresData, asignacionesData, gruposData, cursosData] = await Promise.all([
        obtenerProfesores(),
        obtenerAsignaciones(),
        obtenerGrupos(),
        obtenerCursos(),
      ]);

      setProfesores(profesoresData);
      setAsignaciones(asignacionesData);
      setGrupos(gruposData);
      setCursos(cursosData);
    } catch {
      toast.warning("No se pudieron cargar los datos de profesores");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void cargarDatos(false); });
    return () => { active = false; };
  }, [cargarDatos]);

  function abrirModalCrear() {
    setProfesorSeleccionado(undefined);
    setModalAbierto(true);
  }

  function abrirModalEditar(profesor: Profesor) {
    setProfesorSeleccionado(profesor);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setProfesorSeleccionado(undefined);
  }

  async function handleGuardarProfesor(data: ProfesorFormData) {
    try {
      if (profesorSeleccionado) {
        const profesorActualizado = await actualizarProfesor(
          profesorSeleccionado.id_profesor,
          data
        );

        setProfesores((actuales) =>
          actuales.map((p) =>
            p.id_profesor === profesorActualizado.id_profesor ? profesorActualizado : p
          )
        );
        toast.info("Profesor actualizado con éxito");
        cerrarModal();
        return;
      }

      const nuevoProfesor = await crearProfesor(data);
      setProfesores((actuales) => [...actuales, nuevoProfesor]);
      toast.success("Profesor registrado con éxito");
      cerrarModal();
    } catch (err) {
      toast.warning(
        err instanceof Error
          ? err.message
          : profesorSeleccionado
          ? "No se pudo actualizar el profesor"
          : "No se pudo crear el profesor"
      );
    }
  }

  async function handleEliminarProfesor(id: number) {
    try {
      await eliminarProfesorApi(id);
      setProfesores((actuales) => actuales.filter((p) => p.id_profesor !== id));
      toast.error("Profesor desactivado correctamente");
    } catch {
      toast.warning("No se pudo desactivar al profesor");
    }
  }

  async function handleAsignarGrupo(id_grupo: number) {
    if (!profesorParaAsignar) return;

    try {
      const nuevaAsignacion = await crearAsignacion({
        id_profesor: profesorParaAsignar.id_profesor,
        id_grupo,
      });

      setAsignaciones((actuales) => [...actuales, nuevaAsignacion]);
      toast.success("Grupo asignado al docente");
    } catch (err) {
      toast.warning(err instanceof Error ? err.message : "Error al asignar grupo");
      throw err;
    }
  }

  async function handleEliminarAsignacion(id_asignacion: number) {
    try {
      await eliminarAsignacion(id_asignacion);
      setAsignaciones((actuales) =>
        actuales.filter((a) => a.id_asignacion !== id_asignacion)
      );
      toast.error("Asignación desvinculada correctamente");
    } catch {
      toast.warning("No se pudo desvincular la asignación");
      throw new Error("No se pudo desvincular");
    }
  }

  const profesoresFiltrados = profesores.filter((p) => {
    const termino = busqueda.trim().toLowerCase();
    const nombreCompleto = `${p.nombres} ${p.apellidos}`.toLowerCase();
    const especialidad = (p.especialidad || "").toLowerCase();

    return nombreCompleto.includes(termino) || especialidad.includes(termino);
  });

  if (loading) {
    return <p className="text-gray-600 text-sm">Cargando profesores...</p>;
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profesores</h1>

        <button
          type="button"
          onClick={abrirModalCrear}
          className="group flex items-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-950/20 transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <Plus className="h-4 w-4 text-blue-200 transition group-hover:text-white" strokeWidth={2.5} />
          Nuevo profesor
        </button>
      </div>

      {/* Buscador */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar profesor por nombre o especialidad</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, apellidos o especialidad..."
            className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
      </div>

      {/* Lista / Tabla */}
      <ProfesorTable
        profesores={profesoresFiltrados}
        asignaciones={asignaciones}
        onEditar={abrirModalEditar}
        onEliminar={handleEliminarProfesor}
        onAdministrarAsignaciones={(profesor) => setProfesorParaAsignar(profesor)}
      />

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={modalAbierto}
        onClose={cerrarModal}
        title={profesorSeleccionado ? "Editar profesor" : "Nuevo profesor"}
      >
        <ProfesorForm profesor={profesorSeleccionado} onSubmit={handleGuardarProfesor} />
      </Modal>

      {/* Modal Administrar Asignaciones */}
      <Modal
        isOpen={Boolean(profesorParaAsignar)}
        onClose={() => setProfesorParaAsignar(undefined)}
        title={`Asignaciones: ${profesorParaAsignar ? `${profesorParaAsignar.nombres} ${profesorParaAsignar.apellidos}` : ""}`}
      >
        {profesorParaAsignar && (
          <AdministrarAsignacionesModal
            profesor={profesorParaAsignar}
            asignaciones={asignaciones}
            grupos={grupos}
            cursos={cursos}
            onAsignarGrupo={handleAsignarGrupo}
            onEliminarAsignacion={handleEliminarAsignacion}
            onClose={() => setProfesorParaAsignar(undefined)}
          />
        )}
      </Modal>
    </div>
  );
}

export default ProfesoresPage;