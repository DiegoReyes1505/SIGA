const router  = require('express').Router();
const ctrl    = require('../controllers/grupos');

router.get   ('/',                ctrl.listar);      // listar todos
router.get   ('/:id',             ctrl.obtener);     // detalle
router.get   ('/:id/alumnos',     ctrl.alumnos);     // alumnos del grupo
router.get   ('/:id/horarios',    ctrl.horarios);    // horarios del grupo
router.post  ('/',                ctrl.crear);
router.put   ('/:id',             ctrl.actualizar);
router.delete('/:id',             ctrl.eliminar);    // baja lógica
router.patch ('/:id/restaurar',   ctrl.restaurar);

module.exports = router;
