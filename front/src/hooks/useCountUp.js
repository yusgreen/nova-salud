import { useEffect, useRef, useState } from "react";

// Anima de `from` (último valor visible) a `target` con easeOutCubic.
// fromRef guarda el valor mostrado en cada tick, así si el target cambia
// a mitad de la animación (ej. llega una venta por socket) NO salta a 0:
// arranca desde donde estaba. Eso es lo que hace que el número "suba suave".
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    // Respeta prefers-reduced-motion: salta directo al valor, sin animar.
    if (typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const diff = target - from;
    if (diff === 0) { setValue(target); return; }

    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);          // easeOutCubic
      const current = from + diff * eased;
      fromRef.current = current;                     // recuerda el último visible
      setValue(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current); // cleanup: sin RAF huérfano al desmontar
  }, [target, duration]);

  return value;
}