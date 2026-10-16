/**
 * Mini gráfica de la asistencia por día (sin ejes): la forma de la tendencia
 * de un vistazo, con la línea punteada del mínimo. La gráfica completa está
 * en GraficaTendencia.
 */
const ANCHO = 160;
const ALTO = 40;

export default function Tendencia({ datos, minimo, leyenda }) {
  const puntos = (datos || []).filter((d) => d.porcentaje !== null).map((d) => Number(d.porcentaje));
  if (puntos.length < 2) return null;
  const y = (p) => ALTO - 3 - (p / 100) * (ALTO - 6);
  const x = (i) => (i / (puntos.length - 1)) * ANCHO;
  const linea = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const ultimo = puntos[puntos.length - 1];
  const sube = ultimo >= puntos[0];

  return (
    <div className="tendencia-anillo">
      <svg className="mini-tendencia" viewBox={`0 0 ${ANCHO} ${ALTO}`} width={ANCHO} height={ALTO}
           role="img" aria-label={`Tendencia: de ${puntos[0]} % a ${ultimo} % (${sube ? "sube" : "baja"})`}>
        <line x1="0" x2={ANCHO} y1={y(minimo)} y2={y(minimo)} className="mini-tendencia-minimo" />
        <polyline points={linea} className="mini-tendencia-linea" />
        <circle cx={x(puntos.length - 1)} cy={y(ultimo)} r="3" className="mini-tendencia-punto" />
      </svg>
      {leyenda && <small>{leyenda}</small>}
    </div>
  );
}
