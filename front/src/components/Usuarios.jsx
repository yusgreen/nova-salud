import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { SkeletonLines } from "./Skeleton";
import { IconPlus, IconUsuarios } from "./Icons";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

const ROLES = [
  { valor: "admin", etiqueta: "Administrador" },
  { valor: "farmaceutico", etiqueta: "Farmacéutico" },
  { valor: "cajero", etiqueta: "Cajero" },
];

const FORM_INICIAL = {
  nombre: "",
  email: "",
  password: "",
  rol: "cajero",
};

function iniciales(nombre) {
  return String(nombre || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function Usuarios() {
  const { usuario } = useAuth();
  const { notificar } = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [confirmacion, setConfirmacion] = useState(null);
  const [confirmError, setConfirmError] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const resumen = useMemo(() => {
    const activos = usuarios.filter((u) => u.activo).length;
    return {
      total: usuarios.length,
      activos,
      inactivos: usuarios.length - activos,
    };
  }, [usuarios]);

  useEffect(() => {
    let activo = true;
    api
      .get("/users")
      .then((data) => {
        if (activo) {
          setUsuarios(data);
          setError("");
        }
      })
      .catch((e) => {
        if (activo) setError(e.message || "No se pudo cargar la lista de usuarios");
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  function abrirNuevo() {
    setForm(FORM_INICIAL);
    setErrorForm("");
    setNuevoAbierto(true);
  }

  function cerrarNuevo() {
    if (guardando) return;
    setNuevoAbierto(false);
    setErrorForm("");
  }

  function setCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrorForm("");
  }

  async function cambiarRol(usuarioEditado, rol) {
    if (rol === usuarioEditado.rol || busyId !== null) return;
    setBusyId(usuarioEditado.id);
    try {
      const data = await api.put(`/users/${usuarioEditado.id}`, { rol });
      setUsuarios((prev) =>
        prev.map((u) => (u.id === usuarioEditado.id ? data.user : u))
      );
      notificar(`Rol de ${usuarioEditado.nombre} actualizado`, "success");
    } catch (e) {
      notificar(e.message || "No se pudo cambiar el rol", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function guardarNuevo(e) {
    e.preventDefault();
    setErrorForm("");

    const nombre = form.nombre.trim();
    const email = form.email.trim();
    if (nombre.length < 2) {
      setErrorForm("El nombre debe tener al menos 2 caracteres");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErrorForm("Ingresa un email válido");
      return;
    }
    if (form.password.length < 6) {
      setErrorForm("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!ROLES.some((r) => r.valor === form.rol)) {
      setErrorForm("Selecciona un rol válido");
      return;
    }

    setGuardando(true);
    try {
      const data = await api.post("/users", {
        nombre,
        email,
        password: form.password,
        rol: form.rol,
      });
      setUsuarios((prev) =>
        [...prev, data.user].sort((a, b) => a.id - b.id)
      );
      notificar(`Usuario ${data.user.nombre} creado`, "success");
      setNuevoAbierto(false);
      setForm(FORM_INICIAL);
    } catch (err) {
      setErrorForm(err.message || "No se pudo crear el usuario");
    } finally {
      setGuardando(false);
    }
  }

  function pedirCambioEstado(usuarioEditado) {
    if (usuarioEditado.id === usuario?.id) return;
    setConfirmError("");
    setConfirmacion({ usuario: usuarioEditado, activo: !usuarioEditado.activo });
  }

  async function confirmarCambioEstado() {
    if (!confirmacion || confirmando) return;
    setConfirmando(true);
    setConfirmError("");
    try {
      const data = await api.put(`/users/${confirmacion.usuario.id}/estado`, {
        activo: confirmacion.activo,
      });
      setUsuarios((prev) =>
        prev.map((u) => (u.id === data.user.id ? data.user : u))
      );
      notificar(
        `${data.user.nombre} ${data.user.activo ? "activado" : "desactivado"}`,
        "success"
      );
      setConfirmacion(null);
    } catch (e) {
      setConfirmError(e.message || "No se pudo cambiar el estado");
    } finally {
      setConfirmando(false);
    }
  }

  if (loading) return <SkeletonLines count={6} />;
  if (error) return <p className="status error">{error}</p>;

  const mensajeConfirmacion = confirmacion
    ? confirmacion.activo
      ? `¿Activar a ${confirmacion.usuario.nombre}? Podrá iniciar sesión nuevamente.`
      : `¿Desactivar a ${confirmacion.usuario.nombre}? No podrá iniciar sesión y sus tokens dejarán de funcionar.`
    : "";

  return (
    <div className="users">
      <header className="page-head">
        <div>
          <p className="kicker">Usuarios</p>
          <h2 className="page-title">Equipo</h2>
          <p className="page-sub">Administra roles y accesos del equipo.</p>
        </div>
        <div className="toolbar-row">
          <span className="badge badge-neutral">Solo admin</span>
          <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
            <IconPlus className="icon-sm" aria-hidden="true" />
            Nuevo usuario
          </button>
        </div>
      </header>

      <div className="stat-strip">
        <span className="stat-chip"><strong>{resumen.total}</strong> total</span>
        <span className="stat-chip"><strong>{resumen.activos}</strong> activos</span>
        <span className={`stat-chip ${resumen.inactivos > 0 ? "is-warning" : ""}`}>
          <strong>{resumen.inactivos}</strong> inactivos
        </span>
      </div>

      {usuarios.length === 0 ? (
        <div className="empty-state">
          <IconUsuarios className="icon-lg" aria-hidden="true" />
          <h3 className="empty-state-title">No hay usuarios todavía</h3>
          <p className="empty-state-message">
            Crea el primer usuario para dar acceso al sistema.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const esYo = u.id === usuario?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <span className="avatar" aria-hidden="true">
                          {iniciales(u.nombre)}
                        </span>
                        <span className="cell-user-label">
                          <strong>{u.nombre}</strong>
                          {esYo && <span className="badge badge-info">Tú</span>}
                        </span>
                      </div>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <select
                        className="select role-select"
                        value={u.rol}
                        onChange={(e) => cambiarRol(u, e.target.value)}
                        disabled={esYo || busyId === u.id}
                        title={
                          esYo
                            ? "No puedes cambiar tu propio rol"
                            : `Cambiar rol de ${u.nombre}`
                        }
                        aria-label={`Rol de ${u.nombre}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.valor} value={r.valor}>
                            {r.etiqueta}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="status-cell">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={u.activo}
                          aria-label={`${u.activo ? "Desactivar" : "Activar"} a ${u.nombre}`}
                          className={`switch ${u.activo ? "is-on" : ""}`}
                          onClick={() => pedirCambioEstado(u)}
                          disabled={esYo}
                          title={
                            esYo
                              ? "No puedes desactivar tu propia cuenta"
                              : `${u.activo ? "Desactivar" : "Activar"} a ${u.nombre}`
                          }
                        />
                        <span className={`status-label ${u.activo ? "is-on" : ""}`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {nuevoAbierto && (
        <Modal titulo="Nuevo usuario" onClose={cerrarNuevo}>
          <form className="form-grid" onSubmit={guardarNuevo}>
            <label className="field">
              <span className="label">Nombre</span>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setCampo("nombre", e.target.value)}
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setCampo("email", e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="field">
              <span className="label">Contraseña</span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setCampo("password", e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field">
              <span className="label">Rol</span>
              <select
                className="select"
                value={form.rol}
                onChange={(e) => setCampo("rol", e.target.value)}
                required
              >
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            {errorForm && <p className="field-error">{errorForm}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={cerrarNuevo} disabled={guardando}>
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={guardando}>
                {guardando ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmacion && (
        <ConfirmDialog
          titulo={confirmacion.activo ? "Activar usuario" : "Desactivar usuario"}
          mensaje={mensajeConfirmacion}
          error={confirmError}
          peligro={!confirmacion.activo}
          onCancel={() => {
            if (!confirmando) setConfirmacion(null);
          }}
          onConfirm={confirmarCambioEstado}
        />
      )}
    </div>
  );
}
