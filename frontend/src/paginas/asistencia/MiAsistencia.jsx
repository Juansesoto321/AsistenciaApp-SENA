import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Icono from "../../componentes/Iconos.jsx";
import AnilloAsistencia from "../../componentes/AnilloAsistencia.jsx";
import DetalleJustificacion, { ETIQUETA_SOPORTE } from "../../componentes/DetalleJustificacion.jsx";
import { mayusculaInicial } from "../../utilidades/formato";


export default function MiAsistencia() {
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [detalleSoporte, setDetalleSoporte] = useState(null);

  const cargar = (idFicha) =>
    api(`/reportes/mi-historial${idFicha ? `?id_ficha=${idFicha}` : ""}`)
      .then(setDatos).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => { cargar(); }, []);

  if (!datos) return mensaje ? <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} /> : <Cargando />;
  const r = datos.resumen;

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Mi asistencia</h1><p>Historial personal, porcentaje acumulado y estado de cada clase.</p></div>
        {datos.fichas.length > 1 && (
          <select style={{ maxWidth: 280 }} value={datos.id_ficha || ""} onChange={(e) => cargar(e.target.value)}>
            {datos.fichas.map((f) => <option key={f.id_ficha} value={f.id_ficha}>{f.numero_ficha} · {f.programa}</option>)}
          </select>
        )}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {r && (<>
        {r.porcentaje < r.minimo && (
          <div className="mensaje error alerta-banda" role="alert">
            <Icono nombre="alerta" size="1.2em" />
            <span>
              Tu asistencia ({r.porcentaje} %) está por debajo del mínimo institucional ({r.minimo} %).
              Habla con tu instructor y justifica tus inasistencias a tiempo.
            </span>
            <Link className="boton mini boton-banda" to="/mis-justificaciones">Justificar</Link>
          </div>
        )}
        <div className="resumen-panel">
          <div className="tarjeta tarjeta-anillo">
            <AnilloAsistencia porcentaje={r.porcentaje} minimo={r.minimo} tamano={128} />
            <div>
              <div style={{ fontWeight: 700 }}>Asistencia acumulada</div>
              <p style={{ color: "var(--tinta-suave)", fontSize: 13, marginTop: 4 }}>
                {r.total} clase{r.total === 1 ? "" : "s"} registrada{r.total === 1 ? "" : "s"} · mínimo {r.minimo} %
              </p>
            </div>
          </div>
          <div className="metricas-2x2">
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--verde)" }}>{r.presentes}</div><div className="nombre">Presentes</div></div>
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--ambar)" }}>{r.tardanzas}</div><div className="nombre">Tardanzas</div></div>
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--azul)" }}>{r.justificadas}</div><div className="nombre">Justificadas</div></div>
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--rojo)" }}>{r.ausencias}</div><div className="nombre">Ausencias</div></div>
          </div>
        </div>
      </>)}

      <table className="tabla tabla-tarjetas">
        <thead><tr><th>Fecha</th><th>Estado</th><th>Hora de marca</th><th>Método</th><th>Observación</th><th>Soporte</th></tr></thead>
        <tbody>
          {datos.detalle.map((d, i) => (
            <tr key={i}>
              <td className="principal">
                {mayusculaInicial(new Date(d.fecha).toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" }))}
              </td>
              <td data-etiqueta="Estado"><span className={`insignia ${d.estado}`}>{d.estado}</span></td>
              <td data-etiqueta="Hora de marca">{d.hora || "—"}</td>
              <td data-etiqueta="Método"><span className={`insignia ${d.metodo}`}>{d.metodo}</span></td>
              <td data-etiqueta="Observación">{d.observacion || "—"}</td>
              <td data-etiqueta="Soporte">
                {d.estado_soporte === "pendiente" ? (
                  <Link to={`/justificar/${d.token_soporte}`} className="boton mini">Cargar soporte →</Link>
                ) : d.estado_soporte ? (
                  <button className="boton mini suave" onClick={() => setDetalleSoporte(d)}>
                    <span className={`insignia ${d.estado_soporte}`}>{ETIQUETA_SOPORTE[d.estado_soporte] || d.estado_soporte}</span>
                  </button>
                ) : "—"}
              </td>
            </tr>
          ))}
          {!datos.detalle.length && (
            <tr><td colSpan={6}>
              <Vacio icono="asistencia" titulo="Aún no tienes registros de asistencia">
                Cada vez que marques con tu huella, o tu instructor registre tu asistencia, la verás aquí.
              </Vacio>
            </td></tr>
          )}
        </tbody>
      </table>

      {detalleSoporte && <DetalleJustificacion d={detalleSoporte} alCerrar={() => setDetalleSoporte(null)} />}
    </>
  );
}
