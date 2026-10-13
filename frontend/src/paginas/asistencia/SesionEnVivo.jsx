import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../servicios/api";
import { conectarTiempoReal } from "../../servicios/socket";
import { useAuth } from "../../contexto/AuthContext.jsx";
import IconoHuella from "../../componentes/IconoHuella.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import Icono from "../../componentes/Iconos.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import PanelRegistroManual from "../../componentes/PanelRegistroManual.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { textoPlazo, fechaCorta } from "../../utilidades/formato";

export default function SesionEnVivo() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { confirmar } = useConfirmar();
  const { sesion: sesionUsuario } = useAuth();
  const rol = sesionUsuario.usuario.rol;

  const [sesion, setSesion] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [modal, setModal] = useState(null); // aprendiz con el panel de registro manual abierto
  const [mensaje, setMensaje] = useState(null);
  const [plazo, setPlazo] = useState(72);
  const [cerrando, setCerrando] = useState(false);
  const temporizadorAlerta = useRef(null);

  const cargar = () =>
    api(`/sesiones/${id}`)
      .then(setSesion)
      .catch((e) => setMensaje({ tipo: "error", texto: e.message }));

  useEffect(() => {
    cargar();
    api("/configuracion")
      .then((c) => c?.horas_justificacion && setPlazo(Number(c.horas_justificacion)))
      .catch(() => {});

    const socket = conectarTiempoReal();
    socket.emit("unirse_sesion", id);

    // Cada marcación del lector actualiza la fila del aprendiz sin recargar (CU-14)
    socket.on("marcacion", (m) => {
      setSesion((actual) => actual && {
        ...actual,
        aprendices: actual.aprendices.map((a) =>
          a.id_usuario === m.id_aprendiz
            ? { ...a, estado: m.estado, hora_marca: m.hora_marca, metodo: m.metodo }
            : a
        ),
      });
    });

    socket.on("huella_no_reconocida", () => {
      setAlerta("Huella no reconocida en el lector. Si el aprendiz insiste, usa el registro manual.");
      clearTimeout(temporizadorAlerta.current);
      temporizadorAlerta.current = setTimeout(() => setAlerta(null), 8000);
    });

    return () => {
      clearTimeout(temporizadorAlerta.current);
      socket.emit("salir_sesion", id);
      socket.disconnect();
    };
  }, [id]);

  // Lo llama el panel de registro manual; devuelve si se guardó para que el panel se cierre o no
  async function guardarManual(estado, motivo) {
    try {
      const r = await api(`/sesiones/${id}/asistencia-manual`, {
        method: "POST",
        body: { id_aprendiz: modal.id_usuario, estado, motivo },
      });
      setMensaje({ tipo: "exito", texto: `${modal.nombres}: ${r.mensaje.toLowerCase()}` });
      setModal(null);
      cargar();
      return true;
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
      return false;
    }
  }

  async function cerrar() {
    if (cerrando) return;
    const sinMarca = sesion.aprendices.filter((a) => !a.estado).length;
    const ok = await confirmar({
      titulo: "¿Cerrar la sesión de clase?",
      mensaje: sinMarca
        ? `${sinMarca} aprendiz(es) sin marca quedarán AUSENTES y recibirán por correo el enlace para justificar (plazo: ${textoPlazo(plazo)}).`
        : "Todos los aprendices ya tienen registro. La sesión quedará cerrada.",
      textoConfirmar: "Cerrar sesión",
      peligro: true,
    });
    if (!ok) return;

    setCerrando(true);
    setMensaje(null);
    try {
      const r = await api(`/sesiones/${id}/cerrar`, { method: "POST" });
      setMensaje({ tipo: "exito", texto: r.mensaje });
      await cargar();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setCerrando(false);
    }
  }

  async function eliminar() {
    const ok = await confirmar({
      titulo: "¿Eliminar esta sesión?",
      mensaje: "Se borrará permanentemente, junto con toda su asistencia y las justificaciones asociadas. No se puede deshacer.",
      textoConfirmar: "Eliminar definitivamente",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api(`/sesiones/${id}`, { method: "DELETE" });
      navegar("/sesiones");
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    }
  }

  if (!sesion) {
    return mensaje
      ? <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>
      : <Cargando texto="Cargando sesión…" />;
  }

  const marcados = sesion.aprendices.filter((a) => a.estado).length;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <Link to="/sesiones" style={{ fontSize: 13.5 }}>← Sesiones de hoy</Link>
          <h1>
            {sesion.estado === "activa" && <span className="pulso" />}
            Ficha {sesion.numero_ficha} · Ambiente {sesion.numero_ambiente}
          </h1>
          <p>
            {sesion.programa} · {fechaCorta(sesion.fecha)} ·{" "}
            {sesion.hora_inicio.slice(0, 5)}–{sesion.hora_fin.slice(0, 5)} ·{" "}
            <b>{marcados}/{sesion.aprendices.length}</b> registrados
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {sesion.estado === "activa" ? (
            <button className="boton peligro" onClick={cerrar} disabled={cerrando}>
              {cerrando ? "Cerrando…" : "Cerrar sesión de clase"}
            </button>
          ) : (
            <span className="insignia cerrada">Sesión cerrada</span>
          )}
          {["coordinador", "programador"].includes(rol) && (
            <button className="boton mini suave" onClick={eliminar} title="Borra la sesión y su asistencia permanentemente">
              Eliminar sesión
            </button>
          )}
        </div>
      </div>

      {alerta && (
        <div className="mensaje error alerta-banda" role="alert">
          <Icono nombre="alerta" size="1.2em" /> <span>{alerta}</span>
        </div>
      )}
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <table className="tabla tabla-tarjetas">
        <thead>
          <tr><th>Aprendiz</th><th>Documento</th><th>Huella</th><th>Estado</th><th>Hora</th><th>Método</th><th></th></tr>
        </thead>
        <tbody>
          {sesion.aprendices.map((a) => (
            <tr key={a.id_usuario}>
              <td className="principal">{a.nombres} {a.apellidos}</td>
              <td data-etiqueta="Documento">{a.documento}</td>
              <td data-etiqueta="Huella">
                {a.tiene_huella ? (
                  <IconoHuella title="Huella registrada" />
                ) : (
                  <span style={{ color: "var(--tinta-suave)", fontSize: 12.5 }} title="Sin huella registrada: usar registro manual">
                    Sin huella
                  </span>
                )}
              </td>
              <td data-etiqueta="Estado">
                {a.estado
                  ? <span className={`insignia ${a.estado}`}>{a.estado}</span>
                  : <span style={{ color: "var(--tinta-suave)" }}>esperando…</span>}
              </td>
              <td data-etiqueta="Hora">
                {a.hora_marca
                  ? new Date(a.hora_marca).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </td>
              <td data-etiqueta="Método">{a.metodo ? <span className={`insignia ${a.metodo}`}>{a.metodo}</span> : "—"}</td>
              <td>
                <button
                  className="boton mini suave"
                  disabled={cerrando}
                  onClick={() => setModal(a)}
                >
                  Registro manual
                </button>
              </td>
            </tr>
          ))}
          {!sesion.aprendices.length && (
            <tr><td colSpan={7}><Vacio icono="usuarios" titulo="No hay aprendices matriculados en esta ficha" /></td></tr>
          )}
        </tbody>
      </table>

      {modal && (
        <PanelRegistroManual
          aprendiz={modal}
          plazoHoras={plazo}
          alGuardar={guardarManual}
          alCerrar={() => setModal(null)}
        />
      )}

      {cerrando && (
        <div className="superposicion bloqueante" role="status">
          <div className="aviso-proceso">
            <span className="giro grande" aria-hidden="true" />
            <h2>Cerrando sesión</h2>
            <p>Marcando ausencias y enviando los enlaces de justificación…</p>
          </div>
        </div>
      )}
    </>
  );
}
