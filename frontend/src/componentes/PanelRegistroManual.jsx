import { useEffect, useState } from "react";
import BarraDeslizante from "./BarraDeslizante.jsx";
import Icono from "./Iconos.jsx";
import IconoHuella from "./IconoHuella.jsx";
import { textoPlazo } from "../utilidades/formato";

/**
 * Registro manual de asistencia (CU-15) en un panel que entra desde la derecha:
 * la lista de la clase sigue a la vista, el estado se elige con una barra
 * deslizante y el motivo con un toque. El motivo es obligatorio (queda en la
 * auditoría); "Otro" pide escribirlo.
 */
const ESTADOS = [
  { valor: "presente", texto: "Presente", color: "var(--verde)" },
  { valor: "tardanza", texto: "Tardanza", color: "var(--ambar)" },
  { valor: "ausente", texto: "Ausente", color: "var(--rojo)" },
  { valor: "justificada", texto: "Justificada", color: "var(--azul)" },
];

const AYUDA_ESTADO = {
  presente: "Llegó a tiempo, dentro de la tolerancia.",
  tardanza: "Llegó después de los minutos de tolerancia.",
  justificada: "No vino, pero ya presentó una excusa válida.",
};

const MOTIVOS = [
  "El lector no reconoció la huella",
  "El lector está fuera de línea",
  "Aún no tiene huella registrada",
  "Lesión o problema en el dedo",
  "Llegó con autorización",
  "Otro",
];

export default function PanelRegistroManual({ aprendiz, plazoHoras, alGuardar, alCerrar }) {
  const [estado, setEstado] = useState(aprendiz.estado || "presente");
  const [motivo, setMotivo] = useState(aprendiz.tiene_huella ? null : "Aún no tiene huella registrada");
  const [detalle, setDetalle] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === "Escape" && !guardando) alCerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [guardando, alCerrar]);

  const requiereDetalle = motivo === "Otro";
  const motivoFinal = requiereDetalle
    ? detalle.trim()
    : [motivo, detalle.trim()].filter(Boolean).join(": ");
  const puedeGuardar = !!motivoFinal && !guardando;

  async function guardar() {
    setGuardando(true);
    const ok = await alGuardar(estado, motivoFinal);
    if (!ok) setGuardando(false);
  }

  return (
    <>
      <div className="fondo-panel" onClick={() => !guardando && alCerrar()} aria-hidden="true" />
      <aside className="panel-lateral" role="dialog" aria-modal="true" aria-labelledby="titulo-registro-manual">
        <header>
          <div>
            <small>Registro manual</small>
            <h2 id="titulo-registro-manual">{aprendiz.nombres} {aprendiz.apellidos}</h2>
            <p>
              Documento {aprendiz.documento} ·{" "}
              {aprendiz.tiene_huella ? <><IconoHuella /> huella registrada</> : "sin huella registrada"}
            </p>
          </div>
          <button className="boton-cerrar-panel" onClick={alCerrar} disabled={guardando} aria-label="Cerrar">
            <Icono nombre="cerrar" size="1.2em" />
          </button>
        </header>

        <div className="cuerpo-panel">
          <label className="titulo-campo">¿Cómo registras su asistencia?</label>
          <BarraDeslizante opciones={ESTADOS} valor={estado} alCambiar={setEstado} etiqueta="Estado de asistencia" />
          {estado === "ausente" ? (
            <p className="nota-estado alerta">
              <Icono nombre="alerta" /> Se le enviará un correo con el enlace para justificar
              (plazo: {textoPlazo(plazoHoras)}).
            </p>
          ) : (
            <p className="nota-estado">{AYUDA_ESTADO[estado]}</p>
          )}

          <label className="titulo-campo">¿Por qué es manual? <span>(obligatorio)</span></label>
          <div className="chips">
            {MOTIVOS.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={motivo === m}
                      onClick={() => setMotivo(motivo === m ? null : m)}>
                {m}
              </button>
            ))}
          </div>

          <label className="titulo-campo" htmlFor="detalle-registro">
            {requiereDetalle ? "Escribe el motivo" : "Detalle"} <span>{requiereDetalle ? "(obligatorio)" : "(opcional)"}</span>
          </label>
          <textarea
            id="detalle-registro"
            rows={2}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder={requiereDetalle ? "Ej.: se presentó en coordinación antes de la clase" : "Ej.: tres intentos fallidos en el lector"}
          />
        </div>

        <footer>
          <button className="boton suave" onClick={alCerrar} disabled={guardando}>Cancelar</button>
          <button className="boton" onClick={guardar} disabled={!puedeGuardar}>
            {guardando ? "Guardando…" : "Guardar registro"}
          </button>
        </footer>
      </aside>
    </>
  );
}
