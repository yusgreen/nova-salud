import { getToken } from "./api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Descarga el .xlsx que genera el back. No parsea JSON: pide el buffer y lo salva.
export async function descargarVentasExcel(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.usuarioId) params.set("usuarioId", filtros.usuarioId);

  const query = params.toString();
  const tok = getToken();
  const res = await fetch(`${API_URL}/sales/export${query ? `?${query}` : ""}`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: "No se pudo exportar" }));
    throw new Error(e.error || "Error al exportar");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nova-salud-ventas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}