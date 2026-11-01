import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ToastStack } from "../components/Toast";

const ToastContext = createContext(null);

// Secuencia simple para que cada aviso tenga una key estable en la lista.
let secuencia = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const descartar = useCallback((key) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const notificar = useCallback((mensaje, tipo = "info", duracion = 6000) => {
    const key = `global-${++secuencia}`;
    setToasts((prev) => [...prev, { key, mensaje, tipo, duracion }]);
    return key;
  }, []);

  // api.js avisa por evento para no acoplar el manejo de 401 a React.
  useEffect(() => {
    function onSesionExpirada() {
      notificar("Tu sesión expiró, inicia sesión de nuevo", "error", 8000);
    }
    window.addEventListener("nova:session-expired", onSesionExpirada);
    return () => window.removeEventListener("nova:session-expired", onSesionExpirada);
  }, [notificar]);

  return (
    <ToastContext.Provider value={{ notificar, descartar }}>
      {children}
      <ToastStack items={toasts} onDismiss={descartar} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
