/**
 * Plan de formación por trimestre de cada ficha (qué competencia, con qué
 * instructor y en qué trimestre). Lo consultan el personal de la ficha; lo
 * arman el coordinador y el programador.
 */
const express = require("express");
const { autenticar, autorizar } = require("../middleware/autenticar");
const controlador = require("../controladores/programacion");

const router = express.Router();
router.use(autenticar);

const PLANEACION = ["coordinador", "programador"];

router.get("/fichas/:id/programacion", autorizar(...PLANEACION, "instructor"), controlador.obtenerPlan);
router.post("/fichas/:id/programacion", autorizar(...PLANEACION), controlador.programar);
router.patch("/fichas/:id/trimestres", autorizar(...PLANEACION), controlador.cambiarTrimestres);
router.delete("/programacion/:id", autorizar(...PLANEACION), controlador.quitar);

module.exports = router;
