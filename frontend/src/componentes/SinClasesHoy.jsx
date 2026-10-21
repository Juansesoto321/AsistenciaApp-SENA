import { useEffect, useState } from "react";
import { api } from "../servicios/api";
import Vacio from "./Vacio.jsx";
import { diaYFecha, proximaClase } from "../utilidades/fechas";
import { useFestivos } from "../utilidades/festivos";
import { horaCorta } from "../utilidades/formato";

/**
 * Día sin clases: en vez de solo "no hay clases", dice cuál es la próxima
 * (del horario de quien entra: el instructor ve las suyas). Busca hasta dos
 * semanas adelante y se salta los festivos.
 */
export default function SinClasesHoy({ titulo = "No hay clases programadas para hoy" }) {
  const [horarios, setHorarios] = useState(null);
  const festivos = useFestivos();
  useEffect(() => { api("/horarios").then(setHorarios).catch(() => setHorarios([])); }, []);

  const siguiente = horarios ? proximaClase(horarios, new Date(), festivos) : null;
  return (
    <Vacio icono="sesiones" titulo={titulo}>
      {horarios === null ? "Buscando la próxima clase…" : siguiente ? (<>
        Próxima clase: <b>{diaYFecha(siguiente.fecha)} · {horaCorta(siguiente.horario.hora_inicio)}–{horaCorta(siguiente.horario.hora_fin)}</b>
        {" "}· Ficha {siguiente.horario.numero_ficha} · Ambiente {siguiente.horario.numero_ambiente}
      </>) : "No hay clases programadas en las próximas dos semanas."}
    </Vacio>
  );
}
