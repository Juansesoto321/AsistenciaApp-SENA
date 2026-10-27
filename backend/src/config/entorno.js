/**
 * Carga y valida la configuración del entorno (.env). Se importa antes que
 * cualquier otro módulo, así todo el backend ve los mismos valores.
 */
require("dotenv").config();

// Zona horaria del negocio. Sin esto, un servidor en UTC (Docker, la nube)
// cambia de día a las 7:00 p. m. de Colombia: las clases nocturnas no salían
// en "hoy" y las tardanzas se calculaban contra el día equivocado.
process.env.TZ = process.env.ZONA_HORARIA || "America/Bogota";

const VALORES_DE_EJEMPLO = [
  "cambia_esta_clave_en_produccion",
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
];

const faltantes = ["DATABASE_URL", "JWT_SECRETO", "CLAVE_CIFRADO"].filter((v) => !process.env[v]);
if (faltantes.length) {
  throw new Error(`Faltan variables de entorno: ${faltantes.join(", ")}. Copia backend/.env.example a backend/.env`);
}

const produccion = process.env.NODE_ENV === "production";
const usaEjemplo = VALORES_DE_EJEMPLO.includes(process.env.JWT_SECRETO) ||
  VALORES_DE_EJEMPLO.includes(process.env.CLAVE_CIFRADO);

if (usaEjemplo && produccion) {
  // Las claves de ejemplo son públicas (están en el repositorio): con ellas
  // cualquiera podría fabricar un token de coordinador.
  throw new Error("JWT_SECRETO y CLAVE_CIFRADO usan los valores de ejemplo. Genera unos propios antes de desplegar");
}
if (usaEjemplo && process.env.NODE_ENV !== "test") {
  console.warn("[AVISO] JWT_SECRETO o CLAVE_CIFRADO usan los valores de ejemplo del repositorio. Sirve para desarrollo, nunca en producción.");
}

// URL_FRONTEND admite varias direcciones separadas por comas (p. ej. localhost
// y la IP de la red del SENA). Todas sirven para CORS; la primera va en los correos.
const origenesPermitidos = (process.env.URL_FRONTEND || "http://localhost:5173")
  .split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

// IP de los lectores reales (ADMS), separadas por comas. El protocolo del
// lector no tiene clave: sin esta lista, cualquier equipo que alcance el
// puerto 4000 y conozca el serial podría enviar marcas.
const ipLectores = (process.env.IP_LECTORES || "").split(",").map((ip) => ip.trim()).filter(Boolean);
if (produccion && !ipLectores.length) {
  console.warn("[AVISO] IP_LECTORES está vacío: el lector real (/iclock) acepta marcas de cualquier equipo de la red. Define la IP de cada lector en el .env.");
}

// Clase de demostración con botón para reiniciarla (servicios/claseDemo.js):
// temporal, para mostrar la app en vivo. Por defecto, en todo menos producción.
const claseDemo = process.env.CLASE_DEMO ? process.env.CLASE_DEMO === "true" : !produccion;

module.exports = {
  produccion,
  claseDemo,
  zonaHoraria: process.env.TZ,
  origenesPermitidos,
  urlFrontend: origenesPermitidos[0],
  ipLectores,
};
