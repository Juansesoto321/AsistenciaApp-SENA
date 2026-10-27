const servicio = require("../servicios/academico");
const dispositivos = require("../servicios/dispositivos");
const { festivosDelAnio } = require("../utilidades/festivos");
const { traducirCodigos } = require("../middleware/manejadorErrores");

const FECHAS_INVALIDAS = { 23514: "La fecha fin debe ser posterior a la fecha inicio" };

async function listarPeriodos(_req, res, next) {
  try {
    res.json(await servicio.obtenerPeriodos());
  } catch (error) {
    next(error);
  }
}

async function listarInstructores(_req, res, next) {
  try {
    res.json(await servicio.obtenerInstructores());
  } catch (error) {
    next(error);
  }
}

async function crearPeriodo(req, res, next) {
  try {
    res.status(201).json(await servicio.crearPeriodo(req.body));
  } catch (error) {
    next(traducirCodigos(error, FECHAS_INVALIDAS));
  }
}

async function listarFichas(req, res, next) {
  try {
    res.json(await servicio.obtenerFichas(req.usuario));
  } catch (error) {
    next(error);
  }
}

async function crearFicha(req, res, next) {
  try {
    res.status(201).json(await servicio.crearFicha(req.body, req.usuario));
  } catch (error) {
    next(traducirCodigos(error, FECHAS_INVALIDAS));
  }
}

async function listarHorarios(req, res, next) {
  try {
    const { id_instructor, id_ficha, id_ambiente } = req.query;
    res.json(await servicio.obtenerHorarios(req.usuario, { id_instructor, id_ficha, id_ambiente }));
  } catch (error) {
    next(error);
  }
}

async function crearHorario(req, res, next) {
  try {
    res.status(201).json(await servicio.crearHorario(req.body, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function editarHorario(req, res, next) {
  try {
    res.json(await servicio.editarHorario(req.params.id, req.body, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function eliminarHorario(req, res, next) {
  try {
    await servicio.eliminarHorario(req.params.id, req.usuario);
    res.json({ mensaje: "Horario eliminado" });
  } catch (error) {
    next(traducirCodigos(error, {
      23503: "No se puede eliminar: ya existen sesiones de clase registradas para este horario",
    }));
  }
}

// ---------- MATRICULAS (CU-06) ----------
async function listarMatriculas(req, res, next) {
  try {
    res.json(await servicio.obtenerMatriculasDeFicha(req.params.id, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function matricular(req, res, next) {
  try {
    res.json(await servicio.matricularAprendices(req.params.id, req.body.ids_aprendices, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function cambiarEstadoMatricula(req, res, next) {
  try {
    await servicio.cambiarEstadoMatricula(req.params.id, req.body.estado, req.usuario);
    res.json({ mensaje: "Matrícula actualizada" });
  } catch (error) {
    next(error);
  }
}

// ---------- AMBIENTES Y DISPOSITIVOS (CU-07, CU-09) ----------
async function listarAmbientes(_req, res, next) {
  try {
    res.json(await servicio.obtenerAmbientes());
  } catch (error) {
    next(error);
  }
}

async function crearAmbiente(req, res, next) {
  try {
    res.status(201).json(await servicio.crearAmbiente(req.body, req.usuario));
  } catch (error) {
    next(traducirCodigos(error, { 23503: "El periodo indicado no existe" }));
  }
}

async function asociarDispositivo(req, res, next) {
  try {
    res.status(201).json(await servicio.asociarDispositivo(req.params.id, req.body, req.usuario));
  } catch (error) {
    next(traducirCodigos(error, {
      23505: "Serial duplicado o el ambiente ya tiene un lector asociado",
    }));
  }
}

async function listarDispositivos(_req, res, next) {
  try {
    res.json(await servicio.obtenerDispositivos());
  } catch (error) {
    next(error);
  }
}

// Asistente para conectar un lector: puerto, IP del equipo y lectores que ya llamaron
async function conexionLector(_req, res, next) {
  try {
    res.json(await dispositivos.conexionLector());
  } catch (error) {
    next(error);
  }
}

// Festivos de Colombia del año pedido, del anterior y del siguiente (calendario)
function listarFestivos(req, res) {
  const pedido = Number(req.query.anio);
  const anio = Number.isInteger(pedido) && pedido >= 2000 && pedido <= 2100 ? pedido : new Date().getFullYear();
  res.json([anio - 1, anio, anio + 1].flatMap(festivosDelAnio));
}

module.exports = {
  listarFestivos,
  listarPeriodos,
  listarInstructores,
  crearPeriodo,
  listarFichas,
  crearFicha,
  listarHorarios,
  crearHorario,
  editarHorario,
  eliminarHorario,
  listarMatriculas,
  matricular,
  cambiarEstadoMatricula,
  listarAmbientes,
  crearAmbiente,
  asociarDispositivo,
  listarDispositivos,
  conexionLector,
};
