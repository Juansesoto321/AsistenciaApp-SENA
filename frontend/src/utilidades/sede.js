/**
 * La sede y las frases del panel. La sede es una sola (el CGMLTI): si la app
 * se instala en otro centro, se cambia aquí.
 */
export const SEDE = {
  nombre: "SENA · CGMLTI Bogotá",
  centro: "Centro de Gestión de Mercados, Logística y Tecnologías de la Información (CGMLTI)",
  direccion: "Calle 52 N° 13 – 65",
  ciudad: "Bogotá D.C.",
  // Abre Google Maps con la dirección (en el celular, la app de mapas)
  mapa: "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("SENA CGMLTI, Calle 52 # 13-65, Bogotá"),
};

const FRASES = [
  "La disciplina también es una forma de libertad.",
  "Cada clase a la que llegas suma a la persona que quieres ser.",
  "Aprender haciendo: hoy también cuenta.",
  "La constancia le gana al talento que no se presenta.",
  "Tu huella aquí es tu compromiso con tu formación.",
  "Llegar a tiempo es la primera forma de respeto.",
  "Lo que practicas cada día es lo que te vuelve experto.",
  "Pequeños pasos todos los días hacen grandes proyectos.",
  "El futuro se construye clase a clase.",
  "Formarte es la mejor inversión que puedes hacer.",
];

/** Una frase por día (la misma para todos ese día), para que no cambie al recargar. */
export function fraseDelDia(fecha = new Date()) {
  const dia = Math.floor(new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86_400_000);
  return FRASES[dia % FRASES.length];
}
