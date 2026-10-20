import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import AccionSesion from "../../componentes/AccionSesion.jsx";
import { horaCorta } from "../../utilidades/formato";
import { useAuth } from "../../contexto/AuthContext.jsx";

export default function Sesiones() {
  const [horarios, setHorarios] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const alError = (texto) => setMensaje({ tipo: "error", texto });
  const soloConsulta = useAuth().sesion.usuario.rol === "programador";

  useEffect(() => {
    api("/sesiones/hoy")
      .then(setHorarios)
      .catch((e) => { setHorarios([]); alError(e.message); });
  }, []);

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Sesiones de hoy</h1>
          <p>
            {soloConsulta
              ? "Consulta las clases de hoy y su asistencia en tiempo real. Las inicia y las cierra el instructor o la coordinación."
              : "Inicia la sesión para activar el lector del ambiente y supervisar la asistencia en tiempo real."}
          </p>
        </div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {horarios === null ? <Cargando texto="Buscando las clases de hoy…" /> : (
        <table className="tabla tabla-tarjetas">
          <thead><tr><th>Hora</th><th>Ficha</th><th>Programa</th><th>Ambiente</th><th>Sesión</th><th></th></tr></thead>
          <tbody>
            {horarios.map((h) => (
              <tr key={h.id_horario}>
                <td className="principal">{horaCorta(h.hora_inicio)} – {horaCorta(h.hora_fin)}</td>
                <td data-etiqueta="Ficha">{h.numero_ficha}</td>
                <td data-etiqueta="Programa">{h.programa}</td>
                <td data-etiqueta="Ambiente">{h.numero_ambiente}</td>
                <td data-etiqueta="Sesión">
                  {h.estado_sesion
                    ? <span className={`insignia ${h.estado_sesion}`}>{h.estado_sesion}</span>
                    : <span className="insignia pendiente">sin iniciar</span>}
                </td>
                <td><AccionSesion horario={h} alError={alError} /></td>
              </tr>
            ))}
            {!horarios.length && (
              <tr><td colSpan={6}>
                <Vacio icono="sesiones" titulo="No tienes clases programadas para hoy">
                  Las clases salen aquí el día que corresponde según el horario de la ficha.
                </Vacio>
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}
