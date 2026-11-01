import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken, TOKEN_KEY } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true); // true hasta validar token al montar

  // Al montar: si hay token en localStorage, pregunto al back si sigue vigente.
  // Si no hay token, no llamo a la API (evito un 401 fantasma en la consola).
  useEffect(() => {
    let activo = true;
    const token = getToken();
    if (!token) {
      setUsuario(null);
      setLoading(false);
      return () => { activo = false; };
    }
    api
      .get("/auth/me")
      .then((data) => { if (activo) setUsuario(data.user); })
      .catch(() => {
        // Token expirado o inválido: lo tiro y quedo deslogueado.
        if (activo) { clearToken(); setUsuario(null); }
      })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    function onStorage(e) {
      if (e.key !== TOKEN_KEY) return;        // solo nos interesa nuestra clave
      const nuevo = getToken();               // lee el valor YA actualizado por A
      if (!nuevo) { setUsuario(null); return; }   // logout en otra pestana
      // cambio de usuario en otra pestana: revalidamos para espejar la sesion real
      api.get("/auth/me")
        .then((d) => setUsuario(d.user))
        .catch(() => setUsuario(null));       // token nuevo invalido o expirado
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // api.js emite este evento cuando cualquier petición autenticada devuelve 401.
  useEffect(() => {
    function onSesionExpirada() {
      setUsuario(null);
    }
    window.addEventListener("nova:session-expired", onSesionExpirada);
    return () => window.removeEventListener("nova:session-expired", onSesionExpirada);
  }, []);

  async function login(email, password) {
    const data = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUsuario(data.user);
    return data.user;
  }

  async function register(nombre, email, password) {
    // Registro publico: el back fuerza rol "cajero" (nunca deja crear admin).
    await api.post("/auth/register", { nombre, email, password });
    // UX de un paso: tras registrar, logueo automatico con las mismas credenciales.
    const data = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUsuario(data.user);
    return data.user;
  }

  async function actualizarPerfil(nombre) {
    const data = await api.put("/auth/me", { nombre });
    setUsuario(data.user);
    return data.user;
  }

  async function cambiarPassword(passwordActual, passwordNueva) {
    return api.put("/auth/password", { passwordActual, passwordNueva });
  }

  function logout() {
    clearToken();
    setUsuario(null);
  }

  // Derivados de rol: los consume F5 (CRUD) para ocultar botones segun permiso.
  const value = {
    usuario,
    loading,
    login,
    register,
    actualizarPerfil,
    cambiarPassword,
    logout,
    isAuthenticated: !!usuario,
    isAdmin: usuario?.rol === "admin",
    esFarmaceutico: usuario?.rol === "farmaceutico",
    puedeGestionarInventario: usuario?.rol === "admin" || usuario?.rol === "farmaceutico",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}