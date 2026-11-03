import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ProfileModal from "./ProfileModal";
import { IconTema } from "./Icons";

const ETIQUETAS_TEMA = { light: "Claro", dark: "Oscuro", system: "Sistema" };
const ORDEN_TEMA = ["light", "dark", "system"];

const ROLE_LABELS = {
  admin: "Administrador",
  farmaceutico: "Farmacéutico",
  cajero: "Cajero",
};

function tramoSaludo(hora) {
  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function nombreDePila(nombre = "") {
  return String(nombre || "").trim().split(/\s+/).filter(Boolean)[0] || "";
}

function iniciales(nombre = "") {
  return String(nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase() || "?";
}

export default function Topbar({ onMenu }) {
  const { usuario, logout } = useAuth();
  const { preferencia, cambiarTema } = useTheme();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [hora, setHora] = useState(() => new Date().getHours());
  const menuRef = useRef(null);
  const avatarRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setHora(new Date().getHours()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menuAbierto) return;

    function cerrarConClicFuera(e) {
      if (!menuRef.current?.contains(e.target)) setMenuAbierto(false);
    }

    function cerrarConEscape(e) {
      if (e.key === "Escape") {
        setMenuAbierto(false);
        avatarRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", cerrarConClicFuera);
    document.addEventListener("keydown", cerrarConEscape);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();

    return () => {
      document.removeEventListener("mousedown", cerrarConClicFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [menuAbierto]);

  function ciclarTema() {
    const actual = ORDEN_TEMA.indexOf(preferencia);
    cambiarTema(ORDEN_TEMA[(actual + 1) % ORDEN_TEMA.length]);
  }

  function navegarMenu(e) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    if (items.length === 0) return;
    e.preventDefault();
    const actual = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") items[(actual + 1 + items.length) % items.length].focus();
    if (e.key === "ArrowUp") items[(actual - 1 + items.length) % items.length].focus();
    if (e.key === "Home") items[0].focus();
    if (e.key === "End") items[items.length - 1].focus();
  }

  const nombre = nombreDePila(usuario?.nombre);
  const saludo = tramoSaludo(hora);

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="menu-btn"
            onClick={onMenu}
            aria-label="Abrir menú"
            aria-expanded="false"
          >
            <svg className="icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <p className="topbar-greeting">
            <span className="topbar-greeting-full">
              {nombre ? `${saludo}, ${nombre}` : saludo}
            </span>
            <span className="topbar-greeting-compact">
              {nombre ? `Hola, ${nombre}` : "Hola"}
            </span>
          </p>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={ciclarTema}
            title={`Cambiar tema (actual: ${ETIQUETAS_TEMA[preferencia]})`}
            aria-label={`Cambiar tema (actual: ${ETIQUETAS_TEMA[preferencia]})`}
          >
            <IconTema className="icon-md" aria-hidden="true" />
          </button>

          <div className="topbar-profile" ref={menuRef}>
            <button
              type="button"
              ref={avatarRef}
              className="avatar-btn"
              onClick={() => setMenuAbierto((abierto) => !abierto)}
              aria-haspopup="menu"
              aria-expanded={menuAbierto}
              aria-controls={menuAbierto ? "topbar-menu" : undefined}
              aria-label={`Cuenta de ${usuario?.nombre || "usuario"}`}
            >
              {iniciales(usuario?.nombre)}
            </button>

            {menuAbierto && (
              <div
                id="topbar-menu"
                className="profile-menu"
                role="menu"
                aria-label="Cuenta"
                onKeyDown={navegarMenu}
              >
                <div className="profile-menu-head">
                  <span className="profile-menu-name">{usuario?.nombre}</span>
                  <span className="profile-menu-email">{usuario?.email}</span>
                  <span className="badge badge-neutral">
                    {ROLE_LABELS[usuario?.rol] || usuario?.rol}
                  </span>
                </div>
                <div className="profile-menu-divider" role="presentation" />
                <button
                  type="button"
                  role="menuitem"
                  className="profile-menu-item"
                  onClick={() => {
                    setMenuAbierto(false);
                    setPerfilAbierto(true);
                  }}
                >
                  Mi perfil
                </button>
                <div className="profile-menu-divider" role="presentation" />
                <button
                  type="button"
                  role="menuitem"
                  className="profile-menu-item is-danger"
                  onClick={() => {
                    setMenuAbierto(false);
                    logout();
                  }}
                >
                  Salir
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {perfilAbierto && <ProfileModal onClose={() => setPerfilAbierto(false)} />}
    </>
  );
}
