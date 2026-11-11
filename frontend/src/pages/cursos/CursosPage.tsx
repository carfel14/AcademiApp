import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useToast } from "../../context/ToastContext";

import {
  obtenerCursos,
  eliminarCurso as eliminarCursoApi,
  crearCurso,
  actualizarCurso,
} from "../../services/cursoService";
import { obtenerGrupos } from "../../services/grupoService";
import type { Curso } from "../../types/curso";
import type { Grupo } from "../../types/grupo";
import type { CursoFormData } from "../../schema/cursoSchema";
import CursoTable from "../../components/cursos/CursoTable";
import CursoForm from "../../components/cursos/CursoForm";
import Modal from "../../components/ui/Modal";

function CursosPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);

  const [cursoSeleccionado, setCursoSeleccionado] =
    useState<Curso | undefined>();

  const cargarCursos = useCallback(async (refresh = true) => {
    try {
      if (refresh) setLoading(true);
      const [cursosData, gruposData] = await Promise.all([
        obtenerCursos(),
        obtenerGrupos(),
      ]);

      setCursos(cursosData);
      setGrupos(gruposData);
    } catch {
      toast.warning("No se pudieron cargar los cursos y grupos");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void cargarCursos(false); });
    return () => { active = false; };
  }, [cargarCursos]);

  function abrirModalCrear() {
    setCursoSeleccionado(undefined);
    setModalAbierto(true);
  }

  function abrirModalEditar(curso: Curso) {
    setCursoSeleccionado(curso);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setCursoSeleccionado(undefined);
  }

  async function handleGuardarCurso(data: CursoFormData) {
    try {
      if (cursoSeleccionado) {
        const cursoActualizado = await actualizarCurso(
          cursoSeleccionado.id_curso,
          data
        );

        setCursos((cursosActuales) =>
          cursosActuales.map((curso) =>
            curso.id_curso === cursoActualizado.id_curso
              ? cursoActualizado
              : curso
          )
        );

        toast.info("Curso actualizado con éxito");
        cerrarModal();
        return;
      }

      const nuevoCurso = await crearCurso(data);

      setCursos((cursosActuales) => [
        ...cursosActuales,
        nuevoCurso,
      ]);

      toast.success("Curso creado con éxito");
      cerrarModal();
    } catch (error) {
      toast.warning(
        error instanceof Error
          ? error.message
          : cursoSeleccionado
          ? "No se pudo actualizar el curso"
          : "No se pudo crear el curso"
      );
    }
  }

  async function handleEliminarCurso(id: number) {
    try {
      const cursoActual = cursos.find((curso) => curso.id_curso === id);

      if (!cursoActual) return;

      await eliminarCursoApi(id);

      // CURSO.estado pasa a INACTIVO; la lista solo muestra cursos activos.
      setCursos((cursosActuales) =>
        cursosActuales.filter((curso) => curso.id_curso !== id)
      );
      toast.error("Curso desactivado correctamente");
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : "No se pudo desactivar el curso");
    }
  }

  const cursosFiltrados = cursos
    .filter((curso) => {
      const coincideNombre = curso.nombre
        .toLowerCase()
        .includes(busqueda.trim().toLowerCase());
      const coincideEstado =
        estadoFiltro === "todos" || curso.estado.toLowerCase() === estadoFiltro;

      return coincideNombre && coincideEstado;
    })
    .sort((cursoA, cursoB) => {
      if (estadoFiltro !== "todos") return 0;

      const esActivoA = cursoA.estado.toUpperCase() === "ACTIVO";
      const esActivoB = cursoB.estado.toUpperCase() === "ACTIVO";

      return Number(esActivoB) - Number(esActivoA);
    });

  if (loading) {
    return <p className="text-gray-600 text-sm">Cargando cursos...</p>;
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cursos</h1>

        <button
          type="button"
          onClick={abrirModalCrear}
          className="group flex items-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-950/20 transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <Plus className="h-4 w-4 text-blue-200 transition group-hover:text-white" strokeWidth={2.5} />
          Nuevo curso
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar cursos por nombre</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar curso por nombre..."
            className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap font-medium">Estado</span>
          <select
            value={estadoFiltro}
            onChange={(event) => setEstadoFiltro(event.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
      </div>

      {/* Cursos */}
      <CursoTable
        cursos={cursosFiltrados}
        grupos={grupos}
        onEditar={abrirModalEditar}
        onEliminar={handleEliminarCurso}
        onAdministrarGrupos={(curso) => navigate(`/grupos?curso=${curso.id_curso}`)}
      />

      {/* Modal Crear / Editar Curso */}
      <Modal
        isOpen={modalAbierto}
        onClose={cerrarModal}
        title={cursoSeleccionado ? "Editar curso" : "Nuevo curso"}
      >
        <CursoForm
          curso={cursoSeleccionado}
          onSubmit={handleGuardarCurso}
        />
      </Modal>

    </div>
  );
}

export default CursosPage;