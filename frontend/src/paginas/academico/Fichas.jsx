import { useEffect, useState } from "react";
import useTabla from "../../componentes/useTabla.jsx";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { colorAsistencia } from "../../componentes/AnilloAsistencia.jsx";

const VACIA = { numero_ficha: "", programa: "", jornada: "mañana", fecha_inicio: "", fecha_fin: "", id_periodo: "", id_instructor: "", trimestres: "7" };

export default function Fichas() {
  const { sesion } = useAuth();
  const rol = sesion.usuario.rol;
  const [fichas, setFichas] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIA);
  const [mensaje, setMensaje] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activa");

  const texto = busqueda.trim().toLowerCase();
  const visibles = (fichas || []).filter((x) =>
    (estado === "todas" || x.estado === estado) &&
    (!texto || [x.numero_ficha, x.programa, x.instructor].some((v) => String(v).toLowerCase().includes(texto)))
  );

  const tabla = useTabla(visibles, { porPagina: 20 });

  const cargar = () =>
    api("/fichas").then(setFichas).catch((e) => { setFichas([]); setMensaje({ tipo: "error", texto: e.message }); });
  useEffect(() => {
    cargar();
    if (["coordinador", "programador"].includes(rol)) {
      api("/periodos").then(setPeriodos).catch(() => {});
      api("/instructores").then(setInstructores).catch(() => {});
    }
  }, []);

  async function crear() {
    if (!f.numero_ficha.trim() || !f.programa.trim() || !f.fecha_inicio || !f.fecha_fin || !f.id_periodo || !f.id_instructor)
      return setMensaje({ tipo: "error", texto: "Completa todos los campos: son obligatorios" });
    try {
      await api("/fichas", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: "Ficha creada" }); setModal(false); setF(VACIA); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>{rol === "instructor" ? "Mis fichas" : "Fichas de formación"}</h1>
        <p>Programas, matrículas y enrolamiento de huella por ficha.</p></div>
        {["coordinador", "programador"].includes(rol) && <button className="boton" onClick={() => setModal(true)}>+ Nueva ficha</button>}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {fichas?.length > 0 && (
        <div className="barra-filtro">
          <input
            type="search" className="buscador" placeholder="Buscar por número, programa o instructor"
            aria-label="Buscar ficha" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="selector-dias" role="group" aria-label="Estado de la ficha">
            {[["activa", "Activas"], ["finalizada", "Finalizadas"], ["todas", "Todas"]].map(([valor, texto]) => (
              <button key={valor} type="button" aria-pressed={estado === valor} onClick={() => setEstado(valor)}>{texto}</button>
            ))}
          </div>
        </div>
      )}

      <div className="tabla-desplazable">
      <table className="tabla">
        <thead><tr>{tabla.encabezado("numero_ficha", "Ficha")}{tabla.encabezado("programa", "Programa")}{tabla.encabezado("jornada", "Jornada")}{tabla.encabezado("instructor", "Instructor")}{tabla.encabezado("total_aprendices", "Aprendices")}{tabla.encabezado("porcentaje_asistencia", "Asistencia")}{tabla.encabezado("estado", "Estado")}<th></th></tr></thead>
        <tbody>
          {tabla.visibles.map((x) => (
            <tr key={x.id_ficha}>
              <td><b>{x.numero_ficha}</b></td>
              <td>{x.programa}</td>
              <td style={{ textTransform: "capitalize" }}>{x.jornada}</td>
              <td>{x.instructor}</td>
              <td>{x.total_aprendices}</td>
              <td>{x.porcentaje_asistencia === null
                ? <span className="texto-suave">Sin clases</span>
                : <b style={{ color: colorAsistencia(x.porcentaje_asistencia) }}>{x.porcentaje_asistencia} %</b>}</td>
              <td><span className={`insignia ${x.estado}`}>{x.estado}</span></td>
              <td><Link className="boton mini suave" to={`/fichas/${x.id_ficha}`}>Ver detalles →</Link></td>
            </tr>
          ))}
          {fichas === null && <tr><td colSpan={8}><Cargando /></td></tr>}
          {fichas?.length === 0 && <tr><td colSpan={8}><Vacio icono="fichas" titulo="Aún no hay fichas registradas" /></td></tr>}
          {fichas?.length > 0 && !visibles.length && <tr><td colSpan={8}><Vacio icono="fichas" titulo="Ninguna ficha coincide con la búsqueda" /></td></tr>}
        </tbody>
      </table>
      </div>
      {tabla.paginacion}

      {modal && (
        <div className="superposicion" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva ficha</h2>
            <div className="rejilla-2">
              <div><label>Número de ficha *</label><input required value={f.numero_ficha} onChange={(e) => setF({ ...f, numero_ficha: e.target.value })} /></div>
              <div>
                <label>Jornada</label>
                <select value={f.jornada} onChange={(e) => setF({ ...f, jornada: e.target.value })}>
                  <option value="mañana">Mañana</option><option value="tarde">Tarde</option>
                  <option value="noche">Noche</option><option value="mixta">Mixta</option>
                </select>
              </div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Programa de formación *</label>
                <input required value={f.programa} onChange={(e) => setF({ ...f, programa: e.target.value })} placeholder="Análisis y Desarrollo de Software" />
              </div>
              <div>
                <label>Trimestres</label>
                <select value={f.trimestres} onChange={(e) => setF({ ...f, trimestres: e.target.value })}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}{n === 7 ? " (tecnólogo)" : n === 4 ? " (técnico)" : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rejilla-2">
              <div><label>Fecha inicio *</label><input required type="date" value={f.fecha_inicio} onChange={(e) => setF({ ...f, fecha_inicio: e.target.value })} /></div>
              <div><label>Fecha fin *</label><input required type="date" value={f.fecha_fin} onChange={(e) => setF({ ...f, fecha_fin: e.target.value })} /></div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Periodo *</label>
                <select required value={f.id_periodo} onChange={(e) => setF({ ...f, id_periodo: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {periodos.map((p) => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label>Instructor titular *</label>
                <select required value={f.id_instructor} onChange={(e) => setF({ ...f, id_instructor: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {instructores.map((i) => <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>)}
                </select>
              </div>
            </div>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(false)}>Cancelar</button>
              <button className="boton" onClick={crear}>Crear ficha</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
