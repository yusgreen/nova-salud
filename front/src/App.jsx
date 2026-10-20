import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { SaleProvider } from "./context/SaleContext";
import { ProductProvider } from "./context/ProductContext";
import { SalesProvider } from "./context/SalesContext";
import Topbar from "./components/Topbar";
import Inventario from "./components/Inventario";
import Caja from "./components/Caja";
import Ventas from "./components/Ventas";
import Auditoria from "./components/Auditoria";
import Toast from "./components/Toast";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { IconInventario, IconCaja, IconVentas, IconAuditoria, IconPanel, IconLogo } from "./components/Icons";
import Dashboard from "./components/Dashboard";
// Un solo lugar para la navegación. icon = componente SVG (hereda currentColor).
const NAV = [
  { id: "dashboard",  label: "Panel",      icon: IconPanel,      visible: (g) => g },
  { id: "inventario", label: "Inventario", icon: IconInventario, visible: () => true },
  { id: "caja",       label: "Caja",       icon: IconCaja,       visible: () => true },
  { id: "ventas",     label: "Ventas",     icon: IconVentas,     visible: (g) => g },
  { id: "auditoria",  label: "Auditoría",  icon: IconAuditoria,  visible: (g) => g },
];

export default function App() {
  const { usuario, loading, puedeGestionarInventario } = useAuth();
  const [view, setView] = useState("login");
  const [tab, setTab] = useState("inventario");
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => { setTab("inventario"); setMenuAbierto(false); }, [usuario?.id]);

  if (loading) return <div className="auth-shell"><p className="status">Verificando sesión…</p></div>;

  if (!usuario) {
    return view === "login"
      ? <Login onSwitch={() => setView("register")} />
      : <Register onSwitch={() => setView("login")} />;
  }

  function irA(id) { setTab(id); setMenuAbierto(false); }
  const items = NAV.filter((n) => n.visible(puedeGestionarInventario));

  return (
    <SaleProvider>
      <ProductProvider>
        <SalesProvider>
          <div className="app-shell">
            {menuAbierto && <div className="drawer-overlay" onClick={() => setMenuAbierto(false)} />}

            <aside className={`sidebar ${menuAbierto ? "open" : ""}`}>
              <div className="sidebar-brand">
                <IconLogo className="sidebar-logo" aria-hidden="true" />
                <span className="sidebar-name">Nova Salud</span>
              </div>
              <p className="sidebar-tag">Sistema de inventario y ventas en tiempo real</p>
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
              <main className="content">
                {tab === "dashboard" && puedeGestionarInventario && <Dashboard />}
                {tab === "inventario" && <Inventario />}
                {tab === "caja" && <Caja />}
                {tab === "ventas" && puedeGestionarInventario && <Ventas />}
                {tab === "auditoria" && puedeGestionarInventario && <Auditoria />}
              </main>
            </div>
          </div>
          <Toast />
        </SalesProvider>
      </ProductProvider>
    </SaleProvider>
  );
}