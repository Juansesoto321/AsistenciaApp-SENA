/**
 * CU-23 Cargar justificacion (aprendiz, via enlace de 72 horas)
 * CU-24 Validar justificacion (instructor aprueba/rechaza)
 */
const express = require("express");
const { autenticar, autorizar } = require("../middleware/autenticar");
const controlador = require("../controladores/justificaciones");

const router = express.Router();

// --- PUBLICO (acceso por token del correo, sin login) ---
router.get("/token/:token", controlador.verPorToken);
router.post("/token/:token", controlador.enviarPorToken);

// --- AUTENTICADO ---
router.use(autenticar);
router.get("/", autorizar("instructor", "coordinador", "programador"), controlador.listarBandeja);
router.get("/pendientes/contador", autorizar("instructor", "coordinador", "programador"), controlador.contarPendientes);
router.get("/:id/archivo", autorizar("instructor", "coordinador", "programador"), controlador.verArchivo);
// El programador las consulta, pero solo el instructor o la coordinación deciden
router.patch("/:id", autorizar("instructor", "coordinador"), controlador.validar);

module.exports = router;
