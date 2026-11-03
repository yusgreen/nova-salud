import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Register({ onSwitch }) {
  const { register } = useAuth();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await register(nombre, email, password);
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
          <h1 className="auth-title">Crea tu cuenta</h1>
          <p className="text-muted">Un acceso simple para empezar a vender</p>
        </div>
        {error && <p className="status error">{error}</p>}
        <div className="form-grid">
          <label className="label">Nombre
            <input className="input" value={nombre} onChange={(e)=>setNombre(e.target.value)} required autoComplete="name" />
          </label>
          <label className="label">Email
            <input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" />
          </label>
          <label className="label">Contraseña (mín 6)
            <input className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Tu contraseña" minLength={6} required autoComplete="new-password" />
          </label>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? "Creando..." : "Registrarme"}</button>
        <p className="auth-switch text-muted">
          ¿Ya tienes cuenta? <button type="button" className="link" onClick={onSwitch}>Ingresa</button>
        </p>
      </form>
    </AuthLayout>
  );
}