import { useConfig } from "../context/ConfigContext";
import { formatearMoneda } from "../services/format";

function fechaLegible(fecha) {
  try {
    return new Date(fecha).toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fecha;
  }
}

function etiquetaMetodo(metodo) {
  if (metodo === "TARJETA") return "Tarjeta";
  if (metodo === "YAPE_PLIN") return "Yape/Plin";
  return "Efectivo";
}

export default function Comprobante({ venta, onClose }) {
  const { config } = useConfig();
  const moneda = config.moneda;

  if (!venta) return null;

  const lineas = venta.detalles || [];

  return (
    <div className="ticket-print">
      <div className="ticket-print-head">
        <strong className="ticket-print-marca">{config.nombreNegocio}</strong>
        <span className="ticket-print-lema">{config.lema}</span>
      </div>

      <div className="ticket-print-meta">
        <div>
          <span>Ticket</span>
          <strong>#{venta.id}</strong>
        </div>
        <div>
          <span>Fecha</span>
          <strong>{fechaLegible(venta.fecha)}</strong>
        </div>
        <div>
          <span>Atendió</span>
          <strong>{venta.atendidoPor?.nombre || "—"}</strong>
        </div>
      </div>

      <table className="ticket-print-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cant.</th>
            <th>P. unit.</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={`${l.productoId || l.product?.id || i}`}>
              <td>{l.producto?.nombre || "(eliminado)"}</td>
              <td className="num">{l.cantidad}</td>
              <td className="num">{formatearMoneda(l.precioUnitario, moneda)}</td>
              <td className="num">
                {formatearMoneda(l.precioUnitario * l.cantidad, moneda)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ticket-print-total">
        <span>Total</span>
        <strong>{formatearMoneda(venta.total, moneda)}</strong>
      </div>

      <div className="ticket-print-pago">
        <div>
          <span>Método</span>
          <strong>{etiquetaMetodo(venta.metodoPago)}</strong>
        </div>
        {venta.metodoPago === "EFECTIVO" && venta.montoRecibido != null && (
          <>
            <div>
              <span>Recibido</span>
              <strong>{formatearMoneda(venta.montoRecibido, moneda)}</strong>
            </div>
            <div>
              <span>Vuelto</span>
              <strong>{formatearMoneda(venta.vuelto ?? 0, moneda)}</strong>
            </div>
          </>
        )}
      </div>

      {venta.nota && (
        <p className="ticket-print-nota">Nota: {venta.nota}</p>
      )}

      <p className="ticket-print-pie">Gracias por su compra</p>

      <div className="modal-foot ticket-print-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cerrar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
      </div>
    </div>
  );
}
