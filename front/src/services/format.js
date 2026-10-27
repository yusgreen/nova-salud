export function formatearMoneda(valor, moneda = "S/") {
  return `${moneda} ${Number(valor || 0).toFixed(2)}`;
}
