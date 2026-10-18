// back/src/sockets/inventorySocket.js
// El server de socket NO hace negocio. Solo registra conexiones.
// Los eventos de stock/alerta los EMITE el controller de venta (req.io.emit),
// no este archivo. Aca vive el "quien esta escuchando", no el "que paso".

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`[socket] cliente conectado: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[socket] cliente desconectado: ${socket.id}`);
    });
    // TODO(front Marlon): cuando el dashboard de alertas quiera "suscribirse"
    // a un producto concreto, aca se agregaria socket.on("seguir_producto", ...).
    // Por ahora el broadcast global (io.emit) alcanza para la demo.
  });
};