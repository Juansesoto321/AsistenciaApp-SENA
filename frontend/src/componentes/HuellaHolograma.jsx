import EscanerHuella from "./EscanerHuella.jsx";

/**
 * La huella del lector como un holograma: el escáner de siempre dentro de un
 * marco con esquinas de luz, flotando sobre una base de anillos que laten.
 * Recibe lo mismo que EscanerHuella (estado, encendidas). Es decorativa: lo
 * que pasa (marcó o no) lo dice el texto de al lado.
 */
export default function HuellaHolograma({ className = "", ...escaner }) {
  return (
    <div className={`holograma ${className}`} aria-hidden="true">
      <span className="holograma-halo" />
      <div className="holograma-marco">
        <EscanerHuella {...escaner} />
      </div>
      <span className="holograma-base"><i /><i /><i /></span>
    </div>
  );
}
