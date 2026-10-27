/**
 * Fondo de la parte de abajo del menú: cintas de luz hechas de muchas líneas
 * finas (como una malla que se tuerce), puntos de luz sobre la cinta de arriba
 * y el logo del SENA en contorno, como marca de agua. Es decorativo
 * (aria-hidden) y los colores salen de estilos.css (.menu-aurora).
 */
import LogoSena from "./LogoSena.jsx";

const ANCHO = 260;

/**
 * Una cinta: `lineas` curvas casi paralelas que se abren y se cierran. Cada
 * línea se corre un poco y tuerce sus puntos de control al revés que la de al
 * lado, y eso da el efecto de malla.
 */
function cinta({ desde, c1, c2, hasta, lineas, paso, giro }) {
  return Array.from({ length: lineas }, (_, i) => {
    const d = (i - (lineas - 1) / 2) * paso;
    return `M-30 ${desde + d} C 70 ${c1 + d * 2.2 - d * giro}, 170 ${c2 - d * 1.6 + d * giro}, ${ANCHO + 30} ${hasta + d * 0.5}`;
  });
}

const CINTAS = [
  { clase: "cinta-alta", lineas: 16, desde: 300, c1: 250, c2: 260, hasta: 40, paso: 2.4, giro: 1.2 },
  { clase: "cinta-media", lineas: 12, desde: 190, c1: 160, c2: 260, hasta: 250, paso: 2.6, giro: -0.8 },
  { clase: "cinta-baja", lineas: 14, desde: 420, c1: 330, c2: 400, hasta: 300, paso: 2.2, giro: 1 },
];

// Puntos de luz fijos (siempre los mismos, para que no salten al recargar)
const PUNTOS = Array.from({ length: 34 }, (_, i) => {
  const t = (i * 37) % 100 / 100;
  return { x: 40 + t * 190, y: 200 - t * 120 + ((i * 53) % 40) - 20, r: i % 5 === 0 ? 1.6 : 0.9 };
});

export default function AuroraMenu() {
  return (
    <div className="menu-aurora" aria-hidden="true">
      <svg className="menu-ondas" viewBox={`0 0 ${ANCHO} 440`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="menu-cinta" x1="0" y1="0" x2="1" y2="0">
            <stop className="aurora-a" offset="0" />
            <stop className="aurora-b" offset="0.55" />
            <stop className="aurora-c" offset="1" />
          </linearGradient>
        </defs>
        {CINTAS.map((c) => (
          <g key={c.clase} className={`menu-cinta ${c.clase}`}>
            {cinta(c).map((d, i) => <path key={i} d={d} />)}
          </g>
        ))}
        <g className="menu-puntos">
          {PUNTOS.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} />)}
        </g>
      </svg>
      <LogoSena className="menu-marca-agua" size="104px" />
    </div>
  );
}
