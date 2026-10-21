import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Icono from "../../componentes/Iconos.jsx";
import { fechaHora, haceCuanto } from "../../utilidades/formato";

/** Ícono y color de cada tipo de aviso, para reconocerlo de un vistazo. */
const ESTILOS = {
  inasistencia: ["alerta", "rojo"],
  asistencia: ["asistencia", "verde"],
  solicitud_registro: ["usuarios", "azul"],
  soporte: ["configuracion", "ambar"],
  biometria: ["llave", "azul"],
  lector: ["ambientes", "rojo"],
};

const COORDINACION = ["coordinador", "programador"];
/**
 * A dónde lleva el aviso: el enlace que trae (p. ej. la justificación que hay
 * que revisar) o, en los avisos anteriores a los enlaces, la página de su tipo.
 */
function enlaceDe(n, rol) {
  if (n.enlace) return n.enlace;
  const personal = rol !== "aprendiz";
  if (n.tipo === "justificacion" || n.tipo === "inasistencia") return personal ? (n.tipo === "justificacion" ? "/justificaciones" : null) : "/mis-justificaciones";
  if (n.tipo === "asistencia") return personal ? null : "/mi-asistencia";
  if (n.tipo === "solicitud_registro") return rol === "coordinador" ? "/usuarios" : null;
  if (n.tipo === "soporte") return "/soporte";
  if (n.tipo === "lector") return COORDINACION.includes(rol) ? "/ambientes" : "/sesiones";
  return null;
}
function estiloDe(n) {
  if (n.tipo === "justificacion") {
    if (/rechazada/i.test(n.titulo)) return ["justificaciones", "rojo"];
    if (/aprobada/i.test(n.titulo)) return ["justificaciones", "verde"];
    return ["justificaciones", "ambar"]; // nueva por revisar
  }
  return ESTILOS[n.tipo] || ["notificaciones", "azul"];
}

export default function Notificaciones() {
  const rol = useAuth().sesion.usuario.rol;
  const [lista, setLista] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargar = () =>
    api("/notificaciones")
      .then(setLista)
      .catch((e) => { setLista([]); setMensaje({ tipo: "error", texto: e.message }); });
  useEffect(() => { cargar(); }, []);

  async function marcarLeida(n) {
    try {
      await api(`/notificaciones/${n.id_notificacion}/leida`, { method: "PATCH" });
      cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function marcarTodas() {
    try {
      const r = await api("/notificaciones/leidas", { method: "PATCH" });
      setMensaje({ tipo: "exito", texto: `${r.marcadas} notificación(es) marcada(s) como leída(s).` });
      cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  const sinLeer = lista ? lista.filter((n) => !n.leida).length : 0;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Notificaciones</h1>
          <p>Inasistencias, justificaciones, solicitudes y avisos del sistema.</p>
        </div>
        {sinLeer > 0 && (
          <button className="boton suave" onClick={marcarTodas}>Marcar todas como leídas ({sinLeer})</button>
        )}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {lista === null ? <Cargando /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {lista.map((n) => {
            const [icono, tono] = estiloDe(n);
            const enlace = enlaceDe(n, rol);
            return (
              <div key={n.id_notificacion} className={`tarjeta notificacion${n.leida ? " leida" : ""}`}>
                <span className={`icono-notificacion ${tono}`} aria-hidden="true"><Icono nombre={icono} size="1.2em" /></span>
                <div className="cuerpo-notificacion">
                  <b>{n.titulo}</b>
                  <p>{n.mensaje}</p>
                  <small><span title={fechaHora(n.creado_en)}>{haceCuanto(n.creado_en)}</span>{!n.leida && <> · <span className="sin-leer">Sin leer</span></>}</small>
                </div>
                <div className="acciones-notificacion">
                  {enlace && (
                    // Abrirla también la marca como leída
                    <Link className="boton mini" to={enlace} onClick={() => { if (!n.leida) marcarLeida(n); }}>Ver →</Link>
                  )}
                  {!n.leida && <button className="boton mini suave" onClick={() => marcarLeida(n)}>Marcar leída</button>}
                </div>
              </div>
            );
          })}
          {!lista.length && <Vacio icono="notificaciones" titulo="No tienes notificaciones">Aquí te avisaremos de inasistencias, justificaciones y novedades de tu cuenta.</Vacio>}
        </div>
      )}
    </>
  );
}
