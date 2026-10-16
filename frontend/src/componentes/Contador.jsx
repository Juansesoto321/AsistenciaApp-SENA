/**
 * Número que sube contando hasta su valor, y de un valor al siguiente cuando
 * cambia (por ejemplo, con cada marca de una clase en vivo). Respeta
 * "reducir movimiento" y deja pasar tal cual lo que no sea un número ("—").
 */
import { useEffect, useRef, useState } from "react";
import { reducirMovimiento } from "../utilidades/movimiento";

const DURACION_MS = 900;

export default function Contador({ valor }) {
  const objetivo = Number(valor);
  const esNumero = valor !== null && valor !== undefined && valor !== "" && Number.isFinite(objetivo);
  const [mostrado, setMostrado] = useState(() => (esNumero && !reducirMovimiento() ? 0 : objetivo));
  const actual = useRef(mostrado);

  useEffect(() => {
    if (!esNumero) return;
    if (reducirMovimiento()) { actual.current = objetivo; setMostrado(objetivo); return; }
    const origen = Number.isFinite(actual.current) ? actual.current : 0; // antes era "—"
    const inicio = performance.now();
    let cuadro;
    const avanzar = (ahora) => {
      const t = Math.min((ahora - inicio) / DURACION_MS, 1);
      actual.current = origen + (objetivo - origen) * (1 - (1 - t) ** 3); // frena al final
      setMostrado(actual.current);
      if (t < 1) cuadro = requestAnimationFrame(avanzar);
    };
    cuadro = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(cuadro);
  }, [objetivo, esNumero]);

  if (!esNumero) return <>{valor ?? "—"}</>;
  const decimales = (String(objetivo).split(".")[1] || "").length; // 87.5 se sigue viendo 87.5
  return <>{mostrado.toFixed(decimales)}</>;
}
