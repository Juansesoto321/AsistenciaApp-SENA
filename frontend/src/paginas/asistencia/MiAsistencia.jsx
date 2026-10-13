import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Icono from "../../componentes/Iconos.jsx";
import AnilloAsistencia from "../../componentes/AnilloAsistencia.jsx";
import { mayusculaInicial, fechaCorta } from "../../utilidades/formato";

const ETIQUETA_SOPORTE = {
  pendiente: "Por cargar",
  enviada: "En revisión",
  aprobada: "Aprobado",
  rechazada: "Rechazado",
  vencida: "Plazo vencido",
};

const ETIQUETA_TIPO = {
  cita_medica: "Cita médica",
  incapacidad_medica: "Incapacidad médica",
  calamidad_domestica: "Calamidad doméstica",
  diligencia_legal: "Diligencia legal / trámite obligatorio",
  duelo: "Duelo (fallecimiento familiar)",
  otro: "Otro",
};

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

      {detalleSoporte && (
        <div className="superposicion" onClick={() => setDetalleSoporte(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Mi justificación</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Clase del {fechaCorta(detalleSoporte.fecha)}
              · {ETIQUETA_TIPO[detalleSoporte.soporte_tipo] || "Sin tipo"}
            </p>
            <label>Estado</label>
            <span className={`insignia ${detalleSoporte.estado_soporte}`}>
              {ETIQUETA_SOPORTE[detalleSoporte.estado_soporte] || detalleSoporte.estado_soporte}
            </span>
            <label style={{ marginTop: 14 }}>Lo que describiste</label>
            <div className="tarjeta" style={{ background: "var(--violeta-50)" }}>{detalleSoporte.soporte_descripcion || "Sin descripción"}</div>
            {detalleSoporte.soporte_observacion && (
              <>
                <label style={{ marginTop: 14 }}>Observación del instructor</label>
                {/* Verde si la aprobó, rojo si la rechazó (antes siempre salía en rojo) */}
                <div className="tarjeta" style={{
                  background: detalleSoporte.estado_soporte === "rechazada" ? "var(--rojo-suave)" : "var(--verde-suave)",
                }}>
                  {detalleSoporte.soporte_observacion}
                </div>
              </>
            )}
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setDetalleSoporte(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
