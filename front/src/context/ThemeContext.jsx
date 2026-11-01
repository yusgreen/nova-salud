import { createContext, useContext, useEffect, useState } from "react";

const THEME_KEY = "nova_theme";
const ThemeContext = createContext(null);

function resolverTema(preferencia) {
  if (preferencia === "light" || preferencia === "dark") return preferencia;
  // "system" (o cualquier valor desconocido): sigue el SO
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [preferencia, setPreferencia] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "system";
    } catch {
      return "system";
    }
  });

  // Aplica data-theme en <html> cada vez que cambia la preferencia o el SO.
  useEffect(() => {
    const aplicar = () => {
      const efectivo = resolverTema(preferencia);
      document.documentElement.setAttribute("data-theme", efectivo);
    };
    aplicar();

    if (preferencia !== "system") return undefined;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => aplicar();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preferencia]);

  function cambiarTema(valor) {
    setPreferencia(valor);
    try {
      localStorage.setItem(THEME_KEY, valor);
    } catch {
      /* ignore */
    }
  }

  const value = {
    preferencia,
    temaEfectivo: resolverTema(preferencia),
    cambiarTema,
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}