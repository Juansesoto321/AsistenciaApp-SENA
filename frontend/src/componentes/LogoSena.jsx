/**
 * Logo del SENA en SVG (redibujado a partir de la imagen que entregó el
 * equipo): la cabeza, la palabra SENA y la figura. Toma el color del texto
 * (currentColor): verde SENA en claro, más brillante en oscuro (ver
 * .logo-sena en estilos.css). `titulo`: si va solo, el nombre que lee el
 * lector de pantalla; sin título es decorativo (ya hay texto al lado).
 */
export default function LogoSena({ size = "1em", titulo, className = "", style }) {
  return (
    <svg
      className={`logo-sena ${className}`} viewBox="95 80 1065 1080" fill="currentColor"
      style={{ width: size, height: size, flexShrink: 0, ...style }}
      role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : "true"}
    >
      <circle cx="626" cy="217" r="127" />
      <path d="M351 427H272C266 412 248 405 233 405C212 405 200 412 200 420C200 428 210 432 225 434L268 441C320 450 355 462 355 492C355 525 320 548 240 548C160 548 119 530 119 492H193C198 508 212 515 236 515C262 515 274 506 274 496C274 486 262 483 245 480L205 474C150 466 128 448 128 427C128 395 165 375 240 375C310 375 345 395 351 427Z" />
      <path d="M379 377H578V412H455V440H568V478H455V507H580V543H379Z" />
      <path d="M605 377H690L780 470V377H853V543H762L678 450V543H605Z" />
      <path fillRule="evenodd" d="M857 543L956 377H1040L1138 543H1057L1043 516H950L936 543ZM967 481H1025L996 421Z" />
      <path d="M105 584H565L306 1032L236 975L426 662H103Z" />
      <path d="M692 584H1148L1150 662H830L1015 975L945 1033Z" />
      <path d="M626 660L888 1090L815 1150L626 818L437 1148L362 1092Z" />
    </svg>
  );
}
