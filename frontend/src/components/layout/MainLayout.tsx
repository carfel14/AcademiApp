import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import type { Usuario } from "../../router/AppRouter";

export default function MainLayout({ usuario, onLogout }: { usuario: Usuario; onLogout: () => Promise<void> }) {
  const [menu, setMenu] = useState(false);
  return <div className="app-frame">
    <header className="app-top">
      <button type="button" className="app-menu work-secondary" aria-label={menu ? "Cerrar navegación" : "Abrir navegación"} aria-expanded={menu}
        aria-controls="app-navigation" onClick={() => setMenu(!menu)}>{menu ? <X size={18} /> : <Menu size={18} />}<span>Menú</span></button>
      <span className="app-top-title">Academia Silvia</span>
      <div className="app-account">
        <span>{usuario.profesor ?? usuario.usuario}<small className="block work-muted">{usuario.roles.join(", ")}</small></span>
        <button className="work-link" onClick={() => void onLogout().catch(() => undefined)}>Salir</button>
      </div>
    </header>
    <Sidebar roles={usuario.roles} open={menu} onNavigate={() => setMenu(false)} />
    <main className="app-sheet"><Outlet /></main>
  </div>;
}
