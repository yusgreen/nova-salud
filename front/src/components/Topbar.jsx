import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ProfileModal from "./ProfileModal";
import { IconTema } from "./Icons";

const COLOR_ROL = {
  admin: { bg: "rgba(248,113,113,0.14)", fg: "#f87171" },
  farmaceutico: { bg: "rgba(45,212,191,0.14)", fg: "#2dd4bf" },
  cajero: { bg: "rgba(251,191,36,0.14)", fg: "#fbbf24" },
};

const ETIQUETAS_TEMA = { light: "Claro", dark: "Oscuro", system: "Sistema" };
const ORDEN_TEMA = ["light", "dark", "system"];

export default function Topbar({ onMenu }) {
  const { usuario, logout } = useAuth();
  const { preferencia, cambiarTema } = useTheme();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const c = COLOR_ROL[usuario?.rol] || COLOR_ROL.cajero;

  function ciclarTema() {
    const actual = ORDEN_TEMA.indexOf(preferencia);
    cambiarTema(ORDEN_TEMA[(actual + 1) % ORDEN_TEMA.length]);
  }

  return (
    <>
      <header className="topbar">
        <button className="menu-btn" onClick={onMenu} aria-label="Abrir menú">☰</button>
        <div className="userbox">
          <button
            type="button"
            className="theme-btn"
            onClick={ciclarTema}
            title={`Cambiar tema (actual: ${ETIQUETAS_TEMA[preferencia]})`}
            aria-label={`Cambiar tema (actual: ${ETIQUETAS_TEMA[preferencia]})`}
          >
            <IconTema className="theme-icon" aria-hidden="true" />
            <span className="theme-label">{ETIQUETAS_TEMA[preferencia]}</span>
          </button>
          <button
            type="button"
            className="username username-btn"
            onClick={() => setPerfilAbierto(true)}
            title="Mi perfil"
          >
            {usuario?.nombre}
          </button>
          <span className="rolchip" style={{ background: c.bg, color: c.fg }}>
            {usuario?.rol}
          </span>
          <button className="btn-ghost" onClick={logout}>Salir</button>
        </div>
      </header>
      {perfilAbierto && <ProfileModal onClose={() => setPerfilAbierto(false)} />}
    </>
  );
}
