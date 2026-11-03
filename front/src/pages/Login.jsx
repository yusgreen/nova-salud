import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Login({ onSwitch }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-form-head">
          <h1 className="auth-title">Bienvenido de nuevo</h1>
          <p className="text-muted">Ingresa para gestionar el inventario</p>
        </div>
        {error && <p className="status error">{error}</p>}
        <div className="form-grid">
          <label className="label">Email
            <input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" />
          </label>
          <label className="label">Contraseña
            <input className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Tu contraseña" required autoComplete="current-password" />
          </label>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? "Entrando..." : "Ingresar"}</button>
        <p className="auth-switch text-muted">
          ¿Sin cuenta? <button type="button" className="link" onClick={onSwitch}>Regístrate</button>
        </p>
      </form>
    </AuthLayout>
  );
}