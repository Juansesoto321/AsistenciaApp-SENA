import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Icono from "../../componentes/Iconos.jsx";
import useTabla from "../../componentes/useTabla.jsx";
import { fechaHora } from "../../utilidades/formato";

const VACIO = { tipo: "", descripcion: "", nombre_archivo: "", archivo_datos: "" };
const MAX_CAPTURA_MB = 4; // el servidor rechaza capturas más pesadas
const ESTADOS = { abierto: ["Abierto", "pendiente"], en_proceso: ["En proceso", "tardanza"], resuelto: ["Resuelto", "presente"] };

/** Lee la imagen elegida como data URI (así viaja al servidor, igual que los soportes de justificación). */
const leerComoDataUri = (archivo) => new Promise((resolver, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => resolver(lector.result);
  lector.onerror = rechazar;
  lector.readAsDataURL(archivo);
});

export default function Soporte() {
  const { sesion } = useAuth();
  const gestiona = ["coordinador", "programador"].includes(sesion.usuario.rol);
  const [tickets, setTickets] = useState(null);
  const [f, setF] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [captura, setCaptura] = useState(null); // { ticket, url, nombre } de la captura abierta
  const [mensaje, setMensaje] = useState(null);
  // Tipos de problema del rol (el backend los define) y el nombre de todos
  const [tipos, setTipos] = useState({ tipos: [], nombres: {} });
  const tabla = useTabla(tickets, { porPagina: 20, valores: { creado_en: (t) => new Date(t.creado_en) } });

  const cargar = () =>
    api("/soporte").then(setTickets).catch((e) => { setTickets([]); setMensaje({ tipo: "error", texto: e.message }); });
  useEffect(() => {
    cargar();
    api("/soporte/tipos").then((t) => {
      setTipos(t);
      setF((actual) => ({ ...actual, tipo: actual.tipo || t.tipos[0]?.valor || "" }));
    }).catch(() => {});
  }, []);

  async function elegirCaptura(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return setF({ ...f, nombre_archivo: "", archivo_datos: "" });
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) {
      e.target.value = "";
      return setMensaje({ tipo: "error", texto: "La captura debe ser una imagen JPG, PNG o WEBP" });
    }
    if (archivo.size > MAX_CAPTURA_MB * 1024 * 1024) {
      e.target.value = "";
      return setMensaje({ tipo: "error", texto: `La captura no puede pesar más de ${MAX_CAPTURA_MB} MB` });
    }
    setF({ ...f, nombre_archivo: archivo.name, archivo_datos: await leerComoDataUri(archivo) });
  }

  async function crear() {
    setEnviando(true);
    try {
      const r = await api("/soporte", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: r.mensaje });
      setF({ ...VACIO, tipo: tipos.tipos[0]?.valor || "" });
      document.getElementById("soporte-captura").value = "";
      cargar();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  async function verCaptura(t) {
    try {
      const r = await api(`/soporte/${t.id_ticket}/captura`);
      setCaptura({ ticket: t.id_ticket, url: r.archivo_datos, nombre: r.nombre_archivo });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function cambiarEstado(t, estado) {
    try {
      await api(`/soporte/${t.id_ticket}`, { method: "PATCH", body: { estado } });
      cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Soporte</h1><p>Reporta problemas con tu huella, errores de asistencia o dudas del sistema. Una captura de pantalla ayuda a resolverlo más rápido.</p></div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div className="tarjeta" style={{ marginBottom: 18, maxWidth: 640 }}>
        <label htmlFor="soporte-tipo">Tipo de problema</label>
        <select id="soporte-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          {tipos.tipos.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
        </select>
        <label htmlFor="soporte-descripcion">Descripción detallada</label>
        <textarea id="soporte-descripcion" rows={3} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        <label htmlFor="soporte-captura">Captura de pantalla (opcional · JPG, PNG o WEBP, hasta {MAX_CAPTURA_MB} MB)</label>
        <input id="soporte-captura" type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirCaptura} />
        {f.archivo_datos && (<>
          <img className="vista-captura" src={f.archivo_datos} alt="Vista previa de la captura" />
          <button type="button" className="boton mini suave" style={{ marginTop: 8 }} onClick={() => {
            document.getElementById("soporte-captura").value = "";
            setF({ ...f, nombre_archivo: "", archivo_datos: "" });
          }}>Quitar captura</button>
        </>)}
        <button className="boton" style={{ marginTop: 14, display: "block" }} disabled={!f.tipo || !f.descripcion.trim() || enviando} onClick={crear}>
          {enviando ? "Enviando…" : "Registrar ticket"}
        </button>
      </div>

      <div className="tabla-desplazable">
      <table className="tabla">
        <thead><tr>
          {tabla.encabezado("id_ticket", "#")}
          {tabla.encabezado("creado_en", "Fecha")}
          {gestiona && tabla.encabezado("usuario", "Usuario")}
          {tabla.encabezado("tipo", "Tipo")}
          <th>Descripción</th>
          {tabla.encabezado("estado", "Estado")}
          <th></th>
        </tr></thead>
        <tbody>
          {tabla.visibles.map((t) => (
            <tr key={t.id_ticket}>
              <td><b>{t.id_ticket}</b></td>
              <td>{fechaHora(t.creado_en)}</td>
              {gestiona && <td>{t.usuario}</td>}
              <td>{tipos.nombres[t.tipo] || t.tipo}</td>
              <td>{t.descripcion}</td>
              <td><span className={`insignia ${ESTADOS[t.estado]?.[1] || ""}`}>{ESTADOS[t.estado]?.[0] || t.estado}</span></td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  {t.tiene_captura && <button className="boton mini suave" onClick={() => verCaptura(t)}><Icono nombre="adjunto" /> Captura</button>}
                  {gestiona && t.estado === "abierto" && <button className="boton mini suave" onClick={() => cambiarEstado(t, "en_proceso")}>En proceso</button>}
                  {gestiona && t.estado !== "resuelto" && <button className="boton mini exito" onClick={() => cambiarEstado(t, "resuelto")}>Resolver</button>}
                </div>
              </td>
            </tr>
          ))}
          {tickets === null && <tr><td colSpan={7}><Cargando /></td></tr>}
          {tickets?.length === 0 && <tr><td colSpan={7}><Vacio icono="configuracion" titulo="No hay tickets registrados" /></td></tr>}
        </tbody>
      </table>
      </div>
      {tabla.paginacion}

      {captura && (
        <div className="superposicion" onClick={() => setCaptura(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <h2>Captura del ticket #{captura.ticket}</h2>
            <div className="visor-soporte" style={{ marginTop: 10 }}>
              <img src={captura.url} alt={`Captura del ticket ${captura.ticket}`} />
              <a href={captura.url} download={captura.nombre}><Icono nombre="adjunto" /> Descargar {captura.nombre}</a>
            </div>
            <div className="acciones-modal"><button className="boton suave" onClick={() => setCaptura(null)}>Cerrar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
