const pool = require("../config/db");

// La marca ($2) cae entre (inicio - $3 min) y (fin + $4 min) del horario de la
// clase. Antes bastaba con que la sesión estuviera abierta: una clase de 12:00
// iniciada a las 9:57 se quedaba con las huellas de las 9:57.
const EN_VENTANA = `$2::timestamptz BETWEEN (s.fecha + h.hora_inicio) - make_interval(mins => $3::int)
                                      AND (s.fecha + h.hora_fin) + make_interval(mins => $4::int)`;

// Si dos clases del ambiente aceptan la marca (una sin cerrar y la siguiente ya
// abierta), gana la de la ficha del aprendiz ($5 = documento; sin él no influye)
const PRIMERO_SU_FICHA = `EXISTS (SELECT 1 FROM matricula m JOIN usuario u ON u.id_usuario = m.id_aprendiz
                                 WHERE m.id_ficha = h.id_ficha AND m.estado = 'activa' AND u.documento = $5::text) DESC`;

async function buscarSesionActivaEnAmbiente(idAmbiente, momento, { antes, despues }, documento = null) {
  const r = await pool.query(
    `SELECT s.id_sesion, s.estado, s.fecha, s.hora_apertura, h.id_ficha, h.hora_inicio
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE h.id_ambiente = $1 AND s.fecha = CURRENT_DATE AND s.estado = 'activa'
       AND ${EN_VENTANA}
     ORDER BY ${PRIMERO_SU_FICHA}, s.hora_apertura DESC LIMIT 1`,
    [idAmbiente, momento, antes, despues, documento]
  );
  return r.rows[0] || null;
}

/**
 * La sesión que estaba abierta en el ambiente en el momento de la marca, esté
 * activa o ya cerrada. Sirve para las marcas que el lector reenvía tarde.
 */
async function buscarSesionEnAmbienteAl(idAmbiente, momento, { antes, despues }, documento = null) {
  const r = await pool.query(
    `SELECT s.id_sesion, s.estado, s.fecha, s.hora_apertura, h.id_ficha, h.hora_inicio
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE h.id_ambiente = $1
       AND s.fecha = $2::timestamptz::date
       AND s.hora_apertura <= $2
       AND (s.hora_cierre IS NULL OR s.hora_cierre >= $2)
       AND ${EN_VENTANA}
     ORDER BY ${PRIMERO_SU_FICHA}, s.hora_apertura DESC LIMIT 1`,
    [idAmbiente, momento, antes, despues, documento]
  );
  return r.rows[0] || null;
}

/** La clase abierta ahora en el ambiente, sin mirar la hora: para explicar por qué se rechazó una marca. */
async function buscarSesionAbiertaEnAmbiente(idAmbiente) {
  const r = await pool.query(
    `SELECT s.id_sesion, h.hora_inicio, h.hora_fin
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE h.id_ambiente = $1 AND s.fecha = CURRENT_DATE AND s.estado = 'activa'
     ORDER BY s.hora_apertura DESC LIMIT 1`,
    [idAmbiente]
  );
  return r.rows[0] || null;
}

// Para el protocolo simulado (/api/lector): matching 1:N contra las plantillas cifradas
async function buscarPlantillasDeFicha(idFicha) {
  const r = await pool.query(
    `SELECT pb.*, u.id_usuario, u.nombres, u.apellidos
     FROM plantilla_biometrica pb
     JOIN usuario u ON u.id_usuario = pb.id_aprendiz
     JOIN matricula m ON m.id_aprendiz = u.id_usuario AND m.estado = 'activa'
     WHERE m.id_ficha = $1`,
    [idFicha]
  );
  return r.rows;
}

// Para el protocolo real ADMS: el dispositivo ya identifico, llega el PIN=documento
async function buscarAprendizPorDocumentoEnFicha(documento, idFicha) {
  const r = await pool.query(
    `SELECT u.id_usuario, u.nombres, u.apellidos
     FROM usuario u
     JOIN matricula m ON m.id_aprendiz = u.id_usuario AND m.estado = 'activa'
     WHERE u.documento = $1 AND m.id_ficha = $2`,
    [documento, idFicha]
  );
  return r.rows[0] || null;
}

async function obtenerTolerancia() {
  const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'minutos_tolerancia'");
  return Number(r.rows[0]?.valor || 15);
}

// UNIQUE (id_sesion, id_aprendiz) evita duplicados - regla CU-13 A2
async function insertarAsistencia(idSesion, idAprendiz, estado, horaMarca, cliente = pool) {
  const r = await cliente.query(
    `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, hora_marca, metodo)
     VALUES ($1,$2,$3,$4,'huella')
     ON CONFLICT (id_sesion, id_aprendiz) DO NOTHING
     RETURNING id_asistencia`,
    [idSesion, idAprendiz, estado, horaMarca]
  );
  return r.rows[0]?.id_asistencia || null;
}

/** Bloquea la fila mientras se decide si una marca atrasada la corrige. */
async function buscarAsistenciaParaCorregir(cliente, idSesion, idAprendiz) {
  const r = await cliente.query(
    `SELECT id_asistencia, estado, metodo FROM asistencia
     WHERE id_sesion = $1 AND id_aprendiz = $2 FOR UPDATE`,
    [idSesion, idAprendiz]
  );
  return r.rows[0] || null;
}

/**
 * Cambia un "ausente" que puso el sistema al cerrar la clase por lo que dice
 * la marca del lector. Deja el cambio en el historial (cambiado_por NULL = el
 * lector) y borra el enlace de justificación que el aprendiz aún no usó.
 */
async function corregirAusenciaConMarca(cliente, { idAsistencia, estado, horaMarca, motivo }) {
  await cliente.query(
    `UPDATE asistencia SET estado = $2, hora_marca = $3, metodo = 'huella', observacion = $4
     WHERE id_asistencia = $1`,
    [idAsistencia, estado, horaMarca, motivo]
  );
  await cliente.query(
    `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por)
     VALUES ($1, 'ausente', $2, $3, NULL)`,
    [idAsistencia, estado, motivo]
  );
  await cliente.query("DELETE FROM justificacion WHERE id_asistencia = $1 AND estado = 'pendiente'", [idAsistencia]);
}

async function notificar(cliente, idUsuario, titulo, mensaje) {
  await cliente.query(
    "INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje) VALUES ($1, 'asistencia', $2, $3)",
    [idUsuario, titulo, mensaje]
  );
}

module.exports = {
  buscarSesionActivaEnAmbiente,
  buscarSesionEnAmbienteAl,
  buscarSesionAbiertaEnAmbiente,
  buscarPlantillasDeFicha,
  buscarAprendizPorDocumentoEnFicha,
  obtenerTolerancia,
  insertarAsistencia,
  buscarAsistenciaParaCorregir,
  corregirAusenciaConMarca,
  notificar,
};
