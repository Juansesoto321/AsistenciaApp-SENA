const servicio = require("../servicios/sesiones");
const claseDemo = require("../servicios/claseDemo");

async function horariosDeHoy(req, res, next) {
  try {
    res.json(await servicio.horariosDeHoy(req.usuario));
  } catch (error) {
    next(error);
  }
}

async function historialDeClases(req, res, next) {
  try {
    res.json(await servicio.historialDeClases(req.usuario, req.query.dias));
  } catch (error) {
    next(error);
  }
}

async function iniciarSesion(req, res, next) {
  try {
    res.json(await servicio.iniciarSesion(req.body.id_horario, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function verDetalle(req, res, next) {
  try {
    res.json(await servicio.verDetalle(req.params.id, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function registrarAsistenciaManual(req, res, next) {
  try {
    res.json(await servicio.registrarAsistenciaManual(req.params.id, req.usuario, req.body));
  } catch (error) {
    next(error);
  }
}

async function cerrarSesion(req, res, next) {
  try {
    res.json(await servicio.cerrarSesion(req.params.id, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function eliminarSesion(req, res, next) {
  try {
    res.json(await servicio.eliminarSesion(req.params.id, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function estadoClaseDemo(req, res, next) {
  try {
    res.json(await claseDemo.estado());
  } catch (error) {
    next(error);
  }
}

async function reiniciarClaseDemo(req, res, next) {
  try {
    res.json(await claseDemo.reiniciar(req.usuario));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  historialDeClases, horariosDeHoy, iniciarSesion, verDetalle, registrarAsistenciaManual, cerrarSesion, eliminarSesion,
  estadoClaseDemo, reiniciarClaseDemo,
};
