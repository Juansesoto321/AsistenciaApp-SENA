/**
 * CU-12 Iniciar sesion de clase · CU-14 Supervisar en tiempo real
 * CU-15 Asistencia manual/override · cierre con generacion de justificaciones (72h)
 */
const crypto = require("crypto");
const { urlFrontend } = require("../config/entorno");
const modelo = require("../modelos/sesiones");
const { enTransaccion } = require("../modelos/transaccion");
const { enviarCorreo } = require("./correo");
const { auditar } = require("./auditoria");
const { emitirASesion, emitirNotificacionNueva } = require("./tiempoReal");
const { error } = require("../utilidades/errores");
const { escaparHtml, fechaLarga, textoPlazo } = require("../utilidades/formato");

const ESTADOS_VALIDOS = ["presente", "tardanza", "ausente", "justificada"];
// Regla RF-35: pasadas 24 h del cierre, solo la coordinación corrige asistencia
const ROLES_SIN_LIMITE_DE_TIEMPO = ["coordinador", "programador"];

function verificarTitular(usuario, idInstructor, accion) {
  if (usuario.rol === "instructor" && idInstructor !== usuario.id)
    throw error(`Solo el instructor titular puede ${accion}`, "prohibido");
}

/**
 * Dentro de la transaccion: crea el enlace de justificacion y la notificacion
 * interna. Devuelve el correo que hay que enviar, o null si la ausencia ya
 * tenia enlace. El correo se envia DESPUES del COMMIT: el servidor SMTP puede
 * tardar segundos por mensaje y no debe mantener la transaccion abierta.
 */
async function prepararJustificacion(cliente, { idAsistencia, idAprendiz, numeroFicha, fechaClase, horas }) {
  const token = crypto.randomBytes(24).toString("hex");
  const creada = await modelo.insertarJustificacion(cliente, idAsistencia, token, horas);
  if (!creada) return null;

  const plazo = textoPlazo(horas);
  await modelo.insertarNotificacionInasistencia(
    cliente, idAprendiz,
    `Se registró tu inasistencia a la clase del ${fechaClase}. Revisa tu correo: tienes ${plazo} para cargar una justificación.`
  );
  const aprendiz = await modelo.buscarUsuarioParaCorreo(cliente, idAprendiz);
  return { idAprendiz, correo: aprendiz.correo, nombres: aprendiz.nombres, token, numeroFicha, fechaClase, plazo };
}

async function enviarAvisosDeInasistencia(avisos) {
  for (const a of avisos) {
    const enlace = `${urlFrontend}/justificar/${a.token}`;
    await enviarCorreo({
      para: a.correo,
      asunto: `AsistenciaApp · Inasistencia registrada (ficha ${a.numeroFicha})`,
      html: `<p>Hola ${escaparHtml(a.nombres)},</p>
             <p>Se registró tu <b>inasistencia</b> a la clase del ${a.fechaClase} de la ficha ${a.numeroFicha}.</p>
             <p>Si tienes una excusa (por ejemplo, cita médica), cárgala en el siguiente enlace.
             <b>Disponible solo por ${a.plazo}</b>; después quedará como "sin justificación":</p>
             <p><a href="${enlace}">${enlace}</a></p>`,
    });
    emitirNotificacionNueva(a.idAprendiz);
  }
}

async function horariosDeHoy(usuario) {
  return modelo.horariosDeHoy(usuario);
}

// CU-12: iniciar (o reanudar) la sesion de hoy
async function iniciarSesion(idHorario, usuario) {
  const h = await modelo.buscarHorarioConLector(idHorario);
  if (!h) throw error("Horario no encontrado", "no_encontrado");

  // Regla CU-12: solo el instructor titular (o un coordinador)
  verificarTitular(usuario, h.id_instructor, "iniciar esta sesión");
  if (!h.es_hoy) throw error("Este horario no corresponde al día de hoy", "validacion");
  if (h.estado_ficha !== "activa") throw error("La ficha de este horario ya finalizó", "validacion");

  const sesion = await modelo.crearOReanudarSesion(idHorario);
  if (sesion.estado === "cerrada") throw error("La sesión de hoy ya fue cerrada", "validacion");

  await auditar(usuario.id, "iniciar_sesion_clase", "sesion_clase", sesion.id_sesion);

  return {
    id_sesion: sesion.id_sesion,
    lector: h.estado_lector || "sin_lector",
    mensaje: h.estado_lector === "en_linea"
      ? "Sesión activa. Lector en línea, listo para capturar huellas"
      : "Sesión activa. El lector no está en línea: puedes usar registro manual",
  };
}

// CU-14: detalle de la sesion (lista completa con estados)
async function verDetalle(idSesion, usuario) {
  const sesion = await modelo.buscarDetalle(idSesion);
  if (!sesion) throw error("Sesión no encontrada", "no_encontrado");
  verificarTitular(usuario, sesion.id_instructor, "ver esta sesión");
  const aprendices = await modelo.buscarAprendicesDeSesion(idSesion);
  return { ...sesion, aprendices };
}

// CU-15: registro manual / override. Todo cambio requiere motivo y queda en
// cambio_asistencia. Pasadas 24 h del cierre solo la coordinacion puede
// corregir (RF-35).
async function registrarAsistenciaManual(idSesion, usuario, { id_aprendiz, estado, motivo }) {
  if (!motivo?.trim()) throw error("Todo registro manual requiere una justificación (regla CU-15)", "validacion");
  if (!ESTADOS_VALIDOS.includes(estado)) throw error("Estado inválido", "validacion");

  const sesion = await modelo.buscarSesionParaRegistroManual(idSesion);
  if (!sesion) throw error("Sesión no encontrada", "no_encontrado");
  verificarTitular(usuario, sesion.id_instructor, "modificar la asistencia de esta sesión");
  if (sesion.cerrada_hace_mas_de_24h && !ROLES_SIN_LIMITE_DE_TIEMPO.includes(usuario.rol))
    throw error("Pasadas 24 horas del cierre, solo la coordinación puede modificar esta asistencia", "prohibido");
  if (!(await modelo.estaMatriculado(id_aprendiz, sesion.id_ficha)))
    throw error("El aprendiz no pertenece a la ficha de esta sesión", "validacion");

  const { idAsistencia, aviso } = await enTransaccion(async (cliente) => {
    const upsert = await modelo.upsertAsistenciaManual(cliente, {
      idSesion, idAprendiz: id_aprendiz, estado, motivo: motivo.trim(), registradoPor: usuario.id,
    });

    await modelo.insertarCambioAsistencia(cliente, {
      idAsistencia: upsert.id_asistencia, estadoAnterior: upsert.estado_anterior,
      estadoNuevo: estado, motivo: motivo.trim(), cambiadoPor: usuario.id,
    });

    // Si queda "ausente", genera el enlace de justificación y la notificación,
    // igual que al cerrar la sesión.
    const pendiente = estado === "ausente"
      ? await prepararJustificacion(cliente, {
          idAsistencia: upsert.id_asistencia, idAprendiz: id_aprendiz, numeroFicha: sesion.numero_ficha,
          fechaClase: fechaLarga(sesion.fecha), horas: await modelo.obtenerHorasJustificacion(cliente),
        })
      : null;

    return { idAsistencia: upsert.id_asistencia, aviso: pendiente };
  });

  if (aviso) await enviarAvisosDeInasistencia([aviso]);

  const u = await modelo.buscarNombreUsuario(id_aprendiz);
  if (u) {
    emitirASesion(idSesion, "marcacion", {
      id_sesion: Number(idSesion), id_aprendiz, nombres: u.nombres, apellidos: u.apellidos, estado, hora_marca: new Date(), metodo: "manual",
    });
  }

  await auditar(usuario.id, "asistencia_manual", "asistencia", idAsistencia, {
    estado, motivo, sesion_cerrada: sesion.estado === "cerrada",
  });

  return { mensaje: "Asistencia registrada manualmente" };
}

// Cierre de sesion: marca ausentes + genera enlaces de justificacion (72h) + notifica
async function cerrarSesion(idSesion, usuario) {
  const s = await modelo.buscarSesionParaCerrar(idSesion);
  if (!s) throw error("Sesión no encontrada", "no_encontrado");
  if (s.estado === "cerrada") throw error("La sesión ya está cerrada", "validacion");
  verificarTitular(usuario, s.id_instructor, "cerrar la sesión");

  const { ausentes, avisos } = await enTransaccion(async (cliente) => {
    const sinRegistro = await modelo.marcarAusentesSinRegistro(cliente, idSesion, s.id_ficha);
    await modelo.cerrarSesion(cliente, idSesion, usuario.id);

    const horas = await modelo.obtenerHorasJustificacion(cliente);
    const pendientes = [];
    for (const a of sinRegistro) {
      const aviso = await prepararJustificacion(cliente, {
        idAsistencia: a.id_asistencia, idAprendiz: a.id_aprendiz, numeroFicha: s.numero_ficha,
        fechaClase: fechaLarga(s.fecha), horas,
      });
      if (aviso) pendientes.push(aviso);
    }
    return { ausentes: sinRegistro.length, avisos: pendientes };
  });

  // Ya confirmado el cierre: correos y avisos en vivo
  await enviarAvisosDeInasistencia(avisos);
  await auditar(usuario.id, "cerrar_sesion_clase", "sesion_clase", Number(idSesion), { ausentes });

  return { mensaje: `Sesión cerrada. ${ausentes} aprendiz(es) marcados como ausentes y notificados` };
}

// Elimina permanentemente una sesion y su asistencia/justificaciones asociadas.
// Solo coordinador: es destructivo e irreversible, pensado para limpiar
// sesiones de prueba (no para corregir asistencia real - para eso esta CU-15).
async function eliminarSesion(idSesion, usuario) {
  await enTransaccion(async (cliente) => {
    const eliminada = await modelo.eliminarSesion(cliente, idSesion);
    if (!eliminada) throw error("Sesión no encontrada", "no_encontrado");
  });

  await auditar(usuario.id, "eliminar_sesion_clase", "sesion_clase", Number(idSesion));
  return { mensaje: "Sesión eliminada permanentemente, junto con su asistencia y justificaciones" };
}

module.exports = { horariosDeHoy, iniciarSesion, verDetalle, registrarAsistenciaManual, cerrarSesion, eliminarSesion };
