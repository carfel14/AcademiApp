import { NavLink } from "react-router-dom";
import { BookOpen, CalendarDays, ChartNoAxesColumn, ClipboardCheck, ClipboardList, CreditCard, GraduationCap, Bell, ScrollText, Shield, UsersRound } from "lucide-react";

const groups = [
  { label: "Academia", links: [
    ["/cursos", "Cursos", GraduationCap, "ADMIN"],
    ["/planes", "Planes de estudio", BookOpen, "ADMIN PROFESOR"],
    ["/calendario", "Horarios y sesiones", CalendarDays, "ADMIN PROFESOR"],
    ["/asistencia", "Asistencia", ClipboardCheck, "ADMIN PROFESOR"],
    ["/evaluaciones", "Evaluaciones", ClipboardList, "ADMIN PROFESOR"],
  ] },
  { label: "Personas y cobros", links: [
    ["/estudiantes", "Estudiantes", UsersRound, "ADMIN CAJA"],
    ["/profesores", "Profesores", UsersRound, "ADMIN"],
    ["/inscripciones", "Inscripciones", ClipboardList, "ADMIN CAJA"],
    ["/cobros", "Cobros", CreditCard, "ADMIN CAJA"],
    ["/recordatorios", "Recordatorios", Bell, "ADMIN CAJA"],
  ] },
  { label: "Administración", links: [
    ["/reportes", "Reportes", ChartNoAxesColumn, "ADMIN"],
    ["/usuarios", "Usuarios y roles", Shield, "ADMIN"],
    ["/bitacora", "Bitácora", ScrollText, "ADMIN"],
  ] },
] as const;

export default function Sidebar({ rol, open, onNavigate }: { rol: string; open: boolean; onNavigate: () => void }) {
  return <aside id="app-navigation" className={`app-sidebar${open ? " open" : ""}`}>
    <div className="app-brand"><img src="/images/logo.png" alt="" /><span>Academia Silvia</span></div>
    <nav aria-label="Navegación principal">
      {groups.map(group => {
        const links = group.links.filter(([, , , roles]) => roles.split(" ").includes(rol));
        return links.length ? <div key={group.label} className="app-nav-group">
          <p>{group.label}</p>
          {links.map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={onNavigate}><Icon size={16} aria-hidden="true" />{label}</NavLink>)}
        </div> : null;
      })}
    </nav>
  </aside>;
}
