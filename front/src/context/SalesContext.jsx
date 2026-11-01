import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
import { socket } from "../services/socket";
import { useAuth } from "./AuthContext";

const SalesContext = createContext(null);

export function SalesProvider({ children }) {
  const { puedeGestionarInventario } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Guarda de permiso DENTRO del contexto: el cajero no monta fetch ni listener,
    // asi nunca dispara el GET /sales prohibido (que daria 403). Simetrico con el tab.
    if (!puedeGestionarInventario) { setLoading(false); return; }

    let activo = true;
    api.get("/sales")
      .then((d) => { if (activo) { setVentas(d); setError(""); } })
      .catch((e) => { if (activo) setError(e.message || "No se pudo cargar el historial"); })
      .finally(() => { if (activo) setLoading(false); });

    // ADVERTENCIA DE ARQUITECTURA: NO llamo socket.connect() ni disconnect() aqui.
    // La conexion del singleton la ABRE y la CIERRA ProductContext (que envuelve a este
    // provider en el arbol). Si yo tambien hiciera connect/disconnect sobre el mismo
    // socket, al desmontar este provider tumbaria la conexion que ProductContext usa
    // para el stock. Dos duenos para un singleton = pelea. Un solo dueno: ProductContext.
    // Yo solo registro mi listener sobre la conexion que ya esta viva.
    const onVenta = (nueva) => {
      if (!activo) return;
      // filter por id evita duplicados si el GET inicial y el evento se solapan (race de mount).
      setVentas((prev) => [nueva, ...prev.filter((v) => v.id !== nueva.id)]);
    };
    const onAnulada = (actualizada) => {
      if (!activo) return;
      setVentas((prev) =>
        prev.map((v) =>
          v.id === actualizada.id
            ? { ...v, ...actualizada, estado: "ANULADA" }
            : v
        )
      );
    };
    socket.on("venta_registrada", onVenta);
    socket.on("venta_anulada", onAnulada);

    return () => {
      activo = false;
      socket.off("venta_registrada", onVenta);   // cleanup: sin off, StrictMode duplicaria el listener
      socket.off("venta_anulada", onAnulada);
    };
  }, [puedeGestionarInventario]);

  const value = { ventas, loading, error };
  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales debe usarse dentro de <SalesProvider>");
  return ctx;
}