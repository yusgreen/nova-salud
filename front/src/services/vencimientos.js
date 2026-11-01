const DIA_MS = 24 * 60 * 60 * 1000;
export const DIAS_AVISO_VENCIMIENTO = 30;

// Las fechas del backend pueden venir como ISO completo o como YYYY-MM-DD.
// Para las fechas sin hora uso el calendario local y evito corrimientos de zona.
export function parseFechaLocal(valor) {
  if (!valor) return null;

  if (typeof valor === "string") {
    const soloFecha = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (soloFecha) {
      return new Date(
        Number(soloFecha[1]),
        Number(soloFecha[2]) - 1,
        Number(soloFecha[3])
      );
    }
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function diasHastaVencimiento(valor, hoy = new Date()) {
  const fecha = parseFechaLocal(valor);
  if (!fecha) return null;

  const base = new Date(hoy);
  base.setHours(0, 0, 0, 0);

  const vence = new Date(fecha);
  vence.setHours(0, 0, 0, 0);

  return Math.round((vence.getTime() - base.getTime()) / DIA_MS);
}

export function estadoVencimiento(valor, hoy = new Date()) {
  const dias = diasHastaVencimiento(valor, hoy);
  if (dias === null) return null;
  if (dias < 0) return "vencido";
  if (dias <= DIAS_AVISO_VENCIMIENTO) return "pronto";
  return "vigente";
}

export function formatearFechaVencimiento(valor) {
  const fecha = parseFechaLocal(valor);
  if (!fecha) return "";
  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
