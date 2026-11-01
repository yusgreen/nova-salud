import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { socket } from "../services/socket";

const ProductContext = createContext(null);

export function ProductProvider({ children }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertas, setAlertas] = useState([]); // notificaciones efímeras de bajo stock
  const loadingRef = useRef(true);

  // Carga inicial del inventario (una sola vez, al montar el provider).
  // GET /products es publico, no necesita token; igual solo montamos con usuario.
  function refrescar() {
    setLoading(true);
    loadingRef.current = true;
    api
      .get("/products")
      .then((d) => { setProductos(d); setError(""); })
      .catch((e) => setError(e.message || "No se pudo cargar el inventario"))
      .finally(() => { loadingRef.current = false; setLoading(false); });
  }

  useEffect(() => { refrescar(); }, []);

  // Suscripcion al socket. El cleanup (return) es OBLIGATORIO: sin el socket.off,
  // React StrictMode (que monta efectos 2 veces en dev) duplicaria los listeners
  // y verias cada alerta DOS veces. Este es el bug clasico de novato con sockets+React.
  useEffect(() => {
    socket.connect(); // conecta la instancia singleton (autoConnect:false, por eso a mano)

    // stock_actualizado -> aplica el delta SOLO al stock, preservando el resto del objeto.
    // Asi Caja e Inventario ven el numero bajar sin recargar: "tiempo real" de verdad.
    const onStock = (lista) => {
      setProductos((prev) =>
        prev.map((p) => {
          const u = lista.find((a) => a.id === p.id);
          return u ? { ...p, stock: u.stock } : p;
        })
      );
    };

    // alerta_bajo_stock -> empuja alertas con key unico (para React list + timeout de cierre).
    const onAlerta = (lista) => {
      if (!lista || lista.length === 0) return;
      setAlertas((prev) => [
        ...prev,
        ...lista.map((a) => ({ ...a, key: `${a.id}-${Date.now()}-${Math.random().toString(36).slice(2)}` })),
      ]);
    };

    // Al (re)conectar despues de una caida del server, refresco para recuperar eventos
    // que se perdieron mientras el socket estuvo abajo. Barato y robusto.
    const onConnect = () => { if (!loadingRef.current) refrescar(); };

    socket.on("stock_actualizado", onStock);
    socket.on("alerta_bajo_stock", onAlerta);
    socket.on("connect", onConnect);

    return () => {
      socket.off("stock_actualizado", onStock);
      socket.off("alerta_bajo_stock", onAlerta);
      socket.off("connect", onConnect);
      socket.disconnect(); // logout -> desmonta provider -> socket se va limpio
    };
  }, []); // [] a proposito: conectar una vez por montaje del provider

  function descartarAlerta(key) {
    setAlertas((prev) => prev.filter((a) => a.key !== key));
  }

  const value = { productos, loading, error, refrescar, alertas, descartarAlerta };
  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts debe usarse dentro de <ProductProvider>");
  return ctx;
}