/**
 * Festivos de Colombia, calculados (no hace falta cargarlos cada año):
 * - fijos: se celebran el mismo día;
 * - Ley Emiliani (Ley 51 de 1983): si no caen en lunes, pasan al lunes siguiente;
 * - los que dependen de la Pascua: jueves y viernes santo, y Ascensión,
 *   Corpus Christi y Sagrado Corazón (estos tres también pasan a lunes).
 */
const { fechaIso } = require("./formato");

const FIJOS = [
  [1, 1, "Año Nuevo"], [5, 1, "Día del Trabajo"], [7, 20, "Día de la Independencia"],
  [8, 7, "Batalla de Boyacá"], [12, 8, "Inmaculada Concepción"], [12, 25, "Navidad"],
];
const AL_LUNES = [
  [1, 6, "Día de los Reyes Magos"], [3, 19, "Día de San José"], [6, 29, "San Pedro y San Pablo"],
  [8, 15, "Asunción de la Virgen"], [10, 12, "Día de la Raza"], [11, 1, "Todos los Santos"],
  [11, 11, "Independencia de Cartagena"],
];
// Días después del domingo de Pascua
const SEMANA_SANTA = [[-3, "Jueves Santo"], [-2, "Viernes Santo"]];
const PASCUA_AL_LUNES = [[39, "Ascensión del Señor"], [60, "Corpus Christi"], [68, "Sagrado Corazón"]];

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
function domingoDePascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

const sumarDias = (fecha, n) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + n);
const alLunes = (fecha) => sumarDias(fecha, (8 - fecha.getDay()) % 7); // lunes se queda igual

/** [{ fecha: "AAAA-MM-DD", nombre }] del año, en orden. */
function festivosDelAnio(anio) {
  const pascua = domingoDePascua(anio);
  const lista = [
    ...FIJOS.map(([mes, dia, nombre]) => [new Date(anio, mes - 1, dia), nombre]),
    ...AL_LUNES.map(([mes, dia, nombre]) => [alLunes(new Date(anio, mes - 1, dia)), nombre]),
    ...SEMANA_SANTA.map(([dias, nombre]) => [sumarDias(pascua, dias), nombre]),
    ...PASCUA_AL_LUNES.map(([dias, nombre]) => [alLunes(sumarDias(pascua, dias)), nombre]),
  ];
  return lista
    .sort((x, y) => x[0] - y[0])
    .map(([fecha, nombre]) => ({ fecha: fechaIso(fecha), nombre }));
}

/** Nombre del festivo de esa fecha (Date o "AAAA-MM-DD"), o null si es día hábil. */
function festivoEn(fecha) {
  const iso = typeof fecha === "string" ? fecha.slice(0, 10) : fechaIso(fecha);
  return festivosDelAnio(Number(iso.slice(0, 4))).find((f) => f.fecha === iso)?.nombre || null;
}

module.exports = { festivosDelAnio, festivoEn, domingoDePascua };
