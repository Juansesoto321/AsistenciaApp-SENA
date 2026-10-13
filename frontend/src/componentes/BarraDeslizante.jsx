import { useRef } from "react";

/**
 * Barra deslizante para elegir una opción entre varias: un "pulgar" de color
 * se desliza sobre la opción elegida. Se puede arrastrar, tocar una opción o
 * usar las flechas del teclado (es un role="slider" accesible).
 *
 * opciones: [{ valor, texto, color }]  (color: cualquier color CSS, p. ej. "var(--verde)")
 */
export default function BarraDeslizante({ opciones, valor, alCambiar, etiqueta }) {
  const pista = useRef(null);
  const arrastrando = useRef(false);
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor));
  const actual = opciones[indice];

  const elegir = (i) => {
    const limitado = Math.min(opciones.length - 1, Math.max(0, i));
    if (opciones[limitado].valor !== valor) alCambiar(opciones[limitado].valor);
  };

  const elegirPorPosicion = (x) => {
    const caja = pista.current.getBoundingClientRect();
    elegir(Math.floor(((x - caja.left) / caja.width) * opciones.length));
  };

  function alTeclear(e) {
    const pasos = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (e.key in pasos) { e.preventDefault(); elegir(indice + pasos[e.key]); }
    if (e.key === "Home") { e.preventDefault(); elegir(0); }
    if (e.key === "End") { e.preventDefault(); elegir(opciones.length - 1); }
  }

  return (
    <div
      ref={pista}
      className="barra-deslizante"
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={opciones.length - 1}
      aria-valuenow={indice}
      aria-valuetext={actual.texto}
      style={{ "--n": opciones.length, "--i": indice, "--color": actual.color }}
      onPointerDown={(e) => {
        arrastrando.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        elegirPorPosicion(e.clientX);
      }}
      onPointerMove={(e) => { if (arrastrando.current) elegirPorPosicion(e.clientX); }}
      onPointerUp={() => { arrastrando.current = false; }}
      onPointerCancel={() => { arrastrando.current = false; }}
      onKeyDown={alTeclear}
    >
      <span className="pulgar" aria-hidden="true" />
      {opciones.map((o, i) => (
        <span key={o.valor} className={`segmento ${i === indice ? "activo" : ""}`}>{o.texto}</span>
      ))}
    </div>
  );
}
