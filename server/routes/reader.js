const router = require("express").Router();
const ctrl = require("../controllers/reader");

router.get("/status", ctrl.status);

module.exports = router;
