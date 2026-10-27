import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useTabla from "../../componentes/useTabla.jsx";
import { api } from "../../servicios/api";
import Cargando from "../../componentes/Cargando.jsx";
import Icono from "../../componentes/Iconos.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";

const VACIO = { nombres: "", apellidos: "", tipo_documento: "CC", documento: "", correo: "", telefono: "", rol: "aprendiz" };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState(null);
  // ?buscar= llega desde el buscador de la barra de arriba (también estando ya en esta página)
  const [parametros] = useSearchParams();
  const [filtro, setFiltro] = useState(() => ({ rol: "", estado: "", buscar: parametros.get("buscar") || "" }));
  useEffect(() => {
    const buscar = parametros.get("buscar");
    if (buscar !== null) setFiltro((actual) => ({ ...actual, buscar }));
  }, [parametros]);
  const [modal, setModal] = useState(null); // 'crear' | 'masiva'
  const [f, setF] = useState(VACIO);
  const [csv, setCsv] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const tabla = useTabla(usuarios, { porPagina: 20, valores: { nombre: (u) => `${u.nombres} ${u.apellidos}` } });

  const cargar = () => {
    const q = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString();
    api(`/usuarios?${q}`).then(setUsuarios).catch((e) => { setUsuarios([]); setMensaje({ tipo: "error", texto: e.message }); });
  };
  useEffect(() => { cargar(); }, [filtro]);

  async function crear() {
    try {
      const r = await api("/usuarios", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: r.mensaje }); setModal(null); setF(VACIO); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  function abrirEdicion(u) {
    setF({ ...VACIO, nombres: u.nombres, apellidos: u.apellidos, telefono: u.telefono || "", rol: u.rol });
    setModal({ editar: u });
  }

  async function guardarEdicion() {
    const u = modal.editar;
    try {
      const r = await api(`/usuarios/${u.id_usuario}`, {
        method: "PUT",
        body: { nombres: f.nombres, apellidos: f.apellidos, telefono: f.telefono, rol: f.rol },
      });
      setMensaje({ tipo: "exito", texto: r.mensaje }); setModal(null); setF(VACIO); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function cambiarEstado(u, estado) {
    try {
      const r = await api(`/usuarios/${u.id_usuario}/estado`, { method: "PATCH", body: { estado } });
      setMensaje({ tipo: "exito", texto: r.mensaje }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  function leerExcel(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = async (ev) => {
      try {
        // La librería de Excel pesa ~400 KB: se descarga solo cuando alguien sube un archivo
        const XLSX = await import("xlsx");
        const libro = XLSX.read(ev.target.result, { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
        // Si la primera fila es un encabezado (el documento no es solo dígitos), se omite.
        const inicio = /^\d+$/.test(String(filas[0]?.[2] ?? "").trim()) ? 0 : 1;
        const lineas = filas.slice(inicio)
          .filter((fila) => fila.some((c) => String(c).trim()))
          .map((fila) => fila.slice(0, 5).map((c) => String(c).trim()).join(";"));
        setCsv(lineas.join("\n"));
        setMensaje({ tipo: "exito", texto: `${lineas.length} fila(s) leídas del Excel. Revisa antes de cargar.` });
      } catch {
        setMensaje({ tipo: "error", texto: "No se pudo leer el archivo. Verifica que sea un .xlsx válido." });
      }
    };
    lector.readAsArrayBuffer(archivo);
    e.target.value = "";
  }

  async function cargaMasiva() {
    // CSV: nombres;apellidos;documento;correo;telefono
    const filas = csv.trim().split("\n").map((l) => {
      const [nombres, apellidos, documento, correo, telefono] = l.split(";").map((s) => s?.trim());
      return { nombres, apellidos, documento, correo, telefono };
    });
    try {
      const r = await api("/usuarios/carga-masiva", { method: "POST", body: { filas } });
      setMensaje({
        tipo: r.errores.length ? "error" : "exito",
        texto: `${r.creados} aprendices creados.` + (r.errores.length ? ` Errores: ${r.errores.map((e) => `fila ${e.fila} (${e.error})`).join(", ")}` : ""),
      });
      setModal(null); setCsv(""); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Usuarios</h1><p>Crea, aprueba y administra las cuentas del sistema.</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="boton suave" onClick={() => setModal("masiva")}><Icono nombre="subir" /> Carga masiva</button>
          <button className="boton" onClick={() => setModal("crear")}>+ Nuevo usuario</button>
        </div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input type="search" style={{ flex: "1 1 300px", maxWidth: 380 }} placeholder="Buscar por nombre, documento o correo"
               aria-label="Buscar usuarios por nombre, documento o correo" value={filtro.buscar} onChange={(e) => setFiltro({ ...filtro, buscar: e.target.value })} />
        <select style={{ maxWidth: 170 }} value={filtro.rol} onChange={(e) => setFiltro({ ...filtro, rol: e.target.value })}>
          <option value="">Todos los roles</option>
          <option value="coordinador">Coordinador</option>
          <option value="instructor">Instructor</option>
          <option value="programador">Programador</option>
          <option value="aprendiz">Aprendiz</option>
        </select>
        <select style={{ maxWidth: 190 }} value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="pendiente">Pendiente de aprobación</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>

      <div className="tabla-desplazable">
      <table className="tabla">
        <thead><tr>{tabla.encabezado("nombre", "Nombre", { className: "col-nombre" })}{tabla.encabezado("documento", "Documento")}{tabla.encabezado("correo", "Correo", { className: "col-correo" })}{tabla.encabezado("rol", "Rol")}{tabla.encabezado("estado", "Estado")}<th className="col-acciones">Acciones</th></tr></thead>
        <tbody>
          {tabla.visibles.map((u) => (
            <tr key={u.id_usuario}>
              <td className="col-nombre">{u.nombres} {u.apellidos}</td>
              <td>{u.documento}</td>
              <td className="col-correo">{u.correo}</td>
              <td style={{ textTransform: "capitalize" }}>{u.rol}</td>
              <td><span className={`insignia ${u.estado}`}>{u.estado}</span></td>
              <td className="col-acciones"><div className="acciones-celda">
                <button className="boton mini suave" onClick={() => abrirEdicion(u)}>Editar</button>
                {u.estado === "pendiente" && <button className="boton mini exito" onClick={() => cambiarEstado(u, "activo")}>Aprobar</button>}
                {u.estado === "activo" && <button className="boton mini suave" onClick={() => cambiarEstado(u, "inactivo")}>Desactivar</button>}
                {u.estado === "inactivo" && <button className="boton mini exito" onClick={() => cambiarEstado(u, "activo")}>Reactivar</button>}
              </div></td>
            </tr>
          ))}
          {usuarios === null && <tr><td colSpan={6}><Cargando /></td></tr>}
          {usuarios?.length === 0 && <tr><td colSpan={6}><Vacio icono="usuarios" titulo="No hay usuarios con esos filtros" /></td></tr>}
        </tbody>
      </table>
      </div>
      {tabla.paginacion}

      {modal?.editar && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Editar usuario</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              {modal.editar.correo} · documento {modal.editar.documento} (no se pueden cambiar)
            </p>
            <div className="rejilla-2">
              <div><label>Nombres</label><input value={f.nombres} onChange={(e) => setF({ ...f, nombres: e.target.value })} /></div>
              <div><label>Apellidos</label><input value={f.apellidos} onChange={(e) => setF({ ...f, apellidos: e.target.value })} /></div>
            </div>
            <label>Teléfono</label>
            <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
            <label>Rol</label>
            <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
              <option value="aprendiz">Aprendiz</option>
              <option value="instructor">Instructor</option>
              <option value="programador">Programador</option>
              <option value="coordinador">Coordinador</option>
            </select>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" onClick={guardarEdicion}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {modal === "crear" && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo usuario</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>La contraseña temporal se envía al correo del usuario.</p>
            <div className="rejilla-2">
              <div><label>Nombres</label><input value={f.nombres} onChange={(e) => setF({ ...f, nombres: e.target.value })} /></div>
              <div><label>Apellidos</label><input value={f.apellidos} onChange={(e) => setF({ ...f, apellidos: e.target.value })} /></div>
            </div>
            <div className="rejilla-2">
              <div>
                <label htmlFor="nuevo-tipo-doc">Tipo de documento</label>
                <select id="nuevo-tipo-doc" value={f.tipo_documento} onChange={(e) => setF({ ...f, tipo_documento: e.target.value })}>
                  <option value="CC">Cédula de ciudadanía</option>
                  <option value="TI">Tarjeta de identidad</option>
                  <option value="CE">Cédula de extranjería</option>
                </select>
              </div>
              <div><label>Documento</label><input inputMode="numeric" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></div>
            </div>
            <label>Teléfono</label><input type="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
            <label>Correo</label><input value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
            <label>Rol</label>
            <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
              <option value="aprendiz">Aprendiz</option>
              <option value="instructor">Instructor</option>
              <option value="programador">Programador</option>
              <option value="coordinador">Coordinador</option>
            </select>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" onClick={crear}>Crear usuario</button>
            </div>
          </div>
        </div>
      )}

      {modal === "masiva" && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Carga masiva de aprendices</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Sube un Excel (.xlsx) con las columnas en este orden: nombres, apellidos, documento, correo, teléfono
              — con o sin fila de encabezado. O pega el texto directamente abajo, una fila por aprendiz:<br />
              <code>nombres;apellidos;documento;correo;telefono</code>
            </p>
            <label>Archivo Excel (.xlsx)</label>
            <input type="file" accept=".xlsx,.xls" onChange={leerExcel} />
            <label style={{ marginTop: 14 }}>O pega/edita el texto aquí</label>
            <textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)}
                      placeholder={"Ana María;García López;1012345678;ana.garcia@soy.sena.edu.co;3001234567"} />
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" onClick={cargaMasiva}>Cargar aprendices</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
