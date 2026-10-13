import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Icono from "../../componentes/Iconos.jsx";

const COMPETENCIA_VACIA = { codigo: "", nombre: "" };
const RAP_VACIO = { id_competencia: "", codigo: "", nombre: "" };

const EJEMPLO_CSV =
  "competencia;codigo;resultado de aprendizaje;tematica\n" +
  "Construcción del software;593108-04;Codificar el software de acuerdo con el diseño establecido;Fundamentos de desarrollo móvil\n" +
  "Construcción del software;593108-04;Codificar el software de acuerdo con el diseño establecido;Tecnologías emergentes con Python e IoT";

export default function Competencias() {
  const { sesion } = useAuth();
  const { confirmar } = useConfirmar();
  const rol = sesion.usuario.rol;
  const puedeEditar = ["coordinador", "programador"].includes(rol);

  const [competencias, setCompetencias] = useState([]);
  const [raps, setRaps] = useState([]);
  const [expandida, setExpandida] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [modalCompetencia, setModalCompetencia] = useState(null); // null | "nueva" | objeto
  const [modalRap, setModalRap] = useState(null);
  const [modalCarga, setModalCarga] = useState(false);
  const [c, setC] = useState(COMPETENCIA_VACIA);
  const [r, setR] = useState(RAP_VACIO);
  const [csv, setCsv] = useState("");
  const [resultadoCarga, setResultadoCarga] = useState(null);
  const [nuevaTematica, setNuevaTematica] = useState({});
  const [busqueda, setBusqueda] = useState("");

  const cargar = () => {
    setCargando(true);
    Promise.all([api("/competencias"), api("/competencias/raps")])
      .then(([cs, rs]) => { setCompetencias(cs); setRaps(rs); })
      .catch((e) => setMensaje({ tipo: "error", texto: e.message }))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const rapsDe = (idCompetencia) => raps.filter((x) => x.id_competencia === idCompetencia);

  // Búsqueda en competencias, RAP y temáticas. Si coincide un RAP, la competencia se abre sola.
  const texto = busqueda.trim().toLowerCase();
  const contiene = (v) => String(v || "").toLowerCase().includes(texto);
  const rapCoincide = (rap) => contiene(rap.codigo) || contiene(rap.nombre) || rap.tematicas.some((t) => contiene(t.nombre));
  const visibles = !texto ? competencias : competencias.filter((x) => contiene(x.nombre) || contiene(x.codigo) || rapsDe(x.id_competencia).some(rapCoincide));
  const abierta = (x) => expandida === x.id_competencia || (texto && rapsDe(x.id_competencia).some(rapCoincide));
  const cerrarMenu = (e) => { const menu = e.currentTarget.closest("details"); if (menu) menu.open = false; };

  async function guardarCompetencia() {
    if (!c.nombre.trim()) return setMensaje({ tipo: "error", texto: "El nombre de la competencia es obligatorio" });
    try {
      if (modalCompetencia === "nueva") await api("/competencias", { method: "POST", body: c });
      else await api(`/competencias/${modalCompetencia.id_competencia}`, { method: "PUT", body: c });
      setMensaje({ tipo: "exito", texto: "Competencia guardada" });
      setModalCompetencia(null); setC(COMPETENCIA_VACIA); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function eliminarCompetencia(x) {
    const ok = await confirmar({
      titulo: "¿Eliminar la competencia?",
      mensaje: `Se eliminará "${x.nombre}" junto con sus resultados de aprendizaje y temáticas.`,
      textoConfirmar: "Eliminar competencia",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api(`/competencias/${x.id_competencia}`, { method: "DELETE" });
      setMensaje({ tipo: "exito", texto: "Competencia eliminada" }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function guardarRap() {
    try {
      if (modalRap.nuevo) await api("/competencias/raps", { method: "POST", body: r });
      else await api(`/competencias/raps/${modalRap.id_rap}`, { method: "PUT", body: r });
      setMensaje({ tipo: "exito", texto: "Resultado de aprendizaje guardado" });
      setModalRap(null); setR(RAP_VACIO); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function eliminarRap(rap) {
    const ok = await confirmar({
      titulo: "¿Eliminar el resultado de aprendizaje?",
      mensaje: `Se eliminará el resultado ${rap.codigo} junto con sus temáticas.`,
      textoConfirmar: "Eliminar resultado",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api(`/competencias/raps/${rap.id_rap}`, { method: "DELETE" });
      setMensaje({ tipo: "exito", texto: "Resultado eliminado" }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function agregarTematica(rap) {
    const nombre = (nuevaTematica[rap.id_rap] || "").trim();
    if (!nombre) return;
    try {
      await api("/competencias/tematicas", { method: "POST", body: { id_rap: rap.id_rap, nombre } });
      setNuevaTematica({ ...nuevaTematica, [rap.id_rap]: "" }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function eliminarTematica(idTematica) {
    try {
      await api(`/competencias/tematicas/${idTematica}`, { method: "DELETE" }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  function leerArchivo(evento) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setCsv(String(lector.result));
    lector.readAsText(archivo, "UTF-8");
  }

  async function subirCsv() {
    if (!csv.trim()) return setMensaje({ tipo: "error", texto: "Pega el contenido o selecciona un archivo" });
    setCargando(true);
    try {
      const resumen = await api("/competencias/carga-masiva", { method: "POST", body: { contenido: csv } });
      setResultadoCarga(resumen); cargar();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally { setCargando(false); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Competencias y resultados de aprendizaje</h1>
          <p>Estructura curricular del programa: cada competencia agrupa resultados de aprendizaje (RAP), y cada RAP sus temáticas.</p>
        </div>
        {puedeEditar && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="boton suave" onClick={() => { setCsv(""); setResultadoCarga(null); setModalCarga(true); }}><Icono nombre="subir" /> Carga masiva</button>
            <button className="boton" onClick={() => { setC(COMPETENCIA_VACIA); setModalCompetencia("nueva"); }}>+ Nueva competencia</button>
          </div>
        )}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />
      {cargando && <Cargando />}

      {competencias.length > 0 && (
        <div className="barra-filtro">
          <input type="search" className="buscador" placeholder="Buscar competencia, código de RAP o temática" aria-label="Buscar"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <span className="texto-suave">{visibles.length} de {competencias.length} competencias</span>
        </div>
      )}
      {texto && !visibles.length && <Vacio icono="competencias" titulo="Nada coincide con la búsqueda" />}

      {visibles.map((x) => (
        <div key={x.id_competencia} className="tarjeta" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button type="button" className="titulo-plegable" aria-expanded={!!abierta(x)} onClick={() => setExpandida(expandida === x.id_competencia ? null : x.id_competencia)}>
              <b><Icono nombre={abierta(x) ? "abajo" : "arriba"} style={abierta(x) ? undefined : { transform: "rotate(90deg)" }} /> {x.nombre}</b>
              {x.codigo && <span style={{ color: "var(--tinta-suave)", marginLeft: 8 }}>· {x.codigo}</span>}
              <span className="cuenta-raps">{x.total_raps} {Number(x.total_raps) === 1 ? "resultado de aprendizaje" : "resultados de aprendizaje"}</span>
            </button>
            {puedeEditar && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="boton mini suave" onClick={() => { setR({ ...RAP_VACIO, id_competencia: x.id_competencia }); setModalRap({ nuevo: true }); }}>+ RAP</button>
                <details className="menu-acciones">
                  <summary className="boton mini suave" aria-label={`Más acciones para ${x.nombre}`}>···</summary>
                  <div className="menu-acciones-lista">
                    <button type="button" onClick={(e) => { cerrarMenu(e); setC({ codigo: x.codigo || "", nombre: x.nombre }); setModalCompetencia(x); }}>Editar competencia</button>
                    <button type="button" className="peligro" onClick={(e) => { cerrarMenu(e); eliminarCompetencia(x); }}>Eliminar…</button>
                  </div>
                </details>
              </div>
            )}
          </div>

          {abierta(x) && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
              {!rapsDe(x.id_competencia).length && <div className="vacio">Esta competencia aún no tiene resultados de aprendizaje.</div>}
              {rapsDe(x.id_competencia).map((rap) => (
                <div key={rap.id_rap} style={{ marginBottom: 14, paddingLeft: 10, borderLeft: "3px solid var(--borde)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <b>{rap.codigo}</b> · {rap.nombre}
                    </div>
                    {puedeEditar && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="boton mini suave" onClick={() => { setR({ id_competencia: rap.id_competencia, codigo: rap.codigo, nombre: rap.nombre }); setModalRap(rap); }}>Editar</button>
                        <button className="boton mini peligro" onClick={() => eliminarRap(rap)}>Eliminar</button>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {rap.tematicas.map((t) => (
                      <span key={t.id_tematica} className="insignia">
                        {t.nombre}
                        {puedeEditar && (
                          <button
                            onClick={() => eliminarTematica(t.id_tematica)}
                            title="Quitar temática"
                            style={{ marginLeft: 6, border: 0, background: "transparent", cursor: "pointer" }}
                          >×</button>
                        )}
                      </span>
                    ))}
                    {!rap.tematicas.length && <span style={{ fontSize: 13, color: "var(--tinta-suave)" }}>Sin temáticas</span>}
                  </div>
                  {puedeEditar && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                      <input
                        placeholder="Nueva temática…"
                        value={nuevaTematica[rap.id_rap] || ""}
                        onChange={(e) => setNuevaTematica({ ...nuevaTematica, [rap.id_rap]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && agregarTematica(rap)}
                        style={{ maxWidth: 280 }}
                      />
                      <button className="boton mini suave" onClick={() => agregarTematica(rap)}>Agregar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {!cargando && !competencias.length && (
        <Vacio icono="competencias" titulo="Aún no hay competencias. Créalas una por una o usa la carga masiva desde un CSV" />
      )}

      {modalCompetencia && (
        <div className="superposicion" onClick={() => setModalCompetencia(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modalCompetencia === "nueva" ? "Nueva competencia" : "Editar competencia"}</h2>
            <label>Código</label>
            <input value={c.codigo} onChange={(e) => setC({ ...c, codigo: e.target.value })} placeholder="220501096" />
            <label>Nombre *</label>
            <input value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} placeholder="Construcción del software" />
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModalCompetencia(null)}>Cancelar</button>
              <button className="boton" onClick={guardarCompetencia}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {modalRap && (
        <div className="superposicion" onClick={() => setModalRap(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modalRap.nuevo ? "Nuevo resultado de aprendizaje" : "Editar resultado de aprendizaje"}</h2>
            <label>Competencia *</label>
            <select value={r.id_competencia} onChange={(e) => setR({ ...r, id_competencia: e.target.value })}>
              <option value="">Selecciona…</option>
              {competencias.map((x) => <option key={x.id_competencia} value={x.id_competencia}>{x.nombre}</option>)}
            </select>
            <label>Código *</label>
            <input value={r.codigo} onChange={(e) => setR({ ...r, codigo: e.target.value })} placeholder="593108-04" />
            <label>Nombre *</label>
            <input value={r.nombre} onChange={(e) => setR({ ...r, nombre: e.target.value })} placeholder="Codificar el software de acuerdo con el diseño establecido" />
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModalRap(null)}>Cancelar</button>
              <button className="boton" onClick={guardarRap}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {modalCarga && (
        <div className="superposicion" onClick={() => setModalCarga(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h2>Carga masiva de competencias</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Una fila por temática, separada por <b>;</b> (también acepta coma o tabulación).
              Si la competencia o el código ya existen, se reutilizan en vez de duplicarse.
            </p>
            <pre style={{ background: "var(--fondo)", padding: 10, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>{EJEMPLO_CSV}</pre>

            <label>Archivo CSV</label>
            <input type="file" accept=".csv,.txt" onChange={leerArchivo} />
            <label>…o pega el contenido</label>
            <textarea rows={7} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="competencia;codigo;resultado;tematica" />

            {resultadoCarga && (
              <div className="mensaje exito" style={{ marginTop: 10 }}>
                Procesadas {resultadoCarga.filas_procesadas} fila(s): {resultadoCarga.competencias_nuevas} competencia(s),{" "}
                {resultadoCarga.raps_nuevos} resultado(s) y {resultadoCarga.tematicas_nuevas} temática(s) nuevas.
                {!!resultadoCarga.errores.length && (
                  <ul style={{ marginTop: 6 }}>
                    {resultadoCarga.errores.map((e, i) => <li key={i}>Fila {e.fila}: {e.error}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModalCarga(false)}>Cerrar</button>
              <button className="boton" onClick={subirCsv} disabled={cargando}>{cargando ? "Cargando…" : "Cargar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
