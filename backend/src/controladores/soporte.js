const servicio = require("../servicios/soporte");

async function crear(req, res, next) {
  try {
    const idTicket = await servicio.crear({
      idUsuario: req.usuario.id,
      rol: req.usuario.rol,
      tipo: req.body.tipo,
      descripcion: req.body.descripcion,
      nombreArchivo: req.body.nombre_archivo,
      archivoDatos: req.body.archivo_datos,
    });
    res.status(201).json({ mensaje: `Ticket #${idTicket} registrado. Te notificaremos la respuesta`, id_ticket: idTicket });
  } catch (error) {
    next(error);
  }
}

function tipos(req, res) {
  res.json(servicio.tiposDe(req.usuario.rol));
}

async function listar(req, res, next) {
  try {
    res.json(await servicio.obtenerListado(req.usuario));
  } catch (error) {
    next(error);
  }
}

async function verCaptura(req, res, next) {
  try {
    res.json(await servicio.obtenerCaptura(Number(req.params.id), req.usuario));
  } catch (error) {
    next(error);
  }
}

async function cambiarEstado(req, res, next) {
  try {
    await servicio.cambiarEstado(req.params.id, req.body.estado);
    res.json({ mensaje: "Ticket actualizado" });
  } catch (error) {
    next(error);
  }
}

module.exports = { tipos, crear, listar, verCaptura, cambiarEstado };
