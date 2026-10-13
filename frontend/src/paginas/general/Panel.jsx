import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../servicios/api";
import { conectarTiempoReal } from "../../servicios/socket";
import { useAuth } from "../../contexto/AuthContext.jsx";
import Icono from "../../componentes/Iconos.jsx";
import Aviso from "../../componentes/Aviso.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import AccionSesion from "../../componentes/AccionSesion.jsx";
import AnilloAsistencia from "../../componentes/AnilloAsistencia.jsx";
import GraficaTendencia from "../../componentes/GraficaTendencia.jsx";
import { horaCorta, mayusculaInicial, saludo } from "../../utilidades/formato";
import { nombreDelDia, proximaClase } from "../../utilidades/fechas";

const MAX_EN_RIESGO = 6;
const RECARGA_MS = 60_000; // clases iniciadas en otro equipo y lectores que se caen

const ACCESOS = {
  coordinador: [
    ["/usuarios", "usuarios", "Gestionar usuarios"],
    ["/fichas", "fichas", "Fichas y matrículas"],
    ["/horarios", "horarios", "Calendario de horarios"],
    ["/ambientes", "ambientes", "Lectores biométricos"],
  ],
  instructor: [
    ["/justificaciones", "justificaciones", "Revisar justificaciones"],
    ["/horarios", "horarios", "Mis horarios"],
    ["/fichas", "fichas", "Mis fichas"],
    ["/reportes", "reportes", "Reportes de mis fichas"],
  ],
  programador: [
    ["/fichas", "fichas", "Gestionar fichas"],
    ["/horarios", "horarios", "Organizar horarios"],
    ["/competencias", "competencias", "Competencias y RAP"],
    ["/ambientes", "ambientes", "Ambientes y lectores"],
  ],
  aprendiz: [
    ["/mi-asistencia", "asistencia", "Ver mi historial completo"],
    ["/horarios", "horarios", "Ver mi horario de la semana"],
    ["/perfil", "perfil", "Actualizar mis datos"],
    ["/soporte", "alerta", "Reportar un problema"],
  ],
};

function Metrica({ valor, nombre, color, a, atencion }) {
  const contenido = (<>
    <div className="valor" style={color ? { color } : undefined}>
      {atencion && <span className="pulso" style={{ background: "var(--ambar)" }} />}
      {valor ?? "—"}
    </div>
    <div className="nombre">{nombre}</div>
  </>);
  const clase = `tarjeta-metrica${a ? " enlace" : ""}${atencion ? " atencion" : ""}`;
  return a ? <Link to={a} className={clase}>{contenido}</Link> : <div className={clase}>{contenido}</div>;
}

function Accesos({ rol }) {
  return (
    <div className="tarjeta">
      <h3 style={{ fontSize: 16 }}>Accesos rápidos</h3>
      <div className="accesos">
        {(ACCESOS[rol] || []).map(([ruta, icono, texto]) => (
          <Link key={ruta} className="boton suave" to={ruta}><Icono nombre={icono} /> {texto}</Link>
        ))}
      </div>
    </div>
  );
}

// ---------- Coordinador, programador e instructor ----------

/** Lo que pide acción hoy. Solo aparece lo que tiene algo pendiente. */
function Atencion({ pendientes, lectoresSinSenal, enRiesgo, puedeVerLectores }) {
  const avisos = [
    pendientes > 0 && { a: "/justificaciones", tono: "ambar", valor: pendientes, texto: pendientes === 1 ? "justificación por revisar" : "justificaciones por revisar" },
    lectoresSinSenal > 0 && { a: puedeVerLectores ? "/ambientes" : "/sesiones", tono: "rojo", valor: lectoresSinSenal, texto: lectoresSinSenal === 1 ? "lector sin señal" : "lectores sin señal" },
    enRiesgo > 0 && { a: "/reportes", tono: "rojo", valor: enRiesgo, texto: enRiesgo === 1 ? "aprendiz bajo el mínimo" : "aprendices bajo el mínimo" },
  ].filter(Boolean);
  if (!avisos.length) return null;
  return (
    <div className="atencion-fila" role="status">
      {avisos.map((v) => (
        <Link key={v.a + v.texto} to={v.a} className={`aviso-atencion ${v.tono}`}>
          <Icono nombre="alerta" /> <b>{v.valor}</b> {v.texto} <span aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  );
}

const ESTADO_LECTOR = { en_linea: "lector en línea", fuera_de_linea: "lector sin señal", no_verificado: "lector sin conectar" };

/** Una clase de hoy con su avance: cuántos marcaron, cuántos llegaron tarde y cuántos faltan. */
function ClaseDeHoy({ h, verInstructor, alError }) {
  const total = Math.max(h.matriculados, 1);
  const marcaron = h.presentes + h.tardanzas + h.justificadas;
  const ancho = (n) => `${(n / total) * 100}%`;
  let estado = "Sin iniciar";
  if (h.estado_sesion === "activa") estado = `En curso · ${marcaron} de ${h.matriculados} han marcado`;
  if (h.estado_sesion === "cerrada") estado = `Cerrada · ${marcaron} asistieron, ${h.ausentes} faltaron`;

  return (
    <li className="clase-hoy">
      <div className="clase-hora">
        <span className="hora-clase">{horaCorta(h.hora_inicio)} – {horaCorta(h.hora_fin)}</span>
        {h.estado_sesion === "activa" && <span className="insignia activa"><span className="pulso" />En curso</span>}
      </div>
      <div className="clase-info">
        <b>Ficha {h.numero_ficha}</b>
        <small>
          Ambiente {h.numero_ambiente}{verInstructor ? ` · ${h.instructor}` : ""}
          {" · "}
          <span className={`punto-lector ${h.estado_lector || "ninguno"}`} aria-hidden="true" />
          {h.estado_lector ? ESTADO_LECTOR[h.estado_lector] : "sin lector"}
        </small>
        {h.id_sesion && (
          <div className="barra-asistencia" aria-hidden="true">
            <span className="presente" style={{ width: ancho(h.presentes) }} />
            <span className="tardanza" style={{ width: ancho(h.tardanzas) }} />
            <span className="justificada" style={{ width: ancho(h.justificadas) }} />
            <span className="ausente" style={{ width: ancho(h.ausentes) }} />
          </div>
        )}
        <small>{estado}{h.tardanzas > 0 ? ` · ${h.tardanzas} con tardanza` : ""}</small>
      </div>
      <AccionSesion horario={h} alError={alError} />
    </li>
  );
}

function PanelSupervision({ rol, alError }) {
  const esInstructor = rol === "instructor";
  const [datos, setDatos] = useState(null);
  const [pendientes, setPendientes] = useState(null);
  const [clases, setClases] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [lectores, setLectores] = useState(null);
  const [dias, setDias] = useState(30);
  const [tendencia, setTendencia] = useState(null);
  const socket = useRef(null);

  const cargarClases = () => api("/sesiones/hoy").then(setClases).catch(() => setClases([]));

  useEffect(() => {
    api("/reportes/estadisticas").then(setDatos).catch((e) => alError(e.message));
    api("/reportes/resumen").then(setResumen).catch(() => setResumen({ bajo_minimo: [] }));
    if (!esInstructor) api("/dispositivos").then(setLectores).catch(() => setLectores([]));
    cargarClases();

    const cargarPendientes = () => api("/justificaciones/pendientes/contador").then((r) => setPendientes(Number(r.pendientes))).catch(() => {});
    cargarPendientes();
    socket.current = conectarTiempoReal();
    socket.current.on("justificaciones:actualizadas", cargarPendientes);
    // Cada marca de una clase en curso actualiza su barra (se agrupan las que llegan seguidas)
    let espera = null;
    socket.current.on("marcacion", () => { clearTimeout(espera); espera = setTimeout(cargarClases, 700); });
    const reloj = setInterval(() => {
      cargarClases();
      if (!esInstructor) api("/dispositivos").then(setLectores).catch(() => {});
    }, RECARGA_MS);
    return () => { clearTimeout(espera); clearInterval(reloj); socket.current.disconnect(); };
  }, []);

  // Se une a las clases en curso para recibir sus marcas en vivo
  useEffect(() => {
    (clases || []).filter((c) => c.estado_sesion === "activa").forEach((c) => socket.current?.emit("unirse_sesion", c.id_sesion));
  }, [clases]);

  useEffect(() => {
    setTendencia(null);
    api(`/reportes/tendencia?dias=${dias}`).then(setTendencia).catch(() => setTendencia([]));
  }, [dias]);

  if (!datos) return <Cargando />;
  const sinDatos = datos.promedio_asistencia === null; // aún no hay clases cerradas
  const promedio = Number(datos.promedio_asistencia);
  const minimo = Number(datos.minimo);
  const sinSenal = esInstructor
    ? new Set((clases || []).filter((c) => c.estado_lector && c.estado_lector !== "en_linea").map((c) => c.numero_ambiente)).size
    : (lectores || []).filter((l) => l.estado !== "en_linea").length;
  const enRiesgo = resumen?.bajo_minimo || [];
  const hayDatosTendencia = tendencia?.some((d) => d.porcentaje !== null);

  return (<>
    <Atencion pendientes={pendientes} lectoresSinSenal={sinSenal} enRiesgo={enRiesgo.length} puedeVerLectores={!esInstructor} />

    <div className="resumen-panel">
      <div className="tarjeta tarjeta-anillo">
        {sinDatos ? (
          <Vacio icono="asistencia" titulo="Aún no hay clases cerradas">El promedio aparece cuando se cierre la primera clase.</Vacio>
        ) : (<>
          <AnilloAsistencia porcentaje={promedio} minimo={minimo} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Asistencia promedio</div>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13, marginTop: 4 }}>
              {esInstructor ? "De tus clases cerradas" : "De las clases cerradas"} · mínimo {minimo} %
            </p>
            <span className={`insignia ${promedio >= minimo ? "activa" : "ausente"}`} style={{ marginTop: 8 }}>
              {promedio >= minimo ? "Cumple el mínimo" : "Bajo el mínimo"}
            </span>
          </div>
        </>)}
      </div>
      <div className="metricas-2x2">
        <Metrica valor={datos.fichas_activas} nombre="Fichas activas" a="/fichas" />
        <Metrica valor={datos.aprendices_activos} nombre="Aprendices activos" />
        <Metrica valor={datos.sesiones_hoy} nombre="Clases iniciadas hoy" a="/sesiones" color={datos.sesiones_hoy > 0 ? "var(--azul)" : undefined} />
        <Metrica valor={pendientes} nombre="Justificaciones por revisar" a="/justificaciones" atencion={pendientes > 0} />
      </div>
    </div>

    <div className="dos-columnas">
      <div className="tarjeta">
        <div className="titulo-tarjeta">
          <h3>{esInstructor ? "Tus clases de hoy" : "Clases de hoy"}</h3>
          {clases?.length > 0 && <Link to="/sesiones" style={{ fontSize: 13.5 }}>Ver todas →</Link>}
        </div>
        {clases === null ? <Cargando /> : clases.length === 0 ? (
          <Vacio icono="sesiones" titulo="No hay clases programadas para hoy" />
        ) : (
          <>
            <ul className="lista-clases">
              {clases.map((h) => <ClaseDeHoy key={h.id_horario} h={h} verInstructor={!esInstructor} alError={alError} />)}
            </ul>
            <div className="leyenda-barra" aria-hidden="true">
              <span><i className="presente" />Presente</span><span><i className="tardanza" />Tardanza</span>
              <span><i className="justificada" />Justificada</span><span><i className="ausente" />Ausente</span>
            </div>
          </>
        )}
      </div>

      <div className="tarjeta">
        <div className="titulo-tarjeta">
          <h3>Aprendices bajo el mínimo</h3>
          {enRiesgo.length > 0 && <Link to="/reportes" style={{ fontSize: 13.5 }}>Ver todos →</Link>}
        </div>
        {resumen === null ? <Cargando /> : enRiesgo.length === 0 ? (
          <Vacio icono="asistencia" titulo={`Todos están sobre el ${minimo} %`}>Aquí aparecerán los aprendices que necesiten seguimiento.</Vacio>
        ) : (
          <ul className="lista-riesgo">
            {enRiesgo.slice(0, MAX_EN_RIESGO).map((a) => (
              <li key={`${a.id_usuario}-${a.id_ficha}`}>
                <div>
                  <b>{a.aprendiz}</b>
                  <small>Ficha {a.numero_ficha} · {a.ausencias} {a.ausencias === 1 ? "falta" : "faltas"} en {a.clases} clases</small>
                </div>
                <span className="porcentaje-riesgo">{a.porcentaje} %</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>

    <div className="dos-columnas" style={{ marginTop: 14 }}>
      <div className="tarjeta">
        <div className="titulo-tarjeta">
          <h3>Asistencia por día</h3>
          <div className="selector-dias" role="group" aria-label="Periodo de la gráfica">
            {[[7, "7 días"], [30, "30 días"], [90, "3 meses"]].map(([n, texto]) => (
              <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)}>{texto}</button>
            ))}
          </div>
        </div>
        {tendencia === null ? <Cargando /> : !hayDatosTendencia ? (
          <Vacio icono="reportes" titulo="Sin clases cerradas en este periodo">Prueba con un periodo más largo. Las clases en curso cuentan al cerrarse.</Vacio>
        ) : (
          <GraficaTendencia datos={tendencia} minimo={minimo} />
        )}
      </div>
      <Accesos rol={rol} />
    </div>
  </>);
}

// ---------- Aprendiz ----------
function PanelAprendiz({ alError }) {
  const [historial, setHistorial] = useState(null);
  const [horarios, setHorarios] = useState(null);

  useEffect(() => {
    api("/reportes/mi-historial").then(setHistorial).catch((e) => alError(e.message));
    api("/horarios").then(setHorarios).catch(() => setHorarios([]));
  }, []);

  if (!historial) return <Cargando />;
  const r = historial.resumen;
  const siguiente = horarios ? proximaClase(horarios) : null;

  return (<>
    {r && r.porcentaje < r.minimo && (
      <div className="mensaje error alerta-banda" role="alert">
        <Icono nombre="alerta" size="1.2em" />
        <span>
          Tu asistencia ({r.porcentaje} %) está por debajo del mínimo ({r.minimo} %). Habla con tu instructor y
          justifica tus inasistencias a tiempo.
        </span>
      </div>
    )}

    {r ? (
      <div className="resumen-panel">
        <div className="tarjeta tarjeta-anillo">
          <AnilloAsistencia porcentaje={r.porcentaje} minimo={r.minimo} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Mi asistencia</div>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13, margin: "4px 0 8px" }}>Mínimo institucional: {r.minimo} %</p>
            <Link to="/mi-asistencia" style={{ fontSize: 13.5, fontWeight: 600 }}>Ver historial →</Link>
          </div>
        </div>
        <div className="metricas-2x2">
          <Metrica valor={r.presentes} nombre="Presentes" color="var(--verde)" />
          <Metrica valor={r.tardanzas} nombre="Tardanzas" color="var(--ambar)" />
          <Metrica valor={r.justificadas} nombre="Justificadas" color="var(--azul)" />
          <Metrica valor={r.ausencias} nombre="Ausencias" color="var(--rojo)" />
        </div>
      </div>
    ) : (
      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <Vacio icono="fichas" titulo="Todavía no estás matriculado en una ficha">
          Cuando la coordinación te matricule, aquí verás tu asistencia y tus clases.
        </Vacio>
      </div>
    )}

    <div className="dos-columnas">
      <div className="tarjeta">
        <div className="titulo-tarjeta">
          <h3>Próxima clase</h3>
          <Link to="/horarios" style={{ fontSize: 13.5 }}>Mi horario →</Link>
        </div>
        {horarios === null ? <Cargando /> : !siguiente ? (
          <Vacio icono="horarios" titulo="No tienes clases en los próximos días" />
        ) : (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 18 }}>{mayusculaInicial(nombreDelDia(siguiente.fecha))}</b>
              {siguiente.enCurso && <span className="insignia activa"><span className="pulso" />En curso</span>}
            </div>
            <p className="hora-clase" style={{ color: "var(--violeta-700)", fontWeight: 700, margin: "4px 0 10px" }}>
              {horaCorta(siguiente.horario.hora_inicio)} – {horaCorta(siguiente.horario.hora_fin)}
            </p>
            <p style={{ color: "var(--tinta-suave)", fontSize: 14, lineHeight: 1.6 }}>
              Ambiente <b style={{ color: "var(--tinta)" }}>{siguiente.horario.numero_ambiente}</b>
              {siguiente.horario.sede_centro ? ` · ${siguiente.horario.sede_centro}` : ""}<br />
              Instructor: {siguiente.horario.instructor}<br />
              {siguiente.horario.tematica || siguiente.horario.competencia || "Tema por asignar"}
            </p>
          </div>
        )}
      </div>
      <Accesos rol="aprendiz" />
    </div>
  </>);
}

export default function Panel() {
  const { sesion } = useAuth();
  const rol = sesion.usuario.rol;
  const [mensaje, setMensaje] = useState(null);
  const alError = (texto) => setMensaje({ tipo: "error", texto });

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>{saludo()}, {sesion.usuario.nombres}</h1>
          <p>{mayusculaInicial(new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</p>
        </div>
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {rol === "aprendiz" ? <PanelAprendiz alError={alError} /> : <PanelSupervision rol={rol} alError={alError} />}
    </>
  );
}
