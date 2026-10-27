const pool = require("../config/db");

// Busqueda solo por serial: la usa el protocolo ADMS real, que no maneja
// clave de API (limitacion del protocolo de fabrica, no del backend).
async function buscarPorSerial(serial) {
  const r = await pool.query("SELECT * FROM dispositivo WHERE serial = $1", [serial]);
  return r.rows[0] || null;
}

// Protocolo simulado (/api/lector): serial + clave de API por encabezado.
async function buscarPorCredenciales(serial, claveApi) {
  const r = await pool.query("SELECT * FROM dispositivo WHERE serial = $1 AND clave_api = $2", [serial, claveApi]);
  return r.rows[0] || null;
}

async function marcarEnLinea(idDispositivo) {
  await pool.query(
    "UPDATE dispositivo SET estado = 'en_linea', ultimo_heartbeat = NOW() WHERE id_dispositivo = $1",
    [idDispositivo]
  );
}

/**
 * Tarea programada CU-09: sin heartbeat en 3 minutos, el lector se da por
 * caido. Devuelve solo los que acaban de caer (para avisar una sola vez).
 */
async function marcarFueraDeLineaSinHeartbeat() {
  const r = await pool.query(
    `UPDATE dispositivo d SET estado = 'fuera_de_linea'
     WHERE d.estado = 'en_linea' AND d.ultimo_heartbeat < NOW() - INTERVAL '3 minutes'
     RETURNING d.id_dispositivo, d.serial, d.id_ambiente,
               (SELECT numero_ambiente FROM ambiente a WHERE a.id_ambiente = d.id_ambiente) AS numero_ambiente`
  );
  return r.rows;
}

/**
 * Notificación de lector caído para la coordinación, el programador y el
 * instructor que tenga clase en curso en ese ambiente. Devuelve a quiénes.
 */
async function notificarLectorCaido({ id_ambiente: idAmbiente }, mensaje) {
  const r = await pool.query(
    `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
     SELECT u.id_usuario, 'lector', 'Lector sin señal', $2
     FROM usuario u
     WHERE u.estado = 'activo'
       AND (u.rol IN ('coordinador', 'programador')
            OR u.id_usuario IN (SELECT h.id_instructor FROM sesion_clase s JOIN horario h ON h.id_horario = s.id_horario
                                WHERE h.id_ambiente = $1 AND s.fecha = CURRENT_DATE AND s.estado = 'activa'))
     RETURNING id_usuario`,
    [idAmbiente, mensaje]
  );
  return r.rows.map((f) => f.id_usuario);
}

/** Serial de cada lector registrado y el ambiente al que pertenece. */
async function listarConAmbiente() {
  const r = await pool.query(
    `SELECT d.serial, d.estado, a.numero_ambiente
     FROM dispositivo d LEFT JOIN ambiente a ON a.id_ambiente = d.id_ambiente`
  );
  return r.rows;
}

module.exports = { buscarPorSerial, buscarPorCredenciales, marcarEnLinea, marcarFueraDeLineaSinHeartbeat, notificarLectorCaido, listarConAmbiente };
