import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Icono from "../../componentes/Iconos.jsx";
import useTabla from "../../componentes/useTabla.jsx";
import { fechaHora, haceCuanto } from "../../utilidades/formato";
import { descargarCsv } from "../../utilidades/csv";

/** Cada acción de la auditoría en palabras de quien la lee. */
const ACCIONES = {
  login: "Inició sesión",
  intento_login_fallido: "Contraseña errada al iniciar sesión",
  restablecer_contrasena: "Restableció su contraseña",
  actualizar_perfil: "Actualizó su perfil",
  solicitud_registro: "Pidió una cuenta",
  crear_usuario: "Creó un usuario",
  editar_usuario: "Editó un usuario",
  usuario_activo: "Aprobó o reactivó una cuenta",
  usuario_inactivo: "Desactivó una cuenta",
  carga_masiva_aprendices: "Cargó aprendices desde Excel",
  crear_ficha: "Creó una ficha",
  matricular_aprendices: "Matriculó aprendices",
  cambiar_matricula: "Cambió una matrícula",
  programar_competencia: "Programó una competencia en el plan",
  quitar_programacion: "Quitó una competencia del plan",
  cambiar_trimestres_ficha: "Cambió los trimestres de una ficha",
  crear_competencia: "Creó una competencia",
  editar_competencia: "Editó una competencia",
  eliminar_competencia: "Eliminó una competencia",
  carga_masiva_competencias: "Cargó competencias desde CSV",
  crear_rap: "Creó un resultado de aprendizaje",
  editar_rap: "Editó un resultado de aprendizaje",
  eliminar_rap: "Eliminó un resultado de aprendizaje",
  crear_tematica: "Creó una temática",
  eliminar_tematica: "Eliminó una temática",
  crear_horario: "Creó una clase",
  editar_horario: "Editó una clase",
  eliminar_horario: "Eliminó una clase",
  crear_ambiente: "Creó un ambiente",
  registrar_dispositivo: "Asoció un lector a un ambiente",
  iniciar_sesion_clase: "Inició una clase",
  cerrar_sesion_clase: "Cerró una clase",
  eliminar_sesion_clase: "Eliminó una sesión de clase",
  asistencia_manual: "Registró asistencia a mano",
  justificacion_aprobada: "Aprobó una justificación",
  justificacion_rechazada: "Rechazó una justificación",
  enrollment_biometrico: "Registró una huella",
  eliminar_datos_biometricos: "Eliminó una huella",
  actualizar_configuracion: "Cambió la configuración",
  exportar_reporte: "Exportó un reporte",
  exportar_auditoria: "Exportó el registro de actividad",
};
const FORMATO = { csv: "CSV", excel: "Excel", pdf: "PDF" };
// Para lo que se borró antes de que la auditoría guardara su nombre
const ENTIDAD = {
  usuario: "usuario", ficha: "ficha", horario: "clase", sesion_clase: "sesión", asistencia: "asistencia",
  justificacion: "justificación", matricula: "matrícula", ambiente: "ambiente", dispositivo: "lector",
  competencia: "competencia", resultado_aprendizaje: "resultado de aprendizaje", tematica: "temática",
};
const LIMITE_EXPORTACION = 1000; // el máximo que entrega el servidor

/** Sobre qué fue la acción ("Ficha 2901817", "Ana Ruiz · clase del 04/09/2026"). */
function sobreQue(r) {
  if (r.nombre_entidad) return r.nombre_entidad;
  if (r.entidad && r.id_entidad) return `Ya no existe (${ENTIDAD[r.entidad] || r.entidad} n.º ${r.id_entidad})`;
  return "";
}

/** Una línea legible con lo más útil del detalle guardado. */
function resumirDetalle(r) {
  const d = r.detalle || {};
  if (r.accion === "exportar_reporte") return `${FORMATO[d.formato] || d.formato} · ${d.contenido === "resumen" ? "resumen" : "clase por clase"} · ${d.filas} filas`;
  if (r.accion === "exportar_auditoria") return `CSV · ${d.filas} filas`;
  if (r.accion === "asistencia_manual") return `${d.estado}${d.motivo ? ` · "${d.motivo}"` : ""}`;
  if (r.accion === "cerrar_sesion_clase") return `${d.ausentes} ausente(s)`;
  if (r.accion === "actualizar_configuracion") return Object.entries(d).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" · ");
  if (r.accion === "crear_usuario" && d.rol) return `rol ${d.rol}`;
  if (r.accion === "programar_competencia") return `trimestre ${d.trimestre}`;
  return "";
}

/** La consulta con los filtros que tienen valor; "ocultar inicios" no aplica si se piden justo esos. */
function consultaDe(f, extra = {}) {
  const { ocultarLogin, ...resto } = f;
  const valores = { ...resto, sin_login: ocultarLogin && f.accion !== "login" ? "1" : "", ...extra };
  return new URLSearchParams(Object.entries(valores).filter(([, v]) => v)).toString();
}

function Actividad({ alError, alAviso }) {
  // Los inicios de sesión son la mayoría de las filas: se ocultan de entrada
  const [filtros, setFiltros] = useState({ texto: "", accion: "", desde: "", hasta: "", ocultarLogin: true });
  const [datos, setDatos] = useState(null);
  const [exportando, setExportando] = useState(false);
  const tabla = useTabla(datos?.registros, { porPagina: 25, valores: { creado_en: (r) => new Date(r.creado_en) } });

  function cargar(f = filtros) {
    api(`/auditoria?${consultaDe(f)}`).then(setDatos).catch((e) => { setDatos({ registros: [], acciones: [] }); alError(e.message); });
  }

  // Se pide de nuevo con el tope del servidor: la tabla solo trae las 200 más recientes
  async function exportar() {
    setExportando(true);
    try {
      const { registros } = await api(`/auditoria?${consultaDe(filtros, { limite: LIMITE_EXPORTACION })}`);
      descargarCsv(
        ["Fecha y hora", "Quién", "Correo", "Rol", "Qué hizo", "Sobre qué", "Detalle"],
        registros.map((r) => [fechaHora(r.creado_en), r.usuario || "", r.correo || "", r.rol || "", ACCIONES[r.accion] || r.accion, sobreQue(r), resumirDetalle(r)]),
        `registro_actividad_${new Date().toISOString().slice(0, 10)}.csv`
      );
      const { ocultarLogin, ...resto } = filtros;
      api("/auditoria/exportaciones", { method: "POST", body: { filas: registros.length, filtros: { ...resto, ocultar_inicios: ocultarLogin } } }).catch(() => {});
      if (registros.length >= LIMITE_EXPORTACION) {
        alAviso(`Se exportaron las ${LIMITE_EXPORTACION} acciones más recientes. Acota las fechas para llevarte las anteriores.`);
      }
    } catch (e) {
      alError(e.message);
    } finally {
      setExportando(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  const cambiar = (campo, valor) => {
    const f = { ...filtros, [campo]: valor };
    setFiltros(f);
    if (campo !== "texto") cargar(f); // el texto se busca con Enter o con el botón
  };

  return (<>
    <form className="barra-filtro" onSubmit={(e) => { e.preventDefault(); cargar(); }}>
      <input type="search" className="buscador" placeholder="Buscar persona, ficha o correo" aria-label="Buscar por persona, ficha o correo"
        value={filtros.texto} onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })} />
      <select aria-label="Acción" value={filtros.accion} onChange={(e) => cambiar("accion", e.target.value)}>
        <option value="">Todas las acciones</option>
        {(datos?.acciones || []).map((a) => <option key={a} value={a}>{ACCIONES[a] || a}</option>)}
      </select>
      <input type="date" aria-label="Desde" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} style={{ width: "auto" }} />
      <input type="date" aria-label="Hasta" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} style={{ width: "auto" }} />
      <label className="casilla-filtro">
        <input type="checkbox" checked={filtros.ocultarLogin} disabled={filtros.accion === "login"}
          onChange={(e) => cambiar("ocultarLogin", e.target.checked)} />
        Ocultar inicios de sesión
      </label>
      <button className="boton suave" type="submit">Buscar</button>
      <button className="boton suave" type="button" onClick={exportar} disabled={exportando || !datos?.registros.length}>
        <Icono nombre="descargar" /> {exportando ? "Exportando…" : "Exportar CSV"}
      </button>
    </form>
    {datos === null ? <Cargando /> : (
      <div className="tabla-desplazable">
        <table className="tabla">
          <thead><tr>{tabla.encabezado("creado_en", "Cuándo")}{tabla.encabezado("usuario", "Quién")}{tabla.encabezado("accion", "Qué hizo")}<th>Detalle</th></tr></thead>
          <tbody>
            {tabla.visibles.map((r) => (
              <tr key={r.id_auditoria}>
                <td title={fechaHora(r.creado_en)}>{haceCuanto(r.creado_en)}<small className="sub-celda">{fechaHora(r.creado_en)}</small></td>
                <td>{r.usuario || "—"}{r.rol && <small className="sub-celda" style={{ textTransform: "capitalize" }}>{r.rol}</small>}</td>
                <td>{ACCIONES[r.accion] || r.accion}</td>
                <td>
                  {sobreQue(r)}
                  {resumirDetalle(r) && <small className="sub-celda">{resumirDetalle(r)}</small>}
                </td>
              </tr>
            ))}
            {!datos.registros.length && <tr><td colSpan={4}><Vacio icono="registro" titulo="No hay actividad con esos filtros" /></td></tr>}
          </tbody>
        </table>
      </div>
    )}
    {tabla.paginacion}
  </>);
}

function Errores({ alError }) {
  const { sesion } = useAuth();
  const [nivel, setNivel] = useState("");
  const [logs, setLogs] = useState(null);
  const tabla = useTabla(logs, { porPagina: 25, valores: { creado_en: (l) => new Date(l.creado_en) } });

  useEffect(() => {
    setLogs(null);
    api(`/logs?limite=500${nivel ? `&nivel=${nivel}` : ""}`).then(setLogs).catch((e) => { setLogs([]); alError(e.message); });
  }, [nivel]);

  async function descargar() {
    const r = await fetch(`/api/logs/descargar?limite=500${nivel ? `&nivel=${nivel}` : ""}`, { headers: { Authorization: `Bearer ${sesion.token}` } });
    if (!r.ok) return alError("No se pudo descargar el registro de errores");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = "errores_asistenciaapp.txt";
    a.click();
  }

  return (<>
    <div className="barra-filtro">
      <div className="selector-dias" role="group" aria-label="Nivel">
        {[["", "Todos"], ["error", "Errores"], ["advertencia", "Advertencias"]].map(([valor, texto]) => (
          <button key={texto} type="button" aria-pressed={nivel === valor} onClick={() => setNivel(valor)}>{texto}</button>
        ))}
      </div>
      {logs?.length > 0 && <button className="boton suave" onClick={descargar}>Descargar (.txt)</button>}
    </div>
    {logs === null ? <Cargando /> : (
      <div className="tabla-desplazable">
        <table className="tabla">
          <thead><tr>{tabla.encabezado("creado_en", "Cuándo")}{tabla.encabezado("nivel", "Nivel")}{tabla.encabezado("ruta", "Dónde")}{tabla.encabezado("usuario", "Usuario")}<th>Qué pasó</th></tr></thead>
          <tbody>
            {tabla.visibles.map((l) => (
              <tr key={l.id_log}>
                <td>{fechaHora(l.creado_en)}</td>
                <td><span className={`insignia ${l.nivel === "error" ? "ausente" : "tardanza"}`}>{l.nivel}</span></td>
                <td><code className="codigo-ruta">{l.metodo ? `${l.metodo} ` : ""}{l.ruta || "—"}</code></td>
                <td>{l.usuario || "—"}</td>
                <td className="celda-error">
                  {l.mensaje}
                  {l.traza && (
                    <details><summary>Ver detalle técnico</summary><pre>{l.traza}</pre></details>
                  )}
                </td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan={5}><Vacio icono="verificado" titulo="Sin errores registrados">El servidor no ha tenido fallas con estos filtros.</Vacio></td></tr>}
          </tbody>
        </table>
      </div>
    )}
    {tabla.paginacion}
  </>);
}

export default function Registro() {
  const [pestana, setPestana] = useState("actividad");
  const [mensaje, setMensaje] = useState(null);
  const alError = (texto) => setMensaje({ tipo: "error", texto });
  const alAviso = (texto) => setMensaje({ tipo: "info", texto });

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Registro del sistema</h1>
          <p>Quién hizo qué y cuándo (auditoría), y los errores del servidor. Sirve para responder "¿quién cambió esta asistencia?" o "¿qué falló ayer?".</p>
        </div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />
      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === "actividad"} onClick={() => setPestana("actividad")}><Icono nombre="registro" /> Actividad</button>
        <button role="tab" aria-selected={pestana === "errores"} onClick={() => setPestana("errores")}><Icono nombre="alerta" /> Errores del servidor</button>
      </div>
      {pestana === "actividad" ? <Actividad alError={alError} alAviso={alAviso} /> : <Errores alError={alError} />}
    </>
  );
}
