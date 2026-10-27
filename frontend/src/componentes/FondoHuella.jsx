/**
 * Fondo de las pantallas de acceso: las líneas de una huella enorme y tenue
 * que asoma por la esquina de abajo a la derecha, sobre el azul del tema.
 * Sin brillos ni filtros: es decorativo (aria-hidden), queda fijo detrás de
 * todo y los colores salen de estilos.css (ver .fondo-huella).
 */

// Crestas de la huella: elipses cada vez más grandes, cortadas en algunos
// tramos (como las crestas reales) y giradas un poco cada una.
const CRESTAS = Array.from({ length: 18 }, (_, i) => {
  const rx = 70 + i * 38;
  const corte = 8 + ((i * 37) % 23); // tramo cortado, distinto en cada cresta
  return { rx, ry: rx * 1.22, giro: -24 + (i % 5) * 3, trazo: `${100 - corte - 3} ${corte}`, inicio: (i * 17) % 100 };
});

export default function FondoHuella() {
  return (
    <div className="fondo-huella" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <g transform="translate(1460 900)">
          {CRESTAS.map(({ rx, ry, giro, trazo, inicio }) => (
            <ellipse
              key={rx} rx={rx} ry={ry} transform={`rotate(${giro})`} pathLength="100"
              className="fondo-cresta" strokeDasharray={trazo} strokeDashoffset={inicio}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
