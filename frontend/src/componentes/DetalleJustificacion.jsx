import { fechaCorta } from "../utilidades/formato";

/** Estado de la justificación de una falta, como lo lee el aprendiz. */
export const ETIQUETA_SOPORTE = {
  pendiente: "Por cargar",
  enviada: "En revisión",
  aprobada: "Aprobado",
  rechazada: "Rechazado",
  vencida: "Plazo vencido",
};

export const ETIQUETA_TIPO = {
  cita_medica: "Cita médica",
  incapacidad_medica: "Incapacidad médica",
  calamidad_domestica: "Calamidad doméstica",
  diligencia_legal: "Diligencia legal / trámite obligatorio",
  duelo: "Duelo (fallecimiento familiar)",
  otro: "Otro",
};

/**
 * Lo que el aprendiz envió y lo que le respondieron. `d` es una fila de
 * GET /api/reportes/mi-historial (campos soporte_*).
 */
export default function DetalleJustificacion({ d, alCerrar }) {
  return (
    <div className="superposicion" onClick={alCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Mi justificación</h2>
        <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
          Clase del {fechaCorta(d.fecha)}
          · {ETIQUETA_TIPO[d.soporte_tipo] || "Sin tipo"}
        </p>
        <label>Estado</label>
        <span className={`insignia ${d.estado_soporte}`}>
          {ETIQUETA_SOPORTE[d.estado_soporte] || d.estado_soporte}
        </span>
        <label style={{ marginTop: 14 }}>Lo que describiste</label>
        <div className="tarjeta" style={{ background: "var(--marca-50)" }}>{d.soporte_descripcion || "Sin descripción"}</div>
        {d.soporte_observacion && (
          <>
            <label style={{ marginTop: 14 }}>Observación del instructor</label>
            {/* Verde si la aprobó, rojo si la rechazó (antes siempre salía en rojo) */}
            <div className="tarjeta texto-completo" style={{
              background: d.estado_soporte === "rechazada" ? "var(--rojo-suave)" : "var(--verde-suave)",
            }}>
              {d.soporte_observacion}
            </div>
          </>
        )}
        <div className="acciones-modal">
          <button className="boton suave" onClick={alCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
