// back/src/middleware/attachIo.js
// Guarda la referencia al io del server y la adjunta a cada request como req.io.
// Asi el controller de venta puede hacer req.io?.emit(...) sin importar io
// directamente (desacople: el controller no sabe que existe socket.io,
// solo sabe que a lo mejor hay un canal req.io).

let ioRef = null;

function setIo(io) {
  ioRef = io;
}

function attachIo(req, res, next) {
  req.io = ioRef;   // puede ser null si algo salio mal; el controller usa ?. por eso
  next();
}

module.exports = { setIo, attachIo };