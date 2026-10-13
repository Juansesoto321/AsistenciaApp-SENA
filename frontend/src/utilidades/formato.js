/**
 * Formato de textos compartido por las páginas.
 */

/** Plazo en horas como texto: "1 día", "3 días", "1 hora" o "18 horas". */
export function textoPlazo(horas) {
  if (horas % 24 === 0) {
    const dias = horas / 24;
    return `${dias} ${dias === 1 ? "día" : "días"}`;
  }
  return `${horas} ${horas === 1 ? "hora" : "horas"}`;
}

/** Solo la primera letra en mayúscula: "miércoles, 23 de septiembre" -> "Miércoles, 23 de septiembre". */
export const mayusculaInicial = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "Hora" de un campo TIME de la base de datos sin los segundos: "07:00". */
export const horaCorta = (hora) => String(hora || "").slice(0, 5);

// Fechas sin ambigüedad: "4/9/2026" puede leerse como 4 de septiembre o 9 de abril
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "4 sep 2026" */
export function fechaCorta(fecha) {
  const f = new Date(fecha);
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

/** "4 sep 2026, 8:38 a. m." */
export function fechaHora(fecha) {
  const f = new Date(fecha);
  return `${fechaCorta(f)}, ${f.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
}

/** "hace 2 min", "hace 3 h", "hace 2 días"; más de una semana: la fecha corta. */
export function haceCuanto(fecha, ahora = new Date()) {
  const segundos = Math.round((ahora - new Date(fecha)) / 1000);
  if (segundos < 60) return "hace un momento";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  return fechaCorta(fecha);
}

/** "Buenos días", "Buenas tardes" o "Buenas noches" según la hora. */
export function saludo(ahora = new Date()) {
  const hora = ahora.getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}
