import { useEffect, useMemo, useState } from "react";
import { api } from "../../servicios/api";
import { useAuth } from "../../contexto/AuthContext.jsx";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import Cargando from "../../componentes/Cargando.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { aMinutos, isoLocal, lunesDe, mismoDia, ocurreEn, rangoCorto, sumarDias } from "../../utilidades/fechas";
import { useFestivos } from "../../utilidades/festivos";
import Aviso from "../../componentes/Aviso.jsx";
import FormularioHorario from "./FormularioHorario.jsx";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
// Orden de semana laboral (lunes a domingo), aunque dia_semana en BD sea 0=domingo
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

// Paleta estable por ficha, para distinguir bloques de un vistazo
const COLORES = ["#2b8000", "#0f766e", "#d97706", "#dc2626", "#0284c7", "#7c3aed", "#be185d"];
const colorDe = (idFicha) => COLORES[Number(idFicha) % COLORES.length];

const CLAVE_FICHA = "asistenciaapp.calendario-ficha"; // última ficha que miró la coordinación

/** La última ficha que se miró; si no, la primera activa que tenga clases. */
function fichaInicial(lista) {
  let ultima = null;
  try { ultima = localStorage.getItem(CLAVE_FICHA); } catch { /* sin almacenamiento: no se recuerda */ }
  const activas = lista.filter((f) => f.estado === "activa");
  return lista.find((f) => String(f.id_ficha) === ultima)
    || activas.find((f) => f.total_clases > 0) || activas[0] || lista[0];
}
function recordarFicha(id) {
  try { localStorage.setItem(CLAVE_FICHA, String(id)); } catch { /* solo no se recuerda */ }
}

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
  const [raps, setRaps] = useState([]);
  const festivos = useFestivos();
  const [competencias, setCompetencias] = useState([]);

  // Instructor y aprendiz ven lo suyo sin elegir nada. La coordinación abre en
  // la última ficha que miró (o en una activa con clases: antes abría la
  // primera activa aunque estuviera vacía) y puede cambiar a otra ficha, a un
  // instructor o a un ambiente; el calendario se carga al elegir.
  const [tipoFiltro, setTipoFiltro] = useState(vistaPropia ? "instructor" : "ficha");
  const [valorFiltro, setValorFiltro] = useState(vistaPropia ? String(sesion.usuario.id) : "");
  const [aplicado, setAplicado] = useState(vistaPropia);

  const [modal, setModal] = useState(null); // null | "nuevo" | horario a editar
  const [detalle, setDetalle] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(true); // se carga al abrir (lo propio o la primera ficha)

  const [vista, setVista] = useState("semana"); // "semana" | "mes"
  const [ancla, setAncla] = useState(() => new Date()); // fecha dentro de la semana/mes visible

  useEffect(() => {
    if (!esAprendiz) api("/competencias/raps").then(setRaps).catch(() => {});
    if (puedeEditar) {
      api("/fichas").then((lista) => {
        setFichas(lista);
        const primera = fichaInicial(lista);
        if (primera) { setValorFiltro(String(primera.id_ficha)); cargar("ficha", String(primera.id_ficha)); }
        else setCargando(false);
      }).catch((e) => { setCargando(false); setMensaje({ tipo: "error", texto: e.message }); });
      api("/ambientes").then(setAmbientes);
      api("/instructores").then(setInstructores);
      api("/competencias").then(setCompetencias);
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
  // Clases creadas antes de que la competencia fuera obligatoria (las nuevas ya la exigen)
  const sinCompetencia = puedeEditar ? horarios.filter((h) => !h.competencia) : [];

  function abrirNuevo() {
    setModal("nuevo");
  }

  function abrirEdicion(h) {
    setDetalle(null);
    setModal(h);
  }

  function alGuardar(texto) {
    setMensaje({ tipo: "exito", texto });
    setModal(null);
    cargar();
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
  const ID_DE = { instructor: (x) => x.id_usuario, ficha: (x) => x.id_ficha, ambiente: (x) => x.id_ambiente };

  // Al cambiar "ver por", se muestra de una vez la primera opción de la lista
  function cambiarTipo(tipo) {
    setTipoFiltro(tipo);
    const primero = tipo === "ficha" ? fichaInicial(fichas) : ({ instructor: instructores, ambiente: ambientes }[tipo] || [])[0];
    const id = primero ? String(ID_DE[tipo](primero)) : "";
    setValorFiltro(id);
    if (id) cargar(tipo, id);
    else { setHorarios([]); setAplicado(false); }
  }

  function cambiarValor(valor) {
    setValorFiltro(valor);
    if (tipoFiltro === "ficha" && valor) recordarFicha(valor);
    if (valor) cargar(tipoFiltro, valor);
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>{esAprendiz ? "Mi horario" : vistaPropia ? "Mis horarios" : "Calendario de horarios"}</h1>
          <p>
            {esAprendiz
              ? "Tus clases de la semana: ambiente, instructor y tema de cada una. Toca una clase para ver el detalle."
              : "Vista semanal de las clases programadas. El sistema valida que no haya cruces de instructor, ambiente ni ficha."}
          </p>
        </div>
        {puedeEditar && <button className="boton" onClick={abrirNuevo}>+ Nueva clase</button>}
      </div>
      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {!vistaPropia && (
        <div className="barra-filtro">
          <span className="texto-suave">Ver el calendario de</span>
          <div className="selector-dias" role="group" aria-label="Ver el calendario por">
            {[["ficha", "Una ficha"], ["instructor", "Un instructor"], ["ambiente", "Un ambiente"]].map(([tipo, texto]) => (
              <button key={tipo} type="button" aria-pressed={tipoFiltro === tipo} onClick={() => cambiarTipo(tipo)}>{texto}</button>
            ))}
          </div>
          <select aria-label={`Elegir ${tipoFiltro}`} value={valorFiltro} onChange={(e) => cambiarValor(e.target.value)}>
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
      )}

      {cargando && <Cargando texto="Cargando calendario…" />}

      {!cargando && !aplicado && (
        <Vacio icono="horarios" titulo={vistaPropia ? "No tienes clases programadas" : "Todavía no hay fichas"}>
          {vistaPropia ? "Cuando la coordinación programe tus clases, aparecerán aquí." : "Crea una ficha y programa sus clases con «+ Nueva clase»."}
        </Vacio>
      )}

      {!cargando && aplicado && !horarios.length && (
        <Vacio icono="horarios" titulo={esAprendiz ? "Aún no tienes clases programadas" : "No hay clases programadas para esa selección"}>
          {esAprendiz && "Cuando la coordinación programe el horario de tu ficha, lo verás aquí."}
        </Vacio>
      )}

      {!cargando && sinCompetencia.length > 0 && (
        <div className="aviso-sin-competencia" role="status">
          <p>
            <b>{sinCompetencia.length === 1 ? "1 clase no tiene" : `${sinCompetencia.length} clases no tienen`} competencia.</b>{" "}
            Son anteriores a que fuera obligatoria: edítalas y elige la competencia que se ve en ellas.
          </p>
          <div className="lista-sin-competencia">
            {sinCompetencia.map((h) => (
              <button key={h.id_horario} type="button" className="boton mini suave" onClick={() => abrirEdicion(h)}>
                Editar {DIAS[h.dia_semana].toLowerCase()} {h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)} · ficha {h.numero_ficha}
              </button>
            ))}
          </div>
        </div>
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
                  const festivo = festivos.get(isoLocal(fecha));
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
                      {festivo && <div className="etiqueta-festivo" title={festivo}>Festivo</div>}
                    </div>
                  );
                })}

                {/* Eje de horas */}
                {/* marginTop: la etiqueta de cada hora sube 7 px para quedar centrada en su
                    línea; sin este espacio la primera (08:00) quedaba bajo el encabezado */}
                <div style={{ position: "relative", height: horasEje.length * ALTO_HORA, marginTop: 8 }}>
                  {horasEje.map((m, i) => (
                    <div key={m} style={{ position: "absolute", top: i * ALTO_HORA - 7, right: 8, fontSize: 12, color: "var(--tinta-suave)" }}>
                      {comoHora(m)}
                    </div>
                  ))}
                </div>

                {/* Una columna por fecha real */}
                {diasSemana.map((fecha) => {
                  const delDia = horarios.filter((h) => ocurreEn(h, fecha, festivos));
                  const festivo = festivos.get(isoLocal(fecha));
                  return (
                    <div key={fecha.toISOString()} title={festivo ? `Festivo: ${festivo}` : undefined} style={{
                      position: "relative", height: horasEje.length * ALTO_HORA, marginTop: 8,
                      borderLeft: "1px solid var(--borde)",
                      background: mismoDia(fecha, hoy) ? "var(--azul-suave)" : festivo ? "var(--marca-50)" : "transparent",
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
                              : puedeEditar && <div className="sin-asignar">Sin competencia: edítala</div>)}
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
                  const delDia = horarios.filter((h) => ocurreEn(h, fecha, festivos));
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
                        {festivos.has(isoLocal(fecha)) && (
                          <span className="etiqueta-festivo en-linea" title={festivos.get(isoLocal(fecha))}>Festivo</span>
                        )}
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
              {" · "}{detalle.trimestre ? `Trimestre ${detalle.trimestre}` : `Periodo ${detalle.periodo}`}
              {" "}({rangoCorto(detalle.vigente_desde, detalle.vigente_hasta)})
            </p>
            <table className="tabla">
              <tbody>
                <tr><td><b>Ficha</b></td><td>{detalle.numero_ficha} · {detalle.programa}</td></tr>
                <tr><td><b>Instructor</b></td><td>{detalle.instructor}</td></tr>
                <tr><td><b>Ambiente</b></td><td>{detalle.numero_ambiente}{detalle.sede_centro ? ` · ${detalle.sede_centro}` : ""}</td></tr>
                <tr><td><b>Competencia</b></td><td>{detalle.competencia || "— sin asignar —"}</td></tr>
                <tr><td><b>Resultado de aprendizaje</b></td><td>{detalle.codigo_rap ? `${detalle.codigo_rap} · ${detalle.resultado_aprendizaje}` : "— sin asignar —"}</td></tr>
                <tr><td><b>Temática</b></td><td>{detalle.tematica || "— sin asignar —"}</td></tr>
                <tr><td><b>Festivos</b></td><td>{detalle.excluir_festivos === false ? "Se dicta también en festivos" : "No se dicta en festivos"}</td></tr>
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
        <FormularioHorario
          horario={modal === "nuevo" ? null : modal}
          fichas={fichas}
          ambientes={ambientes}
          instructores={instructores}
          raps={raps}
          competencias={competencias}
          festivos={festivos}
          alGuardar={alGuardar}
          alCerrar={() => setModal(null)}
        />
      )}
    </>
  );
}
