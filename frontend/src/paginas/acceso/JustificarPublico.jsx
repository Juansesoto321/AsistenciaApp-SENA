import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../servicios/api";
import Icono from "../../componentes/Iconos.jsx";
import FondoNeon from "../../componentes/FondoNeon.jsx";
import { fechaCorta, fechaHora } from "../../utilidades/formato";

const TIPOS = [
  { valor: "cita_medica", etiqueta: "Cita médica" },
  { valor: "incapacidad_medica", etiqueta: "Incapacidad médica" },
  { valor: "calamidad_domestica", etiqueta: "Calamidad doméstica" },
  { valor: "diligencia_legal", etiqueta: "Diligencia legal / trámite obligatorio" },
  { valor: "duelo", etiqueta: "Duelo (fallecimiento familiar)" },
  { valor: "otro", etiqueta: "Otro" },
];
const TIPOS_SIN_FOTO_OBLIGATORIA = ["calamidad_domestica", "duelo"];
const ESTILO_CAMPO = { background: "var(--campo-fondo)", borderColor: "var(--campo-borde)", color: "var(--tinta)" };

export default function JustificarPublico() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    api(`/justificaciones/token/${token}`).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  function seleccionarArchivo(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (![/^image\/(jpeg|png|webp)$/, "application/pdf"].some((t) => (t instanceof RegExp ? t.test(f.type) : t === f.type)))
      return setError("El soporte debe ser JPG, PNG, WEBP o PDF");
    if (f.size > 5 * 1024 * 1024) return setError("El archivo no puede superar 5 MB");
    setError(null);
    const lector = new FileReader();
    lector.onload = () => setArchivo({ nombre: f.name, datos: lector.result });
    lector.readAsDataURL(f);
  }

  const fotoObligatoria = tipo && !TIPOS_SIN_FOTO_OBLIGATORIA.includes(tipo);
  const puedeEnviar = tipo && descripcion.trim() && (!fotoObligatoria || archivo);

  async function enviar() {
    setError(null);
    setEnviando(true); // con datos móviles un adjunto de varios MB tarda: evita el doble envío
    try {
      await api(`/justificaciones/token/${token}`, {
        method: "POST",
        body: { tipo, descripcion, nombre_archivo: archivo?.nombre, archivo_datos: archivo?.datos },
      });
      setEnviado(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-acceso">
      <FondoNeon />
      <div className="tarjeta-acceso" style={{ maxWidth: 500 }}>
        <div className="logo-acceso"><Icono nombre="justificaciones" size="1em" /></div>
        <h1>Justificar inasistencia</h1>
        {error && <div className="mensaje error">{error}</div>}

        {enviado ? (
          <div className="mensaje exito">
            Justificación enviada. Tu instructor la revisará y te llegará una notificación con la decisión.
          </div>
        ) : info ? (<>
          <p className="subtitulo">
            {info.nombres} {info.apellidos} · Ficha {info.numero_ficha}<br />
            Clase del {fechaCorta(info.fecha)}<br />
            Este enlace vence el {fechaHora(info.expira_en)}
          </p>
          {info.estado !== "pendiente" ? (
            <div className="mensaje exito">Esta justificación ya fue enviada y está en estado: {info.estado}.</div>
          ) : (<>
            <label>Tipo de justificación</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={ESTILO_CAMPO}>
              <option value="" disabled>Selecciona una opción…</option>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select>
            <label>Describe el motivo de tu inasistencia</label>
            <textarea
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej.: cita médica en la EPS, adjunto la constancia…"
              style={ESTILO_CAMPO}
            />
            <label>Soporte {fotoObligatoria ? "(obligatorio, máx. 5 MB)" : "(opcional, máx. 5 MB)"}</label>
            <input type="file" onChange={seleccionarArchivo} accept=".jpg,.jpeg,.png,.webp,.pdf" />
            {archivo && <p style={{ fontSize: 13, marginTop: 6 }}>Archivo adjunto: {archivo.nombre}</p>}
            <button className="boton ancho" disabled={!puedeEnviar || enviando} onClick={enviar}>
              {enviando ? "Enviando…" : "Enviar justificación"}
            </button>
          </>)}
        </>) : !error && <p className="subtitulo">Validando enlace…</p>}
      </div>
    </div>
  );
}
