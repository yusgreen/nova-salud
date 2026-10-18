// Singleton del socket. Se crea UNA instancia, pero NO se conecta al importar:
// autoConnect:false deja que ProductContext decida CUÁNDO conectar (al haber usuario)
// y CUÁNDO desconectar (al logout). Si conectara al importar, Login abriría un socket
// inútil y logout dejaría una conexión huérfana.
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,        // conectamos a mano desde el contexto
  reconnection: true,        // socket.io reintentará solo si cae el server (gratis)
  reconnectionDelay: 1000,
});