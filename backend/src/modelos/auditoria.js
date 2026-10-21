const pool = require("../config/db");

async function insertar({ idUsuario, accion, entidad, idEntidad, detalle }) {
  await pool.query(
    `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
     VALUES ($1,$2,$3,$4,$5)`,
    [idUsuario, accion, entidad, idEntidad, detalle ? JSON.stringify(detalle) : null]
  );
}

const DIA = "(ARRAY['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])";

// Nombre legible de lo que se tocó ("Ficha 2901817", "Ana Ruiz", "Lector ZK-01"),
// en vez de "ficha #2". Si el registro ya se eliminó, el que se guardó al borrarlo.
const NOMBRE_ENTIDAD = `
  COALESCE(CASE a.entidad
    WHEN 'usuario' THEN (SELECT x.nombres || ' ' || x.apellidos FROM usuario x WHERE x.id_usuario = a.id_entidad)
    WHEN 'ficha' THEN (SELECT 'Ficha ' || f.numero_ficha FROM ficha f WHERE f.id_ficha = a.id_entidad)
    WHEN 'horario' THEN (
      SELECT 'Ficha ' || f.numero_ficha || ' · ' || ${DIA}[h.dia_semana + 1] || ' ' || to_char(h.hora_inicio, 'HH24:MI')
      FROM horario h JOIN ficha f ON f.id_ficha = h.id_ficha WHERE h.id_horario = a.id_entidad)
    WHEN 'sesion_clase' THEN (
      SELECT 'Ficha ' || f.numero_ficha || ' · clase del ' || to_char(s.fecha, 'DD/MM/YYYY')
      FROM sesion_clase s JOIN horario h ON h.id_horario = s.id_horario JOIN ficha f ON f.id_ficha = h.id_ficha
      WHERE s.id_sesion = a.id_entidad)
    WHEN 'asistencia' THEN (
      SELECT x.nombres || ' ' || x.apellidos || ' · clase del ' || to_char(s.fecha, 'DD/MM/YYYY')
      FROM asistencia asi JOIN usuario x ON x.id_usuario = asi.id_aprendiz JOIN sesion_clase s ON s.id_sesion = asi.id_sesion
      WHERE asi.id_asistencia = a.id_entidad)
    WHEN 'justificacion' THEN (
      SELECT x.nombres || ' ' || x.apellidos || ' · clase del ' || to_char(s.fecha, 'DD/MM/YYYY')
      FROM justificacion j JOIN asistencia asi ON asi.id_asistencia = j.id_asistencia
      JOIN usuario x ON x.id_usuario = asi.id_aprendiz JOIN sesion_clase s ON s.id_sesion = asi.id_sesion
      WHERE j.id_justificacion = a.id_entidad)
    WHEN 'matricula' THEN (
      SELECT x.nombres || ' ' || x.apellidos || ' · ficha ' || f.numero_ficha
      FROM matricula m JOIN usuario x ON x.id_usuario = m.id_aprendiz JOIN ficha f ON f.id_ficha = m.id_ficha
      WHERE m.id_matricula = a.id_entidad)
    WHEN 'ambiente' THEN (SELECT 'Ambiente ' || am.numero_ambiente FROM ambiente am WHERE am.id_ambiente = a.id_entidad)
    WHEN 'dispositivo' THEN (SELECT 'Lector ' || d.serial FROM dispositivo d WHERE d.id_dispositivo = a.id_entidad)
    WHEN 'competencia' THEN (SELECT c.nombre FROM competencia c WHERE c.id_competencia = a.id_entidad)
    WHEN 'resultado_aprendizaje' THEN (SELECT 'RAP ' || r.codigo FROM resultado_aprendizaje r WHERE r.id_rap = a.id_entidad)
    WHEN 'tematica' THEN (SELECT t.nombre FROM tematica t WHERE t.id_tematica = a.id_entidad)
  END, a.detalle->>'nombre')`;

/**
 * Actividad registrada, la más reciente primero. `texto` busca en quien la hizo
 * (nombre o correo) y en lo que tocó ("Ficha 2901817", el aprendiz de una
 * asistencia); `sinLogin` deja fuera los inicios de sesión.
 */
async function listar({ texto, accion, desde, hasta, sinLogin, limite }) {
  const condiciones = [];
  const valores = [];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replaceAll("?", `$${valores.length}`));
  };

  if (texto) agregar(`(u.nombres || ' ' || u.apellidos ILIKE ? OR u.correo ILIKE ? OR ${NOMBRE_ENTIDAD} ILIKE ?)`, `%${texto}%`);
  if (accion) agregar("a.accion = ?", accion);
  if (desde) agregar("a.creado_en >= ?::date", desde);
  if (hasta) agregar("a.creado_en < ?::date + 1", hasta);
  if (sinLogin) condiciones.push("a.accion <> 'login'");

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  valores.push(limite);
  const r = await pool.query(
    `SELECT a.id_auditoria, a.accion, a.entidad, a.id_entidad, a.detalle, a.creado_en,
            ${NOMBRE_ENTIDAD} AS nombre_entidad,
            u.nombres || ' ' || u.apellidos AS usuario, u.correo, u.rol
     FROM auditoria a
     LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
     ${where}
     ORDER BY a.creado_en DESC, a.id_auditoria DESC
     LIMIT $${valores.length}`,
    valores
  );
  return r.rows;
}

/** Las acciones que existen en el registro, para el filtro de la pantalla. */
async function acciones() {
  const r = await pool.query("SELECT DISTINCT accion FROM auditoria ORDER BY accion");
  return r.rows.map((f) => f.accion);
}

module.exports = { insertar, listar, acciones };
