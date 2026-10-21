/**
 * Control centralizado de errores y excepciones.
 *
 * Los servicios lanzan errores "de negocio" marcados con una propiedad `tipo`
 * (p. ej. `tipo: "validacion"`); aqui se traducen a codigos HTTP en un solo
 * lugar, en vez de repetir el mapeo en cada controlador. Todo error inesperado
 * (sin `tipo` reconocido) responde 500 y queda registrado en la tabla log_error.
 */
const logs = require("../servicios/logs");

// Errores de negocio: tipo -> codigo HTTP
const ESTADOS_POR_TIPO = {
  validacion: 400,
  conflicto_horario: 400,
  credenciales: 401,
  prohibido: 403,
  cuenta_pendiente: 403,
  cuenta_inactiva: 403,
  cuenta_bloqueada: 403,
  no_encontrado: 404,
  no_reconocida: 404,
  sin_sesion: 409,
  fuera_de_horario: 409,
  vencida: 410,
  demasiadas_peticiones: 429,
};

// Errores que lanza express.json() al leer el cuerpo de la peticion
const ERRORES_CUERPO = {
  "entity.parse.failed": [400, "El cuerpo de la petición no es un JSON válido"],
  "entity.too.large": [413, "El archivo o los datos enviados superan el tamaño permitido (10 MB)"],
};

// Errores de PostgreSQL que en realidad son datos invalidos del usuario
// (antes los de formato llegaban como 500 y se guardaban como fallas del servidor)
const MENSAJES_POSTGRES = {
  23505: "El registro ya existe",
  23503: "El registro referenciado no existe",
  23514: "Los datos no cumplen una restricción de la base de datos",
  23502: "Faltan datos obligatorios",
  "22P02": "Un dato tiene un formato inválido (se esperaba un número)",
  22007: "Una fecha u hora tiene un formato inválido",
  22008: "Una fecha u hora está fuera de rango",
  22001: "Un texto supera la longitud permitida",
  22003: "Un número está fuera del rango permitido",
};

/**
 * Adjunta mensajes propios para códigos de PostgreSQL antes de delegar al
 * manejador central. Uso: `next(traducirCodigos(e, { 23503: "El periodo no existe" }))`
 */
function traducirCodigos(error, mapa) {
  if (error?.code && mapa[error.code]) error.mensajePublico = mapa[error.code];
  return error;
}

/** 404 para cualquier ruta que no exista. Va después de montar los routers. */
function rutaNoEncontrada(req, res) {
  res.status(404).json({ mensaje: `No existe la ruta ${req.method} ${req.originalUrl}` });
}

function manejadorErrores(error, req, res, _next) {
  if (ERRORES_CUERPO[error.type]) {
    const [estadoCuerpo, mensaje] = ERRORES_CUERPO[error.type];
    return res.status(estadoCuerpo).json({ mensaje });
  }

  const estado = ESTADOS_POR_TIPO[error.tipo] || (error.code && MENSAJES_POSTGRES[error.code] ? 400 : 500);

  if (estado === 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
    logs.registrar({
      mensaje: error.message || "Error desconocido",
      metodo: req.method,
      ruta: req.originalUrl,
      idUsuario: req.usuario?.id,
      traza: error.stack,
    });
    return res.status(500).json({ mensaje: error.mensajePublico || "Ocurrió un error en el servidor" });
  }

  const cuerpo = {
    mensaje: error.mensajePublico || (error.code ? MENSAJES_POSTGRES[error.code] : error.message),
  };
  // Algunos contratos exigen campos extra (el lector espera `resultado`,
  // el enlace de justificación espera `vencida`).
  if (error.resultado) cuerpo.resultado = error.resultado;
  if (error.vencida) cuerpo.vencida = true;

  res.status(estado).json(cuerpo);
}

module.exports = { manejadorErrores, rutaNoEncontrada, traducirCodigos };
