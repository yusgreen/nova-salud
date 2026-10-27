import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

export const CONFIG_DEFAULTS = {
  nombreNegocio: "Nova Salud",
  lema: "Sistema de inventario y ventas en tiempo real",
  moneda: "S/",
  umbralStockBajo: 10,
  mostrarAyudaDemo: true,
};

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(CONFIG_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    api
      .get("/settings")
      .then((data) => {
        if (activo) setConfig({ ...CONFIG_DEFAULTS, ...data });
      })
      .catch(() => {})
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    document.title = `${config.nombreNegocio} · Inventario y ventas`;
  }, [config.nombreNegocio]);

  async function actualizar(payload) {
    const data = await api.put("/settings", payload);
    setConfig({ ...CONFIG_DEFAULTS, ...data });
    return data;
  }

  return (
    <ConfigContext.Provider value={{ config, loading, actualizar }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig debe usarse dentro de <ConfigProvider>");
  return ctx;
}
