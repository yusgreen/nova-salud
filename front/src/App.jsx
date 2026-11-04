import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useConfig } from "./context/ConfigContext";
import { SaleProvider } from "./context/SaleContext";
import { ProductProvider } from "./context/ProductContext";
import { SalesProvider } from "./context/SalesContext";
import Topbar from "./components/Topbar";
import Inventario from "./components/Inventario";
import Caja from "./components/Caja";
import Ventas from "./components/Ventas";
import CierreCaja from "./components/CierreCaja";
import Auditoria from "./components/Auditoria";
import Configuracion from "./components/Configuracion";
import Usuarios from "./components/Usuarios";
import Toast from "./components/Toast";
import Login from "./pages/Login";
import Register from "./pages/Register";
import {
  IconInventario, IconCaja, IconVentas, IconAuditoria,
  IconPanel, IconLogo, IconConfiguracion, IconUsuarios, IconCierreCaja
} from "./components/Icons";
import Dashboard from "./components/Dashboard";

const NAV = [
  { id: "dashboard", label: "Panel", icon: IconPanel, visible: () => true },
  { id: "inventario", label: "Inventario", icon: IconInventario, visible: () => true },
  { id: "caja", label: "Caja", icon: IconCaja, visible: () => true },
  { id: "ventas", label: "Ventas", icon: IconVentas, visible: (g) => g },
  { id: "cierre", label: "Cierre de caja", icon: IconCierreCaja, visible: () => true },
  { id: "auditoria", label: "Auditoría", icon: IconAuditoria, visible: (g) => g },
  { id: "configuracion", label: "Configuración", icon: IconConfiguracion, visible: () => true, adminOnly: true },
  { id: "usuarios", label: "Usuarios", icon: IconUsuarios, visible: () => true, adminOnly: true },
];

export default function App() {
  const { usuario, loading, puedeGestionarInventario, isAdmin } = useAuth();
  const { config } = useConfig();
  const [view, setView] = useState("login");
  const [tab, setTab] = useState("dashboard");
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => { setTab("dashboard"); setMenuAbierto(false); }, [usuario?.id]);

  useEffect(() => {
    function onSesionExpirada() {
      setView("login");
      setTab("dashboard");
      setMenuAbierto(false);
    }
    window.addEventListener("nova:session-expired", onSesionExpirada);
    return () => window.removeEventListener("nova:session-expired", onSesionExpirada);
  }, []);

  if (loading) return <div className="auth-shell"><p className="status">Verificando sesión…</p></div>;

  if (!usuario) {
    return view === "login"
      ? <Login onSwitch={() => setView("register")} />
      : <Register onSwitch={() => setView("login")} />;
  }

  function irA(id) { setTab(id); setMenuAbierto(false); }
  const items = NAV.filter(
    (n) => n.visible(puedeGestionarInventario) && (!n.adminOnly || isAdmin)
  );

  return (
    <SaleProvider>
      <ProductProvider>
        <SalesProvider>
          <div className="app-shell">
            {menuAbierto && <div className="drawer-overlay" onClick={() => setMenuAbierto(false)} aria-hidden="true" />}

            <aside className={`sidebar ${menuAbierto ? "open" : ""}`} aria-label="Navegación principal">
              <div className="sidebar-brand">
                <IconLogo className="sidebar-logo" aria-hidden="true" />
                <span className="sidebar-name">{config.nombreNegocio}</span>
              </div>
              <p className="sidebar-tag">{config.lema}</p>
              <nav className="sidebar-nav">
                {items.map((n) => (
                  <button
                    key={n.id}
                    className={`side-link ${tab === n.id ? "active" : ""}`}
                    onClick={() => irA(n.id)}
                    aria-current={tab === n.id ? "page" : undefined}
                  >
                    <n.icon className="side-icon" aria-hidden="true" />
                    <span className="side-label">{n.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <div className="app-main">
              <Topbar onMenu={() => setMenuAbierto(true)} />
              <main className={`content animate-tab`} key={tab} role="main">
                {tab === "dashboard" && <Dashboard />}
                {tab === "inventario" && <Inventario />}
                {tab === "caja" && <Caja />}
                {tab === "ventas" && puedeGestionarInventario && <Ventas />}
                {tab === "cierre" && <CierreCaja />}
                {tab === "auditoria" && puedeGestionarInventario && <Auditoria />}
                {tab === "configuracion" && isAdmin && <Configuracion />}
                {tab === "usuarios" && isAdmin && <Usuarios />}
              </main>
            </div>
          </div>
          <Toast />
        </SalesProvider>
      </ProductProvider>
    </SaleProvider>
  );
}