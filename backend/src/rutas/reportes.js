/**
 * CU-17 Busqueda avanzada · CU-18 Exportar · CU-19 Historial del aprendiz
 * + estadisticas del dashboard
 */
const express = require("express");
const controlador = require("../controladores/reportes");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar);

router.get("/busqueda", autorizar("coordinador", "programador", "instructor"), controlador.buscar);
router.get("/exportar", autorizar("coordinador", "programador", "instructor"), controlador.exportar);
router.get("/busquedas-guardadas", controlador.listarBusquedasGuardadas);
router.post("/busquedas-guardadas", controlador.guardarBusqueda);
router.get("/mi-historial", autorizar("aprendiz"), controlador.miHistorial);
router.get("/estadisticas", autorizar("coordinador", "programador", "instructor"), controlador.estadisticas);
router.get("/resumen", autorizar("coordinador", "programador", "instructor"), controlador.resumen);
router.get("/tendencia", autorizar("coordinador", "programador", "instructor"), controlador.tendencia);
router.post("/exportaciones", autorizar("coordinador", "programador", "instructor"), controlador.registrarExportacion);

module.exports = router;
