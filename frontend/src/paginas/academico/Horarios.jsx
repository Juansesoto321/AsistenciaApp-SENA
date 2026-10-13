import { useEffect, useMemo, useState } from "react";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { aMinutos, lunesDe, mismoDia, ocurreEn, sumarDias } from "../../utilidades/fechas";
import Aviso from "../../componentes/Aviso.jsx";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
// Orden de semana laboral (lunes a domingo), aunque dia_semana en BD sea 0=domingo
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const VACIO = {
  id_ficha: "", id_ambiente: "", id_instructor: "", id_periodo: "",
  dia_semana: "1", hora_inicio: "07:00", hora_fin: "13:00", id_rap: "", id_tematica: "",
};

// Paleta estable por ficha, para distinguir bloques de un vistazo
const COLORES = ["#6d4aff", "#0e9f6e", "#d97706", "#dc2626", "#0284c7", "#7c3aed", "#be185d"];
const colorDe = (idFicha) => COLORES[Number(idFicha) % COLORES.length];

const ALTO_HORA = 44; // px por hora en la grilla
const comoHora = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

export default function Horarios() {
  const { sesion } = useAuth();
  const { confirmar } = useConfirmar();
  const rol = sesion.usuario.rol;
  const puedeEditar = ["coordinador", "programador"].includes(rol);
  // Instructor y aprendiz ven directamente su propio horario (el backend lo limita a lo suyo)
  const vistaPropia = rol === "instructor" || rol === "aprendiz";
  const esAprendiz = rol === "aprendiz";

  const [horarios, setHorarios] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [raps, setRaps] = useState([]);

  // Instructor y aprendiz ven lo suyo sin elegir nada; los demás deben filtrar primero.
  const [tipoFiltro, setTipoFiltro] = useState(vistaPropia ? "instructor" : "");
  const [valorFiltro, setValorFiltro] = useState(vistaPropia ? String(sesion.usuario.id) : "");
  const [aplicado, setAplicado] = useState(vistaPropia);

  const [modal, setModal] = useState(null); // null | "nuevo" | horario a editar
  const [detalle, setDetalle] = useState(null);
  const [f, setF] = useState(VACIO);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [vista, setVista] = useState("semana"); // "semana" | "mes"
  const [ancla, setAncla] = useState(() => new Date()); // fecha dentro de la semana/mes visible

  useEffect(() => {
    if (!esAprendiz) api("/competencias/raps").then(setRaps).catch(() => {});
    if (puedeEditar) {
      api("/fichas").then(setFichas);
      api("/ambientes").then(setAmbientes);
      api("/instructores").then(setInstructores);
      api("/periodos").then(setPeriodos);
    }
  }, []);

  useEffect(() => { if (vistaPropia) cargar(); }, []);

  function cargar(tipo = tipoFiltro, valor = valorFiltro) {
    if (!vistaPropia && (!tipo || !valor)) return;
    setCargando(true);
    const parametro = { instructor: "id_instructor", ficha: "id_ficha", ambiente: "id_ambiente" }[tipo];
    const consulta = vistaPropia ? "" : `?${parametro}=${valor}`;
    api(`/horarios${consulta}`)
      .then((datos) => { setHorarios(datos); setAplicado(true); })
      .catch((e) => setMensaje({ tipo: "error", texto: e.message }))
      .finally(() => setCargando(false));
  }

  // Rango horario visible: se ajusta a lo que realmente hay programado
  const rango = useMemo(() => {
    if (!horarios.length) return { desde: 6 * 60, hasta: 22 * 60 };
    const desde = Math.min(...horarios.map((h) => aMinutos(h.hora_inicio)));
    const hasta = Math.max(...horarios.map((h) => aMinutos(h.hora_fin)));
    return { desde: Math.floor(desde / 60) * 60, hasta: Math.ceil(hasta / 60) * 60 };
  }, [horarios]);

  const horasEje = useMemo(() => {
    const filas = [];
    for (let m = rango.desde; m <= rango.hasta; m += 60) filas.push(m);
    return filas;
  }, [rango]);

  // Plan por trimestres de la ficha elegida en el formulario: sus competencias
  // del trimestre en curso salen primero y sugieren el instructor.
  const [planFicha, setPlanFicha] = useState(null);
  useEffect(() => {
    if (!modal || !f.id_ficha) { setPlanFicha(null); return; }
    api(`/fichas/${f.id_ficha}/programacion`).then(setPlanFicha).catch(() => setPlanFicha(null));
  }, [modal, f.id_ficha]);

  const programadasAhora = useMemo(
    () => (planFicha ? planFicha.programacion.filter((p) => p.trimestre === planFicha.trimestre_actual) : []),
    [planFicha]
  );
  const idsCompetenciasAhora = new Set(programadasAhora.map((p) => p.id_competencia));
  const rapsDelTrimestre = raps.filter((r) => idsCompetenciasAhora.has(r.id_competencia));
  const otrosRaps = raps.filter((r) => !idsCompetenciasAhora.has(r.id_competencia));

  function elegirRap(idRap) {
    const rap = raps.find((r) => String(r.id_rap) === String(idRap));
    const asignados = programadasAhora.filter((p) => p.id_competencia === rap?.id_competencia);
    setF({
      ...f,
      id_rap: idRap,
      id_tematica: "",
      // Si el plan dice quién dicta esa competencia y aún no se eligió instructor, se sugiere
      id_instructor: f.id_instructor || (asignados.length === 1 ? String(asignados[0].id_instructor) : ""),
    });
  }

  const pistaPlan = (() => {
    const rap = raps.find((r) => String(r.id_rap) === String(f.id_rap));
    if (!rap || !planFicha) return null;
    const asignados = programadasAhora.filter((p) => p.id_competencia === rap.id_competencia);
    if (!asignados.length) return `Esta competencia no está en el plan del trimestre ${planFicha.trimestre_actual} de la ficha.`;
    return `Según el plan, la dicta ${asignados.map((p) => p.instructor).join(" y ")} en el trimestre ${planFicha.trimestre_actual}.`;
  })();

  const tematicasDelRap = useMemo(
    () => raps.find((r) => String(r.id_rap) === String(f.id_rap))?.tematicas || [],
    [raps, f.id_rap]
  );

  // Fechas reales de la semana visible (lunes a domingo)
  const diasSemana = useMemo(() => {
    const lunes = lunesDe(ancla);
    return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  }, [ancla]);

  // Cuadricula del mes visible, completada con los dias vecinos para cerrar semanas
  const semanasDelMes = useMemo(() => {
    const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0);
    const semanas = [];
    for (let d = lunesDe(primero); d <= ultimo || d.getDay() !== 1; d = sumarDias(d, 1)) {
      if (d.getDay() === 1) semanas.push([]);
      semanas[semanas.length - 1].push(d);
      if (semanas.length > 6) break;
    }
    return semanas;
  }, [ancla]);

  const tituloRango = useMemo(() => {
    if (vista === "mes") {
      const t = ancla.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    const [ini, fin] = [diasSemana[0], diasSemana[6]];
    const mesIni = ini.toLocaleDateString("es-CO", { month: "short" });
    const mesFin = fin.toLocaleDateString("es-CO", { month: "short" });
    return `${ini.getDate()} ${mesIni} – ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`;
  }, [vista, ancla, diasSemana]);

  const mover = (paso) =>
    setAncla((a) => (vista === "mes" ? new Date(a.getFullYear(), a.getMonth() + paso, 1) : sumarDias(a, paso * 7)));

  const hoy = new Date();

  function abrirNuevo() {
    setF(VACIO);
    setModal("nuevo");
  }

  function abrirEdicion(h) {
    setF({
      id_ficha: h.id_ficha, id_ambiente: h.id_ambiente, id_instructor: h.id_instructor,
      id_periodo: h.id_periodo, dia_semana: String(h.dia_semana),
      hora_inicio: h.hora_inicio.slice(0, 5), hora_fin: h.hora_fin.slice(0, 5),
      id_rap: h.id_rap || "", id_tematica: h.id_tematica || "",
    });
    setDetalle(null);
    setModal(h);
  }

  async function guardar() {
    if (!f.id_ficha || !f.id_ambiente || !f.id_instructor || !f.id_periodo || !f.hora_inicio || !f.hora_fin)
      return setMensaje({ tipo: "error", texto: "Completa todos los campos obligatorios" });
    const cuerpo = { ...f, id_rap: f.id_rap || null, id_tematica: f.id_tematica || null };
    try {
      if (modal === "nuevo") await api("/horarios", { method: "POST", body: cuerpo });
      else await api(`/horarios/${modal.id_horario}`, { method: "PUT", body: cuerpo });
      setMensaje({ tipo: "exito", texto: modal === "nuevo" ? "Horario creado sin conflictos" : "Horario actualizado" });
      setModal(null); setF(VACIO); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function eliminar(id) {
    const ok = await confirmar({
      titulo: "¿Eliminar este horario?",
      mensaje: "Dejará de aparecer en el calendario. Si ya tiene sesiones de clase registradas, no se podrá eliminar.",
      textoConfirmar: "Eliminar horario",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api(`/horarios/${id}`, { method: "DELETE" });
      setDetalle(null); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  const opcionesFiltro = { instructor: instructores, ficha: fichas, ambiente: ambientes }[tipoFiltro] || [];

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>{esAprendiz ? "Mi horario" : vistaPropia ? "Mis horarios" : "Calendario de horarios"}</h1>
          <p>
            {esAprendiz
              ? "Tus clases de la semana: ambiente, instructor y tema de cada una. Toca una clase para ver el detalle."
              : "Vista semanal de las clases programadas. El sistema valida que no haya cruces de instructor ni de ambiente."}
          </p>
        </div>
        {puedeEditar && <button className="boton" onClick={abrirNuevo}>+ Nuevo horario</button>}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {!vistaPropia && (
        <div className="tarjeta" style={{ marginBottom: 18 }}>
          <b>¿Qué horario quieres ver?</b>
          <p style={{ color: "var(--tinta-suave)", fontSize: 13.5, margin: "4px 0 10px" }}>
            Elige primero por quién o por dónde quieres consultar.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label>Buscar por</label>
              <select value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setValorFiltro(""); setAplicado(false); }}>
                <option value="">Selecciona…</option>
                <option value="instructor">Instructor</option>
                <option value="ficha">Ficha</option>
                <option value="ambiente">Ambiente</option>
              </select>
            </div>
            <div style={{ minWidth: 260 }}>
              <label>{tipoFiltro ? tipoFiltro.charAt(0).toUpperCase() + tipoFiltro.slice(1) : "Valor"}</label>
              <select value={valorFiltro} disabled={!tipoFiltro} onChange={(e) => { setValorFiltro(e.target.value); setAplicado(false); }}>
                <option value="">Selecciona…</option>
                {tipoFiltro === "instructor" && opcionesFiltro.map((i) => (
                  <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>
                ))}
                {tipoFiltro === "ficha" && opcionesFiltro.map((x) => (
                  <option key={x.id_ficha} value={x.id_ficha}>{x.numero_ficha} · {x.programa}</option>
                ))}
                {tipoFiltro === "ambiente" && opcionesFiltro.map((a) => (
                  <option key={a.id_ambiente} value={a.id_ambiente}>{a.numero_ambiente} · {a.sede_centro}</option>
                ))}
              </select>
            </div>
            <button className="boton" disabled={!tipoFiltro || !valorFiltro} onClick={() => cargar()}>Ver calendario</button>
          </div>
        </div>
      )}

      {cargando && <Cargando texto="Cargando calendario…" />}

      {!cargando && !aplicado && (
        <Vacio icono="horarios" titulo="Elige qué calendario quieres ver">
          Selecciona un instructor, una ficha o un ambiente en el recuadro de arriba.
        </Vacio>
      )}

      {!cargando && aplicado && !horarios.length && (
        <Vacio icono="horarios" titulo={esAprendiz ? "Aún no tienes clases programadas" : "No hay clases programadas para esa selección"}>
          {esAprendiz && "Cuando la coordinación programe el horario de tu ficha, lo verás aquí."}
        </Vacio>
      )}

      {!cargando && aplicado && !!horarios.length && (
        <div className="tarjeta">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="boton mini suave" onClick={() => mover(-1)} title="Anterior">←</button>
              <button className="boton mini suave" onClick={() => setAncla(new Date())}>Hoy</button>
              <button className="boton mini suave" onClick={() => mover(1)} title="Siguiente">→</button>
              <b style={{ marginLeft: 6 }}>{tituloRango}</b>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className={`boton mini ${vista === "semana" ? "" : "suave"}`} onClick={() => setVista("semana")}>Semana</button>
              <button className={`boton mini ${vista === "mes" ? "" : "suave"}`} onClick={() => setVista("mes")}>Mes</button>
            </div>
          </div>

          {/* Encabezado de días fijo y cuerpo de horas con scroll propio, para
              que el calendario no empuje toda la página hacia abajo. */}
          {vista === "semana" && (
            <div style={{ overflow: "auto", maxHeight: "62vh" }}>
              <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, minmax(104px, 1fr))", minWidth: 780 }}>
                <div style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--blanco)" }} />
                {diasSemana.map((fecha) => {
                  const esHoy = mismoDia(fecha, hoy);
                  return (
                    <div key={fecha.toISOString()} style={{
                      textAlign: "center", padding: "6px 0", borderBottom: "1px solid var(--borde)",
                      background: esHoy ? "var(--azul-suave)" : "var(--blanco)",
                      position: "sticky", top: 0, zIndex: 2,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{DIAS[fecha.getDay()]}</div>
                      <div style={{ fontSize: 17, fontWeight: esHoy ? 800 : 500, color: esHoy ? "var(--azul)" : "var(--tinta)", lineHeight: 1.1 }}>
                        {fecha.getDate()}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--tinta-suave)" }}>
                        {fecha.toLocaleDateString("es-CO", { month: "short" })}
                      </div>
                    </div>
                  );
                })}

                {/* Eje de horas */}
                <div style={{ position: "relative", height: horasEje.length * ALTO_HORA }}>
                  {horasEje.map((m, i) => (
                    <div key={m} style={{ position: "absolute", top: i * ALTO_HORA - 7, right: 8, fontSize: 12, color: "var(--tinta-suave)" }}>
                      {comoHora(m)}
                    </div>
                  ))}
                </div>

                {/* Una columna por fecha real */}
                {diasSemana.map((fecha) => {
                  const delDia = horarios.filter((h) => ocurreEn(h, fecha));
                  return (
                    <div key={fecha.toISOString()} style={{
                      position: "relative", height: horasEje.length * ALTO_HORA,
                      borderLeft: "1px solid var(--borde)",
                      background: mismoDia(fecha, hoy) ? "var(--azul-suave)" : "transparent",
                    }}>
                      {horasEje.map((m, i) => (
                        <div key={m} style={{ position: "absolute", top: i * ALTO_HORA, left: 0, right: 0, borderTop: "1px solid var(--borde)", opacity: 0.5 }} />
                      ))}
                      {delDia.map((h) => {
                        const inicio = aMinutos(h.hora_inicio);
                        const fin = aMinutos(h.hora_fin);
                        const top = ((inicio - rango.desde) / 60) * ALTO_HORA;
                        const alto = Math.max(((fin - inicio) / 60) * ALTO_HORA, 30);
                        const color = colorDe(h.id_ficha);
                        const cabe = (lineas) => alto >= 16 * lineas + 10; // cuántas líneas entran
                        return (
                          <button
                            key={h.id_horario}
                            className="bloque-clase"
                            onClick={() => setDetalle({ ...h, fecha })}
                            title={`${h.hora_inicio.slice(0, 5)}–${h.hora_fin.slice(0, 5)} · Ficha ${h.numero_ficha} · ${h.tematica || h.competencia || "sin competencia"}`}
                            style={{
                              top, left: 3, right: 3, height: alto - 3,
                              background: `${color}1f`, borderLeft: `3px solid ${color}`,
                            }}
                          >
                            <div className="hora" style={{ color }}>
                              {h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)}
                            </div>
                            {cabe(2) && <div>Ficha {h.numero_ficha} · Amb. {h.numero_ambiente}</div>}
                            {cabe(3) && (h.tematica || h.competencia
                              ? <div className="sec">{h.tematica || h.competencia}</div>
                              : <div className="sin-asignar">Sin competencia asignada</div>)}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {vista === "mes" && (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(104px, 1fr))", minWidth: 760 }}>
                {ORDEN_SEMANA.map((d) => (
                  <div key={d} style={{ textAlign: "center", fontWeight: 700, padding: "6px 0", borderBottom: "1px solid var(--borde)" }}>
                    {DIAS[d]}
                  </div>
                ))}
                {semanasDelMes.flat().map((fecha) => {
                  const delDia = horarios.filter((h) => ocurreEn(h, fecha));
                  const esDelMes = fecha.getMonth() === ancla.getMonth();
                  const esHoy = mismoDia(fecha, hoy);
                  return (
                    <div key={fecha.toISOString()} style={{
                      minHeight: 96, borderTop: "1px solid var(--borde)", borderLeft: "1px solid var(--borde)",
                      padding: 5, opacity: esDelMes ? 1 : 0.4,
                      background: esHoy ? "var(--azul-suave)" : "transparent",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: esHoy ? 800 : 600, color: esHoy ? "var(--azul)" : "var(--tinta-suave)", marginBottom: 3 }}>
                        {fecha.getDate()}
                      </div>
                      {delDia.slice(0, 3).map((h) => {
                        const color = colorDe(h.id_ficha);
                        return (
                          <button
                            key={h.id_horario}
                            className="bloque-clase"
                            onClick={() => setDetalle({ ...h, fecha })}
                            title={`${h.hora_inicio.slice(0, 5)} · Ficha ${h.numero_ficha}`}
                            style={{
                              position: "static", width: "100%", marginBottom: 3, fontSize: 10.5,
                              whiteSpace: "nowrap", textOverflow: "ellipsis",
                              background: `${color}1f`, borderLeft: `3px solid ${color}`,
                            }}
                          >
                            <span className="hora" style={{ color }}>{h.hora_inicio.slice(0, 5)}</span>{" "}
                            {h.tematica || h.competencia || `Ficha ${h.numero_ficha}`}
                          </button>
                        );
                      })}
                      {delDia.length > 3 && (
                        <div style={{ fontSize: 10.5, color: "var(--tinta-suave)" }}>+{delDia.length - 3} más</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {detalle && (
        <div className="superposicion" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              {detalle.fecha
                ? detalle.fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : DIAS[detalle.dia_semana]}
            </h2>
            <p style={{ color: "var(--tinta-suave)", marginTop: -6 }}>
              {detalle.hora_inicio.slice(0, 5)} – {detalle.hora_fin.slice(0, 5)}
              {detalle.periodo ? ` · Periodo ${detalle.periodo}` : ""}
            </p>
            <table className="tabla">
              <tbody>
                <tr><td><b>Ficha</b></td><td>{detalle.numero_ficha} · {detalle.programa}</td></tr>
                <tr><td><b>Instructor</b></td><td>{detalle.instructor}</td></tr>
                <tr><td><b>Ambiente</b></td><td>{detalle.numero_ambiente}{detalle.sede_centro ? ` · ${detalle.sede_centro}` : ""}</td></tr>
                <tr><td><b>Competencia</b></td><td>{detalle.competencia || "— sin asignar —"}</td></tr>
                <tr><td><b>Resultado de aprendizaje</b></td><td>{detalle.codigo_rap ? `${detalle.codigo_rap} · ${detalle.resultado_aprendizaje}` : "— sin asignar —"}</td></tr>
                <tr><td><b>Temática</b></td><td>{detalle.tematica || "— sin asignar —"}</td></tr>
              </tbody>
            </table>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setDetalle(null)}>Cerrar</button>
              {puedeEditar && <button className="boton mini peligro" onClick={() => eliminar(detalle.id_horario)}>Eliminar</button>}
              {puedeEditar && <button className="boton" onClick={() => abrirEdicion(detalle)}>Editar</button>}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === "nuevo" ? "Nuevo horario" : "Editar horario"}</h2>
            <div className="rejilla-2">
              <div>
                <label>Ficha *</label>
                <select required value={f.id_ficha} onChange={(e) => setF({ ...f, id_ficha: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {fichas.map((x) => <option key={x.id_ficha} value={x.id_ficha}>{x.numero_ficha} · {x.programa}</option>)}
                </select>
              </div>
              <div>
                <label>Ambiente *</label>
                <select required value={f.id_ambiente} onChange={(e) => setF({ ...f, id_ambiente: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {ambientes.map((a) => <option key={a.id_ambiente} value={a.id_ambiente}>{a.numero_ambiente} · {a.sede_centro}</option>)}
                </select>
              </div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Instructor *</label>
                <select required value={f.id_instructor} onChange={(e) => setF({ ...f, id_instructor: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {instructores.map((i) => <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label>Periodo *</label>
                <select required value={f.id_periodo} onChange={(e) => setF({ ...f, id_periodo: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {periodos.map((p) => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Día de la semana *</label>
                <select required value={f.dia_semana} onChange={(e) => setF({ ...f, dia_semana: e.target.value })}>
                  {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="rejilla-2">
                <div><label>Inicio *</label><input required type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></div>
                <div><label>Fin *</label><input required type="time" value={f.hora_fin} onChange={(e) => setF({ ...f, hora_fin: e.target.value })} /></div>
              </div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Resultado de aprendizaje</label>
                <select value={f.id_rap} onChange={(e) => elegirRap(e.target.value)}>
                  <option value="">— sin asignar —</option>
                  {rapsDelTrimestre.length > 0 && (
                    <optgroup label={`Trimestre ${planFicha.trimestre_actual} de la ficha (en curso)`}>
                      {rapsDelTrimestre.map((r) => <option key={r.id_rap} value={r.id_rap}>{r.codigo} · {r.nombre}</option>)}
                    </optgroup>
                  )}
                  <optgroup label={rapsDelTrimestre.length ? "Otras competencias" : "Todas las competencias"}>
                    {otrosRaps.map((r) => <option key={r.id_rap} value={r.id_rap}>{r.codigo} · {r.nombre}</option>)}
                  </optgroup>
                </select>
                {pistaPlan && <p className="nota-estado">{pistaPlan}</p>}
              </div>
              <div>
                <label>Temática</label>
                <select value={f.id_tematica} disabled={!f.id_rap} onChange={(e) => setF({ ...f, id_tematica: e.target.value })}>
                  <option value="">— sin asignar —</option>
                  {tematicasDelRap.map((t) => <option key={t.id_tematica} value={t.id_tematica}>{t.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" onClick={guardar}>{modal === "nuevo" ? "Guardar horario" : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
