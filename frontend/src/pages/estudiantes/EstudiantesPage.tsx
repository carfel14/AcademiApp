import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useToast } from "../../context/ToastContext";

import {
  obtenerEstudiantes,
  crearEstudiante,
  actualizarEstudiante,
  eliminarEstudiante as eliminarEstudianteApi,
} from "../../services/estudianteService";
import {
  obtenerInscripciones,
  cancelarInscripcion,
} from "../../services/inscripcionService";

import type { Estudiante } from "../../types/estudiante";
import type { Inscripcion } from "../../types/inscripcion";
import type { EstudianteFormData } from "../../schema/estudianteSchema";

import EstudianteTable from "../../components/estudiantes/EstudianteTable";
import EstudianteForm from "../../components/estudiantes/EstudianteForm";
import DetalleEstudianteModal from "../../components/estudiantes/DetalleEstudianteModal";
import Modal from "../../components/ui/Modal";

function EstudiantesPage() {
  const { toast } = useToast();

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);

  // Modales
  const [modalFormAbierto, setModalFormAbierto] = useState(false);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<Estudiante | undefined>();
  const [estudianteParaDetalle, setEstudianteParaDetalle] = useState<Estudiante | undefined>();

  const cargarDatos = useCallback(async (refresh = true) => {
    try {
      if (refresh) setLoading(true);
      const [estudiantesData, inscripcionesData] = await Promise.all([
        obtenerEstudiantes(),
        obtenerInscripciones(),
      ]);

      setEstudiantes(estudiantesData);
      setInscripciones(inscripcionesData);
    } catch {
      toast.warning("No se pudieron cargar los datos de estudiantes");
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
    setEstudianteSeleccionado(undefined);
    setModalFormAbierto(true);
  }

  function abrirModalEditar(estudiante: Estudiante) {
    setEstudianteSeleccionado(estudiante);
    setModalFormAbierto(true);
  }

  function cerrarModalForm() {
    setModalFormAbierto(false);
    setEstudianteSeleccionado(undefined);
  }

  async function handleGuardarEstudiante(data: EstudianteFormData) {
    try {
      if (estudianteSeleccionado) {
        const actualizado = await actualizarEstudiante(estudianteSeleccionado.id_estudiante, data);
        setEstudiantes((prev) =>
          prev.map((e) => (e.id_estudiante === actualizado.id_estudiante ? actualizado : e))
        );
        toast.info("Estudiante actualizado con éxito");
        cerrarModalForm();
        return;
      }

      const nuevo = await crearEstudiante(data);
      setEstudiantes((prev) => [...prev, nuevo]);
      toast.success("Estudiante registrado con éxito");
      cerrarModalForm();
    } catch (err) {
      toast.warning(
        err instanceof Error
          ? err.message
          : estudianteSeleccionado
          ? "No se pudo actualizar el estudiante"
          : "No se pudo crear el estudiante"
      );
    }
  }

  async function handleDesactivarEstudiante(id: number) {
    try {
      await eliminarEstudianteApi(id);
      setEstudiantes((prev) => prev.filter((e) => e.id_estudiante !== id));
      toast.error("Estudiante desactivado correctamente");
    } catch {
      toast.warning("No se pudo desactivar al estudiante");
    }
  }

  async function handleCancelarInscripcion(id_inscripcion: number) {
    try {
      await cancelarInscripcion(id_inscripcion);
      setInscripciones((prev) =>
        prev.map((i) =>
          i.id_inscripcion === id_inscripcion ? { ...i, estado: "CANCELADA" as const } : i
        )
      );
      toast.error("Inscripción cancelada");
    } catch (err) {
      toast.warning(err instanceof Error ? err.message : "No se pudo cancelar la inscripción");
    }
  }

  const estudiantesFiltrados = estudiantes.filter((e) => {
    const termino = busqueda.trim().toLowerCase();
    const nombreCompleto = `${e.nombres} ${e.apellidos}`.toLowerCase();
    const codigo = (e.codigo || "").toLowerCase();
    const tel = (e.telefono || "").toLowerCase();

    const coincideTexto =
      nombreCompleto.includes(termino) || codigo.includes(termino) || tel.includes(termino);

    const coincideEstado =
      estadoFiltro === "todos" || e.estado.toLowerCase() === estadoFiltro;

    return coincideTexto && coincideEstado;
  });

  if (loading) {
    return <p className="text-gray-600 text-sm">Cargando estudiantes...</p>;
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Estudiantes</h1>

        <button
          type="button"
          onClick={abrirModalCrear}
          className="group flex items-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-950/20 transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <Plus className="h-4 w-4 text-blue-200 transition group-hover:text-white" strokeWidth={2.5} />
          Nuevo estudiante
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar por nombre, código o teléfono</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombres, apellidos o teléfono..."
            className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap font-medium">Estado</span>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
      </div>

      {/* Tabla */}
      <EstudianteTable
        estudiantes={estudiantesFiltrados}
        onVerDetalle={(e) => setEstudianteParaDetalle(e)}
        onEditar={abrirModalEditar}
        onDesactivar={handleDesactivarEstudiante}
      />

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={modalFormAbierto}
        onClose={cerrarModalForm}
        title={estudianteSeleccionado ? "Editar estudiante" : "Nuevo estudiante"}
      >
        <EstudianteForm
          estudiante={estudianteSeleccionado}
          onSubmit={handleGuardarEstudiante}
        />
      </Modal>

      {/* Modal Expediente Académico */}
      <Modal
        isOpen={Boolean(estudianteParaDetalle)}
        onClose={() => setEstudianteParaDetalle(undefined)}
        title="Expediente del Estudiante"
        maxWidth="max-w-4xl"
      >
        {estudianteParaDetalle && (
          <DetalleEstudianteModal
            estudiante={estudianteParaDetalle}
            inscripciones={inscripciones}
            onCancelarInscripcion={handleCancelarInscripcion}
            onClose={() => setEstudianteParaDetalle(undefined)}
          />
        )}
      </Modal>
    </div>
  );
}

export default EstudiantesPage;