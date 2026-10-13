const pool = require("../config/db");

function construirCondiciones(filtros) {
  const condiciones = [];
  const valores = [];
  const add = (sql, val) => { valores.push(val); condiciones.push(sql.replace("?", `$${valores.length}`)); };

  if (filtros.nombre) add("(u.nombres ILIKE ? OR u.apellidos ILIKE ? OR u.documento ILIKE ?)".replaceAll("?", `$${valores.length + 1}`), `%${filtros.nombre}%`);
  if (filtros.id_ficha) add("f.id_ficha = ?", filtros.id_ficha);
  if (filtros.id_instructor) add("h.id_instructor = ?", filtros.id_instructor);
  if (filtros.estado) add("a.estado = ?", filtros.estado);
  if (filtros.fecha_inicio) add("s.fecha >= ?", filtros.fecha_inicio);
  if (filtros.fecha_fin) add("s.fecha <= ?", filtros.fecha_fin);

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  return { where, valores };
}

async function buscarAsistencias(filtros) {
  const { where, valores } = construirCondiciones(filtros);
  const r = await pool.query(
    `SELECT a.id_asistencia, s.fecha, u.nombres || ' ' || u.apellidos AS aprendiz, u.documento,
            f.numero_ficha, a.estado, TO_CHAR(a.hora_marca AT TIME ZONE 'America/Bogota','HH24:MI') AS hora,
            a.metodo, a.observacion
     FROM asistencia a
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN usuario u ON u.id_usuario = a.id_aprendiz
     ${where}
     ORDER BY s.fecha DESC, u.apellidos`,
    valores
  );
  return r.rows;
}

async function listarBusquedasGuardadas(idUsuario) {
  const r = await pool.query("SELECT * FROM busqueda_guardada WHERE id_usuario = $1 ORDER BY creado_en DESC", [idUsuario]);
  return r.rows;
}

async function guardarBusqueda(idUsuario, nombre, filtros) {
  const r = await pool.query(
    "INSERT INTO busqueda_guardada (id_usuario, nombre, filtros) VALUES ($1,$2,$3) RETURNING *",
    [idUsuario, nombre, JSON.stringify(filtros)]
  );
  return r.rows[0];
}

async function fichasDelAprendiz(idAprendiz) {
  const r = await pool.query(
    `SELECT f.id_ficha, f.numero_ficha, f.programa, m.estado AS estado_matricula
     FROM matricula m JOIN ficha f ON f.id_ficha = m.id_ficha
     WHERE m.id_aprendiz = $1 ORDER BY m.fecha_matricula DESC`,
    [idAprendiz]
  );
  return r.rows;
}

async function historialFicha(idAprendiz, idFicha) {
  const r = await pool.query(
    `SELECT s.fecha, a.estado, TO_CHAR(a.hora_marca AT TIME ZONE 'America/Bogota','HH24:MI') AS hora,
            a.metodo, a.observacion,
            j.estado AS estado_soporte, j.token AS token_soporte, j.expira_en AS soporte_expira,
            j.nombre_archivo AS soporte_archivo, j.tipo AS soporte_tipo, j.descripcion AS soporte_descripcion,
            j.observacion_validacion AS soporte_observacion
     FROM asistencia a
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     LEFT JOIN justificacion j ON j.id_asistencia = a.id_asistencia
     WHERE a.id_aprendiz = $1 AND h.id_ficha = $2
     ORDER BY s.fecha DESC`,
    [idAprendiz, idFicha]
  );
  return r.rows;
}

async function porcentajeMinimo() {
  const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'porcentaje_minimo'");
  return Number(r.rows[0]?.valor || 80);
}

// Requiere el usuario completo (no solo filtros) porque la condicion de
// instructor se repite dentro de varias subconsultas de la misma sentencia.
async function estadisticas(usuario) {
  const filtro = usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = usuario.rol === "instructor" ? [usuario.id] : [];
  const r = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM ficha WHERE estado = 'activa' ${usuario.rol === "instructor" ? "AND id_instructor = $1" : ""}) AS fichas_activas,
      (SELECT COUNT(DISTINCT m.id_aprendiz) FROM matricula m JOIN ficha f ON f.id_ficha = m.id_ficha
        WHERE m.estado = 'activa' ${usuario.rol === "instructor" ? "AND f.id_instructor = $1" : ""}) AS aprendices_activos,
      (SELECT COUNT(*) FROM sesion_clase s JOIN horario h ON h.id_horario = s.id_horario
        WHERE s.fecha = CURRENT_DATE ${filtro}) AS sesiones_hoy,
      -- NULL si todavía no hay clases cerradas (el panel muestra "sin datos" en vez de 0 %)
      (SELECT ROUND(AVG(CASE WHEN a.estado IN ('presente','tardanza','justificada') THEN 100 ELSE 0 END))
        FROM asistencia a JOIN sesion_clase s ON s.id_sesion = a.id_sesion
        JOIN horario h ON h.id_horario = s.id_horario WHERE s.estado = 'cerrada' ${filtro}) AS promedio_asistencia,
      (SELECT COALESCE(MAX(valor::int), 80) FROM configuracion WHERE clave = 'porcentaje_minimo') AS minimo`,
    valores
  );
  return r.rows[0];
}

// Presente, tardanza y justificada cuentan como asistencia (regla CU-19).
// Los resúmenes solo cuentan clases cerradas: en una clase en curso, quien aún
// no marca no tiene registro y el porcentaje saldría inflado.
const ASISTIO = "a.estado IN ('presente','tardanza','justificada')";

/** Asistencia acumulada de cada ficha activa (las de más bajo porcentaje primero). */
async function resumenPorFicha(usuario) {
  const filtro = usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = usuario.rol === "instructor" ? [usuario.id] : [];
  const r = await pool.query(
    `SELECT f.id_ficha, f.numero_ficha, f.programa,
            COUNT(DISTINCT s.id_sesion)::int AS clases,
            COUNT(*) FILTER (WHERE a.estado = 'presente')::int    AS presentes,
            COUNT(*) FILTER (WHERE a.estado = 'tardanza')::int    AS tardanzas,
            COUNT(*) FILTER (WHERE a.estado = 'ausente')::int     AS ausencias,
            COUNT(*) FILTER (WHERE a.estado = 'justificada')::int AS justificadas,
            ROUND(100.0 * COUNT(*) FILTER (WHERE ${ASISTIO}) / COUNT(*))::int AS porcentaje
     FROM asistencia a
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     WHERE f.estado = 'activa' AND s.estado = 'cerrada' ${filtro}
     GROUP BY f.id_ficha
     ORDER BY porcentaje, f.numero_ficha`,
    valores
  );
  return r.rows;
}

/** Asistencia acumulada de cada aprendiz con matrícula activa, por ficha. */
async function resumenPorAprendiz(usuario) {
  const filtro = usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = usuario.rol === "instructor" ? [usuario.id] : [];
  const r = await pool.query(
    `SELECT u.id_usuario, u.nombres || ' ' || u.apellidos AS aprendiz, u.documento,
            f.id_ficha, f.numero_ficha,
            COUNT(*)::int AS clases,
            COUNT(*) FILTER (WHERE a.estado = 'ausente')::int  AS ausencias,
            COUNT(*) FILTER (WHERE a.estado = 'tardanza')::int AS tardanzas,
            ROUND(100.0 * COUNT(*) FILTER (WHERE ${ASISTIO}) / COUNT(*))::int AS porcentaje
     FROM asistencia a
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN usuario u ON u.id_usuario = a.id_aprendiz
     JOIN matricula m ON m.id_aprendiz = a.id_aprendiz AND m.id_ficha = f.id_ficha AND m.estado = 'activa'
     WHERE f.estado = 'activa' AND s.estado = 'cerrada' ${filtro}
     GROUP BY u.id_usuario, f.id_ficha
     ORDER BY porcentaje, ausencias DESC`,
    valores
  );
  return r.rows;
}

/** Porcentaje de asistencia de cada uno de los últimos `dias` días (NULL los días sin clases). */
async function tendencia(usuario, dias) {
  const filtro = usuario.rol === "instructor" ? "AND h.id_instructor = $2" : "";
  const valores = usuario.rol === "instructor" ? [dias, usuario.id] : [dias];
  const r = await pool.query(
    `WITH datos AS (
       SELECT s.fecha, a.estado
       FROM asistencia a
       JOIN sesion_clase s ON s.id_sesion = a.id_sesion
       JOIN horario h ON h.id_horario = s.id_horario
       WHERE s.estado = 'cerrada' AND s.fecha > CURRENT_DATE - $1::int ${filtro}
     )
     SELECT TO_CHAR(d, 'YYYY-MM-DD') AS fecha,
            COUNT(datos.estado)::int AS registros,
            ROUND(100.0 * COUNT(*) FILTER (WHERE datos.estado IN ('presente','tardanza','justificada'))
                  / NULLIF(COUNT(datos.estado), 0))::int AS porcentaje
     FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day') d
     LEFT JOIN datos ON datos.fecha = d::date
     GROUP BY d
     ORDER BY d`,
    valores
  );
  return r.rows;
}

module.exports = {
  buscarAsistencias,
  listarBusquedasGuardadas,
  guardarBusqueda,
  fichasDelAprendiz,
  historialFicha,
  porcentajeMinimo,
  estadisticas,
  resumenPorFicha,
  resumenPorAprendiz,
  tendencia,
};
