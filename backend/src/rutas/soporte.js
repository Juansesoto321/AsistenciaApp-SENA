/** CU-21 Soporte tecnico */
const express = require("express");
const controlador = require("../controladores/soporte");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar);

router.post("/", controlador.crear);
router.get("/", controlador.listar);
router.get("/tipos", controlador.tipos);
router.get("/:id/captura", controlador.verCaptura);
router.patch("/:id", autorizar("coordinador", "programador"), controlador.cambiarEstado);

module.exports = router;
