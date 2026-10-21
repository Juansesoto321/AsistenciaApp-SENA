import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../servicios/api";
import Cargando from "../../componentes/Cargando.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import Icono from "../../componentes/Iconos.jsx";
import AccionSesion from "../../componentes/AccionSesion.jsx";
import SinClasesHoy from "../../componentes/SinClasesHoy.jsx";
import useTabla from "../../componentes/useTabla.jsx";
import { fechaCorta, horaCorta } from "../../utilidades/formato";
import { useAuth } from "../../contexto/AuthContext.jsx";

const PERIODOS = [[30, "30 días"], [90, "3 meses"], [365, "1 año"]];

/** Clases de hoy: iniciarlas o supervisarlas. Sin clases, dice cuál es la próxima. */
function DeHoy({ alError }) {
  const [horarios, setHorarios] = useState(null);

  useEffect(() => {
    api("/sesiones/hoy")
      .then(setHorarios)
      .catch((e) => { setHorarios([]); alError(e.message); });
  }, []);

  if (horarios === null) return <Cargando texto="Buscando las clases de hoy…" />;
  if (!horarios.length) return <div className="tarjeta"><SinClasesHoy titulo="No tienes clases programadas para hoy" /></div>;
  return (
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
      </tbody>
    </table>
  );
}

/**
 * Clases de días anteriores, con cómo les fue. Antes una clase pasada solo se
 * abría si se tenía su dirección.
 */
function Historial({ verInstructor, alError }) {
  const [dias, setDias] = useState(30);
  const [clases, setClases] = useState(null);
  const tabla = useTabla(clases, { porPagina: 20, valores: { fecha: (c) => new Date(c.fecha) } });

  useEffect(() => {
    setClases(null);
    api(`/sesiones/historial?dias=${dias}`)
      .then(setClases)
      .catch((e) => { setClases([]); alError(e.message); });
  }, [dias]);

  return (<>
    <div className="barra-filtro">
      <span className="texto-suave">Clases de los últimos</span>
      <div className="selector-dias" role="group" aria-label="Periodo del historial">
        {PERIODOS.map(([n, texto]) => (
          <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)}>{texto}</button>
        ))}
      </div>
    </div>
    {clases === null ? <Cargando texto="Buscando las clases anteriores…" /> : !clases.length ? (
      <div className="tarjeta">
        <Vacio icono="sesiones" titulo="No hay clases en ese periodo">Prueba con un periodo más largo.</Vacio>
      </div>
    ) : (<>
      <table className="tabla tabla-tarjetas">
        <thead>
          <tr>
            {tabla.encabezado("fecha", "Fecha")}<th>Hora</th>{tabla.encabezado("numero_ficha", "Ficha")}<th>Ambiente</th>
            {verInstructor && tabla.encabezado("instructor", "Instructor")}<th>Asistencia</th><th>Sesión</th><th></th>
          </tr>
        </thead>
        <tbody>
          {tabla.visibles.map((c) => (
            <tr key={c.id_sesion}>
              <td className="principal">{fechaCorta(c.fecha)}</td>
              <td data-etiqueta="Hora">{horaCorta(c.hora_inicio)} – {horaCorta(c.hora_fin)}</td>
              <td data-etiqueta="Ficha">{c.numero_ficha}</td>
              <td data-etiqueta="Ambiente">{c.numero_ambiente}</td>
              {verInstructor && <td data-etiqueta="Instructor">{c.instructor}</td>}
              <td data-etiqueta="Asistencia">
                {c.registros ? <>{c.asistieron} de {c.registros}{c.ausentes > 0 && <small className="sub-celda">{c.ausentes} ausente(s)</small>}</> : "—"}
              </td>
              <td data-etiqueta="Sesión"><span className={`insignia ${c.estado}`}>{c.estado}</span></td>
              <td><Link className="boton mini suave" to={`/sesiones/${c.id_sesion}`}>Ver resumen</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      {tabla.paginacion}
    </>)}
  </>);
}

export default function Sesiones() {
  const [mensaje, setMensaje] = useState(null);
  const alError = (texto) => setMensaje({ tipo: "error", texto });
  const rol = useAuth().sesion.usuario.rol;
  const soloConsulta = rol === "programador";
  // ?vista=historial: se vuelve aquí desde una clase pasada
  const [parametros, setParametros] = useSearchParams();
  const vista = parametros.get("vista") === "historial" ? "historial" : "hoy";
  const cambiarVista = (nueva) => setParametros(nueva === "hoy" ? {} : { vista: nueva }, { replace: true });

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>{vista === "hoy" ? "Sesiones de hoy" : "Historial de clases"}</h1>
          <p>
            {vista === "historial"
              ? "Clases de días anteriores: abre una para ver quién asistió, quién llegó tarde y quién faltó."
              : soloConsulta
                ? "Consulta las clases de hoy y su asistencia en tiempo real. Las inicia y las cierra el instructor o la coordinación."
                : "Inicia la sesión para activar el lector del ambiente y supervisar la asistencia en tiempo real."}
          </p>
        </div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={vista === "hoy"} onClick={() => cambiarVista("hoy")}><Icono nombre="sesiones" /> Hoy</button>
        <button role="tab" aria-selected={vista === "historial"} onClick={() => cambiarVista("historial")}><Icono nombre="registro" /> Historial de clases</button>
      </div>
      {vista === "hoy" ? <DeHoy alError={alError} /> : <Historial verInstructor={rol !== "instructor"} alError={alError} />}
    </>
  );
}
