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
async function listar({ texto, accion, desde, hasta, sinLogin, limite } = {}) {
  const tope = Math.min(Number(limite) || LIMITE_POR_DEFECTO, LIMITE_MAXIMO);
  const [registros, acciones] = await Promise.all([
    modelo.listar({
      texto: texto?.trim() || null, accion: accion || null, desde: desde || null, hasta: hasta || null,
      sinLogin: !!sinLogin, limite: tope,
    }),
    modelo.acciones(),
  ]);
  return { registros, acciones };
}

/** El CSV se arma en el navegador; aquí queda quién se llevó el registro y con qué filtros. */
async function registrarExportacion(usuario, { filas, filtros }) {
  await auditar(usuario.id, "exportar_auditoria", null, null, {
    formato: "csv",
    filas: Number(filas) || 0,
    filtros: filtros && typeof filtros === "object" ? filtros : {},
  });
}

module.exports = { auditar, listar, registrarExportacion };
