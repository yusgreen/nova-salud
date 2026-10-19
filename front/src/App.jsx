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

// Un solo lugar para la navegación. visible(g) decide si la vista se muestra
// (g = puedeGestionarInventario). Agregar una vista en A2 = agregar una fila acá.
const NAV = [
  { id: "inventario", label: "Inventario", icon: "📦", visible: () => true },
  { id: "caja",       label: "Caja",       icon: "🧾", visible: () => true },
  { id: "ventas",     label: "Ventas",     icon: "📈", visible: (g) => g },
  { id: "auditoria",  label: "Auditoría",  icon: "🛡️", visible: (g) => g },
];

export default function App() {
  const { usuario, loading, puedeGestionarInventario } = useAuth();
  const [view, setView] = useState("login");
  const [tab, setTab] = useState("inventario");
  const [menuAbierto, setMenuAbierto] = useState(false); // drawer móvil

  // Reset al cambiar de usuario: cajero no hereda Auditoría del admin.
  // Y cerramos el drawer por si el cambio de sesión ocurrió con él abierto.
  useEffect(() => { setTab("inventario"); setMenuAbierto(false); }, [usuario?.id]);

  if (loading) return <div className="auth-shell"><p className="status">Verificando sesión…</p></div>;

  if (!usuario) {
    return view === "login"
      ? <Login onSwitch={() => setView("register")} />
      : <Register onSwitch={() => setView("login")} />;
  }

  // Navegar cierra el drawer (en móvil, si no, la vista nueva queda tapada).
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
                <span className="sidebar-logo">💊</span>
                <span className="sidebar-name">Nova Salud</span>
              </div>
              <nav className="sidebar-nav">
                {items.map((n) => (
                  <button
                    key={n.id}
                    className={`side-link ${tab === n.id ? "active" : ""}`}
                    onClick={() => irA(n.id)}
                  >
                    <span className="side-icon">{n.icon}</span>
                    <span className="side-label">{n.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <div className="app-main">
              <Topbar onMenu={() => setMenuAbierto(true)} />
              <main className="content">
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