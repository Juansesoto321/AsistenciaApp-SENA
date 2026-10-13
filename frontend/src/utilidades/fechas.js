/**
 * Fechas de los horarios. Un horario se repite cada semana (dia_semana:
 * 0 = domingo) mientras dure su periodo académico.
 */

export const soloFecha = (f) => new Date(f.getFullYear(), f.getMonth(), f.getDate());
export const sumarDias = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);
export const mismoDia = (a, b) => a.toDateString() === b.toDateString();
/** Lunes de la semana a la que pertenece la fecha */
export const lunesDe = (f) => sumarDias(f, f.getDay() === 0 ? -6 : 1 - f.getDay());

/** Minutos desde la medianoche de una hora "HH:MM(:SS)". */
export const aMinutos = (hora) => {
  const [h, m] = String(hora).split(":");
  return Number(h) * 60 + Number(m);
};

/**
 * ¿Ese horario tiene clase en esa fecha? Un horario vale solo entre las fechas
 * de su trimestre (o de su periodo, si es de antes de los trimestres): el
 * backend las entrega ya calculadas en vigente_desde / vigente_hasta.
 */
export function ocurreEn(horario, fecha) {
  if (horario.dia_semana !== fecha.getDay()) return false;
  const dia = soloFecha(fecha);
  const inicio = soloFecha(new Date(horario.vigente_desde));
  const fin = soloFecha(new Date(horario.vigente_hasta));
  return dia >= inicio && dia <= fin;
}

/** "1 oct – 31 dic" */
export function rangoCorto(desde, hasta) {
  const corto = (f) => new Date(f).toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");
  return `${corto(desde)} – ${corto(hasta)}`;
}

/**
 * La siguiente clase a partir de `ahora` (la que está en curso cuenta como
 * siguiente). Busca hasta dos semanas adelante. Devuelve
 * { horario, fecha, enCurso } o null.
 */
export function proximaClase(horarios, ahora = new Date()) {
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  for (let d = 0; d < 14; d++) {
    const fecha = sumarDias(ahora, d);
    const delDia = horarios
      .filter((h) => ocurreEn(h, fecha))
      .filter((h) => d > 0 || aMinutos(h.hora_fin) > minutosAhora) // hoy: las que no han terminado
      .sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio));
    if (delDia.length) {
      const horario = delDia[0];
      const enCurso = d === 0 && aMinutos(horario.hora_inicio) <= minutosAhora;
      return { horario, fecha, enCurso };
    }
  }
  return null;
}

/** "Hoy", "Mañana" o "jueves 25 de septiembre". */
export function nombreDelDia(fecha, ahora = new Date()) {
  if (mismoDia(fecha, ahora)) return "Hoy";
  if (mismoDia(fecha, sumarDias(ahora, 1))) return "Mañana";
  return fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}
