/**
 * Anillo con el porcentaje de asistencia. Si cumple el mínimo va con el
 * degradado verde → cian, que gira despacio; ámbar si va justo (hasta 15
 * puntos por debajo) y rojo si está lejos del mínimo.
 * Al aparecer, el anillo se llena y el número sube contando.
 */
import { useEffect, useId, useState } from "react";
import Contador from "./Contador.jsx";
import { reducirMovimiento } from "../utilidades/movimiento";

export function colorAsistencia(porcentaje, minimo = 80) {
  if (porcentaje >= minimo) return "var(--verde)";
  if (porcentaje >= minimo - 15) return "var(--ambar)";
  return "var(--rojo)";
}

export default function AnilloAsistencia({ porcentaje, minimo = 80, tamano = 120 }) {
  // Empieza vacío y en el siguiente cuadro pasa al valor: la transición del CSS lo llena
  const [lleno, setLleno] = useState(false);
  useEffect(() => {
    let segundo;
    const primero = requestAnimationFrame(() => { segundo = requestAnimationFrame(() => setLleno(true)); });
    return () => { cancelAnimationFrame(primero); cancelAnimationFrame(segundo); };
  }, []);

  const idDegradado = `anillo-${useId().replace(/:/g, "")}`;
  const color = colorAsistencia(porcentaje, minimo);
  const cumple = porcentaje >= minimo;
  const grosor = Math.round(tamano / 11);
  const radio = (tamano - grosor) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const centro = tamano / 2;
  return (
    <div className="anillo-progreso" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} role="img" aria-label={`Asistencia ${porcentaje}%`}>
        {cumple && (
          <defs>
            <linearGradient id={idDegradado} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#39a900" />
              <stop offset="0.5" stopColor="#3ee67a" />
              <stop offset="1" stopColor="#2fd3e0" />
              {!reducirMovimiento() && (
                <animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="6s" repeatCount="indefinite" />
              )}
            </linearGradient>
          </defs>
        )}
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke="var(--borde)" strokeWidth={grosor} />
        <circle className="anillo-trazo" cx={centro} cy={centro} r={radio} fill="none" stroke={cumple ? `url(#${idDegradado})` : color} strokeWidth={grosor} strokeLinecap="round"
                strokeDasharray={circunferencia} strokeDashoffset={circunferencia * (1 - (lleno ? porcentaje : 0) / 100)}
                transform={`rotate(-90 ${centro} ${centro})`} />
      </svg>
      <div className={`centro${cumple ? " electrico" : ""}`} style={{ color, fontSize: Math.round(tamano / 5) }} aria-hidden="true">
        <span><Contador valor={porcentaje} />%</span>
      </div>
    </div>
  );
}
