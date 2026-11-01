const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const TOKEN_KEY = "nova_token";

// Rutas donde un 401 significa credenciales incorrectas, no sesión vencida.
const RUTAS_SIN_SESION = ["/auth/login", "/auth/register"];

// Evita lanzar varios avisos/logouts si muchas peticiones vencen a la vez.
let manejando401 = false;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  manejando401 = false;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function esRutaSinSesion(path) {
  return RUTAS_SIN_SESION.some((ruta) => path.startsWith(ruta));
}

function notificarSesionExpirada() {
  if (manejando401 || !getToken()) return;
  manejando401 = true;
  clearToken();
  window.dispatchEvent(new Event("nova:session-expired"));
}

export async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token && !esRutaSinSesion(path)) {
      notificarSesionExpirada();
    }
    throw new Error(data?.error || `Error ${response.status}`);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  put: (path, body) =>
    request(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (path) =>
    request(path, {
      method: "DELETE",
    }),
};