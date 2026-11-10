import { NavLink } from "react-router-dom";
import { BookOpen, CalendarDays, ChartNoAxesColumn, ClipboardCheck, ClipboardList, CreditCard, GraduationCap, Bell, ScrollText, Shield, UsersRound } from "lucide-react";

const groups = [
  { label: "Academia", links: [
    ["/cursos", "Cursos", GraduationCap, "ADMINISTRADOR"],
    ["/planes", "Planes de estudio", BookOpen, "ADMINISTRADOR DOCENTE"],
    ["/calendario", "Horarios y sesiones", CalendarDays, "ADMINISTRADOR DOCENTE"],
    ["/asistencia", "Asistencia", ClipboardCheck, "ADMINISTRADOR DOCENTE"],
    ["/evaluaciones", "Evaluaciones", ClipboardList, "ADMINISTRADOR DOCENTE"],
  ] },
  { label: "Personas y cobros", links: [
    ["/estudiantes", "Estudiantes", UsersRound, "ADMINISTRADOR RECEPCION"],
    ["/profesores", "Profesores", UsersRound, "ADMINISTRADOR"],
    ["/inscripciones", "Inscripciones", ClipboardList, "ADMINISTRADOR RECEPCION"],
    ["/cobros", "Cobros", CreditCard, "ADMINISTRADOR CAJERO"],
    ["/recordatorios", "Recordatorios", Bell, "ADMINISTRADOR CAJERO"],
  ] },
  { label: "Administración", links: [
    ["/reportes", "Reportes", ChartNoAxesColumn, "ADMINISTRADOR"],
    ["/usuarios", "Usuarios y roles", Shield, "ADMINISTRADOR"],
    ["/bitacora", "Bitácora", ScrollText, "ADMINISTRADOR"],
  ] },
] as const;

export default function Sidebar({ roles: usuarioRoles, open, onNavigate }: { roles: string[]; open: boolean; onNavigate: () => void }) {
  return <aside id="app-navigation" className={`app-sidebar${open ? " open" : ""}`}>
    <div className="app-brand"><img src="/images/logo.png" alt="" /><span>Academia Silvia</span></div>
    <nav aria-label="Navegación principal">
      {groups.map(group => {
        const links = group.links.filter(([, , , roles]) => roles.split(" ").some(rol => usuarioRoles.includes(rol)));
        return links.length ? <div key={group.label} className="app-nav-group">
          <p>{group.label}</p>
          {links.map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={onNavigate}><Icon size={16} aria-hidden="true" />{label}</NavLink>)}
        </div> : null;
      })}
    </nav>
  </aside>;
}
