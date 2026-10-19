import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { SaleProvider } from "./context/SaleContext";
import { ProductProvider } from "./context/ProductContext";
import Topbar from "./components/Topbar";
import Inventario from "./components/Inventario";
import Caja from "./components/Caja";
import Ventas from "./components/Ventas";
import Toast from "./components/Toast";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { SalesProvider } from "./context/SalesContext";   // nuevo import
import Auditoria from "./components/Auditoria";

export default function App() {
  const { usuario, loading, puedeGestionarInventario } = useAuth();
  const [view, setView] = useState("login");        // solo cuando NO hay usuario
  const [tab, setTab] = useState("inventario");     // inventario | caja | ventas

  // Reset del tab al cambiar de usuario: evita que un cajero herede tab="ventas"
  // de la sesion anterior de un admin (el estado de App persiste entre logins).
  useEffect(() => { setTab("inventario"); }, [usuario?.id]);

  if (loading) return <div className="auth-shell"><p className="status">Verificando sesión…</p></div>;

  if (!usuario) {
    return view === "login"
      ? <Login onSwitch={() => setView("register")} />
      : <Register onSwitch={() => setView("login")} />;
  }

  return (
    <SaleProvider>
      <ProductProvider>
        <SalesProvider> 
        
        <main className="shell">
          <Topbar />
          <nav className="tabs">
            <button className={`tab ${tab === "inventario" ? "active" : ""}`} onClick={() => setTab("inventario")}>
              Inventario
            </button>
            <button className={`tab ${tab === "caja" ? "active" : ""}`} onClick={() => setTab("caja")}>
              Caja
            </button>
            {puedeGestionarInventario && (
              <button className={`tab ${tab === "ventas" ? "active" : ""}`} onClick={() => setTab("ventas")}>
                Ventas
              </button>
            )}
            {puedeGestionarInventario && (
                <button className={`tab ${tab === "auditoria" ? "active" : ""}`} onClick={() => setTab("auditoria")}>
                  Auditoría
                </button>
              )}
          </nav>
          {tab === "inventario" && <Inventario />}
          {tab === "caja" && <Caja />}
          {tab === "ventas" && puedeGestionarInventario && <Ventas />}
          {tab === "auditoria" && <Auditoria />}
        </main>
        <Toast />
         </SalesProvider>                                  
      </ProductProvider>
    </SaleProvider>
  );
}