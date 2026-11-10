import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useToast } from "../../context/ToastContext";

import {
  obtenerInscripciones,
  actualizarInscripcion,
  crearInscripcion,
  cancelarInscripcion,
} from "../../services/inscripcionService";
import { obtenerEstudiantes } from "../../services/estudianteService";
import { obtenerCursos } from "../../services/cursoService";
import { obtenerGrupos } from "../../services/grupoService";

import type { Inscripcion } from "../../types/inscripcion";
import type { Estudiante } from "../../types/estudiante";
import type { Curso } from "../../types/curso";
import type { Grupo } from "../../types/grupo";

import InscripcionCardList from "../../components/inscripciones/InscripcionCardList";
import DetalleInscripcionModal from "../../components/inscripciones/DetalleInscripcionModal";
import NuevaInscripcionWizardModal from "../../components/inscripciones/NuevaInscripcionWizardModal";
import Modal from "../../components/ui/Modal";

function InscripcionesPage() {
  const { toast } = useToast();

  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);

  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [cursoFiltro, setCursoFiltro] = useState<number | "todos">("todos");
  const [loading, setLoading] = useState(true);

  // Modales
  const [modalWizardAbierto, setModalWizardAbierto] = useState(false);
  const [inscripcionParaDetalle, setInscripcionParaDetalle] = useState<Inscripcion | null>(null);

  const cargarDatos = useCallback(async (refresh = true) => {
    try {
      if (refresh) setLoading(true);
      const [inscripcionesData, estudiantesData, cursosData, gruposData] = await Promise.all([
        obtenerInscripciones(),
        obtenerEstudiantes(),
        obtenerCursos(),
        obtenerGrupos(),
      ]);

      setInscripciones(inscripcionesData);
      setEstudiantes(estudiantesData);
      setCursos(cursosData);
      setGrupos(gruposData);
    } catch {
      toast.warning("No se pudieron cargar las inscripciones");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void cargarDatos(false); });
    return () => { active = false; };
  }, [cargarDatos]);

  async function handleCrearInscripcion(data: {
    id_estudiante: number;
    id_grupo: number;
    observacion?: string;
  }) {
    try {
      await crearInscripcion(data);
      toast.success("Inscripción realizada y matrícula cobrada correctamente");
      setModalWizardAbierto(false);
      await cargarDatos();
    } catch (err) {
      toast.warning(err instanceof Error ? err.message : "Error al procesar la inscripción");
      throw err;
    }
  }

  async function handleCancelarInscripcion(id_inscripcion: number) {
    try {
      await cancelarInscripcion(id_inscripcion);
      setInscripciones((prev) =>
        prev.map((i) =>
          i.id_inscripcion === id_inscripcion
            ? { ...i, estado_inscripcion: "CANCELADA" }
            : i
        )
      );
      toast.error("Inscripción cancelada correctamente");
    } catch (err) {
      toast.warning(err instanceof Error ? err.message : "No se pudo cancelar la inscripción");
    }
  }

  const inscripcionesFiltradas = inscripciones.filter((item) => {
    const termino = busqueda.trim().toLowerCase();
    const estudiante = `${item.nombre_estudiante || ""} ${item.apellido_estudiante || ""}`.toLowerCase();
    const grupo = (item.nombre_grupo || "").toLowerCase();
    const cursoNombre = (item.nombre_curso || "").toLowerCase();

    // Filtro de texto (nombre, grupo o curso)
    const coincideTexto =
      estudiante.includes(termino) || grupo.includes(termino) || cursoNombre.includes(termino);

    // Filtro de Estado
    const coincideEstado =
      estadoFiltro === "todos" || item.estado_inscripcion.toLowerCase() === estadoFiltro;

    // Filtro de Curso
    let coincideCurso = true;
    if (cursoFiltro !== "todos") {
      const grupoObj = grupos.find((g) => g.id_grupo === item.id_grupo);
      coincideCurso = grupoObj ? grupoObj.id_curso === Number(cursoFiltro) : true;
    }

    return coincideTexto && coincideEstado && coincideCurso;
  });

  if (loading) {
    return <p className="text-gray-600 text-sm">Cargando módulo de inscripciones...</p>;
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inscripciones</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Registra estudiantes en los grupos disponibles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalWizardAbierto(true)}
          className="group flex items-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-950/20 transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <Plus className="h-4 w-4 text-blue-200 transition group-hover:text-white" strokeWidth={2.5} />
          Nueva inscripción
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        {/* Buscador de texto */}
        <label className="relative block flex-1">
          <span className="sr-only">Buscar por estudiante, curso o grupo</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por estudiante, curso o grupo..."
            className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>

        {/* Filtro por Curso */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap font-medium">Curso</span>
          <select
            value={cursoFiltro}
            onChange={(e) =>
              setCursoFiltro(e.target.value === "todos" ? "todos" : Number(e.target.value))
            }
            className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos los cursos</option>
            {cursos.map((c) => (
              <option key={c.id_curso} value={c.id_curso}>
                {c.nombre_curso}
              </option>
            ))}
          </select>
        </label>

        {/* Filtro por Estado */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap font-medium">Estado</span>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos</option>
            <option value="activa">Activa</option>
            <option value="finalizada">Finalizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
      </div>

      {/* Listado tipo Cards */}
      <InscripcionCardList
        inscripciones={inscripcionesFiltradas}
        onVerDetalle={(item) => setInscripcionParaDetalle(item)}
        onCancelar={handleCancelarInscripcion}
      />

      {/* Modal Wizard: Nueva Inscripción */}
      <Modal
        isOpen={modalWizardAbierto}
        onClose={() => setModalWizardAbierto(false)}
        title="Nueva Inscripción"
        maxWidth="max-w-2xl"
      >
        <NuevaInscripcionWizardModal
          estudiantes={estudiantes}
          cursos={cursos}
          grupos={grupos}
          inscripciones={inscripciones}
          onSubmit={handleCrearInscripcion}
          onClose={() => setModalWizardAbierto(false)}
        />
      </Modal>

      {/* Modal Detalle de Inscripción */}
      <Modal
        isOpen={Boolean(inscripcionParaDetalle)}
        onClose={() => setInscripcionParaDetalle(null)}
        title="Detalle de Inscripción"
        maxWidth="max-w-lg"
      >
        {inscripcionParaDetalle && (
          <DetalleInscripcionModal
            inscripcion={inscripcionParaDetalle}
            onSave={async observacion => {
              const actualizada = await actualizarInscripcion(inscripcionParaDetalle.id_inscripcion, observacion);
              setInscripciones(prev => prev.map(i => i.id_inscripcion === actualizada.id_inscripcion ? actualizada : i));
              setInscripcionParaDetalle(actualizada);
              toast.success("Inscripción actualizada.");
            }}
            onClose={() => setInscripcionParaDetalle(null)}
          />
        )}
      </Modal>
    </div>
  );
}

export default InscripcionesPage;