/**
 * Fondo del tema oscuro: arcos de luz neón y destellos sobre negro, como el
 * resplandor de un lector. Es decorativo (aria-hidden) y queda fijo detrás de
 * todo; en el tema claro no se muestra (ver .fondo-neon en estilos.css).
 * "tenue" lo apaga un poco para las páginas con muchas tarjetas.
 */
import { useId } from "react";

/**
 * Un arco de circunferencia entre dos ángulos (en grados, 0 = a la derecha,
 * crecen en el sentido del reloj): el círculo se gira hasta "desde" y el
 * trazo cubre solo la parte que va hasta "hasta".
 */
function Arco({ cx, cy, r, desde, hasta, ...props }) {
  return (
    <circle
      cx={cx} cy={cy} r={r} fill="none" pathLength="100"
      strokeDasharray={`${(hasta - desde) / 3.6} 100`} strokeLinecap="round"
      transform={`rotate(${desde} ${cx} ${cy})`} {...props}
    />
  );
}

/** Destello de cuatro puntas, como un reflejo de luz. */
function Destello({ x, y, tamano = 1, filtro }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${tamano})`} filter={filtro}>
      <circle r="9" fill="#ffffff" opacity="0.35" />
      <path d="M0-26C1.6-4 4-1.6 26 0 4 1.6 1.6 4 0 26-1.6 4-4 1.6-26 0-4-1.6-1.6-4 0-26Z" fill="#ffffff" />
    </g>
  );
}

const DESTELLOS = [[1030, 152, 0.8], [1578, 462, 1.1], [832, 456, 0.9], [826, 716, 1], [1218, 176, 0.6], [1314, 770, 0.75]];

export default function FondoNeon({ tenue = false }) {
  const id = useId().replace(/:/g, "");
  const brillo = `url(#brillo-${id})`;
  const brilloFuerte = `url(#brillo-fuerte-${id})`;
  return (
    <div className={`fondo-neon${tenue ? " tenue" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id={`brillo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="difuso" />
            <feMerge><feMergeNode in="difuso" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`brillo-fuerte-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="16" result="difuso" />
            <feMerge><feMergeNode in="difuso" /><feMergeNode in="difuso" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={`curva-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1fa84f" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#3ee67a" />
            <stop offset="0.62" stopColor="#d9ffe6" />
            <stop offset="0.8" stopColor="#3ee67a" stopOpacity="0.6" />
            <stop offset="1" stopColor="#3ee67a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`halo-${id}`}>
            <stop offset="0" stopColor="#3ee67a" stopOpacity="0.13" />
            <stop offset="1" stopColor="#3ee67a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ondas grises muy suaves a la izquierda */}
        <path d="M-50 560C240 470 430 520 640 640S1010 820 1250 900H-50Z" fill="#ffffff" opacity="0.025" />
        <path d="M-50 360C200 300 380 330 560 430S860 600 1000 640" fill="none" stroke="#ffffff" strokeWidth="60" opacity="0.02" />
        <ellipse cx="1240" cy="480" rx="520" ry="460" fill={`url(#halo-${id})`} />

        {/* Anillos alrededor del formulario */}
        <Arco cx={1240} cy={470} r={430} desde={-158} hasta={78} stroke="#1f9d4a" strokeWidth="2" opacity="0.7" />
        <Arco cx={1240} cy={470} r={470} desde={30} hasta={150} stroke="#1f9d4a" strokeWidth="1.5" opacity="0.45" />
        <Arco cx={1240} cy={470} r={455} desde={-142} hasta={-104} stroke="#ffffff" strokeWidth="2" opacity="0.55" filter={brillo} />
        <Arco cx={1240} cy={480} r={338} desde={-32} hasta={40} stroke="#ffffff" strokeWidth="2.5" opacity="0.8" filter={brillo} />

        {/* Arco grueso de arriba a la derecha y curva de abajo a la izquierda */}
        <Arco cx={1390} cy={800} r={690} desde={-113} hasta={-66} stroke="#3ee67a" strokeWidth="12" filter={brilloFuerte} />
        <Arco cx={1390} cy={800} r={690} desde={-104} hasta={-80} stroke="#e9fff0" strokeWidth="4" />
        <path
          d="M-40 650C170 840 470 920 690 800S860 660 1010 580"
          fill="none" stroke={`url(#curva-${id})`} strokeWidth="9" strokeLinecap="round" filter={brilloFuerte}
        />

        {!tenue && DESTELLOS.map(([x, y, t]) => <Destello key={`${x}-${y}`} x={x} y={y} tamano={t} filtro={brillo} />)}
      </svg>
    </div>
  );
}
