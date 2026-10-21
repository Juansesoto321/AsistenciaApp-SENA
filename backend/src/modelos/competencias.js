const pool = require("../config/db");

// ---------- COMPETENCIAS ----------
async function listarCompetencias(buscar) {
  const filtro = buscar ? "WHERE c.nombre ILIKE $1 OR c.codigo ILIKE $1" : "";
  const valores = buscar ? [`%${buscar}%`] : [];
  const r = await pool.query(
    `SELECT c.id_competencia, c.codigo, c.nombre,
            COUNT(rap.id_rap)::int AS total_raps
     FROM competencia c
     LEFT JOIN resultado_aprendizaje rap ON rap.id_competencia = c.id_competencia
     ${filtro}
     GROUP BY c.id_competencia
     ORDER BY c.nombre`,
    valores
  );
  return r.rows;
}

async function buscarCompetenciaPorNombre(nombre, cliente = pool) {
  const r = await cliente.query("SELECT * FROM competencia WHERE LOWER(nombre) = LOWER($1)", [nombre]);
  return r.rows[0] || null;
}

async function crearCompetencia({ codigo, nombre }, cliente = pool) {
  const r = await cliente.query(
    "INSERT INTO competencia (codigo, nombre) VALUES ($1,$2) RETURNING *",
    [codigo || null, nombre]
  );
  return r.rows[0];
}

async function editarCompetencia(id, { codigo, nombre }) {
  const r = await pool.query(
    "UPDATE competencia SET codigo = $1, nombre = $2 WHERE id_competencia = $3 RETURNING *",
    [codigo || null, nombre, id]
  );
  return r.rows[0] || null;
}

async function eliminarCompetencia(id) {
  const r = await pool.query("DELETE FROM competencia WHERE id_competencia = $1 RETURNING id_competencia, nombre", [id]);
  return r.rows[0] || null;
}

// ---------- RESULTADOS DE APRENDIZAJE ----------
async function listarRaps(idCompetencia) {
  const filtro = idCompetencia ? "WHERE rap.id_competencia = $1" : "";
  const valores = idCompetencia ? [idCompetencia] : [];
  const r = await pool.query(
    `SELECT rap.id_rap, rap.codigo, rap.nombre, rap.id_competencia,
            c.nombre AS competencia, c.codigo AS codigo_competencia,
            COALESCE(
              JSON_AGG(JSON_BUILD_OBJECT('id_tematica', t.id_tematica, 'nombre', t.nombre)
                       ORDER BY t.nombre) FILTER (WHERE t.id_tematica IS NOT NULL),
              '[]'
            ) AS tematicas
     FROM resultado_aprendizaje rap
     JOIN competencia c ON c.id_competencia = rap.id_competencia
     LEFT JOIN tematica t ON t.id_rap = rap.id_rap
     ${filtro}
     GROUP BY rap.id_rap, c.nombre, c.codigo
     ORDER BY c.nombre, rap.codigo`,
    valores
  );
  return r.rows;
}

async function buscarRapPorCodigo(codigo, cliente = pool) {
  const r = await cliente.query("SELECT * FROM resultado_aprendizaje WHERE LOWER(codigo) = LOWER($1)", [codigo]);
  return r.rows[0] || null;
}

async function crearRap({ idCompetencia, codigo, nombre }, cliente = pool) {
  const r = await cliente.query(
    "INSERT INTO resultado_aprendizaje (id_competencia, codigo, nombre) VALUES ($1,$2,$3) RETURNING *",
    [idCompetencia, codigo, nombre]
  );
  return r.rows[0];
}

async function editarRap(id, { idCompetencia, codigo, nombre }) {
  const r = await pool.query(
    `UPDATE resultado_aprendizaje SET id_competencia = $1, codigo = $2, nombre = $3
     WHERE id_rap = $4 RETURNING *`,
    [idCompetencia, codigo, nombre, id]
  );
  return r.rows[0] || null;
}

async function eliminarRap(id) {
  const r = await pool.query("DELETE FROM resultado_aprendizaje WHERE id_rap = $1 RETURNING id_rap, 'RAP ' || codigo AS nombre", [id]);
  return r.rows[0] || null;
}

// ---------- TEMATICAS ----------
async function buscarTematica(idRap, nombre, cliente = pool) {
  const r = await cliente.query(
    "SELECT * FROM tematica WHERE id_rap = $1 AND LOWER(nombre) = LOWER($2)",
    [idRap, nombre]
  );
  return r.rows[0] || null;
}

async function crearTematica({ idRap, nombre }, cliente = pool) {
  const r = await cliente.query(
    "INSERT INTO tematica (id_rap, nombre) VALUES ($1,$2) RETURNING *",
    [idRap, nombre]
  );
  return r.rows[0];
}

async function eliminarTematica(id) {
  const r = await pool.query("DELETE FROM tematica WHERE id_tematica = $1 RETURNING id_tematica, nombre", [id]);
  return r.rows[0] || null;
}

module.exports = {
  listarCompetencias,
  buscarCompetenciaPorNombre,
  crearCompetencia,
  editarCompetencia,
  eliminarCompetencia,
  listarRaps,
  buscarRapPorCodigo,
  crearRap,
  editarRap,
  eliminarRap,
  buscarTematica,
  crearTematica,
  eliminarTematica,
};
