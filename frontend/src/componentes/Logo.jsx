/**
 * Ícono de AsistenciaApp SENA: un pin de ubicación con un visto, "presente,
 * estoy aquí". El pin toma el color del texto (blanco sobre el recuadro verde)
 * y el visto va en el verde SENA, como si estuviera recortado. Se lee bien
 * incluso a 16 px. El mismo dibujo está en public/favicon.svg (ícono de la
 * pestaña). No es el logosímbolo del SENA: ese se usa con su archivo oficial.
 */
export default function Logo({ size = "1em", colorVisto = "var(--verde-sena)", style, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ width: size, height: size, display: "block", flexShrink: 0, ...style }}
      {...props}
    >
      <path fill="currentColor" d="M12 2.3c-4.3 0-7.7 3.3-7.7 7.5 0 5.5 7.7 12 7.7 12s7.7-6.5 7.7-12c0-4.2-3.4-7.5-7.7-7.5z" />
      <path d="M8.6 9.9l2.3 2.3 4.5-4.7" fill="none" stroke={colorVisto} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
