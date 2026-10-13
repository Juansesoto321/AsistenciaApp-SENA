import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import Icono from "../../componentes/Iconos.jsx";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { colorAsistencia } from "../../componentes/AnilloAsistencia.jsx";
import { fechaCorta } from "../../utilidades/formato";

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

  useEffect(() => {
    api("/fichas").then(setFichas).catch(() => {});
    api("/reportes/busquedas-guardadas").then(setGuardadas).catch(() => {});
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

  async function exportarBusqueda() {
    try {
      await descargarExcel([["Asistencia", resultados.map((r) => ({
        Fecha: fechaParaExcel(r.fecha), Aprendiz: r.aprendiz, Documento: r.documento, Ficha: r.numero_ficha,
        Estado: r.estado, Hora: r.hora || "", Método: r.metodo, Observación: r.observacion || "",
      }))]], "reporte_asistencia.xlsx");
    } catch { setMensaje({ tipo: "error", texto: "No se pudo generar el archivo de Excel" }); }
  }

  async function exportarResumen() {
    try {
      await descargarExcel([
        ["Por ficha", resumen.por_ficha.map((f) => ({
          Ficha: f.numero_ficha, Programa: f.programa, Clases: f.clases, Presentes: f.presentes, Tardanzas: f.tardanzas,
          Justificadas: f.justificadas, Ausencias: f.ausencias, "Asistencia (%)": f.porcentaje,
        }))],
        ["Más faltas", resumen.mas_faltas.map((a) => ({
          Aprendiz: a.aprendiz, Documento: a.documento, Ficha: a.numero_ficha, Clases: a.clases, Ausencias: a.ausencias, "Asistencia (%)": a.porcentaje,
        }))],
        ["Bajo el mínimo", resumen.bajo_minimo.map((a) => ({
          Aprendiz: a.aprendiz, Documento: a.documento, Ficha: a.numero_ficha, Clases: a.clases, Ausencias: a.ausencias, "Asistencia (%)": a.porcentaje,
        }))],
      ], `resumen_asistencia_${fechaParaExcel(new Date())}.xlsx`);
    } catch { setMensaje({ tipo: "error", texto: "No se pudo generar el archivo de Excel" }); }
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
          <button className="boton exito" onClick={exportarResumen}><Icono nombre="reportes" /> Descargar resumen en Excel</button>
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
          {resultados?.length > 0 && <button className="boton exito" onClick={exportarBusqueda}>Exportar a Excel</button>}
          {resultados?.length > 0 && <button className="boton suave" onClick={exportarCsv}>Exportar CSV</button>}
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
          <thead><tr><th>Fecha</th><th>Aprendiz</th><th>Documento</th><th>Ficha</th><th>Estado</th><th>Hora</th><th>Método</th></tr></thead>
          <tbody>
            {resultados.map((r) => (
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
    </>
  );
}
