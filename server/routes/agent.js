const router = require("express").Router();
const ctrl = require("../controllers/agent");

router.post("/enroll", ctrl.enroll);
router.post("/delete", ctrl.deleteFingerprint);
router.post("/cancel", ctrl.cancelEnroll);

module.exports = router;
