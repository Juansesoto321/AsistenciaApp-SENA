/**
 * CU-05 Gestionar fichas · CU-06 Matricular · CU-07 Ambientes y lectores
 * CU-08 Horarios · CU-09 Monitorear lectores
 *
 * El programador tiene las mismas atribuciones que el coordinador sobre la
 * planeacion academica; lo unico que no puede hacer es crear usuarios
 * (ese modulo vive en rutas/usuarios.js).
 */
const express = require("express");
const { autenticar, autorizar } = require("../middleware/autenticar");
const controlador = require("../controladores/academico");

const router = express.Router();
router.use(autenticar);

const PLANEACION = ["coordinador", "programador"];

// ---------- PERIODOS ----------
router.get("/periodos", controlador.listarPeriodos);
router.get("/instructores", autorizar(...PLANEACION), controlador.listarInstructores);
router.post("/periodos", autorizar(...PLANEACION), controlador.crearPeriodo);

// ---------- FICHAS (CU-05) ----------
router.get("/fichas", controlador.listarFichas);
router.post("/fichas", autorizar(...PLANEACION), controlador.crearFicha);

// ---------- MATRICULAS (CU-06) ----------
router.get("/fichas/:id/matriculas", autorizar(...PLANEACION, "instructor"), controlador.listarMatriculas);
router.post("/fichas/:id/matriculas", autorizar(...PLANEACION), controlador.matricular);
router.patch("/matriculas/:id", autorizar(...PLANEACION), controlador.cambiarEstadoMatricula);

// ---------- AMBIENTES Y DISPOSITIVOS (CU-07) ----------
// Incluye el serial de cada lector: solo la planeación lo necesita
router.get("/ambientes", autorizar(...PLANEACION), controlador.listarAmbientes);
router.post("/ambientes", autorizar(...PLANEACION), controlador.crearAmbiente);

// Asociar lector al ambiente: genera la clave API que usara el dispositivo
router.post("/ambientes/:id/dispositivo", autorizar(...PLANEACION), controlador.asociarDispositivo);

// CU-09: panel de monitoreo de lectores
router.get("/dispositivos", autorizar(...PLANEACION), controlador.listarDispositivos);

// ---------- HORARIOS (CU-08) ----------
router.get("/horarios", controlador.listarHorarios);
router.get("/festivos", controlador.listarFestivos);
router.post("/horarios", autorizar(...PLANEACION), controlador.crearHorario);
router.put("/horarios/:id", autorizar(...PLANEACION), controlador.editarHorario);
router.delete("/horarios/:id", autorizar(...PLANEACION), controlador.eliminarHorario);

module.exports = router;
