/**
 * Iconos del menú en SVG. No se usan emojis: varios de los que necesitamos son
 * recientes y Windows 10 no trae la fuente que los dibuja, así que se ven como
 * un cuadro vacío (ya nos pasó con la huella 🫆 y el salvavidas 🛟).
 * Todos heredan el color del texto con `currentColor`.
 */
const TRAZOS = {
  panel: (
    <>
      <line x1="3" y1="20.5" x2="21" y2="20.5" />
      <rect x="5" y="11" width="3.6" height="9.5" rx="1" />
      <rect x="10.2" y="5.5" width="3.6" height="15" rx="1" />
      <rect x="15.4" y="14" width="3.6" height="6.5" rx="1" />
    </>
  ),
  usuarios: (
    <>
      <path d="M15.5 20.5v-1.6a3.9 3.9 0 0 0-3.9-3.9H6.4a3.9 3.9 0 0 0-3.9 3.9v1.6" />
      <circle cx="9" cy="7.4" r="3.4" />
      <path d="M21.5 20.5v-1.6a3.9 3.9 0 0 0-2.9-3.8" />
      <path d="M15.6 4.2a3.4 3.4 0 0 1 0 6.4" />
    </>
  ),
  fichas: (
    <>
      <path d="M5 5a2 2 0 0 1 2-2h12v14H7a2 2 0 0 0-2 2z" />
      <path d="M5 19a2 2 0 0 0 2 2h12" />
      <line x1="9" y1="7.5" x2="15" y2="7.5" />
    </>
  ),
  ambientes: (
    <>
      <line x1="2.5" y1="21" x2="21.5" y2="21" />
      <path d="M4.5 21V9.2L12 4.5l7.5 4.7V21" />
      <path d="M9.8 21v-5.2h4.4V21" />
      <line x1="9.8" y1="10.5" x2="14.2" y2="10.5" />
    </>
  ),
  horarios: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2.8" x2="8" y2="6.5" />
      <line x1="16" y1="2.8" x2="16" y2="6.5" />
    </>
  ),
  competencias: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  sesiones: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  justificaciones: (
    <>
      <path d="M14 3H7.5A2 2 0 0 0 5.5 5v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7.6z" />
      <path d="M14 3v4.6h4.5" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </>
  ),
  reportes: (
    <>
      <circle cx="11" cy="11" r="6.6" />
      <line x1="15.8" y1="15.8" x2="20.5" y2="20.5" />
    </>
  ),
  configuracion: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M18.4 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.5 1.5 0 0 0-1.4.9z" />
    </>
  ),
  notificaciones: (
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.6 8.5-2.6 8.5h17.2S18 15 18 8.5" />
      <path d="M13.7 20.5a2 2 0 0 1-3.4 0" />
    </>
  ),
  perfil: (
    <>
      <path d="M19.5 20.5v-1.8a4 4 0 0 0-4-4h-7a4 4 0 0 0-4 4v1.8" />
      <circle cx="12" cy="7.2" r="3.8" />
    </>
  ),
  asistencia: (
    <>
      <line x1="9.5" y1="6" x2="19" y2="6" />
      <line x1="9.5" y1="12" x2="19" y2="12" />
      <line x1="9.5" y1="18" x2="19" y2="18" />
      <path d="M4.2 6l1.3 1.3L7.9 4.8" />
      <path d="M4.2 12l1.3 1.3 2.4-2.5" />
      <path d="M4.2 18l1.3 1.3 2.4-2.5" />
    </>
  ),
  llave: (
    <>
      <circle cx="7.5" cy="15.5" r="4" />
      <path d="M10.4 12.6 20 3" />
      <path d="M16.5 6.5 19 9" />
      <path d="M14 9l2 2" />
    </>
  ),
  subir: (
    <>
      <path d="M20.5 15v3.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V15" />
      <path d="M7.5 8 12 3.5 16.5 8" />
      <line x1="12" y1="3.5" x2="12" y2="15" />
    </>
  ),
  descargar: (
    <>
      <path d="M20.5 15v3.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V15" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <line x1="12" y1="15" x2="12" y2="3.5" />
    </>
  ),
  adjunto: (
    <path d="M20.4 11.1 12 19.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
  ),
  menu: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  cerrar: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  verificado: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12.3l2.5 2.5 5.1-5.3" />
    </>
  ),
  alerta: (
    <>
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9.5" x2="12" y2="13.5" />
      <circle cx="12" cy="16.8" r=".6" fill="currentColor" />
    </>
  ),
  salir: (
    <>
      <path d="M9.5 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h3.5" />
      <path d="M15.5 16.5 20 12l-4.5-4.5" />
      <line x1="20" y1="12" x2="9.5" y2="12" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  luna: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  contraer: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <line x1="9.5" y1="4" x2="9.5" y2="20" />
      <path d="m15.5 9.5-2.5 2.5 2.5 2.5" />
    </>
  ),
  expandir: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <line x1="9.5" y1="4" x2="9.5" y2="20" />
      <path d="m13 9.5 2.5 2.5-2.5 2.5" />
    </>
  ),
  ordenar: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  arriba: <path d="m7 14 5-5 5 5" />,
  abajo: <path d="m7 10 5 5 5-5" />,
  pdf: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 16.5h4" />
    </>
  ),
  registro: (
    <>
      <path d="M8 4h11a1.5 1.5 0 0 1 1.5 1.5V20H8" />
      <path d="M8 4a2.5 2.5 0 0 0-2.5 2.5V20H20.5" />
      <path d="M11 8.5h6M11 12h6M11 15.5h4" />
    </>
  ),
};

export default function Icono({ nombre, size = "1.05em", style, ...props }) {
  const trazos = TRAZOS[nombre];
  if (!trazos) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "-0.18em", flexShrink: 0, ...style }}
      {...props}
    >
      {trazos}
    </svg>
  );
}
