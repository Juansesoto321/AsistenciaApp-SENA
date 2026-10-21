import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import DetalleJustificacion, { ETIQUETA_SOPORTE } from "../../componentes/DetalleJustificacion.jsx";
import { diaYFecha } from "../../utilidades/fechas";
import { faltaCuanto, fechaCorta } from "../../utilidades/formato";

// Primero lo que pide acción (por cargar, la que vence antes arriba), después lo demás
const ORDEN = { pendiente: 0, enviada: 1, rechazada: 2, aprobada: 3, vencida: 4 };

/** Qué pasa con cada falta: cuánto queda para justificarla o qué respondieron. */
function situacion(d) {
  if (d.estado_soporte === "pendiente") return `Puedes cargarla: ${faltaCuanto(d.soporte_expira)}`;
  if (d.estado_soporte === "enviada") return "Tu instructor la está revisando.";
  if (d.estado_soporte === "aprobada") return "Quedó justificada.";
  if (d.estado_soporte === "rechazada") return d.soporte_observacion ? `Motivo: ${d.soporte_observacion}` : "Fue rechazada.";
  if (d.estado_soporte === "vencida") return `El plazo venció el ${fechaCorta(d.soporte_expira)}.`;
  return "Sin enlace para justificar.";
}

/**
 * Mis justificaciones (aprendiz): cada inasistencia con su excusa. Antes solo
 * se llegaba a esto buscando la falta dentro de "Mi asistencia".
 */
export default function MisJustificaciones() {
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const cargar = (idFicha) =>
    api(`/reportes/mi-historial${idFicha ? `?id_ficha=${idFicha}` : ""}`)
      .then(setDatos).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => { cargar(); }, []);

  if (!datos) return mensaje ? <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} /> : <Cargando />;
  const faltas = datos.detalle
    .filter((d) => d.estado_soporte || d.estado === "ausente")
    .sort((a, b) => (ORDEN[a.estado_soporte] ?? 5) - (ORDEN[b.estado_soporte] ?? 5)
      || (a.estado_soporte === "pendiente" ? new Date(a.soporte_expira) - new Date(b.soporte_expira) : new Date(b.fecha) - new Date(a.fecha)));
  const porCargar = faltas.filter((d) => d.estado_soporte === "pendiente").length;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Mis justificaciones</h1>
          <p>
            Tus inasistencias y la excusa de cada una. {porCargar > 0
              ? `Tienes ${porCargar === 1 ? "1 falta" : `${porCargar} faltas`} por justificar: cárgalas antes de que venza el plazo.`
              : "No tienes faltas pendientes por justificar."}
          </p>
        </div>
        {datos.fichas.length > 1 && (
          <select style={{ maxWidth: 280 }} aria-label="Ficha" value={datos.id_ficha || ""} onChange={(e) => cargar(e.target.value)}>
            {datos.fichas.map((f) => <option key={f.id_ficha} value={f.id_ficha}>{f.numero_ficha} · {f.programa}</option>)}
          </select>
        )}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <table className="tabla tabla-tarjetas">
        <thead><tr><th>Clase</th><th>Justificación</th><th>Qué pasa</th><th></th></tr></thead>
        <tbody>
          {faltas.map((d, i) => (
            <tr key={i}>
              <td className="principal">
                {diaYFecha(new Date(d.fecha))}
                {d.hora_inicio && <small className="sub-celda">{d.hora_inicio}–{d.hora_fin}{d.competencia ? ` · ${d.competencia}` : ""}</small>}
              </td>
              <td data-etiqueta="Justificación">
                {d.estado_soporte
                  ? <span className={`insignia ${d.estado_soporte}`}>{ETIQUETA_SOPORTE[d.estado_soporte] || d.estado_soporte}</span>
                  : <span className={`insignia ${d.estado}`}>{d.estado}</span>}
              </td>
              <td data-etiqueta="Qué pasa" className="texto-completo">{situacion(d)}</td>
              <td>
                {d.estado_soporte === "pendiente" ? (
                  <Link to={`/justificar/${d.token_soporte}`} className="boton mini">Justificar →</Link>
                ) : ["enviada", "aprobada", "rechazada"].includes(d.estado_soporte) ? (
                  <button className="boton mini suave" onClick={() => setDetalle(d)}>Ver</button>
                ) : null}
              </td>
            </tr>
          ))}
          {!faltas.length && (
            <tr><td colSpan={4}>
              <Vacio icono="justificaciones" titulo="No tienes inasistencias">
                Si faltas a una clase, aquí aparecerá con el enlace para cargar tu excusa.
              </Vacio>
            </td></tr>
          )}
        </tbody>
      </table>

      {detalle && <DetalleJustificacion d={detalle} alCerrar={() => setDetalle(null)} />}
    </>
  );
}
