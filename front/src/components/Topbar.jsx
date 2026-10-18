import { useAuth } from "../context/AuthContext";

const COLOR_ROL = {
  admin: { bg: "rgba(248,113,113,0.14)", fg: "#f87171" },
  farmaceutico: { bg: "rgba(45,212,191,0.14)", fg: "#2dd4bf" },
  cajero: { bg: "rgba(251,191,36,0.14)", fg: "#fbbf24" },
};

export default function Topbar() {
  const { usuario, logout } = useAuth();
  const c = COLOR_ROL[usuario?.rol] || COLOR_ROL.cajero;

  return (
    <header className="topbar">
      <div>
        <h1 className="brand">Nova Salud</h1>
        <p className="muted">Sistema de inventario y ventas en tiempo real</p>
      </div>
      <div className="userbox">
        <span className="username">{usuario?.nombre}</span>
        <span className="rolchip" style={{ background: c.bg, color: c.fg }}>
          {usuario?.rol}
        </span>
        <button className="btn-ghost" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}