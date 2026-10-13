import { useEffect, useState } from "react";
import useTabla from "../../componentes/useTabla.jsx";
import { api } from "../../servicios/api";
import Icono from "../../componentes/Iconos.jsx";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { colorAsistencia } from "../../componentes/AnilloAsistencia.jsx";
import { fechaCorta } from "../../utilidades/formato";
import { descargarPdf } from "../../utilidades/pdf";

const VACIO = { nombre: "", id_ficha: "", estado: "", fecha_inicio: "", fecha_fin: "" };

/** "2026-09-04" en la hora local, para que Excel ordene y filtre por fecha */
function fechaParaExcel(fecha) {
  const f = new Date(fecha);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/** Descarga un .xlsx con una hoja por cada [nombre, filas]. La librería se carga solo al exportar. */
async function descargarExcel(hojas, archivo) {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();
  for (const [nombre, filas] of hojas) {
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas.length ? filas : [{ "Sin datos": "" }]), nombre);
  }
  XLSX.writeFile(libro, archivo);
}

function Porcentaje({ valor, minimo }) {
  return (
    <span className="porcentaje-celda">
      <span className="mini-barra" aria-hidden="true">
        <span style={{ width: `${valor}%`, background: colorAsistencia(valor, minimo) }} />
      </span>
      <b style={{ color: colorAsistencia(valor, minimo) }}>{valor} %</b>
    </span>
  );
}

export default function Reportes() {
  const { sesion } = useAuth();
  const { pedirTexto } = useConfirmar();
  const [filtros, setFiltros] = useState(VACIO);
  const [fichas, setFichas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [guardadas, setGuardadas] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [institucion, setInstitucion] = useState("SENA");
  const tabla = useTabla(resultados, { porPagina: 25, valores: { fecha: (r) => new Date(r.fecha) } });

  useEffect(() => {
    api("/fichas").then(setFichas).catch(() => {});
    api("/reportes/busquedas-guardadas").then(setGuardadas).catch(() => {});
    api("/configuracion").then((c) => c.nombre_institucion && setInstitucion(c.nombre_institucion)).catch(() => {});
    api("/reportes/resumen").then(setResumen).catch((e) => { setResumen({ por_ficha: [], mas_faltas: [], bajo_minimo: [], minimo: 80 }); setMensaje({ tipo: "error", texto: e.message }); });
  }, []);

  const query = (f = filtros) => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

  async function buscar(f = filtros) {
    try {
      setResultados(await api(`/reportes/busqueda?${query(f)}`));
      document.getElementById("busqueda")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  function verFicha(idFicha) {
    const f = { ...VACIO, id_ficha: String(idFicha) };
    setFiltros(f);
    buscar(f);
  }

  async function exportarCsv() {
    const r = await fetch(`/api/reportes/exportar?${query()}`, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    });
    if (!r.ok) return setMensaje({ tipo: "error", texto: "No se pudo exportar el reporte" });
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reporte_asistencia.csv";
    a.click();
  }

  // Lo que lleva cada exportación, igual en Excel y en PDF: [título, columnas, filas]
  const COLUMNAS_APRENDIZ = ["Aprendiz", "Documento", "Ficha", "Clases", "Ausencias", "Asistencia (%)"];
  const filaAprendiz = (a) => [a.aprendiz, a.documento, a.numero_ficha, a.clases, a.ausencias, a.porcentaje];
  function hojas(contenido) {
    if (contenido === "resumen") return [
      ["Asistencia por ficha", ["Ficha", "Programa", "Clases", "Presentes", "Tardanzas", "Justificadas", "Ausencias", "Asistencia (%)"],
        resumen.por_ficha.map((f) => [f.numero_ficha, f.programa, f.clases, f.presentes, f.tardanzas, f.justificadas, f.ausencias, f.porcentaje])],
      ["Más faltas sin justificar", COLUMNAS_APRENDIZ, resumen.mas_faltas.map(filaAprendiz)],
      [`Bajo el mínimo (${resumen.minimo} %)`, COLUMNAS_APRENDIZ, resumen.bajo_minimo.map(filaAprendiz)],
    ];
    return [["Asistencia clase por clase", ["Fecha", "Aprendiz", "Documento", "Ficha", "Estado", "Hora", "Método", "Observación"],
      resultados.map((r) => [fechaParaExcel(r.fecha), r.aprendiz, r.documento, r.numero_ficha, r.estado, r.hora || "", r.metodo, r.observacion || ""])]];
  }

  /** Los filtros de la búsqueda en palabras, para el encabezado del PDF. */
  function describirFiltros() {
    const partes = [];
    if (filtros.nombre) partes.push(`aprendiz "${filtros.nombre}"`);
    if (filtros.id_ficha) partes.push(`ficha ${fichas.find((x) => String(x.id_ficha) === String(filtros.id_ficha))?.numero_ficha || filtros.id_ficha}`);
    if (filtros.estado) partes.push(`estado ${filtros.estado}`);
    if (filtros.fecha_inicio) partes.push(`desde ${filtros.fecha_inicio}`);
    if (filtros.fecha_fin) partes.push(`hasta ${filtros.fecha_fin}`);
    return partes.length ? `Filtros: ${partes.join(" · ")}` : "Sin filtros: todas las clases";
  }

  async function exportar(formato, contenido) {
    const contenidoHojas = hojas(contenido);
    const nombre = `${contenido === "resumen" ? "resumen" : "reporte"}_asistencia_${fechaParaExcel(new Date())}`;
    try {
      if (formato === "excel") {
        await descargarExcel(
          contenidoHojas.map(([titulo, columnas, filas]) => [titulo.slice(0, 31), filas.map((f) => Object.fromEntries(columnas.map((c, i) => [c, f[i]])))]),
          `${nombre}.xlsx`
        );
      } else {
        await descargarPdf({
          titulo: contenido === "resumen" ? "Resumen de asistencia" : "Asistencia clase por clase",
          subtitulo: contenido === "resumen" ? `Solo clases cerradas · mínimo institucional ${minimo} %` : describirFiltros(),
          institucion,
          generadoPor: `${sesion.usuario.nombres} ${sesion.usuario.apellidos}`,
          secciones: contenidoHojas.map(([titulo, columnas, filas]) => ({ titulo, columnas, filas })),
          archivo: `${nombre}.pdf`,
        });
      }
      // Queda en la auditoría quién exportó qué (el archivo se armó en este navegador)
      const filas = contenidoHojas.reduce((total, [, , f]) => total + f.length, 0);
      api("/reportes/exportaciones", { method: "POST", body: { formato, contenido, filas, filtros: contenido === "busqueda" ? filtros : {} } }).catch(() => {});
    } catch {
      setMensaje({ tipo: "error", texto: `No se pudo generar el archivo ${formato === "excel" ? "de Excel" : "PDF"}` });
    }
  }

  async function guardar() {
    const nombre = await pedirTexto({
      titulo: "Guardar búsqueda",
      mensaje: "Ponle un nombre para volver a cargar estos filtros después.",
      placeholder: "Ej.: Ausencias de la ficha 3311983 en septiembre",
      textoConfirmar: "Guardar",
    });
    if (!nombre) return;
    try {
      await api("/reportes/busquedas-guardadas", { method: "POST", body: { nombre, filtros } });
      setGuardadas(await api("/reportes/busquedas-guardadas"));
      setMensaje({ tipo: "exito", texto: `Búsqueda "${nombre}" guardada` });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  const minimo = resumen?.minimo ?? 80;

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Reportes</h1>
        <p>Cómo va cada ficha y quién necesita seguimiento (cuentan las clases ya cerradas). Abajo, la búsqueda clase por clase.</p></div>
        {resumen?.por_ficha.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="boton exito" onClick={() => exportar("excel", "resumen")}><Icono nombre="reportes" /> Resumen en Excel</button>
            <button className="boton suave" onClick={() => exportar("pdf", "resumen")}><Icono nombre="pdf" /> Resumen en PDF</button>
          </div>
        )}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {/* ---------- Resumen: se ve sin filtrar nada ---------- */}
      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <div className="titulo-tarjeta"><h3>Asistencia por ficha</h3><small className="texto-suave">Mínimo: {minimo} %</small></div>
        {resumen === null ? <Cargando /> : resumen.por_ficha.length === 0 ? (
          <Vacio icono="reportes" titulo="Todavía no hay clases registradas">Cuando se cierren las primeras clases, aquí verás el avance de cada ficha.</Vacio>
        ) : (
          <div className="tabla-desplazable">
            <table className="tabla">
              <thead><tr><th>Ficha</th><th>Clases</th><th>Presentes</th><th>Tardanzas</th><th>Justificadas</th><th>Ausencias</th><th>Asistencia</th><th></th></tr></thead>
              <tbody>
                {resumen.por_ficha.map((f) => (
                  <tr key={f.id_ficha}>
                    <td><b>{f.numero_ficha}</b><small className="sub-celda">{f.programa}</small></td>
                    <td>{f.clases}</td><td>{f.presentes}</td><td>{f.tardanzas}</td><td>{f.justificadas}</td><td>{f.ausencias}</td>
                    <td><Porcentaje valor={f.porcentaje} minimo={minimo} /></td>
                    <td><button className="boton mini suave" onClick={() => verFicha(f.id_ficha)}>Ver clase por clase</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resumen && resumen.por_ficha.length > 0 && (
        <div className="dos-columnas iguales" style={{ marginBottom: 18 }}>
          <div className="tarjeta">
            <div className="titulo-tarjeta"><h3>Más faltas sin justificar</h3></div>
            {resumen.mas_faltas.length === 0 ? <Vacio icono="asistencia" titulo="Nadie tiene faltas sin justificar" /> : (
              <ol className="ranking">
                {resumen.mas_faltas.map((a) => (
                  <li key={`${a.id_usuario}-${a.id_ficha}`}>
                    <div><b>{a.aprendiz}</b><small>Ficha {a.numero_ficha} · {a.porcentaje} % de asistencia</small></div>
                    <span className="insignia ausente">{a.ausencias} {a.ausencias === 1 ? "falta" : "faltas"}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="tarjeta">
            <div className="titulo-tarjeta"><h3>Bajo el mínimo ({resumen.bajo_minimo.length})</h3></div>
            {resumen.bajo_minimo.length === 0 ? <Vacio icono="asistencia" titulo={`Todos están sobre el ${minimo} %`} /> : (
              <ul className="lista-riesgo">
                {resumen.bajo_minimo.map((a) => (
                  <li key={`${a.id_usuario}-${a.id_ficha}`}>
                    <div><b>{a.aprendiz}</b><small>Ficha {a.numero_ficha} · {a.ausencias} {a.ausencias === 1 ? "falta" : "faltas"} en {a.clases} clases</small></div>
                    <span className="porcentaje-riesgo">{a.porcentaje} %</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ---------- Búsqueda avanzada ---------- */}
      <div className="tarjeta" id="busqueda" style={{ marginBottom: 18 }}>
        <div className="titulo-tarjeta"><h3>Búsqueda clase por clase</h3></div>
        <div className="rejilla-2">
          <div><label htmlFor="filtro-nombre">Aprendiz (nombre o documento)</label>
            <input id="filtro-nombre" value={filtros.nombre} onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })} /></div>
          <div><label htmlFor="filtro-ficha">Ficha</label>
            <select id="filtro-ficha" value={filtros.id_ficha} onChange={(e) => setFiltros({ ...filtros, id_ficha: e.target.value })}>
              <option value="">Todas</option>
              {fichas.map((f) => <option key={f.id_ficha} value={f.id_ficha}>{f.numero_ficha}</option>)}
            </select></div>
        </div>
        <div className="rejilla-2">
          <div><label htmlFor="filtro-estado">Estado</label>
            <select id="filtro-estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
              <option value="">Todos</option>
              <option value="presente">Presente</option><option value="tardanza">Tardanza</option>
              <option value="ausente">Ausente</option><option value="justificada">Justificada</option>
            </select></div>
          <div className="rejilla-2">
            <div><label htmlFor="filtro-desde">Desde</label><input id="filtro-desde" type="date" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })} /></div>
            <div><label htmlFor="filtro-hasta">Hasta</label><input id="filtro-hasta" type="date" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} /></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="boton" onClick={() => buscar()}><Icono nombre="reportes" /> Buscar</button>
          <button className="boton suave" onClick={guardar}>Guardar búsqueda</button>
          {resultados?.length > 0 && (<>
            <button className="boton exito" onClick={() => exportar("excel", "busqueda")}>Exportar a Excel</button>
            <button className="boton suave" onClick={() => exportar("pdf", "busqueda")}><Icono nombre="pdf" /> PDF</button>
            <button className="boton suave" onClick={exportarCsv}>CSV</button>
          </>)}
          {guardadas.length > 0 && (
            <select style={{ maxWidth: 240 }} aria-label="Cargar búsqueda guardada" onChange={(e) => {
              const g = guardadas.find((x) => x.id_busqueda === Number(e.target.value));
              if (g) setFiltros({ ...VACIO, ...g.filtros });
            }}>
              <option value="">Cargar búsqueda guardada…</option>
              {guardadas.map((g) => <option key={g.id_busqueda} value={g.id_busqueda}>{g.nombre}</option>)}
            </select>
          )}
        </div>
      </div>

      {resultados && (
        <div className="tabla-desplazable">
        <table className="tabla">
          <thead><tr>{tabla.encabezado("fecha", "Fecha")}{tabla.encabezado("aprendiz", "Aprendiz")}{tabla.encabezado("documento", "Documento")}{tabla.encabezado("numero_ficha", "Ficha")}{tabla.encabezado("estado", "Estado")}{tabla.encabezado("hora", "Hora")}{tabla.encabezado("metodo", "Método")}</tr></thead>
          <tbody>
            {tabla.visibles.map((r) => (
              <tr key={r.id_asistencia}>
                <td>{fechaCorta(r.fecha)}</td>
                <td>{r.aprendiz}</td><td>{r.documento}</td><td>{r.numero_ficha}</td>
                <td><span className={`insignia ${r.estado}`}>{r.estado}</span></td>
                <td>{r.hora || "—"}</td>
                <td><span className={`insignia ${r.metodo}`}>{r.metodo}</span></td>
              </tr>
            ))}
            {!resultados.length && <tr><td colSpan={7}><Vacio icono="reportes" titulo="Sin resultados con esos filtros">Prueba ampliando el rango de fechas o quitando algún filtro.</Vacio></td></tr>}
          </tbody>
        </table>
        </div>
      )}
      {resultados && tabla.paginacion}
    </>
  );
}
