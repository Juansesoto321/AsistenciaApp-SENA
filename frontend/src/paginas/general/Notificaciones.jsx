import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { fechaHora, haceCuanto } from "../../utilidades/formato";

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
          {lista.map((n) => (
            <div
              key={n.id_notificacion}
              className="tarjeta"
              style={{
                opacity: n.leida ? 0.65 : 1,
                display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center",
                borderLeft: n.leida ? undefined : "3px solid var(--violeta-600)",
              }}
            >
              <div>
                <b>{n.titulo}</b>
                <p style={{ color: "var(--tinta-suave)", fontSize: 13.5, marginTop: 4 }}>{n.mensaje}</p>
                <small style={{ color: "var(--tinta-suave)" }}><span title={fechaHora(n.creado_en)}>{haceCuanto(n.creado_en)}</span></small>
              </div>
              {!n.leida && <button className="boton mini suave" onClick={() => marcarLeida(n)}>Marcar leída</button>}
            </div>
          ))}
          {!lista.length && <Vacio icono="notificaciones" titulo="No tienes notificaciones">Aquí te avisaremos de inasistencias, justificaciones y novedades de tu cuenta.</Vacio>}
        </div>
      )}
    </>
  );
}
