// Placeholders de carga. Se enchufan en P2 reemplazando los <p className="status">Cargando…</p>.
export function SkeletonCard() { return <div className="skeleton skeleton-card" aria-hidden="true" />; }
export function SkeletonRow() { return <div className="skeleton skeleton-row" aria-hidden="true" />; }
export function SkeletonText({ w = "w-full" }) { return <div className={`skeleton skeleton-text ${w}`} aria-hidden="true" />; }

export function SkeletonGrid({ count = 4, variant = "card" }) {
  const Unit = variant === "row" ? SkeletonRow : SkeletonCard;
  return (
    <div className="skeleton-grid" role="status" aria-label="Cargando">
      {Array.from({ length: count }).map((_, i) => <Unit key={i} />)}
    </div>
  );
}

export function SkeletonLines({ count = 3 }) {
  const widths = ["w-70", "w-full", "w-40"];
  return (
    <div className="skeleton-stack" role="status" aria-label="Cargando">
      {Array.from({ length: count }).map((_, i) => <SkeletonText key={i} w={widths[i % widths.length]} />)}
    </div>
  );
}

// Columna de placeholders (simula listas verticales: tickets, filas de producto).
export function SkeletonStack({ count = 3, variant = "card" }) {
  const Unit = variant === "row" ? SkeletonRow : SkeletonCard;
  return (
    <div className="skeleton-stack" role="status" aria-label="Cargando">
      {Array.from({ length: count }).map((_, i) => <Unit key={i} />)}
    </div>
  );
}
