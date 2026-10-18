import { createContext, useContext, useMemo, useState } from "react";

const SaleContext = createContext(null);

export function SaleProvider({ children }) {
  // lineas: [{ productoId, nombre, precio, cantidad, stockDisponible }]
  const [lineas, setLineas] = useState([]);

  function agregar(producto) {
    setLineas((prev) => {
      const existente = prev.find((l) => l.productoId === producto.id);
      if (existente) {
        // no pasar del stock disponible (UX; la verdad final la da el back)
        if (existente.cantidad >= existente.stockDisponible) return prev;
        return prev.map((l) =>
          l.productoId === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      if (producto.stock <= 0) return prev; // sin stock, no se agrega
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: 1,
          stockDisponible: producto.stock,
        },
      ];
    });
  }

  function cambiarCantidad(productoId, delta) {
    setLineas((prev) =>
      prev
        .map((l) => {
          if (l.productoId !== productoId) return l;
          const nueva = l.cantidad + delta;
          if (nueva < 1) return l;                 // mínimo 1 (para quitar usa quitar())
          if (nueva > l.stockDisponible) return l; // máximo = stock disponible
          return { ...l, cantidad: nueva };
        })
    );
  }

  function quitar(productoId) {
    setLineas((prev) => prev.filter((l) => l.productoId !== productoId));
  }

  function limpiar() {
    setLineas([]);
  }

  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0),
    [lineas]
  );
  const unidades = useMemo(
    () => lineas.reduce((acc, l) => acc + l.cantidad, 0),
    [lineas]
  );

  const value = { lineas, agregar, cambiarCantidad, quitar, limpiar, total, unidades };
  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

export function useSale() {
  const ctx = useContext(SaleContext);
  if (!ctx) throw new Error("useSale debe usarse dentro de <SaleProvider>");
  return ctx;
}