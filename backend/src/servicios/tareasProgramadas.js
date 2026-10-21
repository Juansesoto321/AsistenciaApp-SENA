/**
 * Trabajos periodicos del sistema. Se ejecutan cada minuto desde app.js.
 * Un fallo aqui se registra pero nunca detiene el ciclo.
 */
const justificacionesModelo = require("../modelos/justificaciones");
const dispositivoModelo = require("../modelos/dispositivo");
const academicoModelo = require("../modelos/academico");
const logs = require("./logs");
const { emitirNotificacionNueva } = require("./tiempoReal");

const INTERVALO_MS = 60_000;

/** Un aviso por lector que acaba de perder la señal (no se repite cada minuto). */
async function avisarLectoresCaidos(caidos) {
  for (const lector of caidos) {
    const donde = lector.numero_ambiente ? `del ambiente ${lector.numero_ambiente}` : "sin ambiente asignado";
    const mensaje = `El lector ${lector.serial} ${donde} lleva más de 3 minutos sin señal. ` +
      "Las huellas no llegarán hasta que vuelva: revisa su conexión o usa el registro manual.";
    const avisados = await dispositivoModelo.notificarLectorCaido(lector, mensaje);
    avisados.forEach(emitirNotificacionNueva);
  }
}

async function ejecutar() {
  try {
    await justificacionesModelo.vencerExpiradas();           // justificaciones fuera de plazo
    await avisarLectoresCaidos(await dispositivoModelo.marcarFueraDeLineaSinHeartbeat()); // CU-09: lectores caidos
    await academicoModelo.finalizarFichasVencidas();          // fichas que pasaron su fecha fin
  } catch (e) {
    console.error("Error en tareas programadas:", e.message);
    logs.registrar({
      mensaje: `Tareas programadas: ${e.message}`,
      ruta: "tareasProgramadas",
      traza: e.stack,
    });
  }
}

function iniciar() {
  setInterval(ejecutar, INTERVALO_MS);
}

module.exports = { iniciar, ejecutar, avisarLectoresCaidos };
