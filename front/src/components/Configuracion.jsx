import { useEffect, useState } from "react";
import { useConfig } from "../context/ConfigContext";
import { formatearMoneda } from "../services/format";
import { IconConfiguracion, IconLogo } from "./Icons";

const CAMPOS = [
  "nombreNegocio",
  "lema",
  "moneda",
  "umbralStockBajo",
  "mostrarAyudaDemo",
];

export default function Configuracion() {
  const { config, actualizar } = useConfig();
  const [form, setForm] = useState(config);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(config);
  }, [config]);

  const cambios = CAMPOS.some((campo) =>
    campo === "umbralStockBajo"
      ? Number(form.umbralStockBajo) !== config.umbralStockBajo
      : form[campo] !== config[campo]
  );

  function set(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setOk("");
    setError("");
  }

  function descartar() {
    setForm(config);
    setOk("");
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      await actualizar({
        nombreNegocio: String(form.nombreNegocio).trim(),
        lema: String(form.lema).trim(),
        moneda: String(form.moneda).trim(),
        umbralStockBajo: Number(form.umbralStockBajo),
        mostrarAyudaDemo: form.mostrarAyudaDemo,
      });
      setOk("Configuración guardada. Los cambios ya se aplican en todo el sistema.");
    } catch (err) {
      setError(err.message || "No se pudo guardar la configuración");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="config-page">
      <header className="config-head">
        <div className="config-title">
          <span className="config-icon" aria-hidden="true">
            <IconConfiguracion />
          </span>
          <div>
            <h2>Configuración</h2>
            <p className="muted">
              Ajustes globales del sistema. Solo el administrador puede modificarlos.
            </p>
          </div>
        </div>
        <span className="config-badge">Solo admin</span>
      </header>

      <div className="config-grid">
        <form className="config-card" onSubmit={onSubmit}>
          <section className="config-section">
            <h3>Identidad</h3>
            <label>
              Nombre del negocio
              <input
                value={form.nombreNegocio}
                onChange={(e) => set("nombreNegocio", e.target.value)}
                minLength={2}
                maxLength={60}
                required
              />
            </label>
            <label>
              Lema o descripción
              <input
                value={form.lema}
                onChange={(e) => set("lema", e.target.value)}
                maxLength={120}
              />
            </label>
          </section>

          <section className="config-section">
            <h3>Operación</h3>
            <div className="config-row">
              <label>
                Símbolo de moneda
                <input
                  value={form.moneda}
                  onChange={(e) => set("moneda", e.target.value)}
                  maxLength={4}
                  required
                />
              </label>
              <label>
                Umbral de stock bajo
                <input
                  type="number"
                  min="0"
                  max="100000"
                  value={form.umbralStockBajo}
                  onChange={(e) =>
                    set(
                      "umbralStockBajo",
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  required
                />
              </label>
            </div>
            <p className="config-help">
              Se usa como stock mínimo inicial al crear un producto nuevo.
            </p>
          </section>

          <section className="config-section">
            <h3>Acceso</h3>
            <label className="config-switch">
              <span>
                <strong>Mostrar credenciales demo</strong>
                <span className="muted small">
                  Muestra la pista de acceso en la pantalla de Login.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.mostrarAyudaDemo}
                onChange={(e) => set("mostrarAyudaDemo", e.target.checked)}
              />
            </label>
          </section>

          {error && <p className="status error">{error}</p>}
          {ok && <p className="status ok">{ok}</p>}

          <div className="config-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={descartar}
              disabled={!cambios || busy}
            >
              Descartar
            </button>
            <button type="submit" className="btn-primary" disabled={!cambios || busy}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>

        <aside className="config-preview">
          <p className="config-kicker">Vista previa</p>
          <div className="config-brandcard">
            <span className="config-logo" aria-hidden="true">
              <IconLogo />
            </span>
            <div>
              <strong>{form.nombreNegocio || "Nova Salud"}</strong>
              <span>{form.lema || "Sin lema"}</span>
            </div>
          </div>

          <div className="config-demo">
            <span>Ticket de ejemplo</span>
            <strong>{formatearMoneda(24.9, form.moneda || "S/")}</strong>
          </div>

          <ul className="config-facts">
            <li>
              Stock mínimo inicial:{" "}
              <strong>{form.umbralStockBajo === "" ? "—" : form.umbralStockBajo}</strong>
            </li>
            <li>
              Ayuda demo en Login:{" "}
              <strong>{form.mostrarAyudaDemo ? "visible" : "oculta"}</strong>
            </li>
            <li>Los cambios se aplican a todos los usuarios.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
