import { createContext, useContext, useEffect, useState } from "react";

const PREFS_KEY = "nova_prefs";
const PreferenciasContext = createContext(null);

const DEFAULTS = {
  compacto: false,
  tamanoFuente: "medio",   // pequeno | medio | grande
  formatoFecha: "dd/mm/yyyy",
  filasPorPagina: 10,
};

function leerPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function PreferenciasProvider({ children }) {
  const [prefs, setPrefs] = useState(leerPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    const root = document.documentElement;
    root.setAttribute("data-compact", prefs.compacto ? "true" : "false");
    root.setAttribute("data-font-size", prefs.tamanoFuente);
  }, [prefs]);

  function actualizar(cambios) {
    setPrefs((prev) => ({ ...prev, ...cambios }));
  }

  const value = { prefs, actualizar, DEFAULTS };
  return <PreferenciasContext.Provider value={value}>{children}</PreferenciasContext.Provider>;
}

export function usePreferencias() {
  const ctx = useContext(PreferenciasContext);
  if (!ctx) throw new Error("usePreferencias debe usarse dentro de <PreferenciasProvider>");
  return ctx;
}