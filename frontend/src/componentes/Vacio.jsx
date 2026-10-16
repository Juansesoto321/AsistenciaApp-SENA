import Icono from "./Iconos.jsx";
import IconoHuella from "./IconoHuella.jsx";

/**
 * Estado vacío con ícono: explica por qué no hay nada y, si aplica, qué hacer.
 * El ícono de la sección va sobre una huella tenue, el sello de la app.
 * Uso: <Vacio icono="justificaciones" titulo="No hay justificaciones">Texto de ayuda</Vacio>
 */
export default function Vacio({ icono = "panel", titulo, children }) {
  return (
    <div className="vacio">
      <div className="vacio-sello" aria-hidden="true">
        <IconoHuella size="100%" className="vacio-huella" />
        <span className="vacio-icono"><Icono nombre={icono} size="1.35em" /></span>
      </div>
      {titulo && <p className="vacio-titulo">{titulo}</p>}
      {children && <p className="vacio-texto">{children}</p>}
    </div>
  );
}
