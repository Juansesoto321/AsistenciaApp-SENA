const servicio = require("../servicios/reportes");

// CU-17
async function buscar(req, res, next) {
  try {
    res.json(await servicio.buscar(req.query, req.usuario));
  } catch (error) {
    next(error);
  }
}

// CU-18
async function exportar(req, res, next) {
  try {
    const csv = await servicio.exportarCSV(req.query, req.usuario);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=reporte_asistencia.csv");
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

async function listarBusquedasGuardadas(req, res, next) {
  try {
    res.json(await servicio.listarBusquedasGuardadas(req.usuario.id));
  } catch (error) {
    next(error);
  }
}

async function guardarBusqueda(req, res, next) {
  try {
    const guardada = await servicio.guardarBusqueda(req.usuario.id, req.body.nombre, req.body.filtros);
    res.status(201).json(guardada);
  } catch (error) {
    next(error);
  }
}

// CU-19
async function miHistorial(req, res, next) {
  try {
    res.json(await servicio.historialAprendiz(req.usuario.id, req.query.id_ficha));
  } catch (error) {
    next(error);
  }
}

async function estadisticas(req, res, next) {
  try {
    res.json(await servicio.obtenerEstadisticas(req.usuario));
  } catch (error) {
    next(error);
  }
}

async function resumen(req, res, next) {
  try {
    res.json(await servicio.resumen(req.usuario));
  } catch (error) {
    next(error);
  }
}

async function tendencia(req, res, next) {
  try {
    res.json(await servicio.obtenerTendencia(req.usuario, req.query.dias));
  } catch (error) {
    next(error);
  }
}

async function registrarExportacion(req, res, next) {
  try {
    await servicio.registrarExportacion(req.usuario, req.body);
    res.status(201).json({ mensaje: "Exportación registrada" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  buscar, exportar, listarBusquedasGuardadas, guardarBusqueda, miHistorial, estadisticas, resumen, tendencia, registrarExportacion,
};
