/**
 * Indicador de carga: líneas grises que brillan donde va a aparecer el
 * contenido (esqueleto), en vez de un giro sobre una pantalla vacía. Evita
 * mostrar "no hay datos" mientras la consulta todavía está en curso. El texto
 * lo leen los lectores de pantalla.
 */
const ANCHOS = [92, 74, 84, 60];

export default function Cargando({ texto = "Cargando…", lineas = 3 }) {
  return (
    <div className="esqueleto" role="status" aria-live="polite">
      <span className="sr-only">{texto}</span>
      {Array.from({ length: lineas }, (_, i) => (
        <span key={i} className="esqueleto-linea" style={{ width: `${ANCHOS[i % ANCHOS.length]}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}
