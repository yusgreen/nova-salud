import { useEffect, useState } from "react";
import { useConfig } from "../context/ConfigContext";
import { useTheme } from "../context/ThemeContext";
import { usePreferencias } from "../context/PreferenciasContext";
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
  const { preferencia, cambiarTema } = useTheme();
  const { prefs, actualizar: actualizarPrefs } = usePreferencias();
  const [tab, setTab] = useState("apariencia");
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
              {tab === "sistema"
                ? "Ajustes globales del sistema. Solo el administrador puede modificarlos."
                : "Ajustes de este navegador. Se guarda en este navegador."}
            </p>
          </div>
        </div>
        {tab === "sistema" && <span className="config-badge">Solo admin</span>}
      </header>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          { v: "apariencia", t: "Apariencia" },
          { v: "preferencias", t: "Preferencias" },
          { v: "sistema", t: "Sistema" },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            className={`tab ${tab === o.v ? "active" : ""}`}
            onClick={() => setTab(o.v)}
          >
            {o.t}
          </button>
        ))}
      </div>

      {tab === "apariencia" && (
        <div className="config-card">
          <section className="config-section">
            <h3>Tema</h3>
            <div className="tabs">
              {[
                { v: "light", t: "Claro" },
                { v: "dark", t: "Oscuro" },
                { v: "system", t: "Sistema" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className={`tab ${preferencia === o.v ? "active" : ""}`}
                  onClick={() => cambiarTema(o.v)}
                >
                  {o.t}
                </button>
              ))}
            </div>
            <p className="config-help">
              Se guarda en este navegador. "Sistema" sigue la preferencia del SO.
            </p>
          </section>

          <section className="config-section">
            <h3>Modo compacto</h3>
            <div className="config-switch">
              <span>
                <strong>Activar modo compacto</strong>
                <span className="muted small">
                  Reduce espaciados y tamaños para mostrar más información.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.compacto}
                className={`status-switch ${prefs.compacto ? "on" : ""}`}
                onClick={() => actualizarPrefs({ compacto: !prefs.compacto })}
              >
                <span className="status-switch-dot" />
              </button>
            </div>
          </section>

          <section className="config-section">
            <h3>Tamaño de fuente</h3>
            <label>
              Tamaño
              <select
                value={prefs.tamanoFuente}
                onChange={(e) => actualizarPrefs({ tamanoFuente: e.target.value })}
              >
                <option value="pequeno">Pequeño</option>
                <option value="medio">Mediano</option>
                <option value="grande">Grande</option>
              </select>
            </label>
          </section>
        </div>
      )}

      {tab === "preferencias" && (
        <div className="config-card">
          <section className="config-section">
            <h3>Formato y paginación</h3>
            <div className="config-row">
              <label>
                Formato de fecha
                <select
                  value={prefs.formatoFecha}
                  onChange={(e) => actualizarPrefs({ formatoFecha: e.target.value })}
                >
                  <option value="dd/mm/yyyy">DD/MM/AAAA</option>
                  <option value="mm/dd/yyyy">MM/DD/AAAA</option>
                  <option value="yyyy-mm-dd">AAAA-MM-DD</option>
                </select>
              </label>
              <label>
                Filas por página
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={prefs.filasPorPagina}
                  onChange={(e) =>
                    actualizarPrefs({
                      filasPorPagina: e.target.value === "" ? prefs.filasPorPagina : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <p className="config-help">
              Se guarda en este navegador.
            </p>
          </section>
        </div>
      )}

      {tab === "sistema" && (
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
              <button
                type="button"
                role="switch"
                aria-checked={form.mostrarAyudaDemo}
                className={`status-switch ${form.mostrarAyudaDemo ? "on" : ""}`}
                onClick={() => set("mostrarAyudaDemo", !form.mostrarAyudaDemo)}
              >
                <span className="status-switch-dot" />
              </button>
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
      )}
    </div>
  );
}
