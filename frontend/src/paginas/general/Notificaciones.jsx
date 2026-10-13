import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Icono from "../../componentes/Iconos.jsx";
import { fechaHora, haceCuanto } from "../../utilidades/formato";

/** Ícono y color de cada tipo de aviso, para reconocerlo de un vistazo. */
const ESTILOS = {
  inasistencia: ["alerta", "rojo"],
  asistencia: ["asistencia", "verde"],
  solicitud_registro: ["usuarios", "violeta"],
  soporte: ["configuracion", "ambar"],
  biometria: ["llave", "violeta"],
};
function estiloDe(n) {
  if (n.tipo === "justificacion") {
    if (/rechazada/i.test(n.titulo)) return ["justificaciones", "rojo"];
    if (/aprobada/i.test(n.titulo)) return ["justificaciones", "verde"];
    return ["justificaciones", "ambar"]; // nueva por revisar
  }
  return ESTILOS[n.tipo] || ["notificaciones", "violeta"];
}

export default function Notificaciones() {
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
            return (
              <div key={n.id_notificacion} className={`tarjeta notificacion${n.leida ? " leida" : ""}`}>
                <span className={`icono-notificacion ${tono}`} aria-hidden="true"><Icono nombre={icono} size="1.2em" /></span>
                <div className="cuerpo-notificacion">
                  <b>{n.titulo}</b>
                  <p>{n.mensaje}</p>
                  <small><span title={fechaHora(n.creado_en)}>{haceCuanto(n.creado_en)}</span>{!n.leida && <> · <span className="sin-leer">Sin leer</span></>}</small>
                </div>
                {!n.leida && <button className="boton mini suave" onClick={() => marcarLeida(n)}>Marcar leída</button>}
              </div>
            );
          })}
          {!lista.length && <Vacio icono="notificaciones" titulo="No tienes notificaciones">Aquí te avisaremos de inasistencias, justificaciones y novedades de tu cuenta.</Vacio>}
        </div>
      )}
    </>
  );
}
