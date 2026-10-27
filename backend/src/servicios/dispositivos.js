/**
 * Lectores biométricos: identificación del equipo y señal de vida (CU-09).
 * Lo usan los dos protocolos: el simulado (/api/lector) y el real ADMS (/iclock).
 */
const fs = require("fs");
const os = require("os");
const modelo = require("../modelos/dispositivo");
const detectados = require("./lectoresDetectados");
const { ipLectores, puertoLector } = require("../config/entorno");
const { error } = require("../utilidades/errores");

/** Protocolo simulado: el lector se identifica con serial + clave de API. */
async function autenticar(serial, claveApi) {
  if (!serial || !claveApi) throw error("Dispositivo no autorizado", "credenciales");
  const dispositivo = await modelo.buscarPorCredenciales(serial, claveApi);
  if (!dispositivo) throw error("Dispositivo no autorizado", "credenciales");
  return dispositivo;
}

/**
 * Protocolo ADMS: el equipo solo informa su serial (el protocolo de fábrica no
 * admite clave). Si está registrado, cuenta como señal de vida.
 */
async function identificarPorSerial(serial) {
  const dispositivo = serial ? await modelo.buscarPorSerial(serial) : null;
  if (dispositivo) await modelo.marcarEnLinea(dispositivo.id_dispositivo);
  return dispositivo;
}

async function registrarLatido(idDispositivo) {
  await modelo.marcarEnLinea(idDispositivo);
}

/** IPv4 de las tarjetas de red de este computador (sin la de bucle local). */
function ipsDelEquipo() {
  return Object.entries(os.networkInterfaces()).flatMap(([nombre, lista]) =>
    (lista || []).filter((i) => i.family === "IPv4" && !i.internal).map((i) => ({ nombre, ip: i.address })));
}

/**
 * Lo que necesita el asistente para conectar un lector: el puerto al que debe
 * llamar, las IP de este computador y los equipos que ya llamaron. Dentro de
 * Docker las IP son las del contenedor y no sirven: el asistente lo explica.
 */
async function conexionLector() {
  const enDocker = fs.existsSync("/.dockerenv");
  const registrados = new Map((await modelo.listarConAmbiente()).map((d) => [d.serial, d]));
  return {
    puerto: puertoLector,
    enDocker,
    ips: enDocker ? [] : ipsDelEquipo(),
    ipLectores,
    detectados: detectados.recientes().map((d) => ({
      ...d,
      registrado: registrados.has(d.serial),
      ambiente: registrados.get(d.serial)?.numero_ambiente ?? null,
    })),
  };
}

module.exports = { autenticar, identificarPorSerial, registrarLatido, conexionLector };
