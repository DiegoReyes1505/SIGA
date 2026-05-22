const router = require('express').Router();
const ctrl   = require('../controllers/sensor');
const { agentAuth } = require('../middleware/auth');

// Rutas protegidas solo para el agente local
router.post('/evento',   agentAuth, ctrl.procesarEvento);
router.post('/enroll',   agentAuth, ctrl.confirmEnroll);
router.post('/delete',   agentAuth, ctrl.confirmDelete);
router.get('/status',    agentAuth, ctrl.status);

module.exports = router;
