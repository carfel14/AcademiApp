import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import CursosPage from "../pages/cursos/CursosPage";
import ProfesoresPage from "../pages/profesores/ProfesoresPage";
import EstudiantesPage from "../pages/estudiantes/EstudiantesPage";
import InscripcionesPage from "../pages/inscripciones/InscripcionesPage";
import { CalendarioPage, AsistenciaPage } from "../pages/gestion/Academico";
import { CobrosPage, RecordatoriosPage } from "../pages/gestion/Finanzas";
import { BitacoraPage, PlanesPage, ReportesPage, UsuariosPage } from "../pages/gestion/Administracion";
import { EditForm, Status, type Field } from "../pages/gestion/ui";
import { api, getToken, setToken } from "../services/api";

export type Usuario = { id_usuario: number; username: string; nombres: string; apellidos: string; rol: string };

export default function AppRouter() {
  const [usuario, setUsuario] = useState<Usuario>();
  const [token, setSessionToken] = useState(getToken);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const location = useLocation();

  useEffect(() => {
    const sync = () => { const current = getToken(); setSessionToken(current); if (!current) setUsuario(undefined); };
    window.addEventListener("academiapp-session", sync);
    return () => window.removeEventListener("academiapp-session", sync);
  }, []);

  useEffect(() => {
    if (!token) return;
    let current = true;
    api<Usuario>("/auth/sesion").then(user => {
      if (current) { setUsuario(user); setError(""); }
    }).catch((error: Error) => { if (current) setError(error.message); });
    return () => { current = false; };
  }, [token, retry]);

  if (!token) return <Acceso key={location.key} onLogin={(user, token) => { setUsuario(user); setError(""); setToken(token); }} />;
  if (!usuario) return <main className="access-page"><Status error={error || undefined} loading={!error} retry={() => setRetry(n => n + 1)} />
    {error && <button className="work-link" onClick={() => setToken()}>Volver al acceso</button>}</main>;

  const admin = usuario.rol === "ADMIN";
  const docente = usuario.rol === "PROFESOR";
  const caja = usuario.rol === "CAJA";
  const inicio = admin ? "/reportes" : docente ? "/asistencia" : "/cobros";

  return <Routes>
    <Route element={<MainLayout usuario={usuario} onLogout={async () => {
      try { await api("/auth/logout", "POST"); } finally { setToken(); }
    }} />}>
      {admin && <Route path="/cursos" element={<CursosPage />} />}
      {admin && <Route path="/profesores" element={<ProfesoresPage />} />}
      {(admin || caja) && <Route path="/estudiantes" element={<EstudiantesPage />} />}
      {(admin || caja) && <Route path="/inscripciones" element={<InscripcionesPage />} />}
      {(admin || docente) && <Route path="/calendario" element={<CalendarioPage admin={admin} />} />}
      {(admin || docente) && <Route path="/asistencia" element={<AsistenciaPage key="asistencia" />} />}
      {(admin || docente) && <Route path="/evaluaciones" element={<AsistenciaPage key="evaluaciones" evaluaciones />} />}
      {(admin || docente) && <Route path="/planes" element={<PlanesPage editable={admin} />} />}
      {(admin || caja) && <Route path="/cobros" element={<CobrosPage />} />}
      {(admin || caja) && <Route path="/recordatorios" element={<RecordatoriosPage />} />}
      {admin && <Route path="/usuarios" element={<UsuariosPage />} />}
      {admin && <Route path="/bitacora" element={<BitacoraPage />} />}
      {admin && <Route path="/reportes" element={<ReportesPage />} />}
      <Route path="*" element={<Navigate to={inicio} replace />} />
    </Route>
  </Routes>;
}

function Acceso({ onLogin }: { onLogin: (user: Usuario, token: string) => void }) {
  const [setup, setSetup] = useState(false);
  const fields: Field[] = [
    ...(setup ? [{ name: "nombres", label: "Nombres", max: 100 }, { name: "apellidos", label: "Apellidos", max: 100 }] : []),
    { name: "username", label: "Usuario", max: 50 },
    { name: "password", label: setup ? "Contraseña (mínimo 10 caracteres)" : "Contraseña", type: "password", min: setup ? 10 : 1, max: 128 },
    ...(setup ? [{ name: "clave", label: "Clave de configuración", type: "password" as const, max: 256 }] : []),
  ];
  return <main className="access-page">
    <section className="access-panel">
      <div className="app-brand"><img src="/images/logo.png" alt="" /><span>Academia Silvia</span></div>
      <h1>{setup ? "Configurar primer acceso" : "Iniciar sesión"}</h1>
      {setup && <p className="work-muted">Usa la clave APP_SETUP_KEY del servidor para crear la primera cuenta administradora.</p>}
      <EditForm key={String(setup)} fields={fields} saveLabel={setup ? "Crear administrador" : "Ingresar"}
        onSave={async data => {
          const result = await api<{ usuario: Usuario; token: string }>(setup ? "/auth/configurar" : "/auth/login", "POST", data);
          onLogin(result.usuario, result.token);
        }} />
      <button className="work-link" onClick={() => setSetup(!setup)}>{setup ? "Volver al inicio de sesión" : "Configurar primer acceso"}</button>
    </section>
  </main>;
}
