const servicio = require("../servicios/auth");
const { traducirCodigos } = require("../middleware/manejadorErrores");

const DUPLICADO = { 23505: "El correo o documento ya está registrado" };

async function login(req, res, next) {
  try {
    const datos = await servicio.login(req.body.correo, req.body.contrasena);
    res.json(datos);
  } catch (error) {
    next(error);
  }
}

async function renovar(req, res, next) {
  try {
    res.json(await servicio.renovarSesion(req.usuario.id));
  } catch (error) {
    next(error);
  }
}

async function registro(req, res, next) {
  try {
    const { nombres, apellidos, tipo_documento, documento, correo, telefono, contrasena, rol } = req.body;
    await servicio.registrar({ nombres, apellidos, tipoDocumento: tipo_documento, documento, correo, telefono, contrasena, rol });
    res.status(201).json({ mensaje: "Solicitud enviada. Un coordinador aprobará tu cuenta" });
  } catch (error) {
    next(traducirCodigos(error, DUPLICADO));
  }
}

async function recuperar(req, res, next) {
  try {
    await servicio.solicitarRecuperacion(req.body.correo);
    res.json({ mensaje: "Si el correo existe, recibirás un enlace de recuperación" });
  } catch (error) {
    next(error);
  }
}

async function restablecer(req, res, next) {
  try {
    await servicio.restablecerContrasena(req.body.token, req.body.contrasena);
    res.json({ mensaje: "Contraseña actualizada. Ya puedes iniciar sesión" });
  } catch (error) {
    next(error);
  }
}

async function verPerfil(req, res, next) {
  try {
    res.json(await servicio.obtenerPerfil(req.usuario.id));
  } catch (error) {
    next(error);
  }
}

async function actualizarPerfil(req, res, next) {
  try {
    const { telefono, contrasena_actual, contrasena_nueva } = req.body;
    await servicio.actualizarPerfil(req.usuario.id, { telefono, contrasenaActual: contrasena_actual, contrasenaNueva: contrasena_nueva });
    res.json({ mensaje: "Perfil actualizado" });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, renovar, registro, recuperar, restablecer, verPerfil, actualizarPerfil };
