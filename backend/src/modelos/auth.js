const pool = require("../config/db");

async function buscarPorCorreo(correo) {
  const r = await pool.query("SELECT * FROM usuario WHERE LOWER(correo) = LOWER($1)", [correo]);
  return r.rows[0] || null;
}

async function buscarPorId(idUsuario) {
  const r = await pool.query("SELECT * FROM usuario WHERE id_usuario = $1", [idUsuario]);
  return r.rows[0] || null;
}

// Solo se llama para cuentas activas o con el bloqueo ya vencido: si no
// corresponde bloquear, la cuenta queda (o vuelve a quedar) activa.
async function registrarIntentoFallido(idUsuario, intentos, bloquear) {
  await pool.query(
    `UPDATE usuario SET intentos_fallidos = $1,
      estado = CASE WHEN $2 THEN 'bloqueado' ELSE 'activo' END,
      bloqueado_hasta = CASE WHEN $2 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
     WHERE id_usuario = $3`,
    [intentos, bloquear, idUsuario]
  );
}

async function resetearIntentos(idUsuario) {
  await pool.query(
    "UPDATE usuario SET intentos_fallidos = 0, estado = 'activo', bloqueado_hasta = NULL WHERE id_usuario = $1",
    [idUsuario]
  );
}

async function crearUsuarioPendiente({ nombres, apellidos, tipoDocumento, documento, correo, telefono, hash, rol }) {
  const r = await pool.query(
    `INSERT INTO usuario (nombres, apellidos, tipo_documento, documento, correo, telefono, contrasena_hash, rol, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente') RETURNING id_usuario`,
    [nombres.trim(), apellidos.trim(), tipoDocumento || "CC", String(documento).trim(), correo, telefono || null, hash, rol]
  );
  return r.rows[0].id_usuario;
}

async function notificarAdminsSolicitud(mensaje) {
  await pool.query(
    `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
     SELECT id_usuario, 'solicitud_registro', 'Nueva solicitud de registro', $1
     FROM usuario WHERE rol = 'coordinador' AND estado = 'activo'`,
    [mensaje]
  );
}

async function crearTokenRecuperacion(idUsuario, token) {
  await pool.query(
    `INSERT INTO token_recuperacion (id_usuario, token, expira_en) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
    [idUsuario, token]
  );
}

async function contarTokensRecientes(idUsuario) {
  const r = await pool.query(
    "SELECT COUNT(*)::int AS total FROM token_recuperacion WHERE id_usuario = $1 AND creado_en > NOW() - INTERVAL '1 hour'",
    [idUsuario]
  );
  return r.rows[0].total;
}

async function buscarTokenValido(token) {
  const r = await pool.query(
    "SELECT * FROM token_recuperacion WHERE token = $1 AND usado = FALSE AND expira_en > NOW()",
    [token]
  );
  return r.rows[0] || null;
}

async function marcarTokenUsado(idToken) {
  await pool.query("UPDATE token_recuperacion SET usado = TRUE WHERE id_token = $1", [idToken]);
}

// Restablecer la contraseña desbloquea la cuenta, pero no aprueba una cuenta
// pendiente ni reactiva una desactivada: eso solo lo decide el coordinador.
async function restablecerContrasena(idUsuario, hash) {
  await pool.query(
    `UPDATE usuario SET contrasena_hash = $1, intentos_fallidos = 0, bloqueado_hasta = NULL,
            estado = CASE WHEN estado = 'bloqueado' THEN 'activo' ELSE estado END
     WHERE id_usuario = $2`,
    [hash, idUsuario]
  );
}

async function obtenerPerfil(idUsuario) {
  const r = await pool.query(
    `SELECT id_usuario, nombres, apellidos, tipo_documento, documento, correo, telefono, rol, estado, creado_en
     FROM usuario WHERE id_usuario = $1`,
    [idUsuario]
  );
  return r.rows[0] || null;
}

async function obtenerHashContrasena(idUsuario) {
  const r = await pool.query("SELECT contrasena_hash FROM usuario WHERE id_usuario = $1", [idUsuario]);
  return r.rows[0]?.contrasena_hash || null;
}

async function actualizarContrasena(idUsuario, hash) {
  await pool.query("UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2", [hash, idUsuario]);
}

async function actualizarTelefono(idUsuario, telefono) {
  await pool.query("UPDATE usuario SET telefono = $1 WHERE id_usuario = $2", [telefono, idUsuario]);
}

module.exports = {
  buscarPorId,
  buscarPorCorreo,
  registrarIntentoFallido,
  resetearIntentos,
  crearUsuarioPendiente,
  notificarAdminsSolicitud,
  crearTokenRecuperacion,
  contarTokensRecientes,
  buscarTokenValido,
  marcarTokenUsado,
  restablecerContrasena,
  obtenerPerfil,
  obtenerHashContrasena,
  actualizarContrasena,
  actualizarTelefono,
};
