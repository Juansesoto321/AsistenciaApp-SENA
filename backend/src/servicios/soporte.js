const modelo = require("../modelos/soporte");
const { emitirNotificacionAdmins } = require("./tiempoReal");
const { error } = require("../utilidades/errores");

/** Nombre de cada tipo de problema (los de todos los roles, para la coordinación). */
const TIPOS = {
  huella: "Mi huella no es reconocida",
  error_asistencia: "Mi asistencia quedó mal registrada",
  justificacion: "Problema con una justificación",
  lector: "El lector del ambiente no funciona",
  asistencia_clase: "Error en la asistencia de una clase",
  horario: "Mi horario o mis fichas están mal",
  datos: "Datos mal cargados (fichas, horarios, usuarios)",
  falla: "Error o falla del sistema",
  cuenta: "Problema con mi cuenta",
  otro: "Otro",
};
// Cada rol ve los problemas que le pueden pasar a él (antes todos veían los
// del aprendiz, como "Mi huella no es reconocida")
const TIPOS_POR_ROL = {
  aprendiz: ["huella", "error_asistencia", "justificacion", "cuenta", "otro"],
  instructor: ["lector", "asistencia_clase", "horario", "cuenta", "otro"],
  coordinador: ["lector", "falla", "datos", "cuenta", "otro"],
  programador: ["lector", "falla", "datos", "cuenta", "otro"],
};

/** Los tipos que puede elegir el rol, y el nombre de todos (para leer los tickets). */
function tiposDe(rol) {
  return {
    tipos: (TIPOS_POR_ROL[rol] || ["otro"]).map((valor) => ({ valor, texto: TIPOS[valor] })),
    nombres: TIPOS,
  };
}
const ESTADOS_VALIDOS = ["abierto", "en_proceso", "resuelto"];
const ROLES_GESTION = ["coordinador", "programador"];
// Solo imágenes: una captura de pantalla del problema
const FORMATO_CAPTURA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_CAPTURA_MB = 4;

function validarCaptura(archivoDatos) {
  if (!archivoDatos) return;
  if (!FORMATO_CAPTURA.test(archivoDatos)) throw error("La captura debe ser una imagen JPG, PNG o WEBP", "validacion");
  // En base64 cada 4 caracteres son 3 bytes
  if ((archivoDatos.length * 3) / 4 > MAX_CAPTURA_MB * 1024 * 1024)
    throw error(`La captura no puede pesar más de ${MAX_CAPTURA_MB} MB`, "validacion");
}

async function crear({ idUsuario, rol, tipo, descripcion, nombreArchivo, archivoDatos }) {
  if (!(TIPOS_POR_ROL[rol] || ["otro"]).includes(tipo) || !descripcion?.trim())
    throw error("Selecciona un tipo y describe el problema", "validacion");
  validarCaptura(archivoDatos);
  const idTicket = await modelo.crearTicket({
    idUsuario, tipo, descripcion: descripcion.trim(),
    nombreArchivo: archivoDatos ? String(nombreArchivo || "captura").slice(0, 255) : null,
    archivoDatos: archivoDatos || null,
  });
  await modelo.notificarCoordinadores(idTicket, TIPOS[tipo]);
  emitirNotificacionAdmins();
  return idTicket;
}

async function obtenerListado(usuario) {
  return modelo.listar(usuario.id, ROLES_GESTION.includes(usuario.rol));
}

/** La captura la ve quien creó el ticket y la coordinación. */
async function obtenerCaptura(idTicket, usuario) {
  const ticket = await modelo.buscarCaptura(idTicket);
  if (!ticket) throw error("Ticket no encontrado", "no_encontrado");
  if (ticket.id_usuario !== usuario.id && !ROLES_GESTION.includes(usuario.rol))
    throw error("No tienes permisos para ver esta captura", "prohibido");
  if (!ticket.archivo_datos) throw error("Este ticket no tiene captura", "no_encontrado");
  return { nombre_archivo: ticket.nombre_archivo, archivo_datos: ticket.archivo_datos };
}

async function cambiarEstado(idTicket, estado) {
  if (!ESTADOS_VALIDOS.includes(estado)) throw error("Estado inválido", "validacion");
  const actualizado = await modelo.actualizarEstado(idTicket, estado);
  if (!actualizado) throw error("Ticket no encontrado", "no_encontrado");
}

module.exports = { tiposDe, crear, obtenerListado, obtenerCaptura, cambiarEstado };
