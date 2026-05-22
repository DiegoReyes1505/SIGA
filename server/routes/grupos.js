const router = require('express').Router();
const ctrl   = require('../controllers/grupos');

router.get('/',    ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/',   ctrl.crear);
router.put('/:id', ctrl.actualizar);

module.exports = router;
