const pool = require("../config/db");

async function obtenerHorasPlazo() {
  const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'horas_justificacion'");
  return Number(r.rows[0]?.valor || 72);
}

async function buscarPorToken(token) {
  const r = await pool.query(
    `SELECT j.id_justificacion, j.estado, j.expira_en, j.tipo, j.descripcion,
            s.fecha, f.numero_ficha, f.programa, u.nombres, u.apellidos
     FROM justificacion j
     JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN usuario u ON u.id_usuario = a.id_aprendiz
     WHERE j.token = $1`,
    [token]
  );
  return r.rows[0] || null;
}

async function enviarPorToken(token, { tipo, descripcion, nombre_archivo, archivo_datos }) {
  const r = await pool.query(
    `UPDATE justificacion SET tipo = $1, descripcion = $2, nombre_archivo = $3, archivo_datos = $4,
      estado = 'enviada', enviada_en = NOW()
     WHERE token = $5 AND estado = 'pendiente' AND expira_en > NOW()
     RETURNING id_justificacion, id_asistencia`,
    [tipo, descripcion, nombre_archivo || null, archivo_datos || null, token]
  );
  return r.rows[0] || null;
}

async function buscarInstructorDeAsistencia(idAsistencia) {
  const r = await pool.query(
    `SELECT h.id_instructor, u.nombres, u.apellidos
     FROM asistencia a
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN usuario u ON u.id_usuario = a.id_aprendiz
     WHERE a.id_asistencia = $1`,
    [idAsistencia]
  );
  return r.rows[0] || null;
}

async function esPropietario(idJustificacion, usuario) {
  if (usuario.rol === "coordinador" || usuario.rol === "programador") return true;
  const r = await pool.query(
    `SELECT 1 FROM justificacion j
     JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE j.id_justificacion = $1 AND h.id_instructor = $2`,
    [idJustificacion, usuario.id]
  );
  return !!r.rows[0];
}

async function listarBandeja(usuario) {
  const filtro = usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = usuario.rol === "instructor" ? [usuario.id] : [];
  const r = await pool.query(
    `SELECT j.id_justificacion, j.estado, j.tipo, j.descripcion, j.nombre_archivo, j.enviada_en, j.expira_en,
            j.observacion_validacion, j.validada_en,
            rev.nombres || ' ' || rev.apellidos AS revisada_por,
            s.fecha, f.numero_ficha, u.nombres, u.apellidos, u.documento
     FROM justificacion j
     JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN usuario u ON u.id_usuario = a.id_aprendiz
     LEFT JOIN usuario rev ON rev.id_usuario = j.validada_por
     WHERE j.estado IN ('enviada','aprobada','rechazada') ${filtro}
     ORDER BY j.enviada_en DESC NULLS LAST`,
    valores
  );
  return r.rows;
}

async function contarPendientes(usuario) {
  const filtro = usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = usuario.rol === "instructor" ? [usuario.id] : [];
  const r = await pool.query(
    `SELECT COUNT(*) AS pendientes
     FROM justificacion j
     JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE j.estado = 'enviada' ${filtro}`,
    valores
  );
  return Number(r.rows[0].pendientes);
}

async function obtenerArchivo(idJustificacion) {
  const r = await pool.query(
    "SELECT nombre_archivo, archivo_datos FROM justificacion WHERE id_justificacion = $1",
    [idJustificacion]
  );
  return r.rows[0] || null;
}

async function validar(cliente, idJustificacion, { estado, validadaPor, observacion }) {
  const r = await cliente.query(
    `UPDATE justificacion SET estado = $1, validada_por = $2, validada_en = NOW(), observacion_validacion = $3
     WHERE id_justificacion = $4 AND estado = 'enviada'
     RETURNING id_asistencia`,
    [estado, validadaPor, observacion, idJustificacion]
  );
  return r.rows[0] || null;
}

/** Devuelve el estado anterior si hubo cambio, o null si la asistencia ya no estaba "ausente". */
async function marcarAsistenciaJustificada(cliente, idAsistencia) {
  const r = await cliente.query(
    "UPDATE asistencia SET estado = 'justificada' WHERE id_asistencia = $1 AND estado = 'ausente' RETURNING id_asistencia",
    [idAsistencia]
  );
  return r.rows[0] ? "ausente" : null;
}

async function obtenerAprendizDeAsistencia(cliente, idAsistencia) {
  const r = await cliente.query("SELECT id_aprendiz FROM asistencia WHERE id_asistencia = $1", [idAsistencia]);
  return r.rows[0].id_aprendiz;
}

async function registrarCambioAsistencia(cliente, idAsistencia, estadoAnterior, cambiadoPor) {
  await cliente.query(
    `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por)
     VALUES ($1, $2, 'justificada', 'Justificación aprobada', $3)`,
    [idAsistencia, estadoAnterior, cambiadoPor]
  );
}

/** `cliente` solo se pasa cuando la notificación debe ir dentro de una transacción. */
async function crearNotificacion(idUsuario, tipo, titulo, mensaje, cliente = pool) {
  await cliente.query(
    "INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje) VALUES ($1,$2,$3,$4)",
    [idUsuario, tipo, titulo, mensaje]
  );
}

async function buscarInstructorDeJustificacion(idAsistencia) {
  const r = await pool.query(
    `SELECT h.id_instructor FROM asistencia a
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE a.id_asistencia = $1`,
    [idAsistencia]
  );
  return r.rows[0]?.id_instructor || null;
}

async function buscarUsuarioParaCorreo(idUsuario) {
  const r = await pool.query("SELECT nombres, correo FROM usuario WHERE id_usuario = $1", [idUsuario]);
  return r.rows[0];
}

/** Tarea programada: marca como vencidas las que pasaron su plazo. */
async function vencerExpiradas() {
  const r = await pool.query(
    "UPDATE justificacion SET estado = 'vencida' WHERE estado = 'pendiente' AND expira_en < NOW()"
  );
  return r.rowCount;
}

module.exports = {
  vencerExpiradas,
  obtenerHorasPlazo,
  buscarPorToken,
  enviarPorToken,
  buscarInstructorDeAsistencia,
  esPropietario,
  listarBandeja,
  contarPendientes,
  obtenerArchivo,
  validar,
  marcarAsistenciaJustificada,
  obtenerAprendizDeAsistencia,
  registrarCambioAsistencia,
  crearNotificacion,
  buscarInstructorDeJustificacion,
  buscarUsuarioParaCorreo,
};
