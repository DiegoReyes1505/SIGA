const router = require("express").Router();
const ctrl = require("../controllers/reportes");

router.get("/resumen", ctrl.resumenGeneral);
router.get("/resumen-mes", ctrl.resumenMes);
router.get("/faltas-criticas", ctrl.faltasCriticas);
router.get("/retardos-criticos", ctrl.retardosCriticos);
router.get("/por-grupo", ctrl.porGrupo);
router.get("/tendencia-mensual", ctrl.tendenciaMensual);
router.get("/tendencia-diaria", ctrl.tendenciaDiaria);
router.get("/por-materia", ctrl.porMateria);

module.exports = router;
