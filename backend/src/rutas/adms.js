/**
 * Adaptador del protocolo real ZKTeco PUSH/ADMS (iClock) para lectores fisicos
 * como el SenseFace 2A. A diferencia del simulador (/api/lector), aqui el
 * dispositivo hace el matching de huella/rostro EN SI MISMO y solo envia el
 * PIN del usuario ya identificado - nunca una plantilla biometrica cruda.
 *
 * Convencion: el PIN con el que se matricula a cada aprendiz EN EL DISPOSITIVO
 * debe ser su numero de documento (asi el backend sabe a quien corresponde).
 *
 * Rutas fijas por el protocolo (no llevan prefijo /api ni autenticacion por
 * header - el dispositivo identifica con el parametro SN=<serial>):
 *   GET  /iclock/cdata        -> handshake / opciones al encender o reconectar
 *   POST /iclock/cdata        -> carga de registros de asistencia (ATTLOG)
 *   GET  /iclock/getrequest   -> heartbeat / sondeo de comandos pendientes
 *   POST /iclock/devicecmd    -> confirmacion de comandos (no usado por ahora)
 */
const express = require("express");
const controlador = require("../controladores/adms");
const { ipLectores } = require("../config/entorno");
const { soloDesdeIps, ipDeConexion } = require("../middleware/seguridad");
const detectados = require("../servicios/lectoresDetectados");

const router = express.Router();
// Antes del filtro de IP: el asistente para conectar un lector también muestra
// el equipo que llamó desde una IP que no está en IP_LECTORES
router.use((req, _res, next) => {
  const ip = ipDeConexion(req);
  detectados.anotar(req.query.SN, ip, ipLectores.length > 0 && !ipLectores.includes(ip));
  next();
});
// El serial no es un secreto: solo los equipos de IP_LECTORES pueden marcar
router.use(soloDesdeIps(ipLectores));
router.use(express.text({ type: "*/*" }));

router.get("/cdata", controlador.cdataGet);
router.post("/cdata", controlador.cdataPost);
router.get("/getrequest", controlador.getrequest);
router.post("/devicecmd", controlador.devicecmd);

module.exports = router;
