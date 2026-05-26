const router  = require('express').Router();
const ctrl    = require('../controllers/asistencias');

router.get   ('/',                              ctrl.listar);
router.get   ('/alumno/:alumno_id/resumen',     ctrl.resumenAlumno);  // antes del /:id
router.get   ('/:id',                           ctrl.obtener);
router.post  ('/',                              ctrl.crear);
router.put   ('/:id',                           ctrl.actualizar);
router.delete('/:id',                           ctrl.eliminar);

module.exports = router;
