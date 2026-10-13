import { useEffect, useMemo, useState } from "react";
import { api } from "../../servicios/api";
import { rangoCorto } from "../../utilidades/fechas";

/**
 * Formulario para crear o editar una clase, en el orden en que se piensa:
 * 1. ficha · 2. trimestre · 3. qué se ve (competencia, RAP, temática)
 * 4. quién la dicta · 5. dónde y cuándo (ambiente, días, horas).
 * Las competencias del plan del trimestre salen primero y sugieren su
 * instructor. Al crear se pueden marcar varios días a la vez.
 */
const DIAS = [ // en orden de semana laboral; valor = dia_semana (0 = domingo)
  [1, "L", "Lunes"], [2, "M", "Martes"], [3, "X", "Miércoles"], [4, "J", "Jueves"],
  [5, "V", "Viernes"], [6, "S", "Sábado"], [0, "D", "Domingo"],
];

// Franja de cada jornada: horas sugeridas y límites para avisar de un posible error
const JORNADAS = {
  "mañana": { inicio: "07:00", fin: "12:00", desde: "06:00", hasta: "13:00" },
  tarde: { inicio: "13:00", fin: "18:00", desde: "12:00", hasta: "18:30" },
  noche: { inicio: "18:00", fin: "22:00", desde: "17:30", hasta: "22:30" },
};

const VACIO = {
  id_ficha: "", trimestre: "", id_competencia: "", id_rap: "", id_tematica: "",
  id_instructor: "", id_ambiente: "", dias: [1], hora_inicio: "07:00", hora_fin: "12:00",
};

function desdeHorario(h) {
  return {
    id_ficha: String(h.id_ficha), trimestre: h.trimestre ? String(h.trimestre) : "",
    id_competencia: h.id_competencia_efectiva ? String(h.id_competencia_efectiva) : "",
    id_rap: h.id_rap ? String(h.id_rap) : "", id_tematica: h.id_tematica ? String(h.id_tematica) : "",
    id_instructor: String(h.id_instructor), id_ambiente: String(h.id_ambiente),
    dias: [h.dia_semana], hora_inicio: h.hora_inicio.slice(0, 5), hora_fin: h.hora_fin.slice(0, 5),
  };
}

export default function FormularioHorario({ horario, fichas, ambientes, instructores, raps, competencias, alGuardar, alCerrar }) {
  const esNuevo = !horario;
  const [f, setF] = useState(() => (esNuevo ? VACIO : desdeHorario(horario)));
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (cambios) => { setError(null); setF((actual) => ({ ...actual, ...cambios })); };

  const ficha = fichas.find((x) => String(x.id_ficha) === f.id_ficha);
  const jornada = JORNADAS[ficha?.jornada];

  // Plan de la ficha: trimestres con sus fechas y competencias programadas
  useEffect(() => {
    if (!f.id_ficha) { setPlan(null); return; }
    api(`/fichas/${f.id_ficha}/programacion`).then(setPlan).catch(() => setPlan(null));
  }, [f.id_ficha]);

  function elegirFicha(idFicha) {
    const nueva = fichas.find((x) => String(x.id_ficha) === idFicha);
    const horas = esNuevo && JORNADAS[nueva?.jornada]
      ? { hora_inicio: JORNADAS[nueva.jornada].inicio, hora_fin: JORNADAS[nueva.jornada].fin } : {};
    cambiar({ id_ficha: idFicha, trimestre: "", id_competencia: "", id_rap: "", id_tematica: "", ...horas });
  }

  // Al conocer el plan de una ficha nueva, se propone el trimestre en curso
  useEffect(() => {
    if (plan && esNuevo && !f.trimestre) cambiar({ trimestre: String(Math.max(1, plan.trimestre_actual)) });
  }, [plan]);

  const programadas = useMemo(
    () => (plan ? plan.programacion.filter((p) => String(p.trimestre) === f.trimestre) : []),
    [plan, f.trimestre]
  );
  const idsDelPlan = new Set(programadas.map((p) => p.id_competencia));
  const competenciasDelPlan = competencias.filter((c) => idsDelPlan.has(c.id_competencia));
  const otrasCompetencias = competencias.filter((c) => !idsDelPlan.has(c.id_competencia));
  const rapsDeCompetencia = raps.filter((r) => String(r.id_competencia) === f.id_competencia);
  const tematicas = raps.find((r) => String(r.id_rap) === f.id_rap)?.tematicas || [];
  const instructoresDelPlan = programadas.filter((p) => String(p.id_competencia) === f.id_competencia);
  const idsInstructoresPlan = new Set(instructoresDelPlan.map((p) => p.id_instructor));

  function elegirCompetencia(idCompetencia) {
    const asignados = programadas.filter((p) => String(p.id_competencia) === idCompetencia);
    cambiar({
      id_competencia: idCompetencia, id_rap: "", id_tematica: "",
      // Si el plan dice quién la dicta, se sugiere (se puede cambiar)
      ...(asignados.length === 1 ? { id_instructor: String(asignados[0].id_instructor) } : {}),
    });
  }

  function alternarDia(dia) {
    if (!esNuevo) return cambiar({ dias: [dia] }); // al editar, cada horario es de un solo día
    const dias = f.dias.includes(dia) ? f.dias.filter((d) => d !== dia) : [...f.dias, dia];
    cambiar({ dias });
  }

  const fueraDeJornada = jornada && f.hora_inicio && f.hora_fin &&
    (f.hora_inicio < jornada.desde || f.hora_fin > jornada.hasta);
  const faltantes = [
    !f.id_ficha && "la ficha", !f.id_competencia && "la competencia", !f.id_instructor && "el instructor",
    !f.id_ambiente && "el ambiente", !f.dias.length && "al menos un día",
  ].filter(Boolean);

  async function guardar() {
    if (faltantes.length) return setError(`Falta elegir ${faltantes.join(", ")}.`);
    if (f.hora_fin <= f.hora_inicio) return setError("La hora de fin debe ser posterior a la de inicio.");
    const cuerpo = {
      id_ficha: f.id_ficha, trimestre: f.trimestre || null, id_competencia: f.id_competencia,
      id_rap: f.id_rap || null, id_tematica: f.id_tematica || null,
      id_instructor: f.id_instructor, id_ambiente: f.id_ambiente,
      hora_inicio: f.hora_inicio, hora_fin: f.hora_fin,
      ...(esNuevo ? { dias_semana: f.dias } : { dia_semana: f.dias[0] }),
    };
    setGuardando(true);
    try {
      if (esNuevo) await api("/horarios", { method: "POST", body: cuerpo });
      else await api(`/horarios/${horario.id_horario}`, { method: "PUT", body: cuerpo });
      const creada = f.dias.length > 1 ? `Clase creada en ${f.dias.length} días, sin cruces` : "Clase creada sin cruces";
      alGuardar(esNuevo ? creada : "Horario actualizado");
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <div className="superposicion" onClick={() => !guardando && alCerrar()}>
      <div className="modal modal-horario" onClick={(e) => e.stopPropagation()}>
        <h2>{esNuevo ? "Nueva clase" : "Editar clase"}</h2>

        <fieldset className="paso-form">
          <legend>¿Para qué ficha?</legend>
          <div className="rejilla-2">
            <div>
              <label>Ficha *</label>
              <select value={f.id_ficha} onChange={(e) => elegirFicha(e.target.value)}>
                <option value="">Selecciona…</option>
                {fichas.map((x) => <option key={x.id_ficha} value={x.id_ficha}>{x.numero_ficha} · {x.programa}</option>)}
              </select>
            </div>
            <div>
              <label>Trimestre de la ficha *</label>
              <select value={f.trimestre} disabled={!plan} onChange={(e) => cambiar({ trimestre: e.target.value, id_competencia: "", id_rap: "", id_tematica: "" })}>
                {!esNuevo && !horario.trimestre && <option value="">Todo el periodo (horario anterior)</option>}
                {!plan && <option value="">Elige primero la ficha</option>}
                {plan?.fechas_trimestres.map((t) => (
                  <option key={t.trimestre} value={t.trimestre}>
                    Trimestre {t.trimestre} · {rangoCorto(t.desde, t.hasta)}{t.trimestre === plan.trimestre_actual ? " (en curso)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {plan && f.trimestre && <p className="nota-estado">La clase se repetirá cada semana solo durante ese trimestre.</p>}
        </fieldset>

        <fieldset className="paso-form">
          <legend>¿Qué se va a ver?</legend>
          <label>Competencia *</label>
          <select value={f.id_competencia} onChange={(e) => elegirCompetencia(e.target.value)}>
            <option value="">Selecciona…</option>
            {competenciasDelPlan.length > 0 && (
              <optgroup label={`Plan del trimestre ${f.trimestre}`}>
                {competenciasDelPlan.map((c) => <option key={c.id_competencia} value={c.id_competencia}>{c.nombre}</option>)}
              </optgroup>
            )}
            <optgroup label={competenciasDelPlan.length ? "Otras competencias" : "Competencias"}>
              {otrasCompetencias.map((c) => <option key={c.id_competencia} value={c.id_competencia}>{c.nombre}</option>)}
            </optgroup>
          </select>
          {plan && f.trimestre && !competenciasDelPlan.length && (
            <p className="nota-estado">El trimestre {f.trimestre} aún no tiene competencias en el plan de la ficha.</p>
          )}
          <div className="rejilla-2">
            <div>
              <label>Resultado de aprendizaje</label>
              <select value={f.id_rap} disabled={!f.id_competencia} onChange={(e) => cambiar({ id_rap: e.target.value, id_tematica: "" })}>
                <option value="">— opcional —</option>
                {rapsDeCompetencia.map((r) => <option key={r.id_rap} value={r.id_rap}>{r.codigo} · {r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label>Temática</label>
              <select value={f.id_tematica} disabled={!f.id_rap} onChange={(e) => cambiar({ id_tematica: e.target.value })}>
                <option value="">— opcional —</option>
                {tematicas.map((t) => <option key={t.id_tematica} value={t.id_tematica}>{t.nombre}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="paso-form">
          <legend>¿Quién la dicta y dónde?</legend>
          <div className="rejilla-2">
            <div>
              <label>Instructor *</label>
              <select value={f.id_instructor} onChange={(e) => cambiar({ id_instructor: e.target.value })}>
                <option value="">Selecciona…</option>
                {instructoresDelPlan.length > 0 && (
                  <optgroup label="Según el plan">
                    {instructores.filter((i) => idsInstructoresPlan.has(i.id_usuario)).map((i) => (
                      <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={instructoresDelPlan.length ? "Otros instructores" : "Instructores"}>
                  {instructores.filter((i) => !idsInstructoresPlan.has(i.id_usuario)).map((i) => (
                    <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label>Ambiente *</label>
              <select value={f.id_ambiente} onChange={(e) => cambiar({ id_ambiente: e.target.value })}>
                <option value="">Selecciona…</option>
                {ambientes.map((a) => <option key={a.id_ambiente} value={a.id_ambiente}>{a.numero_ambiente} · {a.sede_centro}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="paso-form">
          <legend>¿Cuándo?</legend>
          <label>{esNuevo ? "Días (puedes marcar varios)" : "Día"}</label>
          <div className="dias-semana">
            {DIAS.map(([valor, letra, nombre]) => (
              <button key={valor} type="button" className="chip dia" aria-pressed={f.dias.includes(valor)}
                      onClick={() => alternarDia(valor)} title={nombre} aria-label={nombre}>
                {letra}
              </button>
            ))}
          </div>
          <div className="rejilla-2">
            <div><label>Inicio *</label><input type="time" value={f.hora_inicio} onChange={(e) => cambiar({ hora_inicio: e.target.value })} /></div>
            <div><label>Fin *</label><input type="time" value={f.hora_fin} onChange={(e) => cambiar({ hora_fin: e.target.value })} /></div>
          </div>
          {fueraDeJornada && (
            <p className="nota-estado alerta">
              La ficha es de jornada {ficha.jornada} ({jornada.desde}–{jornada.hasta}). Revisa que la hora sea la correcta.
            </p>
          )}
        </fieldset>

        {error && <div className="mensaje error">{error}</div>}
        <div className="acciones-modal">
          <button className="boton suave" onClick={alCerrar} disabled={guardando}>Cancelar</button>
          <button className="boton" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : esNuevo ? `Crear clase${f.dias.length > 1 ? ` (${f.dias.length} días)` : ""}` : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
