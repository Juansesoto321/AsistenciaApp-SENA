const pool = require("../config/db");

async function buscarFicha(idFicha) {
  const r = await pool.query(
    `SELECT id_ficha, numero_ficha, programa, fecha_inicio, fecha_fin, trimestres, estado, id_instructor
     FROM ficha WHERE id_ficha = $1`,
    [idFicha]
  );
  return r.rows[0] || null;
}

/** Fechas de cada trimestre de la ficha (misma regla que la vista horario_vigencia). */
async function fechasTrimestres(idFicha) {
  const r = await pool.query(
    `SELECT n AS trimestre,
            (f.fecha_inicio + make_interval(months => (n - 1) * 3))::date AS desde,
            (f.fecha_inicio + make_interval(months => n * 3))::date - 1 AS hasta
     FROM ficha f CROSS JOIN generate_series(1, f.trimestres) AS n
     WHERE f.id_ficha = $1
     ORDER BY n`,
    [idFicha]
  );
  return r.rows;
}

async function listarPorFicha(idFicha) {
  const r = await pool.query(
    `SELECT p.id_programacion, p.trimestre, p.id_competencia, p.id_instructor,
            c.codigo AS codigo_competencia, c.nombre AS competencia,
            u.nombres || ' ' || u.apellidos AS instructor,
            (SELECT COUNT(*)::int FROM resultado_aprendizaje r WHERE r.id_competencia = c.id_competencia) AS total_raps
     FROM programacion_trimestre p
     JOIN competencia c ON c.id_competencia = p.id_competencia
     JOIN usuario u ON u.id_usuario = p.id_instructor
     WHERE p.id_ficha = $1
     ORDER BY p.trimestre, c.nombre, instructor`,
    [idFicha]
  );
  return r.rows;
}

async function esInstructor(idUsuario) {
  const r = await pool.query("SELECT 1 FROM usuario WHERE id_usuario = $1 AND rol = 'instructor'", [idUsuario]);
  return !!r.rows[0];
}

async function crear({ idFicha, trimestre, idCompetencia, idInstructor }) {
  const r = await pool.query(
    `INSERT INTO programacion_trimestre (id_ficha, trimestre, id_competencia, id_instructor)
     VALUES ($1, $2, $3, $4) RETURNING id_programacion`,
    [idFicha, trimestre, idCompetencia, idInstructor]
  );
  return r.rows[0].id_programacion;
}

async function eliminar(idProgramacion) {
  const r = await pool.query(
    "DELETE FROM programacion_trimestre WHERE id_programacion = $1 RETURNING id_ficha",
    [idProgramacion]
  );
  return r.rows[0] || null;
}

async function cambiarTrimestres(idFicha, trimestres) {
  const r = await pool.query(
    "UPDATE ficha SET trimestres = $1 WHERE id_ficha = $2 RETURNING id_ficha",
    [trimestres, idFicha]
  );
  return r.rows[0] || null;
}

/** Programaciones que quedarían por fuera si la ficha pasa a tener menos trimestres. */
async function contarDespuesDe(idFicha, trimestre) {
  const r = await pool.query(
    "SELECT COUNT(*)::int AS total FROM programacion_trimestre WHERE id_ficha = $1 AND trimestre > $2",
    [idFicha, trimestre]
  );
  return r.rows[0].total;
}

module.exports = { buscarFicha, fechasTrimestres, listarPorFicha, esInstructor, crear, eliminar, cambiarTrimestres, contarDespuesDe };
