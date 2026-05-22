const db = require('../utils/db');

exports.listar = async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM grupos WHERE activo = 1 ORDER BY nombre');
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

exports.obtener = async (req, res, next) => {
  try {
    const [row] = await db.query('SELECT * FROM grupos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Grupo no encontrado' });
    res.json({ ok: true, datos: row });
  } catch (e) { next(e); }
};

exports.crear = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    const result = await db.query(
      'INSERT INTO grupos (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion || null]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { next(e); }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    await db.query(
      'UPDATE grupos SET nombre=?, descripcion=?, activo=? WHERE id=?',
      [nombre, descripcion || null, activo ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
};
