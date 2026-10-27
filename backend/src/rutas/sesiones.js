/**
 * CU-12 Iniciar sesion de clase · CU-14 Supervisar en tiempo real
 * CU-15 Asistencia manual/override · cierre con generacion de justificaciones (72h)
 */
const express = require("express");
const { autenticar, autorizar } = require("../middleware/autenticar");
const controlador = require("../controladores/sesiones");

const router = express.Router();
router.use(autenticar);

// El programador consulta las clases; iniciarlas, cerrarlas y tocar la
// asistencia es del instructor y la coordinación
const SUPERVISION = ["instructor", "coordinador", "programador"];
const GESTION = ["instructor", "coordinador"];

router.get("/hoy", autorizar(...SUPERVISION), controlador.horariosDeHoy);
router.get("/historial", autorizar(...SUPERVISION), controlador.historialDeClases);
router.post("/iniciar", autorizar(...GESTION), controlador.iniciarSesion);
// Clase de demostración (temporal): antes de "/:id" para que "demo" no se lea como id
router.get("/demo", autorizar(...GESTION), controlador.estadoClaseDemo);
router.post("/demo/reiniciar", autorizar(...GESTION), controlador.reiniciarClaseDemo);
router.get("/:id", autorizar(...SUPERVISION), controlador.verDetalle);
router.post("/:id/asistencia-manual", autorizar(...GESTION), controlador.registrarAsistenciaManual);
router.post("/:id/cerrar", autorizar(...GESTION), controlador.cerrarSesion);
router.delete("/:id", autorizar("coordinador"), controlador.eliminarSesion);

module.exports = router;
