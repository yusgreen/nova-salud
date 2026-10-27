import { useConfig } from "../context/ConfigContext";
import { IconLogo } from "./Icons";
import { IlustracionFarmacia } from "./Illustrations";

export default function AuthLayout({ children }) {
  const { config } = useConfig();

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <aside className="auth-showcase">
          <div className="auth-showcase-brand">
            <span className="auth-logo"><IconLogo aria-hidden="true" /></span>
            <div>
              <strong>{config.nombreNegocio}</strong>
              <span>{config.lema}</span>
            </div>
          </div>

          <IlustracionFarmacia className="auth-illustration" />

          <ul className="auth-benefits">
            <li><span className="auth-dot" /> Inventario y stock en tiempo real</li>
            <li><span className="auth-dot" /> Ventas rápidas con trazabilidad</li>
            <li><span className="auth-dot" /> Alertas de reposición automáticas</li>
          </ul>
        </aside>

        <div className="auth-form-panel">{children}</div>
      </div>
    </div>
  );
}
