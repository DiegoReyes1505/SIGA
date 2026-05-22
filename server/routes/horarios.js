const router = require('express').Router();
const ctrl   = require('../controllers/horarios');

router.get('/',    ctrl.listar);
router.post('/',   ctrl.crear);

module.exports = router;
