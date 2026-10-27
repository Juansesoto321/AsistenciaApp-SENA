const pool = require("../config/db");
const sesiones = require("./sesiones");

// Qué horario es la clase de demostración. Se guarda en configuracion para
// encontrarlo y borrarlo al reiniciar sin tocar ningún otro horario.
const CLAVE = "clase_demo_horario";

async function buscarDemo(cliente = pool) {
  const r = await cliente.query(
    `SELECT h.id_horario, h.id_ficha, h.id_instructor, h.hora_inicio, h.hora_fin, f.numero_ficha
     FROM configuracion c
     JOIN horario h ON h.id_horario::text = c.valor
     JOIN ficha f ON f.id_ficha = h.id_ficha
     WHERE c.clave = $1`,
    [CLAVE]
  );
  return r.rows[0] || null;
}

/**
 * La ficha de la demostración: la del instructor que la reinicia; para la
 * coordinación, la de la demostración anterior o la primera activa. Siempre
 * con aprendices matriculados, que son los que van a marcar.
 */
async function buscarFicha(cliente, { idInstructor = null, idFichaPreferida = null }) {
  const r = await cliente.query(
    `SELECT f.id_ficha, f.numero_ficha, f.id_instructor, f.id_periodo
     FROM ficha f
     WHERE f.estado = 'activa'
       AND ($1::int IS NULL OR f.id_instructor = $1)
       AND EXISTS (SELECT 1 FROM matricula m WHERE m.id_ficha = f.id_ficha AND m.estado = 'activa')
     ORDER BY (f.id_ficha = $2) DESC, f.id_ficha
     LIMIT 1`,
    [idInstructor, idFichaPreferida]
  );
  return r.rows[0] || null;
}

/**
 * El ambiente donde está el lector, para que las huellas lleguen a esta clase:
 * primero el que está en línea o el que habló más reciente. Sin lectores, el
 * ambiente donde la ficha suele tener clase.
 */
async function buscarAmbiente(cliente, idFicha) {
  const conLector = await cliente.query(
    `SELECT a.id_ambiente, a.numero_ambiente, d.estado AS estado_lector
     FROM dispositivo d
     JOIN ambiente a ON a.id_ambiente = d.id_ambiente
     WHERE a.estado = 'activo'
     ORDER BY (d.estado = 'en_linea') DESC, d.ultimo_heartbeat DESC NULLS LAST, d.id_dispositivo
     LIMIT 1`
  );
  if (conLector.rows[0]) return conLector.rows[0];

  const habitual = await cliente.query(
    `SELECT a.id_ambiente, a.numero_ambiente, NULL AS estado_lector
     FROM ambiente a
     LEFT JOIN horario h ON h.id_ambiente = a.id_ambiente AND h.id_ficha = $1
     WHERE a.estado = 'activo'
     GROUP BY a.id_ambiente
     ORDER BY COUNT(h.id_horario) DESC, a.id_ambiente
     LIMIT 1`,
    [idFicha]
  );
  return habitual.rows[0] || null;
}

/**
 * Borra la demostración anterior: sus clases con la asistencia, los cambios y
 * las justificaciones (ver sesiones.eliminarSesion), los avisos que generó
 * (inasistencia al aprendiz, justificación por revisar al instructor) y el
 * horario. Nada fuera de ese horario.
 */
async function borrarDemo(cliente, demo, textoClase) {
  const ids = await cliente.query(
    `SELECT s.id_sesion, s.hora_apertura, j.id_justificacion
     FROM sesion_clase s
     LEFT JOIN asistencia a ON a.id_sesion = s.id_sesion
     LEFT JOIN justificacion j ON j.id_asistencia = a.id_asistencia
     WHERE s.id_horario = $1`,
    [demo.id_horario]
  );
  const idSesiones = [...new Set(ids.rows.map((f) => f.id_sesion))];
  const enlaces = ids.rows.filter((f) => f.id_justificacion).map((f) => `/justificaciones?id=${f.id_justificacion}`);

  if (idSesiones.length) {
    // El aviso de inasistencia no guarda la clase: se reconoce por su texto,
    // "(hh:mm–hh:mm, ficha N)", y solo desde que se abrió la primera clase
    const desde = ids.rows.reduce((min, f) => (f.hora_apertura < min ? f.hora_apertura : min), ids.rows[0].hora_apertura);
    await cliente.query(
      `DELETE FROM notificacion
       WHERE (tipo = 'inasistencia' AND creado_en >= $1 AND strpos(mensaje, $2) > 0
              AND id_usuario IN (SELECT id_aprendiz FROM matricula WHERE id_ficha = $3))
          OR (tipo = 'justificacion' AND enlace = ANY($4::text[]))`,
      [desde, textoClase, demo.id_ficha, enlaces]
    );
  }
  for (const id of idSesiones) await sesiones.eliminarSesion(cliente, id);
  await cliente.query("DELETE FROM horario WHERE id_horario = $1", [demo.id_horario]);
  return idSesiones.length;
}

/**
 * Horario de un solo día (hoy) que empieza en este minuto y dura dos horas, o
 * hasta las 23:59. Copia la competencia de otra clase de la ficha para que la
 * coordinación no la vea como "clase sin competencia". Se dicta aunque sea
 * festivo: la demostración puede caer cualquier día.
 */
async function crearHorario(cliente, { ficha, idAmbiente }) {
  const r = await cliente.query(
    `WITH inicio AS (SELECT LEAST(date_trunc('minute', LOCALTIME)::time, TIME '23:00') AS hora)
     INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin,
                          id_competencia, fecha_desde, fecha_hasta, excluir_festivos)
     SELECT $1, $2, $3, $4, EXTRACT(DOW FROM CURRENT_DATE), i.hora,
            CASE WHEN i.hora >= TIME '21:59' THEN TIME '23:59' ELSE i.hora + INTERVAL '2 hours' END,
            (SELECT id_competencia FROM horario WHERE id_ficha = $1 AND id_competencia IS NOT NULL
             ORDER BY id_horario LIMIT 1),
            CURRENT_DATE, CURRENT_DATE, FALSE
     FROM inicio i
     RETURNING id_horario, hora_inicio, hora_fin`,
    [ficha.id_ficha, idAmbiente, ficha.id_instructor, ficha.id_periodo]
  );
  return r.rows[0];
}

/** El periodo de la ficha tiene que incluir hoy; si no, la clase no saldría en "hoy". */
async function esVigenteHoy(cliente, idHorario) {
  const r = await cliente.query(
    "SELECT 1 FROM horario_vigencia WHERE id_horario = $1 AND CURRENT_DATE BETWEEN vigente_desde AND vigente_hasta",
    [idHorario]
  );
  return r.rowCount > 0;
}

async function guardarDemo(cliente, idHorario) {
  await cliente.query(
    "INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = $2",
    [CLAVE, String(idHorario)]
  );
}

module.exports = { CLAVE, buscarDemo, buscarFicha, buscarAmbiente, borrarDemo, crearHorario, esVigenteHoy, guardarDemo };
