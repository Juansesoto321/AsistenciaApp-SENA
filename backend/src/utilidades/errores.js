/**
 * Errores de negocio.
 *
 * Los servicios no conocen HTTP: lanzan un error con un `tipo` y el manejador
 * central (middleware/manejadorErrores.js) lo traduce al código de estado.
 * Tipos reconocidos: validacion, conflicto_horario, credenciales, prohibido,
 * cuenta_pendiente, cuenta_inactiva, cuenta_bloqueada, no_encontrado,
 * no_reconocida, sin_sesion, fuera_de_horario, vencida, demasiadas_peticiones.
 *
 * Uso: throw error("La sesión ya está cerrada", "validacion");
 */
function error(mensaje, tipo, extras = {}) {
  return Object.assign(new Error(mensaje), { tipo, ...extras });
}

module.exports = { error };
