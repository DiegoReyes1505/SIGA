const router = require("express").Router();
const ctrl = require("../controllers/alumnos");

router.get("/", ctrl.listar);
router.get("/huella/:huella_id", ctrl.porHuellaId);
router.get("/:id", ctrl.obtener);

router.post("/", ctrl.crear);
router.put("/:id", ctrl.actualizar);
router.delete("/:id", ctrl.eliminar);
router.patch("/:id/restaurar", ctrl.restaurar);

router.patch("/:id/huella", ctrl.asignarHuella);
router.delete("/:id/huella", ctrl.eliminarHuella);

router.get("/:id/horarios", ctrl.horariosPorAlumno);

module.exports = router;
