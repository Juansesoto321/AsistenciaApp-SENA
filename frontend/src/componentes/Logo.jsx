/**
 * Ícono de AsistenciaApp SENA: una huella dentro del marco de un escáner,
 * cruzada por la línea de escaneo. Es la versión de una sola tinta del logo
 * (el de color está en feria/logo/logo-icono.svg): toma el color del texto
 * (blanco sobre el recuadro verde), con menos crestas para leerse a 16 px.
 * El mismo dibujo está en public/favicon.svg (ícono de la pestaña).
 * No es el logosímbolo del SENA: ese se usa con su archivo oficial.
 */
const CRESTAS = [
  // [radio x, radio y, cortes, inicio]: el corte largo cae abajo, como una huella real
  [2.3, 3, "64 36", 43],
  [4.8, 6, "36 6 38 20", 36],
  [7.2, 8.6, "42 6 38 14", 32],
];

export default function Logo({ size = "1em", colorLinea = "currentColor", style, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      style={{ width: size, height: size, display: "block", flexShrink: 0, ...style }}
      {...props}
    >
      <path strokeWidth="2" d="M2.6 7.8V5a2.4 2.4 0 0 1 2.4-2.4h2.8M16.2 2.6H19A2.4 2.4 0 0 1 21.4 5v2.8M21.4 16.2V19a2.4 2.4 0 0 1-2.4 2.4h-2.8M7.8 21.4H5A2.4 2.4 0 0 1 2.6 19v-2.8" />
      {CRESTAS.map(([rx, ry, cortes, inicio]) => (
        <ellipse key={rx} cx="12" cy="12.6" rx={rx} ry={ry} strokeWidth="1.6" pathLength="100" strokeDasharray={cortes} strokeDashoffset={-inicio} />
      ))}
      <line x1="1.2" y1="10.2" x2="22.8" y2="10.2" stroke={colorLinea} strokeWidth="1.5" />
    </svg>
  );
}
