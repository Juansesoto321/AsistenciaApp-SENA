const modelo = require("../modelos/auditoria");

const LIMITE_POR_DEFECTO = 200;
const LIMITE_MAXIMO = 1000;

/**
 * Registra toda accion sensible (requisito transversal de los CU).
 * Nunca lanza: un fallo al auditar no puede tumbar la operacion del usuario.
 */
async function auditar(idUsuario, accion, entidad = null, idEntidad = null, detalle = null) {
  try {
    await modelo.insertar({ idUsuario, accion, entidad, idEntidad, detalle });
  } catch (e) {
    console.error("Error registrando auditoria:", e.message);
  }
}

/** Registro de actividad para la coordinación (quién hizo qué y cuándo). */
async function listar({ texto, accion, desde, hasta, limite } = {}) {
  const tope = Math.min(Number(limite) || LIMITE_POR_DEFECTO, LIMITE_MAXIMO);
  const [registros, acciones] = await Promise.all([
    modelo.listar({ texto: texto?.trim() || null, accion: accion || null, desde: desde || null, hasta: hasta || null, limite: tope }),
    modelo.acciones(),
  ]);
  return { registros, acciones };
}

module.exports = { auditar, listar };
