import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { SaleProvider } from "./context/SaleContext";
import { ProductProvider } from "./context/ProductContext";
import Topbar from "./components/Topbar";
import Inventario from "./components/Inventario";
import Caja from "./components/Caja";
import Toast from "./components/Toast";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  const { usuario, loading } = useAuth();
  const [view, setView] = useState("login");
  const [tab, setTab] = useState("inventario");

  if (loading) return <div className="auth-shell"><p className="status">Verificando sesión…</p></div>;

  // Sin usuario: solo Login/Register. NO montamos Sale/Product -> sin socket en login.
  if (!usuario) {
    return view === "login"
      ? <Login onSwitch={() => setView("register")} />
      : <Register onSwitch={() => setView("login")} />;
  }

  // Con usuario: los providers de sesion viven AQUI, así logout los desmonta
  // y el socket se desconecta solo (cleanup de ProductContext).
  return (
    <SaleProvider>
      <ProductProvider>
        <main className="shell">
          <Topbar />
          <nav className="tabs">
            <button className={`tab ${tab === "inventario" ? "active" : ""}`} onClick={() => setTab("inventario")}>
              Inventario
            </button>
            <button className={`tab ${tab === "caja" ? "active" : ""}`} onClick={() => setTab("caja")}>
              Caja
            </button>
          </nav>
          {tab === "inventario" ? <Inventario /> : <Caja />}
          <Toast />
        </main>
      </ProductProvider>
    </SaleProvider>
  );
}