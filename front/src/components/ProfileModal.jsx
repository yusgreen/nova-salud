import { useEffect, useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";

export default function ProfileModal({ onClose }) {
  const { usuario, actualizarPerfil, cambiarPassword } = useAuth();
  const { preferencia, cambiarTema } = useTheme();
  const { notificar } = useToast();

  const [nombre, setNombre] = useState(usuario?.nombre || "");
  const [avatar, setAvatar] = useState(usuario?.avatar || null);
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busyNombre, setBusyNombre] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);
  const [errorNombre, setErrorNombre] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  useEffect(() => {
    setNombre(usuario?.nombre || "");
    setAvatar(usuario?.avatar || null);
  }, [usuario]);

  async function procesarFoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorNombre("La imagen debe ser menor a 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");

        // Recorte cuadrado centrado
        const size = Math.min(img.width, img.height);
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;

        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 128, 128);
        const base64 = canvas.toDataURL("image/webp", 0.8);
        setAvatar(base64);
        setErrorNombre("");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

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
      await actualizarPerfil({ nombre: limpio, avatar });
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

  function iniciales(n) {
    return String(n || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";
  }

  return (
    <Modal titulo="Mi perfil" onClose={onClose}>
      <div className="profile">
        <div className="profile-header-avatar">
          <div className="avatar-large">
            {avatar ? (
              <img src={avatar} alt="Vista previa" />
            ) : (
              <span>{iniciales(nombre)}</span>
            )}
          </div>
          <div className="avatar-actions">
            <label className="btn btn-ghost btn-sm">
              Cambiar foto
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={procesarFoto} />
            </label>
            {avatar && (
              <button type="button" className="btn btn-ghost btn-sm is-danger" onClick={() => setAvatar(null)}>
                Quitar foto
              </button>
            )}
          </div>
        </div>

        <p className="text-muted small">
          Sesión iniciada como <strong>{usuario?.email}</strong>
        </p>

        <div className="profile-theme">
          <h3 className="profile-section-title">Tema</h3>
          <div className="segmented" role="group" aria-label="Tema de la interfaz">
            {[
              { v: "light", t: "Claro" },
              { v: "dark", t: "Oscuro" },
              { v: "system", t: "Sistema" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                className={`segment ${preferencia === o.v ? "is-active" : ""}`}
                aria-pressed={preferencia === o.v}
                onClick={() => cambiarTema(o.v)}
              >
                {o.t}
              </button>
            ))}
          </div>
        </div>

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
              {busyNombre ? "Guardando..." : "Guardar cambios"}
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
