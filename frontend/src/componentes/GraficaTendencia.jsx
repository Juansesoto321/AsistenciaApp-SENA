/**
 * Asistencia de cada día (últimos 7 o 30 días) como línea. Los días sin
 * clases no tienen punto: la línea se corta en vez de caer a 0 %.
 * `datos` viene de GET /api/reportes/tendencia: [{ fecha, registros, porcentaje }].
 */
import { fechaCorta } from "../utilidades/formato";

const ANCHO = 560;
const ALTO = 210;
const MARGEN = { arriba: 12, derecha: 12, abajo: 30, izquierda: 44 };

// "2026-10-13" se lee como fecha local (sin la "T" el navegador la toma en UTC y cambia de día)
const diaMes = (iso) => fechaCorta(`${iso}T00:00:00`).replace(/ \d{4}$/, "");

export default function GraficaTendencia({ datos, minimo = 80 }) {
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (i) => MARGEN.izquierda + (datos.length === 1 ? ancho / 2 : (i * ancho) / (datos.length - 1));
  const y = (porcentaje) => MARGEN.arriba + alto - (porcentaje / 100) * alto;
  const base = y(0);

  // Tramos de días seguidos con clases
  const tramos = [];
  let tramo = [];
  datos.forEach((d, i) => {
    if (d.porcentaje === null) {
      if (tramo.length) tramos.push(tramo);
      tramo = [];
    } else tramo.push({ ...d, cx: x(i), cy: y(d.porcentaje) });
  });
  if (tramo.length) tramos.push(tramo);

  const etiquetasX = [0, Math.floor((datos.length - 1) / 2), datos.length - 1];

  return (
    <svg className="grafica-tendencia" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img"
      aria-label={`Asistencia por día de los últimos ${datos.length} días`}>
      {[0, 50, 100].map((p) => (
        <g key={p}>
          <line className="rejilla" x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(p)} y2={y(p)} />
          <text className="eje" x={MARGEN.izquierda - 8} y={y(p) + 4} textAnchor="end">{p} %</text>
        </g>
      ))}
      <line className="linea-minimo" x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(minimo)} y2={y(minimo)} />
      <text className="eje minimo" x={ANCHO - MARGEN.derecha} y={y(minimo) - 5} textAnchor="end">mínimo {minimo} %</text>

      {tramos.map((t) => {
        const linea = t.map((p, i) => `${i ? "L" : "M"}${p.cx},${p.cy}`).join(" ");
        const area = `${linea} L${t[t.length - 1].cx},${base} L${t[0].cx},${base} Z`;
        return (
          <g key={t[0].fecha}>
            {t.length > 1 && <path className="area" d={area} />}
            {t.length > 1 && <path className="linea" d={linea} />}
          </g>
        );
      })}
      {tramos.flat().map((p) => (
        <circle key={p.fecha} className={p.porcentaje < minimo ? "punto bajo" : "punto"} cx={p.cx} cy={p.cy} r={datos.length > 14 ? 3.5 : 5}>
          <title>{`${diaMes(p.fecha)}: ${p.porcentaje} % (${p.registros} registros)`}</title>
        </circle>
      ))}

      {[...new Set(etiquetasX)].map((i) => (
        <text key={i} className="eje" x={x(i)} y={ALTO - 8}
          textAnchor={i === 0 ? "start" : i === datos.length - 1 ? "end" : "middle"}>
          {diaMes(datos[i].fecha)}
        </text>
      ))}
    </svg>
  );
}
