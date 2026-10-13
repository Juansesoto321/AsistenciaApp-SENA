const pool = require("../config/db");

// El dia se toma de la base de datos (no del reloj del servidor Node) para que
// coincida siempre con CURRENT_DATE de la sesion. Solo cuentan los horarios
// vigentes hoy (dentro de su trimestre o periodo). Trae también cómo va la
// asistencia de cada clase y el estado del lector de su ambiente (panel).
async function horariosDeHoy(usuario) {
  const filtro = usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = usuario.rol === "instructor" ? [usuario.id] : [];
  const r = await pool.query(
    `SELECT h.id_horario, h.hora_inicio, h.hora_fin,
            f.numero_ficha, f.programa,
            a.numero_ambiente,
            u.nombres || ' ' || u.apellidos AS instructor,
            d.estado AS estado_lector,
            s.id_sesion,
            s.estado AS estado_sesion,
            (SELECT COUNT(*)::int FROM matricula m WHERE m.id_ficha = f.id_ficha AND m.estado = 'activa') AS matriculados,
            COALESCE(c.presentes, 0) AS presentes,
            COALESCE(c.tardanzas, 0) AS tardanzas,
            COALESCE(c.ausentes, 0) AS ausentes,
            COALESCE(c.justificadas, 0) AS justificadas
     FROM horario h
     JOIN horario_vigencia v ON v.id_horario = h.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN ambiente a ON a.id_ambiente = h.id_ambiente
     JOIN usuario u ON u.id_usuario = h.id_instructor
     LEFT JOIN dispositivo d ON d.id_ambiente = h.id_ambiente
     LEFT JOIN sesion_clase s ON s.id_horario = h.id_horario AND s.fecha = CURRENT_DATE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE x.estado = 'presente')::int    AS presentes,
              COUNT(*) FILTER (WHERE x.estado = 'tardanza')::int    AS tardanzas,
              COUNT(*) FILTER (WHERE x.estado = 'ausente')::int     AS ausentes,
              COUNT(*) FILTER (WHERE x.estado = 'justificada')::int AS justificadas
       FROM asistencia x WHERE x.id_sesion = s.id_sesion
     ) c ON TRUE
     WHERE h.dia_semana = EXTRACT(DOW FROM CURRENT_DATE) AND f.estado = 'activa'
       AND CURRENT_DATE BETWEEN v.vigente_desde AND v.vigente_hasta ${filtro}
     ORDER BY h.hora_inicio`,
    valores
  );
  return r.rows;
}

async function buscarHorarioConLector(idHorario) {
  const r = await pool.query(
    `SELECT h.*, f.numero_ficha, f.estado AS estado_ficha, d.estado AS estado_lector,
            (h.dia_semana = EXTRACT(DOW FROM CURRENT_DATE)
             AND CURRENT_DATE BETWEEN v.vigente_desde AND v.vigente_hasta) AS es_hoy
     FROM horario h
     JOIN horario_vigencia v ON v.id_horario = h.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     LEFT JOIN dispositivo d ON d.id_ambiente = h.id_ambiente
     WHERE h.id_horario = $1`,
    [idHorario]
  );
  return r.rows[0] || null;
}

async function crearOReanudarSesion(idHorario) {
  const r = await pool.query(
    `INSERT INTO sesion_clase (id_horario, fecha)
     VALUES ($1, CURRENT_DATE)
     ON CONFLICT (id_horario, fecha) DO UPDATE SET estado = sesion_clase.estado
     RETURNING id_sesion, estado`,
    [idHorario]
  );
  return r.rows[0];
}

async function buscarDetalle(idSesion) {
  const r = await pool.query(
    `SELECT s.id_sesion, s.fecha, s.estado,
            s.hora_apertura, s.hora_cierre,
            h.hora_inicio, h.hora_fin, h.id_instructor,
            f.numero_ficha, f.programa,
            a.numero_ambiente
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN ambiente a ON a.id_ambiente = h.id_ambiente
     WHERE s.id_sesion = $1`,
    [idSesion]
  );
  return r.rows[0] || null;
}

async function buscarAprendicesDeSesion(idSesion) {
  const r = await pool.query(
    `SELECT u.id_usuario, u.nombres, u.apellidos, u.documento,
            asi.estado, asi.hora_marca, asi.metodo, asi.observacion,
            (pb.id_plantilla IS NOT NULL) AS tiene_huella
     FROM matricula m
     JOIN usuario u ON u.id_usuario = m.id_aprendiz
     JOIN sesion_clase s ON s.id_sesion = $1
     JOIN horario h ON h.id_horario = s.id_horario AND h.id_ficha = m.id_ficha
     LEFT JOIN asistencia asi ON asi.id_sesion = s.id_sesion AND asi.id_aprendiz = u.id_usuario
     LEFT JOIN plantilla_biometrica pb ON pb.id_aprendiz = u.id_usuario
     WHERE m.estado = 'activa'
     ORDER BY u.apellidos`,
    [idSesion]
  );
  return r.rows;
}

async function esInstructorDeSesion(idSesion, idUsuario) {
  const r = await pool.query(
    `SELECT 1 FROM sesion_clase s JOIN horario h ON h.id_horario = s.id_horario
     WHERE s.id_sesion = $1 AND h.id_instructor = $2`,
    [idSesion, idUsuario]
  );
  return !!r.rows[0];
}

// Datos para validar un registro manual: dueño de la clase y hace cuanto se cerro
async function buscarSesionParaRegistroManual(idSesion) {
  const r = await pool.query(
    `SELECT s.estado, s.fecha, h.id_instructor, h.id_ficha, f.numero_ficha,
            (s.hora_cierre IS NOT NULL AND s.hora_cierre < NOW() - INTERVAL '24 hours') AS cerrada_hace_mas_de_24h
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     WHERE s.id_sesion = $1`,
    [idSesion]
  );
  return r.rows[0] || null;
}

async function estaMatriculado(idAprendiz, idFicha) {
  const r = await pool.query("SELECT 1 FROM matricula WHERE id_aprendiz = $1 AND id_ficha = $2", [idAprendiz, idFicha]);
  return !!r.rows[0];
}

// UPSERT atomico: evita condiciones de carrera cuando dos peticiones intentan
// registrar/modificar la asistencia al mismo tiempo.
async function upsertAsistenciaManual(cliente, { idSesion, idAprendiz, estado, motivo, registradoPor }) {
  const r = await cliente.query(
    `WITH anterior AS (
       SELECT estado FROM asistencia WHERE id_sesion = $1 AND id_aprendiz = $2
     )
     INSERT INTO asistencia (id_sesion, id_aprendiz, estado, hora_marca, metodo, observacion, registrado_por)
     VALUES ($1, $2, $3, NOW(), 'manual', $4, $5)
     ON CONFLICT (id_sesion, id_aprendiz) DO UPDATE SET
       estado = EXCLUDED.estado,
       metodo = 'manual',
       observacion = EXCLUDED.observacion,
       registrado_por = EXCLUDED.registrado_por,
       hora_marca = COALESCE(asistencia.hora_marca, NOW())
     RETURNING id_asistencia, (SELECT estado FROM anterior) AS estado_anterior`,
    [idSesion, idAprendiz, estado, motivo, registradoPor]
  );
  return r.rows[0];
}

async function insertarCambioAsistencia(cliente, { idAsistencia, estadoAnterior, estadoNuevo, motivo, cambiadoPor }) {
  await cliente.query(
    `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por)
     VALUES ($1, $2, $3, $4, $5)`,
    [idAsistencia, estadoAnterior, estadoNuevo, motivo, cambiadoPor]
  );
}

async function buscarNombreUsuario(idUsuario) {
  const r = await pool.query("SELECT nombres, apellidos FROM usuario WHERE id_usuario = $1", [idUsuario]);
  return r.rows[0] || null;
}

async function buscarSesionParaCerrar(idSesion) {
  const r = await pool.query(
    `SELECT s.*, h.id_ficha, h.id_instructor, f.numero_ficha
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     WHERE s.id_sesion = $1`,
    [idSesion]
  );
  return r.rows[0] || null;
}

// Marca ausentes a quienes no registraron (CU-14 paso 5)
async function marcarAusentesSinRegistro(cliente, idSesion, idFicha) {
  const r = await cliente.query(
    `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, metodo)
     SELECT $1, m.id_aprendiz, 'ausente', 'sistema'
     FROM matricula m
     WHERE m.id_ficha = $2
       AND m.estado = 'activa'
       AND NOT EXISTS (SELECT 1 FROM asistencia a WHERE a.id_sesion = $1 AND a.id_aprendiz = m.id_aprendiz)
     RETURNING id_asistencia, id_aprendiz`,
    [idSesion, idFicha]
  );
  return r.rows;
}

async function cerrarSesion(cliente, idSesion, cerradaPor) {
  await cliente.query(
    "UPDATE sesion_clase SET estado = 'cerrada', hora_cierre = NOW(), cerrada_por = $1 WHERE id_sesion = $2",
    [cerradaPor, idSesion]
  );
}

// Elimina permanentemente una sesion y su asistencia/justificaciones asociadas.
async function eliminarSesion(cliente, idSesion) {
  await cliente.query(
    "DELETE FROM cambio_asistencia WHERE id_asistencia IN (SELECT id_asistencia FROM asistencia WHERE id_sesion = $1)",
    [idSesion]
  );
  await cliente.query(
    "DELETE FROM justificacion WHERE id_asistencia IN (SELECT id_asistencia FROM asistencia WHERE id_sesion = $1)",
    [idSesion]
  );
  await cliente.query("DELETE FROM asistencia WHERE id_sesion = $1", [idSesion]);
  const r = await cliente.query("DELETE FROM sesion_clase WHERE id_sesion = $1 RETURNING id_sesion", [idSesion]);
  return r.rows[0] || null;
}

// --- Generacion del enlace de justificacion al quedar "ausente" (72h por defecto) ---
async function obtenerHorasJustificacion(cliente) {
  const r = await cliente.query("SELECT valor FROM configuracion WHERE clave = 'horas_justificacion'");
  return Number(r.rows[0]?.valor || 72);
}

async function insertarJustificacion(cliente, idAsistencia, token, horas) {
  const r = await cliente.query(
    `INSERT INTO justificacion (id_asistencia, token, expira_en)
     VALUES ($1, $2, NOW() + ($3 || ' hours')::interval)
     ON CONFLICT (id_asistencia) DO NOTHING
     RETURNING id_justificacion`,
    [idAsistencia, token, horas]
  );
  return r.rows[0] || null;
}

async function buscarUsuarioParaCorreo(cliente, idAprendiz) {
  const r = await cliente.query("SELECT nombres, correo FROM usuario WHERE id_usuario = $1", [idAprendiz]);
  return r.rows[0];
}

async function insertarNotificacionInasistencia(cliente, idAprendiz, mensaje) {
  await cliente.query(
    `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
     VALUES ($1, 'inasistencia', 'Inasistencia registrada', $2)`,
    [idAprendiz, mensaje]
  );
}

module.exports = {
  horariosDeHoy,
  buscarHorarioConLector,
  crearOReanudarSesion,
  buscarDetalle,
  buscarAprendicesDeSesion,
  esInstructorDeSesion,
  buscarSesionParaRegistroManual,
  estaMatriculado,
  upsertAsistenciaManual,
  insertarCambioAsistencia,
  buscarNombreUsuario,
  buscarSesionParaCerrar,
  marcarAusentesSinRegistro,
  cerrarSesion,
  eliminarSesion,
  obtenerHorasJustificacion,
  insertarJustificacion,
  buscarUsuarioParaCorreo,
  insertarNotificacionInasistencia,
};
