const db = require('../utils/db');

// GET /api/materias
exports.listar = async (req, res, next) => {
  try {
    const { incluir_inactivos } = req.query;
    const sql = incluir_inactivos === '1'
      ? 'SELECT * FROM materias ORDER BY nombre'
      : 'SELECT * FROM materias WHERE activo = 1 ORDER BY nombre';
    const rows = await db.query(sql);
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

// GET /api/materias/:id
exports.obtener = async (req, res, next) => {
  try {
    const [row] = await db.query('SELECT * FROM materias WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Materia no encontrada' });
    res.json({ ok: true, datos: row });
  } catch (e) { next(e); }
};

// POST /api/materias
exports.crear = async (req, res, next) => {
  try {
    const { nombre, clave } = req.body;
    if (!nombre?.trim() || !clave?.trim())
      return res.status(422).json({ ok: false, mensaje: 'Nombre y clave son obligatorios' });
    const [dup] = await db.query('SELECT id FROM materias WHERE clave = ?', [clave.trim().toUpperCase()]);
    if (dup) return res.status(409).json({ ok: false, mensaje: 'La clave ya existe' });
    const result = await db.query(
      'INSERT INTO materias (nombre, clave) VALUES (?, ?)',
      [nombre.trim(), clave.trim().toUpperCase()]
    );
    res.status(201).json({ ok: true, id: result.insertId, mensaje: 'Materia creada correctamente' });
  } catch (e) { next(e); }
};

// PUT /api/materias/:id
exports.actualizar = async (req, res, next) => {
  try {
    const { nombre, clave, activo } = req.body;
    if (!nombre?.trim() || !clave?.trim())
      return res.status(422).json({ ok: false, mensaje: 'Nombre y clave son obligatorios' });
    const [dup] = await db.query('SELECT id FROM materias WHERE clave = ? AND id != ?', [clave.trim().toUpperCase(), req.params.id]);
    if (dup) return res.status(409).json({ ok: false, mensaje: 'La clave ya existe en otra materia' });
    await db.query(
      'UPDATE materias SET nombre=?, clave=?, activo=? WHERE id=?',
      [nombre.trim(), clave.trim().toUpperCase(), activo ?? 1, req.params.id]
    );
    res.json({ ok: true, mensaje: 'Materia actualizada correctamente' });
  } catch (e) { next(e); }
};

// DELETE /api/materias/:id  (baja lógica)
exports.eliminar = async (req, res, next) => {
  try {
    const [row] = await db.query('SELECT id FROM materias WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Materia no encontrada' });
    await db.query('UPDATE materias SET activo = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, mensaje: 'Materia desactivada correctamente' });
  } catch (e) { next(e); }
};

// PATCH /api/materias/:id/restaurar
exports.restaurar = async (req, res, next) => {
  try {
    await db.query('UPDATE materias SET activo = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, mensaje: 'Materia restaurada correctamente' });
  } catch (e) { next(e); }
};
