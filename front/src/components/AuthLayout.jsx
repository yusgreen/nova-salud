import { useConfig } from "../context/ConfigContext";
import { IconLogo } from "./Icons";

export default function AuthLayout({ children }) {
  const { config } = useConfig();

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <header className="auth-header">
          <span className="auth-logo"><IconLogo aria-hidden="true" /></span>
          <div className="auth-brand">
            <strong className="auth-name">{config.nombreNegocio}</strong>
            <span className="auth-tagline">{config.lema}</span>
          </div>
        </header>

        <div className="auth-body">{children}</div>

        {config.mostrarAyudaDemo && (
          <footer className="auth-demo">
            <span>Acceso demo</span>
            <span className="auth-demo-cred">admin@novasalud.pe · admin123</span>
          </footer>
        )}
      </div>
    </div>
  );
}
