/**
 * RUTA TEMPORAL DE MIGRACIÓN — eliminar después de usarla
 * GET /api/migracion/fix-faltas
 */
const express = require('express');
const router  = express.Router();
const db      = require('../utils/db');

router.get('/fix-faltas', async (req, res) => {
  try {
    const [{ total }] = await db.query(
      `SELECT COUNT(*) AS total FROM asistencias
       WHERE tipo = 'falta' AND (registrado_por != 'sensor' OR registrado_por IS NULL)`
    );

    if (total === 0) {
      return res.json({ ok: true, mensaje: 'Nada que migrar, todas las faltas ya tienen registrado_por=sensor', afectadas: 0 });
    }

    const result = await db.query(
      `UPDATE asistencias SET registrado_por = 'sensor'
       WHERE tipo = 'falta' AND (registrado_por != 'sensor' OR registrado_por IS NULL)`
    );

    res.json({ ok: true, mensaje: `Migración completada`, afectadas: result.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, mensaje: e.message });
  }
});

module.exports = router;
