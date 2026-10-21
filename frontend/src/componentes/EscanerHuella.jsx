/**
 * Huella grande de la pantalla de inicio de sesión, inspirada en la pantalla
 * del lector y dibujada con luz neón: las crestas se encienden a medida que la
 * persona escribe, una línea de escaneo la cruza (y la recorre mientras se
 * verifican los datos), tiembla en rojo si no se pudo entrar y, al entrar, se
 * recoge y aparece el logo (el visto de "presente").
 *
 * Es decorativa (aria-hidden): lo que pasa se anuncia en el formulario.
 * Las animaciones viven en estilos.css y se apagan con "reducir movimiento".
 */
import { useEffect, useId, useState } from "react";
import Logo from "./Logo.jsx";

// Mismo dibujo que IconoHuella, con más crestas: [radio x, radio y, patrón, desfase]
const CRESTAS = [
  [7, 9, "70 30", 40],
  [16, 20, "62 7 31", 12],
  [25, 31, "50 6 36 8", 30],
  [34, 42, "42 7 39 12", 20],
  [43, 53, "56 9 27 8", 6],
  [52, 64, "38 8 44 10", 34],
  [61, 75, "47 10 33 10", 14],
  [70, 86, "35 9 41 15", 26],
  [79, 97, "30 12 38 20", 44],
];
export const TOTAL_CRESTAS = CRESTAS.length;

/**
 * estado: "espera" | "leyendo" | "error" | "exito" | "marca" (el haz pasa una vez)
 *         | "registrada" (toda en verde: el aprendiz ya marcó)
 * encendidas: cuántas crestas se iluminan (de adentro hacia afuera)
 * intento: al cambiar, se repite la animación del estado (temblar, pasar el haz)
 */
export default function EscanerHuella({ estado = "espera", encendidas = 0, intento = 0, className = "" }) {
  // La huella "brota" y el haz pasa una vez al abrir la página
  const [entrando, setEntrando] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntrando(false), 2000);
    return () => clearTimeout(t);
  }, []);
  // Dos huellas en la misma página no pueden compartir los id del <defs>
  const id = useId().replace(/:/g, "");

  return (
    <div
      className={`escaner escaner-${estado}${entrando ? " escaner-entrando" : ""} ${className}`}
      style={{ "--brillo": encendidas / TOTAL_CRESTAS }}
      aria-hidden="true"
    >
      <svg key={intento} className="escaner-huella" viewBox="0 0 200 230" fill="none" strokeLinecap="round">
        <defs>
          <clipPath id={`forma-${id}`}>
            <ellipse cx="100" cy="118" rx="86" ry="104" />
          </clipPath>
          <linearGradient id={`haz-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d4efc2" stopOpacity="0" />
            <stop offset="0.6" stopColor="#d4efc2" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {CRESTAS.map(([rx, ry, patron, desfase], i) => (
          <ellipse
            key={rx}
            className={`cresta${i < encendidas ? " encendida" : ""}`}
            style={{ "--i": i }}
            cx="100" cy="118" rx={rx} ry={ry}
            pathLength="100" strokeDasharray={patron} strokeDashoffset={desfase}
          />
        ))}
        <g clipPath={`url(#forma-${id})`}>
          <rect className="escaner-haz" x="0" y="-36" width="200" height="36" fill={`url(#haz-${id})`} />
        </g>
        {/* Línea de escaneo: cruza la huella de lado a lado y se sale un poco */}
        <line className="escaner-linea" x1="-26" y1="118" x2="226" y2="118" />
      </svg>
      <div className="escaner-logo">
        <Logo size="100%" colorVisto="var(--fondo)" />
      </div>
    </div>
  );
}
