import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { fechaHora, haceCuanto } from "../../utilidades/formato";

const RECARGA_MS = 30_000; // el estado del lector cambia solo: se vuelve a consultar cada 30 s

// Lo que significa cada estado del lector, en palabras de quien lo usa
const ESTADO_LECTOR = {
  en_linea: { texto: "En línea", clase: "activa" },
  fuera_de_linea: { texto: "Sin señal", clase: "ausente" },
  no_verificado: { texto: "Aún no se conecta", clase: "pendiente" },
};

function EstadoLector({ estado }) {
  const e = ESTADO_LECTOR[estado] || { texto: estado, clase: "" };
  return (
    <span className={`insignia ${e.clase}`}>
      {estado === "en_linea" && <span className="pulso" aria-hidden="true" />}
      {e.texto}
    </span>
  );
}

export default function Ambientes() {
  const [ambientes, setAmbientes] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [modal, setModal] = useState(null); // 'ambiente' | {lector: ambiente}
  const [f, setF] = useState({ numero_ambiente: "", sede_centro: "", id_periodo: "" });
  const [lector, setLector] = useState({ serial: "", modelo: "ZKTeco SenseFace 2A" });
  const [claveGenerada, setClaveGenerada] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargar = () =>
    api("/ambientes").then(setAmbientes).catch((e) => { setAmbientes([]); setMensaje({ tipo: "error", texto: e.message }); });
  useEffect(() => {
    cargar();
    api("/periodos").then(setPeriodos).catch(() => {});
    const reloj = setInterval(() => api("/ambientes").then(setAmbientes).catch(() => {}), RECARGA_MS);
    return () => clearInterval(reloj);
  }, []);

  async function crearAmbiente() {
    try {
      await api("/ambientes", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: "Ambiente creado" });
      setModal(null); setF({ numero_ambiente: "", sede_centro: "", id_periodo: "" }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function registrarLector() {
    try {
      const r = await api(`/ambientes/${modal.lector.id_ambiente}/dispositivo`, { method: "POST", body: lector });
      setClaveGenerada(r);
      cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Ambientes y lectores</h1><p>Cada ambiente puede tener un lector biométrico. El lector envía una señal cada pocos segundos; si pasan 3 minutos sin señal aparece como «Sin señal».</p></div>
        <button className="boton" onClick={() => setModal("ambiente")}>+ Nuevo ambiente</button>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div className="tabla-desplazable">
      <table className="tabla">
        <thead><tr><th>Ambiente</th><th>Sede / Centro</th><th>Lector</th><th>Estado del lector</th><th>Última señal</th><th></th></tr></thead>
        <tbody>
          {(ambientes || []).map((a) => (
            <tr key={a.id_ambiente}>
              <td><b>{a.numero_ambiente}</b></td>
              <td>{a.sede_centro}</td>
              <td>{a.serial ? `${a.serial} · ${a.modelo}` : "—"}</td>
              <td>{a.serial ? <EstadoLector estado={a.estado_dispositivo} /> : "—"}</td>
              <td>{a.ultimo_heartbeat ? <span title={fechaHora(a.ultimo_heartbeat)}>{haceCuanto(a.ultimo_heartbeat)}</span> : "Nunca"}</td>
              <td>{!a.serial && <button className="boton mini" onClick={() => { setModal({ lector: a }); setClaveGenerada(null); setLector({ serial: "", modelo: "ZKTeco SenseFace 2A" }); }}>+ Asociar lector</button>}</td>
            </tr>
          ))}
          {ambientes === null && <tr><td colSpan={6}><Cargando /></td></tr>}
          {ambientes?.length === 0 && <tr><td colSpan={6}><Vacio icono="ambientes" titulo="No hay ambientes registrados">Crea un ambiente y asócialo a un lector para empezar a tomar asistencia.</Vacio></td></tr>}
        </tbody>
      </table>
      </div>

      {modal === "ambiente" && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo ambiente</h2>
            <div className="rejilla-2">
              <div><label>Número de ambiente</label><input value={f.numero_ambiente} onChange={(e) => setF({ ...f, numero_ambiente: e.target.value })} placeholder="201" /></div>
              <div>
                <label>Periodo</label>
                <select value={f.id_periodo} onChange={(e) => setF({ ...f, id_periodo: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {periodos.map((p) => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <label>Sede / Centro</label>
            <input value={f.sede_centro} onChange={(e) => setF({ ...f, sede_centro: e.target.value })} placeholder="SENA - CGMLTI Bogotá" />
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" onClick={crearAmbiente}>Crear ambiente</button>
            </div>
          </div>
        </div>
      )}

      {modal?.lector && (
        <div className="superposicion" onClick={() => !claveGenerada && setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Asociar lector al ambiente {modal.lector.numero_ambiente}</h2>
            {!claveGenerada ? (<>
              <div className="rejilla-2">
                <div><label>Serial del dispositivo</label><input value={lector.serial} onChange={(e) => setLector({ ...lector, serial: e.target.value })} placeholder="LECTOR-002" /></div>
                <div><label>Modelo</label><input value={lector.modelo} onChange={(e) => setLector({ ...lector, modelo: e.target.value })} /></div>
              </div>
              <div className="acciones-modal">
                <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
                <button className="boton" onClick={registrarLector}>Generar clave y registrar</button>
              </div>
            </>) : (<>
              <div className="mensaje exito">Lector registrado. Guarda esta clave: <b>solo se muestra una vez</b>.</div>
              <label>Clave API del dispositivo</label>
              <input readOnly value={claveGenerada.clave_api} onFocus={(e) => e.target.select()} />
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", marginTop: 10 }}>
                Configúrala en el lector físico (o en el simulador con las variables
                <code> SERIAL_LECTOR</code> y <code>CLAVE_API_LECTOR</code>).
              </p>
              <div className="acciones-modal"><button className="boton" onClick={() => setModal(null)}>Entendido</button></div>
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
