import { useEffect, useState } from "react";
import { useConfig } from "../context/ConfigContext";
import { useTheme } from "../context/ThemeContext";
import { usePreferencias } from "../context/PreferenciasContext";
import { formatearMoneda } from "../services/format";
import { IconLogo } from "./Icons";

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
    <div className="settings">
      <header className="page-head">
        <div>
          <p className="kicker">Configuración</p>
          <h2 className="page-title">Ajustes</h2>
          <p className="page-sub">
            {tab === "sistema"
              ? "Ajustes globales del sistema. Solo el administrador puede modificarlos."
              : "Ajustes de este navegador. Se guarda en este navegador."}
          </p>
        </div>
        {tab === "sistema" && <span className="badge badge-neutral">Solo admin</span>}
      </header>

      <div className="segmented">
        {[
          { v: "apariencia", t: "Apariencia" },
          { v: "preferencias", t: "Preferencias" },
          { v: "sistema", t: "Sistema" },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            className={`segment ${tab === o.v ? "is-active" : ""}`}
            onClick={() => setTab(o.v)}
          >
            {o.t}
          </button>
        ))}
      </div>

      {tab === "apariencia" && (
        <section className="card settings-card">
          <div className="setting">
            <h3 className="setting-title">Tema</h3>
            <div className="segmented">
              {[
                { v: "light", t: "Claro" },
                { v: "dark", t: "Oscuro" },
                { v: "system", t: "Sistema" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className={`segment ${preferencia === o.v ? "is-active" : ""}`}
                  onClick={() => cambiarTema(o.v)}
                >
                  {o.t}
                </button>
              ))}
            </div>
            <p className="setting-help">
              Se guarda en este navegador. "Sistema" sigue la preferencia del SO.
            </p>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-title">Modo compacto</span>
              <span className="setting-help">
                Reduce espaciados y tamaños para mostrar más información.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.compacto}
              className={`switch ${prefs.compacto ? "is-on" : ""}`}
              onClick={() => actualizarPrefs({ compacto: !prefs.compacto })}
              aria-label="Activar modo compacto"
            />
          </div>

          <label className="field">
            <span className="label">Tamaño de fuente</span>
            <select
              className="select"
              value={prefs.tamanoFuente}
              onChange={(e) => actualizarPrefs({ tamanoFuente: e.target.value })}
            >
              <option value="pequeno">Pequeño</option>
              <option value="medio">Mediano</option>
              <option value="grande">Grande</option>
            </select>
          </label>
        </section>
      )}

      {tab === "preferencias" && (
        <section className="card settings-card">
          <div className="setting">
            <h3 className="setting-title">Formato y paginación</h3>
            <div className="form-grid cols-2">
              <label className="field">
                <span className="label">Formato de fecha</span>
                <select
                  className="select"
                  value={prefs.formatoFecha}
                  onChange={(e) => actualizarPrefs({ formatoFecha: e.target.value })}
                >
                  <option value="dd/mm/yyyy">DD/MM/AAAA</option>
                  <option value="mm/dd/yyyy">MM/DD/AAAA</option>
                  <option value="yyyy-mm-dd">AAAA-MM-DD</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Filas por página</span>
                <input
                  className="input"
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
            <p className="setting-help">Se guarda en este navegador.</p>
          </div>
        </section>
      )}

      {tab === "sistema" && (
        <div className="settings-layout">
          <form className="card settings-card" onSubmit={onSubmit}>
            <section className="setting">
              <h3 className="setting-title">Identidad</h3>
              <label className="field">
                <span className="label">Nombre del negocio</span>
                <input
                  className="input"
                  value={form.nombreNegocio}
                  onChange={(e) => set("nombreNegocio", e.target.value)}
                  minLength={2}
                  maxLength={60}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Lema o descripción</span>
                <input
                  className="input"
                  value={form.lema}
                  onChange={(e) => set("lema", e.target.value)}
                  maxLength={120}
                />
              </label>
            </section>

            <section className="setting">
              <h3 className="setting-title">Operación</h3>
              <div className="form-grid cols-2">
                <label className="field">
                  <span className="label">Símbolo de moneda</span>
                  <input
                    className="input"
                    value={form.moneda}
                    onChange={(e) => set("moneda", e.target.value)}
                    maxLength={4}
                    required
                  />
                </label>
                <label className="field">
                  <span className="label">Umbral de stock bajo</span>
                  <input
                    className="input"
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
              <p className="setting-help">
                Se usa como stock mínimo inicial al crear un producto nuevo.
              </p>
            </section>

            <section className="setting">
              <h3 className="setting-title">Acceso</h3>
              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-title">Mostrar credenciales demo</span>
                  <span className="setting-help">
                    Muestra la pista de acceso en la pantalla de Login.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.mostrarAyudaDemo}
                  className={`switch ${form.mostrarAyudaDemo ? "is-on" : ""}`}
                  onClick={() => set("mostrarAyudaDemo", !form.mostrarAyudaDemo)}
                  aria-label="Mostrar credenciales demo"
                />
              </div>
            </section>

            {error && <p className="status error">{error}</p>}
            {ok && <p className="status ok">{ok}</p>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={descartar}
                disabled={!cambios || busy}
              >
                Descartar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!cambios || busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>

          <aside className="card preview-card">
            <p className="kicker">Vista previa</p>
            <div className="preview-brand">
              <span className="preview-brand-logo" aria-hidden="true">
                <IconLogo />
              </span>
              <div className="preview-brand-text">
                <strong>{form.nombreNegocio || "Nova Salud"}</strong>
                <span>{form.lema || "Sin lema"}</span>
              </div>
            </div>

            <div className="preview-ticket">
              <span>Ticket de ejemplo</span>
              <strong className="font-mono">{formatearMoneda(24.9, form.moneda || "S/")}</strong>
            </div>

            <ul className="preview-facts">
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
