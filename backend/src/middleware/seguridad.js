/**
 * Protecciones HTTP básicas, sin dependencias externas.
 */
const { error } = require("../utilidades/errores");

/** Encabezados de seguridad (lo esencial de helmet para una API JSON). */
function encabezadosSeguridad(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}

/**
 * Limita cuántas peticiones puede hacer una misma IP en una ventana de tiempo
 * (fuerza bruta, envío masivo de correos de recuperación, spam de registros).
 * Vive en memoria: basta para un solo servidor; con varias instancias habría
 * que llevarlo a Redis.
 *
 * Los topes son holgados a propósito: en el SENA un salón entero puede salir
 * a internet por la misma IP y todos inician sesión al mismo tiempo.
 */
function limitarPeticiones({ maximo, ventanaMinutos, mensaje }) {
  const ventanaMs = ventanaMinutos * 60_000;
  const porIp = new Map(); // ip -> { cuenta, reinicio }

  // Limpieza periódica para que el mapa no crezca sin límite
  setInterval(() => {
    const ahora = Date.now();
    for (const [ip, registro] of porIp) if (registro.reinicio <= ahora) porIp.delete(ip);
  }, ventanaMs).unref();

  return (req, res, next) => {
    const ahora = Date.now();
    let registro = porIp.get(req.ip);
    if (!registro || registro.reinicio <= ahora) {
      registro = { cuenta: 0, reinicio: ahora + ventanaMs };
      porIp.set(req.ip, registro);
    }
    registro.cuenta++;
    if (registro.cuenta > maximo) {
      res.setHeader("Retry-After", Math.ceil((registro.reinicio - ahora) / 1000));
      return next(error(mensaje, "demasiadas_peticiones"));
    }
    next();
  };
}

/**
 * Solo deja pasar peticiones de las IP indicadas (los lectores reales). Se usa
 * la IP de la conexión y no X-Forwarded-For: ese encabezado lo puede escribir
 * cualquiera. Con la lista vacía deja pasar a todos (desarrollo y pruebas).
 */
function soloDesdeIps(permitidas) {
  const lista = new Set(permitidas);
  return (req, res, next) => {
    if (!lista.size) return next();
    const ip = String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
    if (lista.has(ip)) return next();
    // La IP queda en el registro: si el lector legítimo aparece con otra
    // (p. ej. detrás de Docker Desktop), así se sabe cuál poner en IP_LECTORES
    console.warn(`[ADMS] Petición rechazada desde ${ip || "IP desconocida"}: no está en IP_LECTORES`);
    res.status(403).type("text/plain").send("Forbidden");
  };
}

module.exports = { encabezadosSeguridad, limitarPeticiones, soloDesdeIps };
