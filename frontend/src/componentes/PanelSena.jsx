/**
 * Piezas del panel (todos los roles): la portada con la foto de la sede, la
 * frase del día, el lector, la sede con su mapa, la tarjeta de aliento, las
 * cifras de color con su mini gráfica y los accesos. Panel.jsx las acomoda
 * en dos columnas: lo del día a la izquierda y la sede y el lector a la derecha.
 */
import { Link } from "react-router-dom";
import Icono from "./Iconos.jsx";
import IconoHuella from "./IconoHuella.jsx";
import LogoSena from "./LogoSena.jsx";
import Contador from "./Contador.jsx";
import { saludo } from "../utilidades/formato";
import { SEDE, fraseDelDia } from "../utilidades/sede";
import fotoFachada from "../assets/img/sede-fachada.webp";
import fotoCalle from "../assets/img/sede-calle.webp";
import fotoLector from "../assets/img/lector-zkteco.webp";

/** Portada: saludo y nombre sobre la foto de la sede. `detalle`: programa o rol. */
export function PortadaSede({ nombre, detalle, llegada }) {
  return (
    <section className={`portada-sede${llegada ? " saludo-llegada" : ""}`}>
      <img className="portada-foto" src={fotoFachada} alt="" />
      <div className="portada-texto">
        <p className="portada-saludo">{saludo()},</p>
        <h1 className="portada-nombre">{nombre}</h1>
        {detalle && <p className="portada-detalle">{detalle}</p>}
        <p className="portada-sede-nombre">{SEDE.nombre}</p>
        <p className="portada-direccion"><Icono nombre="ubicacion" /> {SEDE.direccion}, {SEDE.ciudad}</p>
      </div>
    </section>
  );
}

export function TarjetaFrase() {
  return (
    <aside className="tarjeta-frase" aria-label="Frase del día">
      <span className="frase-punto" aria-hidden="true" />
      <p>{fraseDelDia()}</p>
      <LogoSena className="frase-logo" size="46px" />
      <svg className="frase-ondas" viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M0 ${70 - i * 6} C 80 ${40 - i * 8}, 160 ${95 - i * 4}, 300 ${30 - i * 6}`} />
        ))}
      </svg>
    </aside>
  );
}

/**
 * El lector del ambiente con su estado. `estado`: "listo" | "registrada" | "alerta".
 * `titulo` y `texto` cambian por rol (el aprendiz ve si ya marcó; el personal,
 * cuántos lectores tienen señal).
 */
export function TarjetaLector({ titulo = "Registro de asistencia", subtitulo = "Acerca tu huella al lector", estado = "listo", texto }) {
  return (
    <section className="tarjeta-lector">
      <header>
        <span className="tarjeta-lector-icono"><IconoHuella size="1.2em" /></span>
        <div>
          <h3>{titulo}</h3>
          <p>{subtitulo}</p>
        </div>
      </header>
      <div className={`lector-anillo ${estado}`} aria-hidden="true">
        <IconoHuella size="58px" />
      </div>
      <p className={`chip-lector ${estado}`} role="status"><span aria-hidden="true" />{texto}</p>
      <div className="lector-foto">
        <img src={fotoLector} alt="Lector de huella ZKTeco SenseFace 2A" />
      </div>
    </section>
  );
}

export function TarjetaSede() {
  return (
    <section className="tarjeta-sede">
      <div className="tarjeta-sede-datos">
        <span className="tarjeta-sede-pin"><Icono nombre="ubicacion" size="1.3em" /></span>
        <div>
          <h3>Tu sede</h3>
          <p className="tarjeta-sede-centro">{SEDE.centro}</p>
          <p>{SEDE.direccion}, {SEDE.ciudad}</p>
        </div>
        <a className="boton mini suave" href={SEDE.mapa} target="_blank" rel="noreferrer">
          Ver en mapa <Icono nombre="flecha" /><span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </div>
      <figure className="tarjeta-sede-foto">
        <img src={fotoCalle} alt="Edificio de la sede del SENA CGMLTI sobre la calle 52" />
        <figcaption>Sede principal · SENA CGMLTI</figcaption>
      </figure>
    </section>
  );
}

export function TarjetaAliento({ titulo }) {
  return (
    <aside className="tarjeta-aliento">
      <LogoSena className="aliento-logo" size="34px" />
      <IconoHuella className="aliento-huella" size="150px" />
      <p>{titulo}</p>
      <span className="aliento-linea" aria-hidden="true" />
    </aside>
  );
}

/** Línea suave de una serie de números (de más antiguo a más reciente), con su área. */
function MiniSerie({ puntos }) {
  const ancho = 120;
  const alto = 34;
  const max = Math.max(...puntos, 1);
  const paso = puntos.length > 1 ? ancho / (puntos.length - 1) : ancho;
  const xy = puntos.map((v, i) => [i * paso, alto - 3 - (v / max) * (alto - 8)]);
  const linea = xy.map(([x, y], i) => {
    if (!i) return `M${x} ${y}`;
    const [px, py] = xy[i - 1];
    const medio = (px + x) / 2;
    return `C${medio} ${py} ${medio} ${y} ${x} ${y}`;
  }).join(" ");
  return (
    <svg className="mini-serie" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="mini-serie-area" d={`${linea} L${ancho} ${alto} L0 ${alto} Z`} />
      <path className="mini-serie-linea" d={linea} />
    </svg>
  );
}

/**
 * Cifra de color con su ícono. `tono`: verde | ambar | azul | rojo | morado.
 * `porcentaje` (opcional) va arriba a la derecha y `serie` dibuja la mini gráfica.
 * `a` la vuelve un enlace; `atencion` la resalta (algo espera respuesta).
 */
export function Estadistica({ valor, nombre, tono = "verde", icono, porcentaje, serie, a, atencion }) {
  const contenido = (<>
    <span className="estadistica-icono" aria-hidden="true"><Icono nombre={icono} size="1.25em" /></span>
    <div className="estadistica-cifra">
      <span className="estadistica-valor">
        {atencion && <span className="pulso" aria-hidden="true" />}
        <Contador valor={valor} />
      </span>
      <span className="estadistica-nombre">{nombre}</span>
    </div>
    {porcentaje !== undefined && porcentaje !== null && <span className="estadistica-porcentaje">{porcentaje} %</span>}
    {serie?.length > 1 && <MiniSerie puntos={serie} />}
  </>);
  const clase = `estadistica ${tono}${a ? " enlace" : ""}`;
  return a ? <Link to={a} className={clase}>{contenido}</Link> : <div className={clase}>{contenido}</div>;
}

const TONOS = ["verde", "azul", "morado", "rojo"];

/** Accesos rápidos de colores. `accesos`: [[ruta, icono, texto], …] */
export function AccesosColor({ accesos }) {
  return (
    <section className="tarjeta accesos-color">
      <h3><Icono nombre="rayo" /> Accesos rápidos</h3>
      <div className="accesos-color-lista">
        {accesos.map(([ruta, icono, texto], i) => (
          <Link key={ruta} to={ruta} className={`acceso-color ${TONOS[i % TONOS.length]}`}>
            <span className="acceso-color-icono" aria-hidden="true"><Icono nombre={icono} size="1.2em" /></span>
            <span className="acceso-color-texto">{texto}</span>
            <Icono nombre="flecha" className="acceso-color-flecha" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Accesos de la parte de abajo: calendario, documentos o reportes, soporte y preguntas. */
export function AccesosAdicionales({ rol }) {
  const lista = [
    ["/horarios", "horarios", "Calendario"],
    rol === "aprendiz" ? ["/mis-documentos", "documento", "Mis documentos"] : ["/reportes", "reportes", "Reportes"],
    ["/soporte", "alerta", "Soporte"],
    ["/preguntas", "ayuda", "Preguntas frecuentes"],
  ];
  return (
    <section className="tarjeta accesos-adicionales">
      <h3><Icono nombre="horarios" /> Accesos adicionales</h3>
      <div className="accesos-adicionales-lista">
        {lista.map(([ruta, icono, texto]) => (
          <Link key={ruta} to={ruta} className="acceso-adicional">
            <Icono nombre={icono} size="1.5em" />
            <span>{texto}</span>
            <Icono nombre="flecha" className="acceso-adicional-flecha" />
          </Link>
        ))}
      </div>
    </section>
  );
}
