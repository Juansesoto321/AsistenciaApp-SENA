/**
 * Clase en curso en el panel: la misma huella del inicio de sesión, que se va
 * encendiendo a medida que los aprendices marcan, y las últimas marcas en vivo.
 */
import { Link } from "react-router-dom";
import EscanerHuella, { TOTAL_CRESTAS } from "./EscanerHuella.jsx";
import Contador from "./Contador.jsx";
import { horaCorta } from "../utilidades/formato";

const ESTADO = { presente: "Presente", tardanza: "Tardanza", justificada: "Justificada", ausente: "Ausente" };
const horaDeMarca = (fecha) => new Date(fecha).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

/**
 * marcas: las últimas que llegaron por Socket.IO en esta sesión (la más reciente primero)
 * recibidas: cuántas han llegado en total; con cada una el haz vuelve a pasar por la huella
 */
export default function ClaseEnCurso({ clase, marcas = [], recibidas = 0, verInstructor }) {
  const marcaron = clase.presentes + clase.tardanzas + clase.justificadas;
  const total = clase.matriculados;
  const encendidas = total ? Math.round((marcaron / total) * TOTAL_CRESTAS) : 0;

  return (
    <section className="en-curso">
      <EscanerHuella
        className="en-curso-huella"
        estado={recibidas ? "marca" : "espera"}
        encendidas={encendidas}
        intento={recibidas}
      />
      <div className="en-curso-datos">
        <p className="en-curso-titulo"><span className="pulso" />Clase en curso</p>
        <p className="en-curso-detalle">
          Ficha {clase.numero_ficha}, ambiente {clase.numero_ambiente}, hasta las {horaCorta(clase.hora_fin)}
          {verInstructor && clase.instructor ? `. ${clase.instructor}` : ""}
        </p>
        <p className="en-curso-cifra" aria-live="polite">
          <b><Contador valor={marcaron} /></b>
          <span>de {total} {total === 1 ? "aprendiz ha" : "aprendices han"} marcado</span>
        </p>
        {marcas.length > 0 && (
          <ul className="en-curso-marcas">
            {marcas.map((m) => (
              <li key={m.clave}>
                <b>{m.nombres} {m.apellidos?.split(" ")[0]}</b>
                <span className={`insignia ${m.estado}`}>{ESTADO[m.estado] || m.estado}</span>
                <time dateTime={m.hora_marca}>{horaDeMarca(m.hora_marca)}</time>
              </li>
            ))}
          </ul>
        )}
        <Link className="boton en-curso-boton" to={`/sesiones/${clase.id_sesion}`}>Ver la clase en vivo</Link>
      </div>
    </section>
  );
}
