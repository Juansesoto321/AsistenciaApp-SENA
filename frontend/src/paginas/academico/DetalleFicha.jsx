import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import IconoHuella from "../../componentes/IconoHuella.jsx";
import Icono from "../../componentes/Iconos.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import PlanTrimestres from "./PlanTrimestres.jsx";

export default function DetalleFicha() {
  const { id } = useParams();
  const { sesion } = useAuth();
  const { confirmar } = useConfirmar();
  const rol = sesion.usuario.rol;
  const [matriculas, setMatriculas] = useState(null);
  const [disponibles, setDisponibles] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [modal, setModal] = useState(null); // 'matricular' | {enrolar: aprendiz}
  const [consentimiento, setConsentimiento] = useState(null);
  const [pasoEnrolar, setPasoEnrolar] = useState(1);
  const [lecturas, setLecturas] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [pestana, setPestana] = useState("aprendices"); // "aprendices" | "plan"
  const [plan, setPlan] = useState(null); // ficha + plan por trimestres
  const puedePlanear = ["coordinador", "programador"].includes(rol);

  const cargar = () => api(`/fichas/${id}/matriculas`).then(setMatriculas).catch((e) => { setMatriculas([]); setMensaje({ tipo: "error", texto: e.message }); });
  const cargarPlan = () => api(`/fichas/${id}/programacion`).then(setPlan).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => { cargar(); cargarPlan(); }, [id]);

  async function abrirMatricular() {
    const todos = await api("/usuarios?rol=aprendiz&estado=activo");
    const ya = new Set((matriculas || []).map((m) => m.id_usuario));
    setDisponibles(todos.filter((u) => !ya.has(u.id_usuario)));
    setSeleccion([]); setModal("matricular");
  }

  async function matricular() {
    try {
      const r = await api(`/fichas/${id}/matriculas`, { method: "POST", body: { ids_aprendices: seleccion } });
      setMensaje({
        tipo: r.errores.length ? "error" : "exito",
        texto: `${r.matriculados} matriculado(s).` + (r.errores.length ? ` ${r.errores.map((e) => e.error).join(". ")}` : ""),
      });
      setModal(null); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function abrirEnrolar(aprendiz) {
    const t = await api("/biometria/consentimiento/texto");
    setConsentimiento(t); setPasoEnrolar(1); setLecturas([]);
    setModal({ enrolar: aprendiz });
  }

  // Simula la captura en el enrolador USB (ZK9500): en produccion aqui se invoca el SDK
  function capturar() {
    const lectura = modal.enrolar.documento; // la "huella" simulada es el documento
    const nuevas = [...lecturas, lectura];
    setLecturas(nuevas);
    if (nuevas.length >= 2) setPasoEnrolar(3);
  }

  async function confirmarEnrolamiento() {
    try {
      const r = await api("/biometria/enrolar", {
        method: "POST",
        body: { id_aprendiz: modal.enrolar.id_usuario, acepta_consentimiento: true, lectura1: lecturas[0], lectura2: lecturas[1] },
      });
      setMensaje({ tipo: "exito", texto: r.mensaje }); setModal(null); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function eliminarHuella(aprendiz) {
    const ok = await confirmar({
      titulo: "¿Eliminar los datos biométricos?",
      mensaje: `La plantilla de huella de ${aprendiz.nombres} se borrará permanentemente (derecho al borrado, Ley 1581/2012). Su historial de asistencia se conserva.`,
      textoConfirmar: "Eliminar huella",
      peligro: true,
    });
    if (!ok) return;
    try {
      const r = await api(`/biometria/${aprendiz.id_usuario}`, { method: "DELETE" });
      setMensaje({ tipo: "exito", texto: r.mensaje }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <Link to="/fichas" style={{ fontSize: 13.5 }}>← Volver a fichas</Link>
          <h1>{plan ? `Ficha ${plan.ficha.numero_ficha}` : "Ficha"}</h1>
          <p>{plan?.ficha.programa || "Aprendices y plan de formación"}</p>
        </div>
        {pestana === "aprendices" && puedePlanear && <button className="boton" onClick={abrirMatricular}>+ Matricular aprendices</button>}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === "aprendices"} onClick={() => setPestana("aprendices")}>
          <Icono nombre="usuarios" /> Aprendices {matriculas ? `(${matriculas.length})` : ""}
        </button>
        <button role="tab" aria-selected={pestana === "plan"} onClick={() => setPestana("plan")}>
          <Icono nombre="competencias" /> Plan por trimestres
        </button>
      </div>

      {pestana === "plan" && (plan
        ? <PlanTrimestres plan={plan} puedeEditar={puedePlanear} alCambiar={cargarPlan} alMensaje={setMensaje} />
        : <Cargando />)}

      {pestana === "aprendices" && (<>
      <p className="nota-estado" style={{ marginBottom: 12 }}>
        Matrícula y enrolamiento de huella digital (requiere consentimiento del aprendiz).
      </p>
      <div className="tabla-desplazable">
      <table className="tabla">
        <thead><tr><th>Aprendiz</th><th>Documento</th><th>Correo</th><th>Huella</th><th>Matrícula</th><th>Acciones</th></tr></thead>
        <tbody>
          {(matriculas || []).map((m) => (
            <tr key={m.id_matricula}>
              <td>{m.nombres} {m.apellidos}</td>
              <td>{m.documento}</td>
              <td>{m.correo}</td>
              <td>{m.tiene_huella
                ? <span className="insignia presente"><IconoHuella /> Registrada</span>
                : <span className="insignia pendiente">Sin registrar</span>}</td>
              <td><span className={`insignia ${m.estado}`}>{m.estado}</span></td>
              <td style={{ display: "flex", gap: 6 }}>
                {!m.tiene_huella && m.estado === "activa" &&
                  <button className="boton mini" onClick={() => abrirEnrolar(m)}><IconoHuella /> Enrolar huella</button>}
                {m.tiene_huella && ["coordinador", "programador"].includes(rol) &&
                  <button className="boton mini peligro" onClick={() => eliminarHuella(m)}>Eliminar huella</button>}
              </td>
            </tr>
          ))}
          {matriculas === null && <tr><td colSpan={6}><Cargando /></td></tr>}
          {matriculas?.length === 0 && <tr><td colSpan={6}><Vacio icono="usuarios" titulo="No hay aprendices matriculados en esta ficha" /></td></tr>}
        </tbody>
      </table>
      </div>
      </>)}

      {modal === "matricular" && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Matricular aprendices</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Un aprendiz solo puede tener una matrícula activa a la vez.
            </p>
            <div style={{ maxHeight: 300, overflow: "auto", marginTop: 10 }}>
              {disponibles.map((u) => (
                <label key={u.id_usuario} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 4px", margin: 0, fontWeight: 500, color: "var(--tinta)" }}>
                  <input type="checkbox" style={{ width: "auto" }}
                         checked={seleccion.includes(u.id_usuario)}
                         onChange={(e) => setSeleccion(e.target.checked
                           ? [...seleccion, u.id_usuario]
                           : seleccion.filter((x) => x !== u.id_usuario))} />
                  {u.nombres} {u.apellidos} · {u.documento}
                </label>
              ))}
              {!disponibles.length && <Vacio icono="usuarios" titulo="No hay aprendices disponibles para matricular" />}
            </div>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" disabled={!seleccion.length} onClick={matricular}>Matricular ({seleccion.length})</button>
            </div>
          </div>
        </div>
      )}

      {modal?.enrolar && (
        <div className="superposicion">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2><IconoHuella /> Enrolamiento de huella · {modal.enrolar.nombres} {modal.enrolar.apellidos}</h2>

            {pasoEnrolar === 1 && (<>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", margin: "8px 0" }}>Paso 1 de 3 · Consentimiento informado ({consentimiento?.version})</p>
              <div className="tarjeta" style={{ background: "var(--violeta-50)", fontSize: 13.5, lineHeight: 1.55 }}>
                {consentimiento?.texto}
              </div>
              <div className="acciones-modal">
                <button className="boton peligro" onClick={() => setModal(null)}>El aprendiz NO acepta</button>
                <button className="boton" onClick={() => setPasoEnrolar(2)}>El aprendiz acepta y firma</button>
              </div>
            </>)}

            {pasoEnrolar === 2 && (<>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", margin: "8px 0" }}>
                Paso 2 de 3 · Captura biométrica ({lecturas.length}/2 lecturas)
              </p>
              <div className="vacio" style={{ fontSize: 15 }}>
                Pide al aprendiz poner el dedo en el <b>enrolador USB</b>.<br />
                Se requieren <b>dos capturas</b> para validar consistencia.
              </div>
              <div className="acciones-modal">
                <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
                <button className="boton" onClick={capturar}><IconoHuella /> Capturar lectura {lecturas.length + 1}</button>
              </div>
            </>)}

            {pasoEnrolar === 3 && (<>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", margin: "8px 0" }}>Paso 3 de 3 · Confirmación</p>
              <div className="mensaje exito">Las dos capturas coinciden. La plantilla se cifrará con AES-256 antes de guardarse.</div>
              <div className="acciones-modal">
                <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
                <button className="boton exito" onClick={confirmarEnrolamiento}>Guardar plantilla cifrada</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
