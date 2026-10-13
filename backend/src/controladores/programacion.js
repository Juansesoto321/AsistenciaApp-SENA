const servicio = require("../servicios/programacion");

async function obtenerPlan(req, res, next) {
  try {
    res.json(await servicio.obtenerPlan(req.params.id, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function programar(req, res, next) {
  try {
    res.status(201).json(await servicio.programar(req.params.id, req.body, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function quitar(req, res, next) {
  try {
    await servicio.quitar(req.params.id, req.usuario);
    res.json({ mensaje: "Competencia quitada del trimestre" });
  } catch (error) {
    next(error);
  }
}

async function cambiarTrimestres(req, res, next) {
  try {
    await servicio.cambiarTrimestres(req.params.id, req.body.trimestres, req.usuario);
    res.json({ mensaje: "Número de trimestres actualizado" });
  } catch (error) {
    next(error);
  }
}

module.exports = { obtenerPlan, programar, quitar, cambiarTrimestres };
