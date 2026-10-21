/**
 * CU-23 Cargar justificacion (aprendiz, via enlace de 72 horas)
 * CU-24 Validar justificacion (instructor aprueba/rechaza)
 */
const modelo = require("../modelos/justificaciones");
const { enTransaccion } = require("../modelos/transaccion");
const { auditar } = require("./auditoria");
const { enviarCorreo } = require("./correo");
const { emitirJustificacionesActualizadas, emitirNotificacionNueva } = require("./tiempoReal");
const { error } = require("../utilidades/errores");
const { escaparHtml, fechaLarga, textoPlazo } = require("../utilidades/formato");

const TIPOS_VALIDOS = ["cita_medica", "incapacidad_medica", "calamidad_domestica", "diligencia_legal", "duelo", "otro"];
const TIPOS_SIN_FOTO_OBLIGATORIA = ["calamidad_domestica", "duelo"];
const FORMATOS_ADJUNTO = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/i;

// Texto legible del plazo configurado (ej. "5 días" o "18 horas")
async function plazoConfigurado() {
  return textoPlazo(await modelo.obtenerHorasPlazo());
}

async function verPorToken(token) {
  const j = await modelo.buscarPorToken(token);
  if (!j) throw error("Enlace de justificación no válido", "no_encontrado");
  if (new Date(j.expira_en) < new Date() && j.estado === "pendiente")
    throw error(`El plazo de ${await plazoConfigurado()} para justificar venció`, "vencida", { vencida: true });
  return j;
}

async function enviarPorToken(token, { tipo, descripcion, nombre_archivo, archivo_datos }) {
  if (!TIPOS_VALIDOS.includes(tipo)) throw error("Selecciona un tipo de justificación válido", "validacion");
  if (!descripcion?.trim()) throw error("Describe el motivo de tu inasistencia", "validacion");
  const fotoObligatoria = !TIPOS_SIN_FOTO_OBLIGATORIA.includes(tipo);
  if (fotoObligatoria && !archivo_datos) throw error("Adjunta un soporte para este tipo de justificación", "validacion");
  if (archivo_datos && !FORMATOS_ADJUNTO.test(archivo_datos)) throw error("El soporte debe ser JPG, PNG, WEBP o PDF", "validacion");

  const r = await modelo.enviarPorToken(token, { tipo, descripcion, nombre_archivo, archivo_datos });
  if (!r) throw error(`El enlace ya fue usado o el plazo de ${await plazoConfigurado()} venció`, "vencida");

  const instr = await modelo.buscarInstructorDeAsistencia(r.id_asistencia);
  if (instr) {
    // La notificación abre esa justificación (antes había que buscarla en la bandeja)
    await modelo.crearNotificacion(
      instr.id_instructor,
      "justificacion",
      "Nueva justificación por revisar",
      `${instr.nombres} ${instr.apellidos} cargó una justificación de la clase del ${fechaLarga(instr.fecha)} (ficha ${instr.numero_ficha}).`,
      undefined,
      `/justificaciones?id=${r.id_justificacion}`
    );
    // CU-24: refleja al instante el nuevo pendiente en el contador del panel del instructor (y del admin)
    emitirJustificacionesActualizadas(instr.id_instructor);
    emitirNotificacionNueva(instr.id_instructor);
  }
}

async function listarBandeja(usuario) {
  return modelo.listarBandeja(usuario);
}

async function contarPendientes(usuario) {
  return { pendientes: await modelo.contarPendientes(usuario) };
}

async function obtenerArchivo(idJustificacion, usuario) {
  if (!(await modelo.esPropietario(idJustificacion, usuario)))
    throw error("No tienes permisos para ver este archivo", "prohibido");
  const j = await modelo.obtenerArchivo(idJustificacion);
  if (!j?.archivo_datos) throw error("Sin adjunto", "no_encontrado");
  return j;
}

async function validarJustificacion(idJustificacion, usuario, { estado, observacion }) {
  if (!(await modelo.esPropietario(idJustificacion, usuario)))
    throw error("No tienes permisos para validar esta justificación", "prohibido");
  if (!["aprobada", "rechazada"].includes(estado)) throw error("Estado inválido", "validacion");
  if (estado === "rechazada" && !observacion?.trim()) throw error("Explica por qué se rechaza la justificación", "validacion");

  const { idAsistencia, aprendiz } = await enTransaccion(async (cliente) => {
    const r = await modelo.validar(cliente, idJustificacion, {
      estado,
      validadaPor: usuario.id,
      observacion: observacion?.trim() || null,
    });
    if (!r) throw error("La justificación no está pendiente de revisión", "validacion");

    const idAprendiz = await modelo.obtenerAprendizDeAsistencia(cliente, r.id_asistencia);

    if (estado === "aprobada") {
      // Solo pasa a "justificada" si sigue como ausente: si el instructor ya la
      // corrigió a mano (p. ej. a "presente"), no se sobrescribe.
      const estadoAnterior = await modelo.marcarAsistenciaJustificada(cliente, r.id_asistencia);
      if (estadoAnterior) await modelo.registrarCambioAsistencia(cliente, r.id_asistencia, estadoAnterior, usuario.id);
      await modelo.crearNotificacion(
        idAprendiz, "justificacion", "Justificación aprobada",
        "Tu inasistencia quedó marcada como justificada.", cliente, "/mis-justificaciones"
      );
      return { idAsistencia: r.id_asistencia, aprendiz: idAprendiz };
    }

    await modelo.crearNotificacion(
      idAprendiz, "justificacion", "Justificación rechazada",
      `Tu justificación fue rechazada. Motivo: ${observacion.trim()}`, cliente, "/mis-justificaciones"
    );
    return { idAsistencia: r.id_asistencia, aprendiz: idAprendiz };
  });

  emitirNotificacionNueva(aprendiz);
  await auditar(usuario.id, `justificacion_${estado}`, "justificacion", Number(idJustificacion));

  // Ya se resolvió: baja el contador de pendientes en el panel del instructor (y del admin)
  const idInstructor = await modelo.buscarInstructorDeJustificacion(idAsistencia);
  emitirJustificacionesActualizadas(idInstructor);

  // Correo con el resultado (y el motivo, si fue rechazada)
  const u = await modelo.buscarUsuarioParaCorreo(aprendiz);
  if (estado === "aprobada") {
    await enviarCorreo({
      para: u.correo,
      asunto: "AsistenciaApp SENA · Justificación aprobada",
      html: `<p>Hola ${escaparHtml(u.nombres)},</p><p>Tu justificación fue <b>aprobada</b>. La inasistencia quedó marcada como "justificada".</p>`,
    });
  } else {
    await enviarCorreo({
      para: u.correo,
      asunto: "AsistenciaApp SENA · Justificación rechazada",
      html: `<p>Hola ${escaparHtml(u.nombres)},</p>
             <p>Tu justificación fue <b>rechazada</b>.</p>
             <p><b>Motivo:</b> ${escaparHtml(observacion.trim())}</p>
             <p>Puedes ver el detalle desde "Mi asistencia" en la plataforma.</p>`,
    });
  }

  return { mensaje: `Justificación ${estado}` };
}

module.exports = { verPorToken, enviarPorToken, listarBandeja, contarPendientes, obtenerArchivo, validarJustificacion };
