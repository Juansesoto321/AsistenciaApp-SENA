import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useTabla from "../../componentes/useTabla.jsx";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Icono from "../../componentes/Iconos.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { textoPlazo as formatearPlazo, fechaCorta, fechaHora, faltaCuanto, haceCuanto } from "../../utilidades/formato";

const textoPlazo = (horas) => formatearPlazo(Number(horas || 72));

const ETIQUETA_TIPO = {
  cita_medica: "Cita médica",
  incapacidad_medica: "Incapacidad médica",
  calamidad_domestica: "Calamidad doméstica",
  diligencia_legal: "Diligencia legal / trámite obligatorio",
  duelo: "Duelo (fallecimiento familiar)",
  otro: "Otro",
};

// "enviada" es la que el aprendiz cargó y espera respuesta; "pendiente" la que
// aún no carga (con plazo) y "vencida" la que dejó pasar el plazo
const ETIQUETA_ESTADO = {
  enviada: "Por revisar", aprobada: "Aprobada", rechazada: "Rechazada", pendiente: "Sin cargar", vencida: "Vencida",
};
const FILTROS = [
  ["enviada", "Por revisar"], ["pendiente", "Sin cargar"], ["vencida", "Vencidas"],
  ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["todas", "Todas"],
];

/** Qué pasó con el plazo: cuánto le queda, hace cuánto venció o hace cuánto espera revisión. */
function textoTiempo(j) {
  if (j.estado === "pendiente") return faltaCuanto(j.expira_en);
  if (j.estado === "vencida") return `venció ${haceCuanto(j.expira_en)}`;
  if (j.estado === "enviada" && j.enviada_en) return `espera ${haceCuanto(j.enviada_en).replace("hace ", "desde hace ")}`;
  return null;
}

/** El soporte llega como data URI; se convierte en un enlace local para verlo dentro de la página. */
async function enlaceDeSoporte(dataUri) {
  const respuesta = await fetch(dataUri);
  return URL.createObjectURL(await respuesta.blob());
}

export default function Justificaciones() {
  const soloConsulta = useAuth().sesion.usuario.rol === "programador"; // decide el instructor o la coordinación
  const [lista, setLista] = useState(null);
  const [parametros] = useSearchParams();
  // El panel enlaza directo a una pestaña (p. ej. ?estado=vencida)
  const [filtro, setFiltro] = useState(() => {
    const pedido = parametros.get("estado");
    return FILTROS.some(([valor]) => valor === pedido) ? pedido : "enviada";
  });
  const [detalle, setDetalle] = useState(null);
  const [soporte, setSoporte] = useState(null); // { url, esImagen, esPdf, nombre } | "cargando" | "error"
  const [mensaje, setMensaje] = useState(null);
  const [plazo, setPlazo] = useState(72);
  const [rechazando, setRechazando] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [procesando, setProcesando] = useState(false);

  // ?id=N (desde una notificación): se abre esa justificación al cargar, una vez
  const pedida = useRef(Number(parametros.get("id")) || null);
  const cargar = () =>
    api("/justificaciones")
      .then((datos) => {
        setLista(datos);
        // Si no hay nada por revisar, se muestran todas en vez de una lista vacía
        setFiltro((actual) => (actual === "enviada" && !datos.some((j) => j.estado === "enviada") ? "todas" : actual));
        if (pedida.current) {
          const j = datos.find((x) => x.id_justificacion === pedida.current);
          pedida.current = null;
          if (j) { setFiltro(j.estado); abrir(j); }
          else setMensaje({ tipo: "error", texto: "Esa justificación ya no está en tu bandeja." });
        }
      })
      .catch((e) => {
        setLista([]);
        setMensaje({ tipo: "error", texto: e.message });
      });

  useEffect(() => {
    cargar();
    api("/configuracion").then((c) => setPlazo(c.horas_justificacion)).catch(() => {});
  }, []);

  // Libera el enlace del soporte al cerrar o cambiar de justificación
  useEffect(() => () => { if (soporte?.url) URL.revokeObjectURL(soporte.url); }, [soporte]);

  async function abrir(j) {
    setDetalle(j);
    setRechazando(false);
    setObservacion("");
    setSoporte(null);
    if (!j.nombre_archivo) return;
    setSoporte("cargando");
    try {
      const r = await api(`/justificaciones/${j.id_justificacion}/archivo`);
      const tipo = r.archivo_datos.slice(5, r.archivo_datos.indexOf(";"));
      setSoporte({
        url: await enlaceDeSoporte(r.archivo_datos),
        esImagen: tipo.startsWith("image/"),
        esPdf: tipo === "application/pdf",
        nombre: r.nombre_archivo || j.nombre_archivo,
      });
    } catch {
      setSoporte("error");
    }
  }

  function cerrar() {
    if (procesando) return;
    setDetalle(null);
    setSoporte(null);
  }

  async function validar(j, estado, obs = "") {
    try {
      setProcesando(true);
      const r = await api(`/justificaciones/${j.id_justificacion}`, { method: "PATCH", body: { estado, observacion: obs } });
      setMensaje({ tipo: "exito", texto: `${r.mensaje}. El aprendiz ya fue notificado por correo.` });
      setDetalle(null);
      setSoporte(null);
      setRechazando(false);
      setObservacion("");
      await cargar();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setProcesando(false);
    }
  }

  const cuenta = (estado) => (lista || []).filter((j) => estado === "todas" || j.estado === estado).length;
  const visibles = (lista || [])
    .filter((j) => filtro === "todas" || j.estado === filtro)
    .sort((a, b) => (b.estado === "enviada") - (a.estado === "enviada")); // las por revisar primero
  const tabla = useTabla(visibles, {
    porPagina: 20,
    valores: { fecha: (j) => new Date(j.fecha), aprendiz: (j) => `${j.nombres} ${j.apellidos}`, enviada_en: (j) => j.enviada_en && new Date(j.enviada_en) },
  });

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Justificaciones de inasistencia</h1>
          <p>
            Los aprendices tienen {textoPlazo(plazo)} para cargar su excusa con el enlace que les llega al correo.{" "}
            {soloConsulta
              ? "Puedes consultarlas; las aprueba o rechaza el instructor o la coordinación."
              : "Revisa el soporte y apruébala o recházala: el aprendiz recibe la respuesta por correo."}
          </p>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {lista === null ? <Cargando /> : (<>
        <div className="pestanas" role="tablist" aria-label="Filtrar por estado">
          {FILTROS.map(([valor, texto]) => (
            <button key={valor} role="tab" aria-selected={filtro === valor} onClick={() => setFiltro(valor)}>
              {texto} <span className="cuenta-pestana">{cuenta(valor)}</span>
            </button>
          ))}
        </div>

        <table className="tabla tabla-tarjetas">
          <thead>
            <tr>
              {tabla.encabezado("fecha", "Fecha clase")}
              {tabla.encabezado("aprendiz", "Aprendiz")}
              {tabla.encabezado("numero_ficha", "Ficha")}
              {tabla.encabezado("tipo", "Tipo")}
              {tabla.encabezado("enviada_en", "Enviada")}
              {tabla.encabezado("estado", "Estado")}
              {tabla.encabezado("revisada_por", "Revisó")}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tabla.visibles.map((j) => (
              <tr key={j.id_justificacion}>
                <td data-etiqueta="Fecha clase">{fechaCorta(j.fecha)}</td>
                <td data-etiqueta="Aprendiz">{j.nombres} {j.apellidos}</td>
                <td data-etiqueta="Ficha">{j.numero_ficha}</td>
                <td data-etiqueta="Tipo">
                  {ETIQUETA_TIPO[j.tipo] || "—"}
                  {j.nombre_archivo && <Icono nombre="adjunto" aria-label="Tiene soporte adjunto" style={{ marginLeft: 6, color: "var(--tinta-suave)" }} />}
                </td>
                <td data-etiqueta="Enviada">
                  {j.enviada_en ? fechaHora(j.enviada_en) : "—"}
                  {textoTiempo(j) && <small className={`sub-celda${j.estado === "vencida" ? " texto-rojo" : ""}`}>{textoTiempo(j)}</small>}
                </td>
                <td data-etiqueta="Estado"><span className={`insignia ${j.estado}`}>{ETIQUETA_ESTADO[j.estado] || j.estado}</span></td>
                <td data-etiqueta="Revisó">{j.revisada_por || "—"}</td>
                <td>
                  {["pendiente", "vencida"].includes(j.estado) ? null : (
                    <button className={`boton mini ${j.estado === "enviada" && !soloConsulta ? "" : "suave"}`} onClick={() => abrir(j)}>
                      {j.estado === "enviada" && !soloConsulta ? "Revisar" : "Ver"}
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {!visibles.length && (
              <tr>
                <td colSpan={8}>
                  {filtro === "enviada" ? (
                    <Vacio icono="justificaciones" titulo="No hay justificaciones por revisar">
                      Cuando un aprendiz cargue la excusa de una inasistencia, aparecerá aquí para aprobarla o rechazarla.
                    </Vacio>
                  ) : (
                    <Vacio icono="justificaciones" titulo="No hay justificaciones en este estado" />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {tabla.paginacion}
      </>)}

      {detalle && (
        <div className="superposicion" onClick={cerrar}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Justificación · {detalle.nombres} {detalle.apellidos}</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Clase del {fechaCorta(detalle.fecha)} · Ficha {detalle.numero_ficha} · {ETIQUETA_TIPO[detalle.tipo] || "Sin tipo"}
            </p>

            <label>Motivo descrito por el aprendiz</label>
            <div className="tarjeta" style={{ background: "var(--violeta-50)" }}>
              {detalle.descripcion || "Sin descripción"}
            </div>

            <label style={{ marginTop: 14 }}>Soporte</label>
            {!detalle.nombre_archivo && <p className="texto-suave">El aprendiz no adjuntó soporte (no es obligatorio en calamidad doméstica ni duelo).</p>}
            {soporte === "cargando" && <Cargando texto="Cargando soporte…" />}
            {soporte === "error" && <p className="texto-suave">No se pudo abrir el soporte.</p>}
            {soporte?.url && (
              <div className="visor-soporte">
                {soporte.esImagen && <img src={soporte.url} alt={`Soporte de ${detalle.nombres}`} />}
                {soporte.esPdf && <iframe src={soporte.url} title={`Soporte de ${detalle.nombres}`} />}
                <a href={soporte.url} download={soporte.nombre}><Icono nombre="adjunto" /> Descargar {soporte.nombre}</a>
              </div>
            )}

            {detalle.estado !== "enviada" && (
              <div className={`decision ${detalle.estado}`}>
                <b>{ETIQUETA_ESTADO[detalle.estado]}</b>
                {detalle.revisada_por && <> por {detalle.revisada_por}</>}
                {detalle.validada_en && <> el {fechaHora(detalle.validada_en)}</>}
                {detalle.observacion_validacion && <p>{detalle.observacion_validacion}</p>}
              </div>
            )}

            {detalle.estado === "enviada" && soloConsulta && (
              <>
                <p className="nota-estado">Espera la revisión del instructor o de la coordinación.</p>
                <div className="acciones-modal" style={{ marginTop: 18 }}>
                  <button className="boton suave" onClick={cerrar}>Cerrar</button>
                </div>
              </>
            )}

            {detalle.estado === "enviada" && !soloConsulta && !rechazando && (
              <div className="acciones-modal" style={{ marginTop: 18 }}>
                <button className="boton suave" disabled={procesando} onClick={cerrar}>Cerrar</button>
                <button className="boton peligro" disabled={procesando} onClick={() => { setRechazando(true); setObservacion(""); }}>
                  Rechazar
                </button>
                <button className="boton exito" disabled={procesando} onClick={() => validar(detalle, "aprobada")}>
                  {procesando ? "Procesando…" : "Aprobar · queda justificada"}
                </button>
              </div>
            )}

            {detalle.estado === "enviada" && !soloConsulta && rechazando && (
              <>
                <label style={{ marginTop: 14 }} htmlFor="motivo-rechazo">
                  Explica por qué se rechaza
                  <span style={{ color: "var(--rojo)" }}> (obligatorio, el aprendiz lo verá)</span>
                </label>
                <textarea
                  id="motivo-rechazo"
                  rows={3}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Ej.: la foto no corresponde a una constancia médica válida."
                  disabled={procesando}
                />
                <div className="acciones-modal">
                  <button className="boton suave" disabled={procesando} onClick={() => { setRechazando(false); setObservacion(""); }}>
                    Cancelar
                  </button>
                  <button className="boton peligro" disabled={procesando || !observacion.trim()} onClick={() => validar(detalle, "rechazada", observacion)}>
                    {procesando ? "Procesando…" : "Confirmar rechazo"}
                  </button>
                </div>
              </>
            )}

            {detalle.estado !== "enviada" && (
              <div className="acciones-modal" style={{ marginTop: 18 }}>
                <button className="boton suave" onClick={cerrar}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
