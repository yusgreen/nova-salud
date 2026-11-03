import { useEffect, useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function ProfileModal({ onClose }) {
  const { usuario, actualizarPerfil, cambiarPassword } = useAuth();
  const { notificar } = useToast();

  const [nombre, setNombre] = useState(usuario?.nombre || "");
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busyNombre, setBusyNombre] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);
  const [errorNombre, setErrorNombre] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  useEffect(() => {
    setNombre(usuario?.nombre || "");
  }, [usuario?.nombre]);

  async function guardarNombre(e) {
    e.preventDefault();
    setErrorNombre("");
    const limpio = nombre.trim();

    if (!limpio) {
      setErrorNombre("El nombre no puede estar vacío");
      return;
    }

    setBusyNombre(true);
    try {
      await actualizarPerfil(limpio);
      notificar("Perfil actualizado", "success");
    } catch (err) {
      setErrorNombre(err.message || "No se pudo actualizar el perfil");
    } finally {
      setBusyNombre(false);
    }
  }

  async function guardarPassword(e) {
    e.preventDefault();
    setErrorPassword("");

    if (!passwordActual || !passwordNueva || !confirmar) {
      setErrorPassword("Completa los tres campos");
      return;
    }

    if (passwordNueva.length < 6) {
      setErrorPassword("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (passwordNueva !== confirmar) {
      setErrorPassword("La nueva contraseña y la confirmación no coinciden");
      return;
    }

    setBusyPassword(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
      setPasswordActual("");
      setPasswordNueva("");
      setConfirmar("");
      notificar("Contraseña actualizada", "success");
    } catch (err) {
      setErrorPassword(err.message || "No se pudo cambiar la contraseña");
    } finally {
      setBusyPassword(false);
    }
  }

  return (
    <Modal titulo="Mi perfil" onClose={onClose}>
      <div className="profile">
        <p className="text-muted small">
          Sesión iniciada como <strong>{usuario?.email}</strong>
        </p>

        <form className="form-grid" onSubmit={guardarNombre}>
          <h3 className="profile-section-title">Datos personales</h3>
          <label className="field">
            <span className="label">Nombre</span>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              required
            />
          </label>
          {errorNombre && <p className="field-error">{errorNombre}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
            <button className="btn btn-primary" disabled={busyNombre}>
              {busyNombre ? "Guardando..." : "Guardar nombre"}
            </button>
          </div>
        </form>

        <hr className="profile-divider" />

        <form className="form-grid" onSubmit={guardarPassword}>
          <h3 className="profile-section-title">Cambiar contraseña</h3>
          <label className="field">
            <span className="label">Contraseña actual</span>
            <input
              className="input"
              type="password"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span className="label">Nueva contraseña</span>
            <input
              className="input"
              type="password"
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label className="field">
            <span className="label">Confirmar nueva contraseña</span>
            <input
              className="input"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          {errorPassword && <p className="field-error">{errorPassword}</p>}
          <div className="modal-actions">
            <button className="btn btn-primary" disabled={busyPassword}>
              {busyPassword ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
