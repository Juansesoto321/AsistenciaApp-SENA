/**
 * Logica de marcacion de asistencia, compartida por los dos protocolos de
 * lector: el simulado (/api/lector, matching biometrico 1:N) y el real
 * ZKTeco ADMS (/iclock, el dispositivo ya identifica y solo envia el PIN).
 * CU-13 Marcar asistencia con huella · CU-16 Huella no reconocida
 */
const modelo = require("../modelos/marcacion");
const { enTransaccion } = require("../modelos/transaccion");
const { descifrar, generarTemplateSimulado } = require("./cifrado");
const { emitirASesion, emitirNotificacionNueva } = require("./tiempoReal");
const { error } = require("../utilidades/errores");
const { fechaLarga } = require("../utilidades/formato");

// Si el reloj del lector va adelantado más que esto, se usa la hora del servidor
const MARGEN_RELOJ_MS = 5 * 60 * 1000;
// Una marca más reciente que esto se considera "en vivo": si el reloj del
// lector va un poco atrasado, igual cuenta para la clase activa
const VENTANA_EN_VIVO_MS = 10 * 60 * 1000;

async function obtenerSesionActiva(idAmbiente) {
  const sesion = await modelo.buscarSesionActivaEnAmbiente(idAmbiente);
  if (!sesion) throw error("No hay una sesión de clase activa en este ambiente", "sin_sesion");
  return sesion;
}

/**
 * Regla CU-13: tardanza si supera los minutos de tolerancia configurados.
 * La hora de inicio se ubica en el dia LOCAL de la marcacion. Antes se usaba
 * la fecha en UTC, que en Colombia ya es "mañana" desde las 7:00 p. m.: en las
 * clases nocturnas nadie quedaba con tardanza.
 */
function calcularEstado(horaInicio, tolerancia, ahora = new Date()) {
  const [horas, minutos, segundos = 0] = String(horaInicio).split(":").map(Number);
  const inicioClase = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), horas, minutos, segundos);
  const minutosTarde = (ahora - inicioClase) / 60000;
  return minutosTarde > tolerancia ? "tardanza" : "presente";
}

/**
 * Hora de la marca según el lector. ADMS la envía en la hora local del equipo
 * ("2026-10-13 08:02:15"); antes se ignoraba y se usaba la hora de llegada, así
 * que una marca reenviada tras una caída de red quedaba como tardanza o se
 * perdía si la clase ya se había cerrado. Sin hora válida, o con el reloj del
 * equipo adelantado, se usa la del servidor.
 */
function horaDeLaMarca(texto, ahora = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(texto || "").trim());
  if (!m) return ahora;
  const fecha = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  if (Number.isNaN(fecha.getTime()) || fecha - ahora > MARGEN_RELOJ_MS) return ahora;
  return fecha;
}

async function registrarAsistencia(sesion, aprendiz, momento = new Date()) {
  const tolerancia = await modelo.obtenerTolerancia();
  const estado = calcularEstado(sesion.hora_inicio, tolerancia, momento);
  const idAsistencia = await modelo.insertarAsistencia(sesion.id_sesion, aprendiz.id_usuario, estado, momento);
  if (!idAsistencia) return { duplicada: true, aprendiz, estado: null };

  emitirASesion(sesion.id_sesion, "marcacion", {
    id_sesion: sesion.id_sesion, // el panel sigue varias clases a la vez
    id_aprendiz: aprendiz.id_usuario,
    nombres: aprendiz.nombres,
    apellidos: aprendiz.apellidos,
    estado,
    hora_marca: momento,
    metodo: "huella",
  });
  return { duplicada: false, aprendiz, estado };
}

/**
 * La marca llegó cuando la clase ya estaba cerrada, pero se hizo mientras
 * estaba abierta. Si el aprendiz quedó "ausente" por el cierre automático, se
 * corrige; si alguien ya registró su asistencia a mano, se respeta.
 */
async function registrarMarcaAtrasada(sesion, aprendiz, momento) {
  const tolerancia = await modelo.obtenerTolerancia();
  const estado = calcularEstado(sesion.hora_inicio, tolerancia, momento);
  const motivo = "Marca del lector recibida después del cierre de la clase";

  const corregida = await enTransaccion(async (cliente) => {
    const actual = await modelo.buscarAsistenciaParaCorregir(cliente, sesion.id_sesion, aprendiz.id_usuario);
    if (!actual) {
      // Matriculado después del cierre: no tenía registro
      await modelo.insertarAsistencia(sesion.id_sesion, aprendiz.id_usuario, estado, momento, cliente);
      return true;
    }
    if (actual.estado !== "ausente" || actual.metodo !== "sistema") return false;

    await modelo.corregirAusenciaConMarca(cliente, { idAsistencia: actual.id_asistencia, estado, horaMarca: momento, motivo });
    await modelo.notificar(
      cliente, aprendiz.id_usuario, "Asistencia corregida",
      `Tu huella de la clase del ${fechaLarga(sesion.fecha)} llegó tarde al sistema porque el lector estaba sin conexión. ` +
      `Quedaste como "${estado}": ya no necesitas justificar esa falta.`
    );
    return true;
  });

  if (!corregida) return { duplicada: true, aprendiz, estado: null };
  emitirNotificacionNueva(aprendiz.id_usuario);
  return { duplicada: false, atrasada: true, aprendiz, estado };
}

/** Protocolo simulado: identifica al aprendiz comparando el template leido contra las plantillas cifradas de la ficha */
async function marcarPorHuella(idAmbiente, lectura) {
  const sesion = await obtenerSesionActiva(idAmbiente);
  const plantillas = await modelo.buscarPlantillasDeFicha(sesion.id_ficha);
  const templateLeido = generarTemplateSimulado(lectura);

  let aprendiz = null;
  for (const p of plantillas) {
    try {
      if (descifrar(p) === templateLeido) { aprendiz = p; break; }
    } catch { /* plantilla corrupta: se ignora */ }
  }

  if (!aprendiz) {
    emitirASesion(sesion.id_sesion, "huella_no_reconocida", { hora: new Date() });
    throw error("Huella no reconocida. Reintenta (máximo 3 veces) o pide registro manual al instructor", "no_reconocida");
  }
  return registrarAsistencia(sesion, aprendiz);
}

/**
 * Protocolo real ADMS: el dispositivo ya identifico y envia el PIN (=documento)
 * con la hora en que se hizo la marca.
 */
async function marcarPorDocumento(idAmbiente, documento, horaDelEquipo, ahora = new Date()) {
  const momento = horaDeLaMarca(horaDelEquipo, ahora);
  let sesion = await modelo.buscarSesionEnAmbienteAl(idAmbiente, momento);
  // Reloj del lector un poco atrasado: una marca reciente cuenta para la clase activa
  if (!sesion && ahora - momento < VENTANA_EN_VIVO_MS) sesion = await modelo.buscarSesionActivaEnAmbiente(idAmbiente);
  if (!sesion) throw error("No había una sesión de clase activa en este ambiente a esa hora", "sin_sesion");

  const aprendiz = await modelo.buscarAprendizPorDocumentoEnFicha(documento, sesion.id_ficha);
  if (!aprendiz) {
    if (sesion.estado === "activa") emitirASesion(sesion.id_sesion, "huella_no_reconocida", { hora: momento, pin: documento });
    throw error("PIN no corresponde a ningún aprendiz matriculado en la ficha de esta sesión", "no_reconocida");
  }
  if (sesion.estado === "cerrada") return registrarMarcaAtrasada(sesion, aprendiz, momento);
  return registrarAsistencia(sesion, aprendiz, momento);
}

module.exports = { marcarPorHuella, marcarPorDocumento, calcularEstado, horaDeLaMarca };
