/**
 * Columna izquierda de las pantallas de acceso (iniciar sesión, crear cuenta,
 * nueva contraseña): la "pantalla del lector", con la marca, la hora, la
 * huella y una línea de estado con su luz.
 */
import { useEffect, useState } from "react";
import Logo from "./Logo.jsx";
import EscanerHuella from "./EscanerHuella.jsx";

/** Hora y fecha como en la pantalla del lector. */
function Reloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hora = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const [hh, mm] = hora.split(":");
  const fecha = ahora.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="login-reloj">
      <time className="login-hora" dateTime={ahora.toISOString()}>
        {hh}<span className="login-dos-puntos">:</span>{mm}
      </time>
      <span className="login-fecha">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</span>
    </div>
  );
}

/**
 * estado: la luz de la línea de estado ("espera", "leyendo", "error", "exito", "enviado")
 * huella: el estado de la huella, si es distinto (ver EscanerHuella)
 */
export default function EscenarioLector({ estado = "espera", texto, encendidas = 0, intento = 0, huella }) {
  return (
    <section className="login-escenario">
      <div className="login-marca">
        <span className="logo-acceso"><Logo size="1.15em" /></span>
        <span>
          <strong>AsistenciaApp</strong>
          <small>Control de asistencia del SENA</small>
        </span>
      </div>

      <Reloj />

      <EscanerHuella estado={huella ?? estado} encendidas={encendidas} intento={intento} />

      <p className={`login-estado login-estado-${estado}`}>
        <span className="login-led" aria-hidden="true" />
        {texto}
      </p>
    </section>
  );
}
