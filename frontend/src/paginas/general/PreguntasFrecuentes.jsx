import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Icono from "../../componentes/Iconos.jsx";
import { preguntasDe } from "../../utilidades/preguntas";

/** Preguntas frecuentes del rol. ?p=N abre esa pregunta (viene del buscador). */
export default function PreguntasFrecuentes() {
  const rol = useAuth().sesion.usuario.rol;
  const preguntas = preguntasDe(rol);
  const pedida = new URLSearchParams(useLocation().search).get("p");
  const abierta = pedida === null ? -1 : Number(pedida); // sin ?p= todas cerradas
  const lista = useRef(null);

  useEffect(() => {
    lista.current?.querySelector("details[open]")?.scrollIntoView({ block: "center" });
  }, [abierta]);

  return (<>
    <div className="cabecera-pagina">
      <div>
        <h1>Preguntas frecuentes</h1>
        <p>Lo que más se pregunta sobre la asistencia y la app. ¿No está tu duda? Escríbenos en Soporte.</p>
      </div>
    </div>
    <div className="lista-preguntas" ref={lista}>
      {preguntas.map((p, i) => (
        <details key={p.pregunta} className="pregunta" open={i === abierta || undefined}>
          <summary><Icono nombre="ayuda" /> {p.pregunta}</summary>
          <p>{p.respuesta}</p>
        </details>
      ))}
    </div>
    <Link className="boton suave" to="/soporte" style={{ marginTop: 18 }}><Icono nombre="alerta" /> Reportar un problema</Link>
  </>);
}
