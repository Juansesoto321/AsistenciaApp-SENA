const pool = require("../config/db");

async function insertar({ idUsuario, accion, entidad, idEntidad, detalle }) {
  await pool.query(
    `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
     VALUES ($1,$2,$3,$4,$5)`,
    [idUsuario, accion, entidad, idEntidad, detalle ? JSON.stringify(detalle) : null]
  );
}

/** Actividad registrada, la más reciente primero. `texto` busca en el nombre o el correo de quien la hizo. */
async function listar({ texto, accion, desde, hasta, limite }) {
  const condiciones = [];
  const valores = [];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replaceAll("?", `$${valores.length}`));
  };

  if (texto) agregar("(u.nombres || ' ' || u.apellidos ILIKE ? OR u.correo ILIKE ?)", `%${texto}%`);
  if (accion) agregar("a.accion = ?", accion);
  if (desde) agregar("a.creado_en >= ?::date", desde);
  if (hasta) agregar("a.creado_en < ?::date + 1", hasta);

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  valores.push(limite);
  const r = await pool.query(
    `SELECT a.id_auditoria, a.accion, a.entidad, a.id_entidad, a.detalle, a.creado_en,
            u.nombres || ' ' || u.apellidos AS usuario, u.rol
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
