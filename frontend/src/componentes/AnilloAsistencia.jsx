/**
 * Anillo con el porcentaje de asistencia. Verde si cumple el mínimo, ámbar si
 * va justo (hasta 15 puntos por debajo) y rojo si está lejos del mínimo.
 * Al aparecer, el anillo se llena y el número sube contando.
 */
import { useEffect, useState } from "react";
import Contador from "./Contador.jsx";

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

  const color = colorAsistencia(porcentaje, minimo);
  const grosor = Math.round(tamano / 11);
  const radio = (tamano - grosor) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const centro = tamano / 2;
  return (
    <div className="anillo-progreso" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} role="img" aria-label={`Asistencia ${porcentaje}%`}>
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke="var(--borde)" strokeWidth={grosor} />
        <circle className="anillo-trazo" cx={centro} cy={centro} r={radio} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
                strokeDasharray={circunferencia} strokeDashoffset={circunferencia * (1 - (lleno ? porcentaje : 0) / 100)}
                transform={`rotate(-90 ${centro} ${centro})`} />
      </svg>
      <div className="centro" style={{ color, fontSize: Math.round(tamano / 5) }} aria-hidden="true">
        <span><Contador valor={porcentaje} />%</span>
      </div>
    </div>
  );
}
