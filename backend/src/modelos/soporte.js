const pool = require("../config/db");

async function crearTicket({ idUsuario, tipo, descripcion, nombreArchivo, archivoDatos }) {
  const r = await pool.query(
    `INSERT INTO ticket_soporte (id_usuario, tipo, descripcion, nombre_archivo, archivo_datos)
     VALUES ($1,$2,$3,$4,$5) RETURNING id_ticket`,
    [idUsuario, tipo, descripcion, nombreArchivo || null, archivoDatos || null]
  );
  return r.rows[0].id_ticket;
}

// Coordinador y programador atienden los tickets: los dos deben enterarse
async function notificarCoordinadores(idTicket, tipo) {
  await pool.query(
    `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje, enlace)
     SELECT id_usuario, 'soporte', 'Nuevo ticket de soporte', 'Ticket #' || $1 || ': ' || $2, '/soporte'
     FROM usuario WHERE rol IN ('coordinador', 'programador') AND estado = 'activo'`,
    [idTicket, tipo]
  );
}

// La captura no viaja en el listado (puede pesar varios MB): se pide aparte
async function listar(idUsuario, esCoordinador) {
  const r = await pool.query(
    `SELECT t.id_ticket, t.id_usuario, t.tipo, t.descripcion, t.estado, t.creado_en, t.nombre_archivo,
            (t.archivo_datos IS NOT NULL) AS tiene_captura,
            u.nombres || ' ' || u.apellidos AS usuario
     FROM ticket_soporte t JOIN usuario u ON u.id_usuario = t.id_usuario
     ${esCoordinador ? "" : "WHERE t.id_usuario = $1"} ORDER BY t.creado_en DESC`,
    esCoordinador ? [] : [idUsuario]
  );
  return r.rows;
}

async function buscarCaptura(idTicket) {
  const r = await pool.query(
    "SELECT id_usuario, nombre_archivo, archivo_datos FROM ticket_soporte WHERE id_ticket = $1",
    [idTicket]
  );
  return r.rows[0] || null;
}

async function actualizarEstado(idTicket, estado) {
  const r = await pool.query(
    "UPDATE ticket_soporte SET estado = $1 WHERE id_ticket = $2 RETURNING id_ticket",
    [estado, idTicket]
  );
  return r.rows[0] || null;
}

module.exports = { crearTicket, notificarCoordinadores, listar, buscarCaptura, actualizarEstado };
