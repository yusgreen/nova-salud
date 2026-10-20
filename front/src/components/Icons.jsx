// Iconos de línea (heredan currentColor → se pintan solos según active/inactive).
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconInventario({ className, ...p }) {
  return (
    <svg className={className} {...base} {...p}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconCaja({ className, ...p }) {
  return (
    <svg className={className} {...base} {...p}>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

export function IconVentas({ className, ...p }) {
  return (
    <svg className={className} {...base} {...p}>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </svg>
  );
}

export function IconAuditoria({ className, ...p }) {
  return (
    <svg className={className} {...base} {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

// Logo de marca: cruz sólida de farmacia (fill, no línea).
export function IconLogo({ className, ...p }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
    </svg>
  );
}

export function IconPanel({ className, ...p }) {
  return (
    <svg className={className} {...base} {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}