const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const modelo = require("../modelos/usuarios");
const { enviarCorreo } = require("./correo");
const { auditar } = require("./auditoria");
const { error } = require("../utilidades/errores");
const { escaparHtml, TIPOS_DOCUMENTO } = require("../utilidades/formato");

const ROLES_VALIDOS = ["coordinador", "programador", "instructor", "aprendiz"];
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generarContrasenaTemporal() {
  return `Sena${crypto.randomBytes(3).toString("hex")}*1`;
}

/**
 * Limpia y valida los datos de una cuenta nueva. El correo se guarda en
 * minúsculas: sin esto "Ana@sena.edu.co" y "ana@sena.edu.co" podían quedar
 * como dos cuentas distintas.
 */
function normalizarCuenta(datos) {
  const cuenta = {
    ...datos,
    nombres: String(datos.nombres || "").trim(),
    apellidos: String(datos.apellidos || "").trim(),
    documento: String(datos.documento || "").trim(),
    correo: String(datos.correo || "").trim().toLowerCase(),
    telefono: datos.telefono ? String(datos.telefono).trim() : null,
  };
  if (!cuenta.nombres || !cuenta.apellidos || !cuenta.documento || !cuenta.correo)
    throw error("Faltan campos obligatorios (nombres, apellidos, documento, correo)", "validacion");
  if (!FORMATO_CORREO.test(cuenta.correo)) throw error(`Correo inválido: ${cuenta.correo}`, "validacion");
  return cuenta;
}

function correoBienvenida(cuenta, temporal) {
  return {
    para: cuenta.correo,
    asunto: "AsistenciaApp SENA · Tu cuenta fue creada",
    html: `<p>Hola ${escaparHtml(cuenta.nombres)},</p><p>Tu cuenta en AsistenciaApp SENA está lista.</p>
           <p><b>Usuario:</b> ${escaparHtml(cuenta.correo)}<br/><b>Contraseña temporal:</b> ${temporal}</p>
           <p>Cámbiala al ingresar por primera vez, desde "Mi perfil".</p>`,
  };
}

async function listar(filtros) {
  return modelo.listar(filtros);
}

// Crear usuario (contrasena temporal enviada por correo — CU-04)
async function crear(datos, idActor) {
  if (!ROLES_VALIDOS.includes(datos.rol)) throw error("Rol inválido", "validacion");
  if (datos.tipoDocumento && !TIPOS_DOCUMENTO.includes(datos.tipoDocumento))
    throw error("Tipo de documento inválido", "validacion");
  const cuenta = normalizarCuenta(datos);
  const temporal = generarContrasenaTemporal();
  const hash = await bcrypt.hash(temporal, 10);
  const idUsuario = await modelo.crear({ ...cuenta, hash });
  await enviarCorreo(correoBienvenida(cuenta, temporal));
  await auditar(idActor, "crear_usuario", "usuario", idUsuario, { rol: cuenta.rol });
  return idUsuario;
}

async function editar(idUsuario, datos, idActor) {
  if (datos.rol !== undefined && !ROLES_VALIDOS.includes(datos.rol)) throw error("Rol inválido", "validacion");
  // Evita que el coordinador se quite a sí mismo el acceso a este módulo
  if (Number(idUsuario) === idActor && datos.rol && datos.rol !== "coordinador")
    throw error("No puedes quitarte tu propio rol de coordinador", "validacion");
  const actualizado = await modelo.editar(idUsuario, {
    nombres: datos.nombres?.trim() || undefined,
    apellidos: datos.apellidos?.trim() || undefined,
    telefono: datos.telefono,
    rol: datos.rol,
  });
  if (!actualizado) throw error("Usuario no encontrado", "no_encontrado");
  await auditar(idActor, "editar_usuario", "usuario", Number(idUsuario));
}

// Cambiar estado: aprobar (pendiente->activo), desactivar, reactivar.
// Regla CU-04: no se elimina, solo se desactiva.
async function cambiarEstado(idUsuario, estado, idActor) {
  if (!["activo", "inactivo"].includes(estado)) throw error("Estado inválido", "validacion");
  if (Number(idUsuario) === idActor && estado === "inactivo")
    throw error("No puedes desactivar tu propia cuenta", "validacion");
  const usuario = await modelo.cambiarEstado(idUsuario, estado);
  if (!usuario) throw error("Usuario no encontrado", "no_encontrado");
  if (estado === "activo") {
    await enviarCorreo({
      para: usuario.correo,
      asunto: "AsistenciaApp SENA · Cuenta aprobada",
      html: `<p>Hola ${escaparHtml(usuario.nombres)}, tu cuenta fue aprobada. Ya puedes iniciar sesión.</p>`,
    });
  }
  await auditar(idActor, `usuario_${estado}`, "usuario", Number(idUsuario));
}

// CU-06 A1: carga masiva de aprendices (filas JSON desde CSV/Excel del frontend)
async function cargaMasiva(filas, idActor) {
  if (!Array.isArray(filas) || !filas.length) throw error("No se recibieron filas", "validacion");
  const resultados = { creados: 0, errores: [] };
  for (const [i, f] of filas.entries()) {
    try {
      const cuenta = normalizarCuenta({ ...f, rol: "aprendiz" });
      const temporal = generarContrasenaTemporal();
      const hash = await bcrypt.hash(temporal, 10);
      await modelo.crear({ ...cuenta, tipoDocumento: "CC", hash });
      await enviarCorreo(correoBienvenida(cuenta, temporal));
      resultados.creados++;
    } catch (e) {
      resultados.errores.push({ fila: i + 1, documento: f.documento, error: e.code === "23505" ? "Correo o documento duplicado" : e.message });
    }
  }
  await auditar(idActor, "carga_masiva_aprendices", "usuario", null, resultados);
  return resultados;
}

module.exports = { listar, crear, editar, cambiarEstado, cargaMasiva };
