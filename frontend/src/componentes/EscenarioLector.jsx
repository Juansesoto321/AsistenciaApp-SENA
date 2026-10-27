/**
 * Columna izquierda de las pantallas de acceso (iniciar sesión, crear cuenta,
 * nueva contraseña): la marca, lo que ofrece la app, la huella del lector como
 * holograma, que reacciona a lo que pasa en el formulario, el lema y una línea
 * de estado con su luz. También pone el fondo (la foto de la sede, oscurecida),
 * el lema "Formación para la vida" y el pie de página.
 */
import Logo from "./Logo.jsx";
import Icono from "./Iconos.jsx";
import IconoHuella from "./IconoHuella.jsx";
import HuellaHolograma from "./HuellaHolograma.jsx";
import FondoHuella from "./FondoHuella.jsx";
import fotoFachada from "../assets/img/sede-fachada.webp";

const VENTAJAS = [
  [<IconoHuella key="h" size="1.5em" />, "Identidad biométrica", "Tu asistencia con tu huella, segura y confiable."],
  [<Icono key="f" nombre="fichas" size="1.5em" />, "Tu formación", "Clases, horario y justificaciones en un solo lugar."],
  [<Icono key="v" nombre="verificado" size="1.5em" />, "Siempre al día", "Avisos al momento si faltas o te aprueban una excusa."],
];

/**
 * estado: la luz de la línea de estado ("espera", "leyendo", "error", "exito", "enviado")
 * huella: el estado de la huella, si es distinto (ver EscanerHuella)
 */
export default function EscenarioLector({ estado = "espera", texto, encendidas = 0, intento = 0, huella }) {
  // El fondo va fuera de la sección: la sección es "sticky" y lo encerraría
  // en su capa, por encima del formulario.
  return (<>
    <FondoHuella />
    <div className="login-foto" aria-hidden="true"><img src={fotoFachada} alt="" /></div>
    <p className="login-lema" aria-hidden="true">Formación <span>para la vida</span></p>
    <section className="login-escenario">
      <div className="login-marca">
        <span className="logo-acceso"><Logo size="1.15em" /></span>
        <span>
          <strong>Asistencia<em>App</em></strong>
          <small>Servicio Nacional de Aprendizaje</small>
        </span>
      </div>

      <div className="login-centro">
        <ul className="login-ventajas">
          {VENTAJAS.map(([icono, titulo, detalle]) => (
            <li key={titulo}>
              <span className="login-ventaja-icono" aria-hidden="true">{icono}</span>
              <span><b>{titulo}</b>{detalle}</span>
            </li>
          ))}
        </ul>
        <HuellaHolograma className="login-holograma" estado={huella ?? estado} encendidas={encendidas} intento={intento} />
      </div>

      <div className="login-titular">
        <h2>Tu asistencia, <span>conectada</span></h2>
        <p>Accede a tu formación desde un solo lugar.</p>
        <p className={`login-estado login-estado-${estado}`}>
          <span className="login-led" aria-hidden="true" />
          {texto}
        </p>
      </div>
    </section>
    <footer className="login-pie">
      <span><Logo size="1.2em" /> <b>SENA</b> · Servicio Nacional de Aprendizaje</span>
      <span className="pie-lemas">Tecnología · Talento · Innovación</span>
    </footer>
  </>);
}
