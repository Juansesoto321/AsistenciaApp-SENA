import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import { useConfirmar } from "../../componentes/Confirmar.jsx";
import Icono from "../../componentes/Iconos.jsx";
import Vacio from "../../componentes/Vacio.jsx";
import { fechaCorta } from "../../utilidades/formato";

/**
 * Plan de formación por trimestre de una ficha: en cada trimestre, qué
 * competencias ve y con qué instructor. Una competencia puede repetirse en
 * varios trimestres, con el mismo o con otro instructor.
 * La coordinación y el programador lo editan; el instructor solo lo consulta.
 */
export default function PlanTrimestres({ plan, puedeEditar, alCambiar, alMensaje }) {
  const { confirmar } = useConfirmar();
  const [competencias, setCompetencias] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [nuevo, setNuevo] = useState({ trimestre: "", id_competencia: "", id_instructor: "" });
  const [guardando, setGuardando] = useState(false);

  const { ficha, trimestre_actual: actual, programacion } = plan;
  const trimestres = Array.from({ length: ficha.trimestres }, (_, i) => i + 1);

  useEffect(() => {
    if (!puedeEditar) return;
    api("/competencias").then(setCompetencias).catch(() => {});
    api("/instructores").then(setInstructores).catch(() => {});
  }, [puedeEditar]);

  // Por defecto se programa sobre el trimestre en curso
  useEffect(() => {
    setNuevo((n) => ({ ...n, trimestre: n.trimestre || String(Math.max(1, actual)) }));
  }, [actual]);

  // En qué trimestres aparece cada competencia (para marcar las que continúan)
  const trimestresPorCompetencia = programacion.reduce((mapa, p) => {
    (mapa[p.id_competencia] ||= new Set()).add(p.trimestre);
    return mapa;
  }, {});

  async function agregar() {
    setGuardando(true);
    try {
      await api(`/fichas/${ficha.id_ficha}/programacion`, { method: "POST", body: nuevo });
      alMensaje({ tipo: "exito", texto: `Competencia programada en el trimestre ${nuevo.trimestre}` });
      setNuevo({ ...nuevo, id_competencia: "" });
      alCambiar();
    } catch (e) {
      alMensaje({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(p) {
    const ok = await confirmar({
      titulo: "¿Quitar esta competencia del trimestre?",
      mensaje: `${p.competencia} (${p.instructor}) dejará de estar en el trimestre ${p.trimestre}. Los horarios ya creados no se borran.`,
      textoConfirmar: "Quitar",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api(`/programacion/${p.id_programacion}`, { method: "DELETE" });
      alCambiar();
    } catch (e) {
      alMensaje({ tipo: "error", texto: e.message });
    }
  }

  async function cambiarTotal(total) {
    try {
      await api(`/fichas/${ficha.id_ficha}/trimestres`, { method: "PATCH", body: { trimestres: Number(total) } });
      alCambiar();
    } catch (e) {
      alMensaje({ tipo: "error", texto: e.message });
    }
  }

  return (
    <>
      <div className="tarjeta resumen-plan">
        <div>
          <b>
            {actual === 0 ? "La ficha aún no empieza"
              : `Trimestre en curso: ${actual} de ${ficha.trimestres}`}
          </b>
          <p>
            Inició el {fechaCorta(ficha.fecha_inicio)}. Cada trimestre dura tres meses.
          </p>
        </div>
        {puedeEditar && (
          <label className="total-trimestres">
            Trimestres de la ficha
            <select value={ficha.trimestres} onChange={(e) => cambiarTotal(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>

      {puedeEditar && (
        <div className="tarjeta agregar-plan">
          <h3>Programar una competencia</h3>
          <div className="campos-plan">
            <div>
              <label>Trimestre</label>
              <select value={nuevo.trimestre} onChange={(e) => setNuevo({ ...nuevo, trimestre: e.target.value })}>
                {trimestres.map((t) => <option key={t} value={t}>Trimestre {t}{t === actual ? " (en curso)" : ""}</option>)}
              </select>
            </div>
            <div>
              <label>Competencia</label>
              <select value={nuevo.id_competencia} onChange={(e) => setNuevo({ ...nuevo, id_competencia: e.target.value })}>
                <option value="">Selecciona…</option>
                {competencias.map((c) => <option key={c.id_competencia} value={c.id_competencia}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label>Instructor</label>
              <select value={nuevo.id_instructor} onChange={(e) => setNuevo({ ...nuevo, id_instructor: e.target.value })}>
                <option value="">Selecciona…</option>
                {instructores.map((i) => <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>)}
              </select>
            </div>
            <button className="boton" disabled={guardando || !nuevo.id_competencia || !nuevo.id_instructor} onClick={agregar}>
              {guardando ? "Agregando…" : "Agregar"}
            </button>
          </div>
          {!competencias.length && (
            <p className="nota-estado">Aún no hay competencias creadas: créalas en el módulo Competencias.</p>
          )}
        </div>
      )}

      <div className="rejilla-trimestres">
        {trimestres.map((t) => {
          const delTrimestre = programacion.filter((p) => p.trimestre === t);
          const etapa = t === actual ? "en-curso" : t < actual ? "terminado" : "proximo";
          return (
            <section key={t} className={`tarjeta trimestre ${etapa}`}>
              <div className="titulo-trimestre">
                <h3>Trimestre {t}</h3>
                {etapa === "en-curso" && <span className="insignia activa"><span className="pulso" />En curso</span>}
                {etapa === "terminado" && <span className="insignia cerrada">Terminado</span>}
              </div>
              {delTrimestre.length === 0 ? (
                <p className="sin-programar">Sin competencias programadas</p>
              ) : (
                <ul className="lista-plan">
                  {delTrimestre.map((p) => {
                    const otros = [...(trimestresPorCompetencia[p.id_competencia] || [])].filter((x) => x !== t);
                    return (
                      <li key={p.id_programacion}>
                        <div>
                          <b>{p.competencia}</b>
                          <small>
                            <Icono nombre="perfil" /> {p.instructor}
                            {otros.length > 0 && <> · también en T{otros.sort((a, b) => a - b).join(", T")}</>}
                          </small>
                        </div>
                        {puedeEditar && (
                          <button className="boton-cerrar-panel" onClick={() => quitar(p)} aria-label={`Quitar ${p.competencia}`}>
                            <Icono nombre="cerrar" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {!programacion.length && !puedeEditar && (
        <Vacio icono="competencias" titulo="Esta ficha aún no tiene plan por trimestres">
          La coordinación define qué competencias se ven en cada trimestre.
        </Vacio>
      )}
    </>
  );
}
