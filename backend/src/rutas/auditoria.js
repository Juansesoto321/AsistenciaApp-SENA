/**
 * Registro de actividad (auditoría): quién hizo qué y cuándo. Solo lo
 * consulta la coordinación, igual que el registro de errores.
 */
const express = require("express");
const controlador = require("../controladores/auditoria");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();

router.use(autenticar, autorizar("coordinador", "programador"));

router.get("/", controlador.listar);
router.post("/exportaciones", controlador.registrarExportacion);

module.exports = router;
