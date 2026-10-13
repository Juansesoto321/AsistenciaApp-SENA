const servicio = require("../servicios/auditoria");

async function listar(req, res, next) {
  try {
    const { texto, accion, desde, hasta, limite } = req.query;
    res.json(await servicio.listar({ texto, accion, desde, hasta, limite }));
  } catch (error) {
    next(error);
  }
}

module.exports = { listar };
