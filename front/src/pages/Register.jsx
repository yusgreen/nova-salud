import { useState } from "react";
import { useAuth } from "../context/AuthContext";

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
      await register(nombre, email, password); // back fuerza rol "cajero"
    } catch (err) {
      setError(err.message); // ej. "El email ya está registrado" (409)
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1 className="brand">Nova Salud</h1>
        <p className="muted">Creá tu cuenta de cajero</p>
        {error && <p className="status error">{error}</p>}
        <label>Nombre<input value={nombre} onChange={(e)=>setNombre(e.target.value)} required /></label>
        <label>Email<input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required /></label>
        <label>Contraseña (min 6)<input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" minLength={6} required /></label>
        <button className="btn-primary" disabled={busy}>{busy ? "Creando..." : "Registrarme"}</button>
        <p className="muted small">
          ¿Ya tenés cuenta? <button type="button" className="link" onClick={onSwitch}>Ingresá</button>
        </p>
      </form>
    </div>
  );
}