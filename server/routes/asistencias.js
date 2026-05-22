const router = require("express").Router();
const ctrl = require("../controllers/asistencias");

router.get("/", ctrl.listar);
router.get("/hoy", ctrl.hoy);
router.get("/alumno/:alumno_id/horarios", ctrl.horariosDeAlumno);
router.post("/", ctrl.registrar);
router.post("/permiso", ctrl.registrarPermiso);

module.exports = router;
