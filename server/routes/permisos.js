const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/permisos");
const syncCtrl = require("../controllers/sync-permisos");

router.get("/", ctrl.listar);
router.get("/sync", syncCtrl.sync);
router.get("/:id", ctrl.detalle);
router.post("/", ctrl.crear);
router.put("/:id", ctrl.actualizar);
router.patch("/:id/cancelar", ctrl.cancelar);

module.exports = router;
