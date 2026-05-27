const router  = require('express').Router();
const ctrl    = require('../controllers/materias');

router.get   ('/',              ctrl.listar);
router.get   ('/:id',          ctrl.obtener);
router.post  ('/',              ctrl.crear);
router.put   ('/:id',          ctrl.actualizar);
router.delete('/:id',          ctrl.eliminar);     // baja lógica
router.patch ('/:id/restaurar', ctrl.restaurar);

module.exports = router;
