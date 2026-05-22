const db = require('../utils/db');

exports.listar = async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM materias WHERE activo = 1 ORDER BY nombre');
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

exports.crear = async (req, res, next) => {
  try {
    const { nombre, clave } = req.body;
    const result = await db.query(
      'INSERT INTO materias (nombre, clave) VALUES (?, ?)', [nombre, clave]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { next(e); }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { nombre, clave, activo } = req.body;
    await db.query(
      'UPDATE materias SET nombre=?, clave=?, activo=? WHERE id=?',
      [nombre, clave, activo ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
};
