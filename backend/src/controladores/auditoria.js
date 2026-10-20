const servicio = require("../servicios/auditoria");

async function listar(req, res, next) {
  try {
    const { texto, accion, desde, hasta, sin_login: sinLogin, limite } = req.query;
    res.json(await servicio.listar({ texto, accion, desde, hasta, sinLogin: sinLogin === "1", limite }));
  } catch (error) {
    next(error);
  }
}

async function registrarExportacion(req, res, next) {
  try {
    await servicio.registrarExportacion(req.usuario, req.body || {});
    res.status(201).json({ mensaje: "Exportación registrada" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, registrarExportacion };
