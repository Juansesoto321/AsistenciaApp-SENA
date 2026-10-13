const pool = require("../config/db");

async function finalizarFichasVencidas() {
  await pool.query(
    `WITH fichas_finalizadas AS (
       UPDATE ficha SET estado = 'finalizada'
       WHERE estado = 'activa' AND fecha_fin < CURRENT_DATE
       RETURNING id_ficha
     )
     UPDATE matricula SET estado = 'finalizada'
     WHERE estado = 'activa' AND id_ficha IN (SELECT id_ficha FROM fichas_finalizadas)`
  );
}

async function listarPeriodos() {
  const resultado = await pool.query("SELECT * FROM periodo ORDER BY fecha_inicio DESC");
  return resultado.rows;
}

async function listarInstructores() {
  const resultado = await pool.query(
    "SELECT id_usuario, nombres, apellidos FROM usuario WHERE rol = 'instructor' AND estado = 'activo' ORDER BY apellidos, nombres"
  );
  return resultado.rows;
}

async function listarFichas(usuario) {
  await finalizarFichasVencidas();
  // El instructor ve las fichas donde es titular y aquellas donde dicta alguna clase
  const filtro = usuario.rol === "instructor"
    ? "WHERE f.id_instructor = $1 OR EXISTS (SELECT 1 FROM horario h WHERE h.id_ficha = f.id_ficha AND h.id_instructor = $1)"
    : "";
  const valores = usuario.rol === "instructor" ? [usuario.id] : [];
  const resultado = await pool.query(
    `SELECT f.*, p.nombre AS periodo,
            u.nombres || ' ' || u.apellidos AS instructor,
            (SELECT COUNT(*) FROM matricula m WHERE m.id_ficha = f.id_ficha AND m.estado = 'activa') AS total_aprendices
     FROM ficha f
     JOIN periodo p ON p.id_periodo = f.id_periodo
     JOIN usuario u ON u.id_usuario = f.id_instructor
     ${filtro}
     ORDER BY f.id_ficha DESC`,
    valores
  );
  return resultado.rows;
}

async function crearPeriodo(datos) {
  const resultado = await pool.query(
    "INSERT INTO periodo (nombre, fecha_inicio, fecha_fin) VALUES ($1,$2,$3) RETURNING *",
    [datos.nombre, datos.fecha_inicio, datos.fecha_fin]
  );
  return resultado.rows[0];
}

async function crearFicha(datos) {
  const resultado = await pool.query(
    `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor, trimestres)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, 7)) RETURNING *`,
    [datos.numero_ficha, datos.programa, datos.jornada, datos.fecha_inicio, datos.fecha_fin, datos.id_periodo,
     datos.id_instructor, datos.trimestres || null]
  );
  return resultado.rows[0];
}

/**
 * `filtros` permite acotar por instructor, ficha o ambiente (el calendario exige
 * elegir uno antes de mostrar nada). El instructor y el aprendiz siempre quedan
 * limitados a lo suyo, sin importar los filtros que envíen.
 */
async function listarHorarios(usuario, filtros = {}) {
  const condiciones = [];
  const valores = [];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replace("?", `$${valores.length}`));
  };

  if (usuario.rol === "instructor") agregar("h.id_instructor = ?", usuario.id);
  // El aprendiz ("Mi horario") solo ve las clases de las fichas donde está matriculado
  else if (usuario.rol === "aprendiz")
    agregar("h.id_ficha IN (SELECT id_ficha FROM matricula WHERE id_aprendiz = ? AND estado = 'activa')", usuario.id);
  else if (filtros.id_instructor) agregar("h.id_instructor = ?", filtros.id_instructor);
  if (filtros.id_ficha) agregar("h.id_ficha = ?", filtros.id_ficha);
  if (filtros.id_ambiente) agregar("h.id_ambiente = ?", filtros.id_ambiente);

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const resultado = await pool.query(
    `SELECT h.*, f.numero_ficha, f.programa, a.numero_ambiente, a.sede_centro,
            u.nombres || ' ' || u.apellidos AS instructor,
            rap.codigo AS codigo_rap, rap.nombre AS resultado_aprendizaje,
            c.nombre AS competencia, t.nombre AS tematica,
            p.nombre AS periodo, p.fecha_inicio AS periodo_inicio, p.fecha_fin AS periodo_fin
     FROM horario h
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN ambiente a ON a.id_ambiente = h.id_ambiente
     JOIN usuario u ON u.id_usuario = h.id_instructor
     JOIN periodo p ON p.id_periodo = h.id_periodo
     LEFT JOIN resultado_aprendizaje rap ON rap.id_rap = h.id_rap
     LEFT JOIN competencia c ON c.id_competencia = rap.id_competencia
     LEFT JOIN tematica t ON t.id_tematica = h.id_tematica
     ${where}
     ORDER BY h.dia_semana, h.hora_inicio`,
    valores
  );
  return resultado.rows;
}

/** `idExcluir` evita que un horario choque consigo mismo al editarlo. */
async function buscarConflictoHorario(datos, idExcluir = null) {
  const resultado = await pool.query(
    `SELECT h.id_horario, f.numero_ficha,
            CASE WHEN h.id_instructor = $1 THEN 'instructor' ELSE 'ambiente' END AS tipo
     FROM horario h JOIN ficha f ON f.id_ficha = h.id_ficha
     WHERE h.dia_semana = $3
       AND (h.id_instructor = $1 OR h.id_ambiente = $2)
       AND (h.hora_inicio, h.hora_fin) OVERLAPS ($4::time, $5::time)
       AND ($6::int IS NULL OR h.id_horario <> $6)
     LIMIT 1`,
    [datos.id_instructor, datos.id_ambiente, datos.dia_semana, datos.hora_inicio, datos.hora_fin, idExcluir]
  );
  return resultado.rows[0];
}

async function buscarHorario(id) {
  const resultado = await pool.query("SELECT * FROM horario WHERE id_horario = $1", [id]);
  return resultado.rows[0] || null;
}

async function editarHorario(id, datos) {
  const resultado = await pool.query(
    `UPDATE horario SET id_ficha = $1, id_ambiente = $2, id_instructor = $3,
            id_periodo = $4, dia_semana = $5, hora_inicio = $6, hora_fin = $7,
            id_rap = $8, id_tematica = $9
     WHERE id_horario = $10 RETURNING *`,
    [datos.id_ficha, datos.id_ambiente, datos.id_instructor, datos.id_periodo,
     datos.dia_semana, datos.hora_inicio, datos.hora_fin,
     datos.id_rap || null, datos.id_tematica || null, id]
  );
  return resultado.rows[0] || null;
}

async function crearHorario(datos) {
  const resultado = await pool.query(
    `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana,
                          hora_inicio, hora_fin, id_rap, id_tematica)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [datos.id_ficha, datos.id_ambiente, datos.id_instructor, datos.id_periodo, datos.dia_semana,
     datos.hora_inicio, datos.hora_fin, datos.id_rap || null, datos.id_tematica || null]
  );
  return resultado.rows[0];
}

async function eliminarHorario(id) {
  const resultado = await pool.query("DELETE FROM horario WHERE id_horario = $1 RETURNING id_horario", [id]);
  return resultado.rows[0] || null;
}

async function instructorDictaEnFicha(idFicha, idInstructor) {
  const resultado = await pool.query(
    `SELECT 1 FROM ficha WHERE id_ficha = $1 AND id_instructor = $2
     UNION ALL
     SELECT 1 FROM horario WHERE id_ficha = $1 AND id_instructor = $2
     LIMIT 1`,
    [idFicha, idInstructor]
  );
  return !!resultado.rows[0];
}

// ---------- MATRICULAS (CU-06) ----------
async function listarMatriculasDeFicha(idFicha) {
  const resultado = await pool.query(
    `SELECT m.id_matricula, m.estado, m.fecha_matricula,
            u.id_usuario, u.nombres, u.apellidos, u.documento, u.correo,
            (pb.id_plantilla IS NOT NULL) AS tiene_huella
     FROM matricula m
     JOIN usuario u ON u.id_usuario = m.id_aprendiz
     LEFT JOIN plantilla_biometrica pb ON pb.id_aprendiz = u.id_usuario
     WHERE m.id_ficha = $1 ORDER BY u.apellidos`,
    [idFicha]
  );
  return resultado.rows;
}

/** Solo matricula usuarios con rol aprendiz; devuelve null si no lo es. */
async function matricularAprendiz(idAprendiz, idFicha) {
  const resultado = await pool.query(
    `INSERT INTO matricula (id_aprendiz, id_ficha)
     SELECT id_usuario, $2 FROM usuario WHERE id_usuario = $1 AND rol = 'aprendiz'
     RETURNING id_matricula`,
    [idAprendiz, idFicha]
  );
  return resultado.rows[0] || null;
}

async function cambiarEstadoMatricula(id, estado) {
  const resultado = await pool.query(
    "UPDATE matricula SET estado = $1 WHERE id_matricula = $2 RETURNING id_matricula",
    [estado, id]
  );
  return resultado.rows[0] || null;
}

// ---------- AMBIENTES Y DISPOSITIVOS (CU-07, CU-09) ----------
async function listarAmbientes() {
  const resultado = await pool.query(
    `SELECT a.*, d.id_dispositivo, d.serial, d.modelo, d.estado AS estado_dispositivo, d.ultimo_heartbeat
     FROM ambiente a LEFT JOIN dispositivo d ON d.id_ambiente = a.id_ambiente
     ORDER BY a.numero_ambiente`
  );
  return resultado.rows;
}

async function crearAmbiente({ numero_ambiente, sede_centro, id_periodo }) {
  const resultado = await pool.query(
    "INSERT INTO ambiente (numero_ambiente, sede_centro, id_periodo) VALUES ($1,$2,$3) RETURNING *",
    [numero_ambiente, sede_centro, id_periodo || null]
  );
  return resultado.rows[0];
}

async function crearDispositivo({ idAmbiente, serial, modelo, claveApi }) {
  const resultado = await pool.query(
    `INSERT INTO dispositivo (serial, modelo, id_ambiente, clave_api, estado)
     VALUES ($1,$2,$3,$4,'no_verificado') RETURNING id_dispositivo, serial, modelo, estado`,
    [serial, modelo || "ZKTeco SenseFace 2A (simulado)", idAmbiente, claveApi]
  );
  return resultado.rows[0];
}

async function listarDispositivos() {
  const resultado = await pool.query(
    `SELECT d.id_dispositivo, d.serial, d.modelo, d.estado, d.ultimo_heartbeat,
            a.numero_ambiente, a.sede_centro
     FROM dispositivo d LEFT JOIN ambiente a ON a.id_ambiente = d.id_ambiente
     ORDER BY d.serial`
  );
  return resultado.rows;
}

module.exports = {
  finalizarFichasVencidas,
  listarPeriodos,
  listarInstructores,
  listarFichas,
  crearPeriodo,
  crearFicha,
  listarHorarios,
  buscarConflictoHorario,
  buscarHorario,
  crearHorario,
  editarHorario,
  eliminarHorario,
  instructorDictaEnFicha,
  listarMatriculasDeFicha,
  matricularAprendiz,
  cambiarEstadoMatricula,
  listarAmbientes,
  crearAmbiente,
  crearDispositivo,
  listarDispositivos,
};
