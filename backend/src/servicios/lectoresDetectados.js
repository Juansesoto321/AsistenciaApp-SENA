/**
 * Lectores que han llamado al protocolo ADMS (/iclock) en los últimos minutos,
 * estén registrados o no. Lo usa el asistente para conectar un lector: muestra
 * en vivo el serial y la IP del equipo que acaba de llamar, aunque todavía no
 * esté asociado a un ambiente o su IP no esté en IP_LECTORES.
 * Vive en memoria (se pierde al reiniciar): es solo para configurar el equipo.
 */
const MAXIMO = 20; // cualquiera en la red puede llamar: la lista no crece sin límite
const SERIAL_VALIDO = /^[\w.-]{1,40}$/;

const detectados = new Map(); // serial -> { serial, ip, bloqueado, primeraVez, ultimaVez }

/** Anota una llamada. `bloqueado`: la IP no está en IP_LECTORES y se rechazó. */
function anotar(serial, ip, bloqueado) {
  if (!SERIAL_VALIDO.test(String(serial || ""))) return;
  const ahora = new Date();
  detectados.set(serial, { serial, ip, bloqueado, primeraVez: detectados.get(serial)?.primeraVez || ahora, ultimaVez: ahora });
  if (detectados.size > MAXIMO) {
    const masViejo = [...detectados.values()].reduce((a, b) => (a.ultimaVez <= b.ultimaVez ? a : b));
    detectados.delete(masViejo.serial);
  }
}

/** Los que llamaron en los últimos `minutos`, el más reciente primero. */
function recientes(minutos = 10) {
  const desde = Date.now() - minutos * 60000;
  return [...detectados.values()].filter((d) => d.ultimaVez >= desde).sort((a, b) => b.ultimaVez - a.ultimaVez);
}

module.exports = { anotar, recientes };
