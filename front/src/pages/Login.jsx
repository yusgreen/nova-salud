import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import AuthLayout from "../components/AuthLayout";

export default function Login({ onSwitch }) {
  const { login } = useAuth();
  const { config } = useConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await login(email, password); // si falla, api.js lanza Error con data.error del back
    } catch (err) {
      setError(err.message);        // ej. "Credenciales inválidas"
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-form-head">
          <h1 className="auth-title">Bienvenido de nuevo</h1>
          <p className="muted">Ingresá para gestionar el inventario</p>
        </div>
        {error && <p className="status error">{error}</p>}
        <label>Email<input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required /></label>
        <label>Contraseña<input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" required /></label>
        <button className="btn-primary" disabled={busy}>{busy ? "Entrando..." : "Ingresar"}</button>
        <p className="muted small">
          ¿Sin cuenta? <button type="button" className="link" onClick={onSwitch}>Registrate</button>
        </p>
        {config.mostrarAyudaDemo && (
          <p className="hint">Demo: admin@novasalud.pe / admin123</p>
        )}
      </form>
    </AuthLayout>
  );
}