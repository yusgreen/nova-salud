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

      {/* Ilustración: acceso seguro a la salud */}
      <div className="auth-illustration" aria-hidden="true">
        <svg viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="novaShield" x1="60" y1="60" x2="260" y2="280" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34d399" />
              <stop offset="1" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>

          {/* Fondo */}
          <circle cx="160" cy="160" r="152" fill="var(--action-soft)" opacity="0.75" />
          <circle cx="160" cy="160" r="118" fill="var(--action-soft)" opacity="0.7" />

          {/* Sombra */}
          <ellipse cx="160" cy="286" rx="72" ry="11" fill="#0f172a" opacity="0.08" />

          {/* Escudo */}
          <path d="M160 68 L238 96 V176 C238 224 203 258 160 274 C117 258 82 224 82 176 V96 Z" fill="url(#novaShield)" />
          <path d="M160 82 L224 105 V175 C224 215 195 244 160 258 C125 244 96 215 96 175 V105 Z" fill="#ffffff" opacity="0.16" />

          {/* Cruz médica */}
          <rect x="150" y="126" width="20" height="80" rx="6" fill="#ffffff" />
          <rect x="120" y="156" width="80" height="20" rx="6" fill="#ffffff" />

          {/* Cápsula superior izquierda */}
          <g transform="rotate(-25 86 98)">
            <rect x="58" y="86" width="56" height="24" rx="12" fill="#f472b6" />
            <line x1="86" y1="86" x2="86" y2="110" stroke="#ffffff" strokeWidth="2" opacity="0.55" />
            <rect x="63" y="91" width="15" height="6" rx="3" fill="#ffffff" opacity="0.4" />
          </g>

          {/* Cápsula inferior derecha */}
          <g transform="rotate(25 250 236)">
            <rect x="222" y="224" width="56" height="24" rx="12" fill="#818cf8" />
            <line x1="250" y1="224" x2="250" y2="248" stroke="#ffffff" strokeWidth="2" opacity="0.55" />
            <rect x="227" y="236" width="15" height="6" rx="3" fill="#ffffff" opacity="0.4" />
          </g>

          {/* Frasco superior derecho */}
          <g>
            <rect x="252" y="104" width="16" height="10" rx="3" fill="#0284c7" />
            <rect x="246" y="112" width="28" height="46" rx="9" fill="#7dd3fc" />
            <rect x="257" y="126" width="6" height="18" rx="2" fill="#ffffff" opacity="0.9" />
            <rect x="251" y="132" width="18" height="6" rx="2" fill="#ffffff" opacity="0.9" />
          </g>

          {/* Destellos */}
          <path d="M64 176 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="#fbbf24" />
          <path d="M44 56 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 z" fill="#38bdf8" opacity="0.9" />
          <circle cx="52" cy="140" r="5" fill="#34d399" opacity="0.5" />
          <circle cx="272" cy="196" r="7" fill="#34d399" opacity="0.35" />
          <circle cx="240" cy="60" r="4" fill="#f472b6" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
