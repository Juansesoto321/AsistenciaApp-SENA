import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
import Tendencia from "../../componentes/Tendencia.jsx";
import Contador from "../../componentes/Contador.jsx";
import ClaseEnCurso from "../../componentes/ClaseEnCurso.jsx";
import EscanerHuella, { TOTAL_CRESTAS } from "../../componentes/EscanerHuella.jsx";
import { horaCorta, mayusculaInicial, saludo } from "../../utilidades/formato";
import { nombreDelDia, proximaClase } from "../../utilidades/fechas";
import { useFestivos } from "../../utilidades/festivos";

const MAX_EN_RIESGO = 6;
const MAX_MARCAS = 4; // marcas recientes que se muestran por clase en curso
const RACHA_MINIMA = 3; // desde cuántas clases seguidas se celebra la racha
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
      <Contador valor={valor} />
    </div>
    <div className="nombre">{nombre}</div>
  </>);
  const clase = `tarjeta-metrica${a ? " enlace" : ""}${atencion ? " atencion" : ""}`;
  return a ? <Link to={a} className={clase}>{contenido}</Link> : <div className={clase}>{contenido}</div>;
}

function Accesos({ rol, enFila }) {
  return (
    <div className="tarjeta">
      <h3 style={{ fontSize: 16 }}>Accesos rápidos</h3>
      <div className={`accesos${enFila ? " fila" : ""}`}>
        {(ACCESOS[rol] || []).map(([ruta, icono, texto]) => (
          <Link key={ruta} className="boton suave" to={ruta}><Icono nombre={icono} /> {texto}</Link>
        ))}
      </div>
    </div>
  );
}

// ---------- Coordinador, programador e instructor ----------

/** Lo que pide acción hoy. Solo aparece lo que tiene algo pendiente. */
function Atencion({ pendientes, lectoresSinSenal, enRiesgo, puedeVerLectores, sinHuella, vencidas }) {
  const avisos = [
    pendientes > 0 && { a: "/justificaciones", tono: "ambar", valor: pendientes, texto: pendientes === 1 ? "justificación por revisar" : "justificaciones por revisar" },
    sinHuella > 0 && {
      a: "/fichas", tono: "ambar", valor: sinHuella, texto: sinHuella === 1 ? "huella sin registrar" : "huellas sin registrar",
      titulo: "Aprendices activos sin huella en la app ni marcas del lector",
    },
    vencidas > 0 && {
      a: "/justificaciones?estado=vencida", tono: "ambar", valor: vencidas,
      texto: vencidas === 1 ? "justificación vencida" : "justificaciones vencidas",
      titulo: "Inasistencias cuyo plazo para justificar venció en los últimos 30 días",
    },
    lectoresSinSenal > 0 && { a: puedeVerLectores ? "/ambientes" : "/sesiones", tono: "rojo", valor: lectoresSinSenal, texto: lectoresSinSenal === 1 ? "lector sin señal" : "lectores sin señal" },
    enRiesgo > 0 && { a: "/reportes", tono: "rojo", valor: enRiesgo, texto: enRiesgo === 1 ? "aprendiz bajo el mínimo" : "aprendices bajo el mínimo" },
  ].filter(Boolean);
  if (!avisos.length) return null;
  return (
    <div className="atencion-fila" role="status">
      {avisos.map((v) => (
        <Link key={v.a + v.texto} to={v.a} className={`aviso-atencion ${v.tono}`} title={v.titulo}>
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
  const [marcas, setMarcas] = useState({}); // id_sesion -> { lista, recibidas }
  const socket = useRef(null);
  const clasesActuales = useRef([]);

  const cargarClases = () => api("/sesiones/hoy").then(setClases).catch(() => setClases([]));

  /** Guarda la marca en su clase para la huella en vivo. */
  function anotarMarca(m) {
    const activas = clasesActuales.current.filter((c) => c.estado_sesion === "activa");
    // Un backend anterior no manda id_sesion: si hay una sola clase en curso, es de esa
    const idSesion = m.id_sesion ?? (activas.length === 1 ? activas[0].id_sesion : null);
    if (!idSesion) return;
    setMarcas((previas) => {
      const actual = previas[idSesion] || { lista: [], recibidas: 0 };
      const nueva = { ...m, clave: `${m.id_aprendiz}-${m.hora_marca}` };
      return {
        ...previas,
        [idSesion]: { lista: [nueva, ...actual.lista].slice(0, MAX_MARCAS), recibidas: actual.recibidas + 1 },
      };
    });
  }

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
    socket.current.on("marcacion", (m) => {
      anotarMarca(m);
      clearTimeout(espera);
      espera = setTimeout(cargarClases, 700);
    });
    const reloj = setInterval(() => {
      cargarClases();
      if (!esInstructor) api("/dispositivos").then(setLectores).catch(() => {});
    }, RECARGA_MS);
    return () => { clearTimeout(espera); clearInterval(reloj); socket.current.disconnect(); };
  }, []);

  // Se une a las clases en curso para recibir sus marcas en vivo
  useEffect(() => {
    clasesActuales.current = clases || [];
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
  const enCurso = (clases || []).filter((c) => c.estado_sesion === "activa");

  return (<>
    {enCurso.length > 0 && (
      <div className="en-curso-lista">
        {enCurso.map((c) => (
          <ClaseEnCurso
            key={c.id_sesion} clase={c} verInstructor={!esInstructor}
            marcas={marcas[c.id_sesion]?.lista} recibidas={marcas[c.id_sesion]?.recibidas}
          />
        ))}
      </div>
    )}

    <Atencion
      pendientes={pendientes} lectoresSinSenal={sinSenal} enRiesgo={enRiesgo.length} puedeVerLectores={!esInstructor}
      sinHuella={datos.huellas_sin_registrar} vencidas={datos.justificaciones_vencidas}
    />

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
            <Tendencia datos={tendencia} minimo={minimo} leyenda={`Últimos ${dias} días`} />
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

const fechaLocal = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
const aMinutos = (hora) => { const [h, m] = String(hora).split(":").map(Number); return h * 60 + m; };
const ESTADO_MARCA = { presente: "Presente", tardanza: "Tardanza", justificada: "Justificada" };

/** Cuántas clases seguidas lleva sin faltar, contando desde la más reciente. */
function rachaSinFaltar(detalle) {
  let racha = 0;
  for (const d of detalle) { // viene de la más reciente a la más antigua
    if (d.estado === "ausente") break;
    racha++;
  }
  return racha;
}

/** "empieza en 25 min", "empieza en 2 h 10 min" o null si la clase es otro día. */
function cuentaRegresiva(siguiente, ahora) {
  const [h, m] = siguiente.horario.hora_inicio.split(":").map(Number);
  const inicio = new Date(siguiente.fecha);
  inicio.setHours(h, m, 0, 0);
  if (fechaLocal(inicio) !== fechaLocal(ahora)) return null;
  const minutos = Math.ceil((inicio - ahora) / 60_000);
  if (minutos <= 1) return "está por empezar";
  if (minutos < 60) return `empieza en ${minutos} min`;
  const resto = minutos % 60;
  return `empieza en ${Math.floor(minutos / 60)} h${resto ? ` ${resto} min` : ""}`;
}

/** La marca de hoy que corresponde a esta clase, si ya la registró. */
function marcaDeHoy(detalle, horario, ahora) {
  const hoy = fechaLocal(ahora);
  return detalle.find((d) => String(d.fecha).slice(0, 10) === hoy && d.hora
    && aMinutos(d.hora) >= aMinutos(horario.hora_inicio) - 30 && aMinutos(d.hora) <= aMinutos(horario.hora_fin));
}

/** La próxima clase en grande, con cuenta regresiva y la huella del lector. */
function ProximaClase({ horarios, detalle, festivos }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (horarios === null) return <div className="tarjeta" style={{ marginBottom: 14 }}><Cargando /></div>;
  const siguiente = proximaClase(horarios, ahora, festivos);
  if (!siguiente) {
    return (
      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <Vacio icono="horarios" titulo="No tienes clases en los próximos días">Cuando te programen clases, la próxima aparecerá aquí.</Vacio>
      </div>
    );
  }
  const { horario } = siguiente;
  const marca = siguiente.enCurso ? marcaDeHoy(detalle, horario, ahora) : null;
  const cuando = siguiente.enCurso ? null : cuentaRegresiva(siguiente, ahora);

  return (
    <section className="proxima-clase">
      <div className="proxima-datos">
        <p className="proxima-etiqueta">
          {siguiente.enCurso ? <><span className="pulso" />Tu clase está en curso</> : "Tu próxima clase"}
        </p>
        <p className="proxima-hora">{horaCorta(horario.hora_inicio)} – {horaCorta(horario.hora_fin)}</p>
        <p className="proxima-cuando">
          {mayusculaInicial(nombreDelDia(siguiente.fecha, ahora))}{cuando ? `, ${cuando}` : ""}
        </p>
        <p className="proxima-detalle">
          Ambiente <b>{horario.numero_ambiente}</b>{horario.sede_centro ? `, ${horario.sede_centro}` : ""}<br />
          Instructor: {horario.instructor}<br />
          {horario.tematica || horario.competencia || "Tema por asignar"}
        </p>
        {siguiente.enCurso && (
          <p className={`proxima-marca${marca ? " lista" : ""}`} role="status">
            {marca ? (<>
              Registraste tu asistencia a las {marca.hora}
              <span className={`insignia ${marca.estado}`}>{ESTADO_MARCA[marca.estado] || marca.estado}</span>
            </>) : "Pon tu dedo en el lector del ambiente para registrar tu asistencia."}
          </p>
        )}
      </div>
      <EscanerHuella className="proxima-huella" estado={marca ? "registrada" : "espera"} encendidas={marca ? TOTAL_CRESTAS : 0} />
    </section>
  );
}

function PanelAprendiz({ alError }) {
  const [historial, setHistorial] = useState(null);
  const [horarios, setHorarios] = useState(null);
  const festivos = useFestivos();

  useEffect(() => {
    api("/reportes/mi-historial").then(setHistorial).catch((e) => alError(e.message));
    api("/horarios").then(setHorarios).catch(() => setHorarios([]));
    // Si marca con el panel abierto, su marca aparece sin recargar la página
    const t = setInterval(() => api("/reportes/mi-historial").then(setHistorial).catch(() => {}), RECARGA_MS);
    return () => clearInterval(t);
  }, []);

  if (!historial) return <Cargando />;
  const r = historial.resumen;
  const detalle = historial.detalle || [];
  const racha = rachaSinFaltar(detalle);

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

    <ProximaClase horarios={horarios} detalle={detalle} festivos={festivos} />

    {r ? (
      <div className="resumen-panel">
        <div className="tarjeta tarjeta-anillo">
          <AnilloAsistencia porcentaje={r.porcentaje} minimo={r.minimo} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Mi asistencia</div>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13, margin: "4px 0 8px" }}>Mínimo institucional: {r.minimo} %</p>
            {racha >= RACHA_MINIMA && <p className="racha">Llevas {racha} clases seguidas sin faltar</p>}
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

    <Accesos rol="aprendiz" enFila />
  </>);
}

export default function Panel() {
  const { sesion } = useAuth();
  const rol = sesion.usuario.rol;
  const [mensaje, setMensaje] = useState(null);
  const alError = (texto) => setMensaje({ tipo: "error", texto });
  // Recién llegado del inicio de sesión: el saludo entra con una animación corta
  const recienLlegado = useLocation().state?.recienLlegado;

  return (
    <>
      <div className={`cabecera-pagina${recienLlegado ? " saludo-llegada" : ""}`}>
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
