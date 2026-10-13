const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { urlFrontend } = require("../config/entorno");
const modelo = require("../modelos/auth");
const { enviarCorreo } = require("./correo");
const { auditar } = require("./auditoria");
const { emitirNotificacionAdmins } = require("./tiempoReal");
const { error } = require("../utilidades/errores");
const { escaparHtml } = require("../utilidades/formato");

const MAX_INTENTOS = 5; // regla CU-01: bloqueo tras 5 intentos fallidos
const MAX_CORREOS_RECUPERACION_POR_HORA = 3;
const ROLES_AUTOREGISTRO = ["aprendiz", "instructor", "programador"];
const ESTADOS_SIN_ACCESO = ["pendiente", "inactivo"];
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validarContrasena = (c) =>
  typeof c === "string" && c.length >= 8 && /[A-Z]/.test(c) && /[a-z]/.test(c) && /\d/.test(c);

const normalizarCorreo = (correo) => String(correo || "").trim().toLowerCase();

// ---- CU-01: Login ----
async function login(correo, contrasena) {
  const u = await modelo.buscarPorCorreo(normalizarCorreo(correo));
  const credencialesInvalidas = () => error("Correo o contraseña incorrectos", "credenciales");
  if (!u) throw credencialesInvalidas();

  if (u.estado === "pendiente") throw error("Tu cuenta está pendiente de aprobación por el coordinador", "cuenta_pendiente");
  if (u.estado === "inactivo") throw error("Tu cuenta está desactivada. Contacta al coordinador", "cuenta_inactiva");
  const bloqueada = u.estado === "bloqueado" && u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date();
  if (bloqueada)
    throw error("Cuenta bloqueada por intentos fallidos. Intenta más tarde o recupera tu contraseña", "cuenta_bloqueada");

  const valida = await bcrypt.compare(contrasena || "", u.contrasena_hash);
  if (!valida) {
    // Si el bloqueo ya vencio, el conteo arranca de cero (RF-02). Antes seguia
    // en 5 y el primer error despues del bloqueo volvia a bloquear la cuenta.
    const previos = u.estado === "bloqueado" ? 0 : u.intentos_fallidos;
    const intentos = previos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await modelo.registrarIntentoFallido(u.id_usuario, intentos, bloquear);
    await auditar(u.id_usuario, "intento_login_fallido");
    if (bloquear) throw error("Cuenta bloqueada por 5 intentos fallidos (15 minutos)", "credenciales");
    throw credencialesInvalidas();
  }

  await modelo.resetearIntentos(u.id_usuario);
  const token = jwt.sign(
    { id: u.id_usuario, rol: u.rol, nombres: u.nombres, apellidos: u.apellidos, correo: u.correo },
    process.env.JWT_SECRETO,
    { expiresIn: "8h" }
  );
  await auditar(u.id_usuario, "login");
  return {
    token,
    usuario: { id: u.id_usuario, nombres: u.nombres, apellidos: u.apellidos, correo: u.correo, rol: u.rol },
  };
}

// ---- CU-22: Auto-registro (queda pendiente de aprobacion) ----
async function registrar(entrada) {
  const datos = { ...entrada, correo: normalizarCorreo(entrada.correo) };
  if (!datos.nombres?.trim() || !datos.apellidos?.trim() || !String(datos.documento || "").trim())
    throw error("Nombres, apellidos y documento son obligatorios", "validacion");
  if (!FORMATO_CORREO.test(datos.correo)) throw error("Escribe un correo electrónico válido", "validacion");
  if (!ROLES_AUTOREGISTRO.includes(datos.rol))
    throw error("Rol inválido: solo aprendiz, instructor o programador", "validacion");
  if (!validarContrasena(datos.contrasena))
    throw error("La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número", "validacion");

  const hash = await bcrypt.hash(datos.contrasena, 10);
  const idUsuario = await modelo.crearUsuarioPendiente({ ...datos, hash });
  await modelo.notificarAdminsSolicitud(
    `${datos.nombres} ${datos.apellidos} (${datos.rol}) solicitó una cuenta y espera aprobación.`
  );
  emitirNotificacionAdmins();
  await auditar(idUsuario, "solicitud_registro", "usuario", idUsuario);
}

// ---- CU-02: Recuperar contrasena ----
// Respuesta siempre generica: no revelamos si el correo existe (regla CU-02 A1)
async function solicitarRecuperacion(correo) {
  const u = await modelo.buscarPorCorreo(normalizarCorreo(correo));
  if (!u) return;
  // Una cuenta sin aprobar o desactivada no puede entrar: no tiene sentido
  // enviarle un enlace (antes, al usarlo, la cuenta quedaba activa)
  if (ESTADOS_SIN_ACCESO.includes(u.estado)) return;
  // Evita que alguien use el formulario para llenar de correos la bandeja de otra persona
  if ((await modelo.contarTokensRecientes(u.id_usuario)) >= MAX_CORREOS_RECUPERACION_POR_HORA) return;
  const token = crypto.randomBytes(32).toString("hex");
  await modelo.crearTokenRecuperacion(u.id_usuario, token);
  const enlace = `${urlFrontend}/restablecer/${token}`;
  await enviarCorreo({
    para: u.correo,
    asunto: "AsistenciaApp · Recupera tu contraseña",
    html: `<p>Hola ${escaparHtml(u.nombres)},</p>
           <p>Haz clic en el siguiente enlace para restablecer tu contraseña (válido por 1 hora):</p>
           <p><a href="${enlace}">${enlace}</a></p>`,
  });
}

// ---- CU-02: Restablecer con token ----
async function restablecerContrasena(token, contrasena) {
  if (!validarContrasena(contrasena))
    throw error("La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número", "validacion");
  const registro = await modelo.buscarTokenValido(token);
  if (!registro) throw error("Enlace inválido o expirado. Solicita uno nuevo", "validacion");
  const hash = await bcrypt.hash(contrasena, 10);
  await modelo.restablecerContrasena(registro.id_usuario, hash);
  await modelo.marcarTokenUsado(registro.id_token);
  await auditar(registro.id_usuario, "restablecer_contrasena");
}

// ---- CU-03: Ver y actualizar perfil ----
async function obtenerPerfil(idUsuario) {
  return modelo.obtenerPerfil(idUsuario);
}

async function actualizarPerfil(idUsuario, { telefono, contrasenaActual, contrasenaNueva }) {
  if (contrasenaNueva) {
    const hashActual = await modelo.obtenerHashContrasena(idUsuario);
    const ok = await bcrypt.compare(contrasenaActual || "", hashActual);
    if (!ok) throw error("La contraseña actual no es correcta", "validacion");
    if (!validarContrasena(contrasenaNueva))
      throw error("La contraseña nueva no cumple los requisitos de seguridad", "validacion");
    const hash = await bcrypt.hash(contrasenaNueva, 10);
    await modelo.actualizarContrasena(idUsuario, hash);
  }
  if (telefono !== undefined) await modelo.actualizarTelefono(idUsuario, telefono);
  await auditar(idUsuario, "actualizar_perfil");
}

module.exports = {
  login, registrar, solicitarRecuperacion, restablecerContrasena, obtenerPerfil, actualizarPerfil,
  validarContrasena, normalizarCorreo,
};
