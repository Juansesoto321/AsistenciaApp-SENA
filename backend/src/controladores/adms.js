const dispositivos = require("../servicios/dispositivos");
const marcacionServicio = require("../servicios/marcacion");

// Rechazos esperados de una marcación: se registran y se sigue con la
// siguiente línea. Cualquier otro error (p. ej. la base de datos caída) se
// propaga para responder 500: así el equipo reintenta el lote más tarde en vez
// de darlo por entregado (los repetidos se descartan por la restricción UNIQUE).
const RECHAZOS_ESPERADOS = ["sin_sesion", "no_reconocida"];

async function procesarLineaAttlog(pin, fechaHora, idAmbiente) {
  try {
    const resultado = await marcacionServicio.marcarPorDocumento(idAmbiente, pin, fechaHora);
    const atrasada = resultado.atrasada ? " (marca atrasada, clase ya cerrada)" : "";
    if (resultado.duplicada) console.log(`[ADMS] ${resultado.aprendiz.nombres}: ya tenia asistencia registrada en esta sesion`);
    else console.log(`[ADMS] ${resultado.aprendiz.nombres} ${resultado.aprendiz.apellidos}: ${resultado.estado.toUpperCase()}${atrasada}`);
  } catch (e) {
    if (!RECHAZOS_ESPERADOS.includes(e.tipo)) throw e;
    if (e.tipo === "sin_sesion") console.warn(`[ADMS] PIN ${pin} marco a las ${fechaHora} pero no habia sesion activa en ese ambiente`);
    else console.warn(`[ADMS] PIN ${pin} no corresponde a ningun aprendiz matriculado en la ficha de esta sesion`);
  }
}

// Handshake: el dispositivo pide su configuracion al conectar
async function cdataGet(req, res, next) {
  try {
    const sn = req.query.SN;
    console.log(`[ADMS] Handshake de dispositivo SN=${sn}`);
    const d = await dispositivos.identificarPorSerial(sn);
    if (!d) console.warn(`[ADMS] SN desconocido (no esta en la tabla dispositivo): ${sn}`);

    // Formato verificado contra un SenseFace 2A real (firmware ZAM70-NF24HA-Ver3.3.12):
    // TransFlag debe ser texto ("TransData AttLog<TAB>OpLog"), no una mascara binaria,
    // y no debe llevar campos extra (ServerVer/PushProtVer/etc.) que el equipo no espera.
    const lineas = [
      `GET OPTION FROM: ${sn}`,
      "Stamp=9999",
      "ATTLOGStamp=9999",
      "OPERLOGStamp=9999",
      "ErrorDelay=30",
      "Delay=10",
      "TransTimes=00:00;23:59",
      "TransInterval=1",
      "TransFlag=TransData AttLog\tOpLog",
      "TimeZone=-5",
      "Realtime=1",
      "Encrypt=None",
      "0",
    ];
    res.type("text/plain").send(lineas.join("\n"));
  } catch (error) {
    next(error);
  }
}

// Carga de registros de asistencia (ATTLOG) - cuerpo en texto plano,
// una marcacion por linea, campos separados por tabulador:
// PIN \t Fecha-Hora \t Estado \t Verificacion \t ...
async function cdataPost(req, res, next) {
  try {
    const sn = req.query.SN;
    const tabla = req.query.table;
    console.log(`[ADMS] POST cdata SN=${sn} table=${tabla}`);

    if (tabla !== "ATTLOG") {
      // OPERLOG, USERINFO, etc: por ahora solo se confirman, no se procesan
      return res.type("text/plain").send("OK");
    }

    const d = await dispositivos.identificarPorSerial(sn);
    if (!d) {
      console.warn(`[ADMS] Marcacion de un SN no registrado: ${sn}`);
      return res.type("text/plain").send("OK"); // se confirma igual para que el equipo no reintente en bucle
    }

    const cuerpo = typeof req.body === "string" ? req.body : "";
    const lineas = cuerpo.split(/\r?\n/).filter((l) => l.trim());
    console.log(`[ADMS] ${lineas.length} registro(s) de asistencia recibidos`);

    for (const linea of lineas) {
      const [pin, fechaHora] = linea.split("\t").map((campo) => campo?.trim());
      if (!pin) continue;
      await procesarLineaAttlog(pin, fechaHora, d.id_ambiente);
    }

    res.type("text/plain").send("OK");
  } catch (error) {
    next(error);
  }
}

// Heartbeat / sondeo de comandos pendientes (el dispositivo pregunta seguido)
async function getrequest(req, res, next) {
  try {
    await dispositivos.identificarPorSerial(req.query.SN);
    res.type("text/plain").send("OK"); // sin comandos pendientes
  } catch (error) {
    next(error);
  }
}

// Confirmacion de comandos (no enviamos comandos al dispositivo por ahora)
function devicecmd(_req, res) {
  res.type("text/plain").send("OK");
}

module.exports = { cdataGet, cdataPost, getrequest, devicecmd };
