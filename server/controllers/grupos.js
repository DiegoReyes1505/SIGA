const db = require('../utils/db');

// GET /api/grupos
exports.listar = async (req, res, next) => {
  try {
    const { incluir_inactivos } = req.query;
    const sql = incluir_inactivos === '1'
      ? 'SELECT * FROM grupos ORDER BY nombre'
      : 'SELECT * FROM grupos WHERE activo = 1 ORDER BY nombre';
    const rows = await db.query(sql);
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

// GET /api/grupos/:id
exports.obtener = async (req, res, next) => {
  try {
    const [row] = await db.query('SELECT * FROM grupos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Grupo no encontrado' });
    res.json({ ok: true, datos: row });
  } catch (e) { next(e); }
};

// GET /api/grupos/:id/alumnos
exports.alumnos = async (req, res, next) => {
  try {
    const { incluir_inactivos } = req.query;
    let sql = `SELECT a.id, a.matricula, a.nombre, a.apellido_pat, a.apellido_mat,
                      a.huella_id, a.activo, a.creado_en
               FROM alumnos a
               WHERE a.grupo_id = ?`;
    if (incluir_inactivos !== '1') sql += ' AND a.activo = 1';
    sql += ' ORDER BY a.apellido_pat, a.nombre';
    const rows = await db.query(sql, [req.params.id]);
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

// GET /api/grupos/:id/horarios
exports.horarios = async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT h.*, m.nombre AS materia, m.clave
       FROM horarios h
       JOIN materias m ON m.id = h.materia_id
       WHERE h.grupo_id = ?
       ORDER BY h.dia_semana, h.hora_inicio`,
      [req.params.id]
    );
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

// POST /api/grupos
exports.crear = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre?.trim()) return res.status(422).json({ ok: false, mensaje: 'El nombre es obligatorio' });
    const [dup] = await db.query('SELECT id FROM grupos WHERE nombre = ?', [nombre.trim()]);
    if (dup) return res.status(409).json({ ok: false, mensaje: 'Ya existe un grupo con ese nombre' });
    const result = await db.query(
      'INSERT INTO grupos (nombre, descripcion) VALUES (?, ?)',
      [nombre.trim(), descripcion?.trim() || null]
    );
    res.status(201).json({ ok: true, id: result.insertId, mensaje: 'Grupo creado correctamente' });
  } catch (e) { next(e); }
};

// PUT /api/grupos/:id
exports.actualizar = async (req, res, next) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    if (!nombre?.trim()) return res.status(422).json({ ok: false, mensaje: 'El nombre es obligatorio' });
    const [dup] = await db.query('SELECT id FROM grupos WHERE nombre = ? AND id != ?', [nombre.trim(), req.params.id]);
    if (dup) return res.status(409).json({ ok: false, mensaje: 'Ya existe un grupo con ese nombre' });
    await db.query(
      'UPDATE grupos SET nombre=?, descripcion=?, activo=? WHERE id=?',
      [nombre.trim(), descripcion?.trim() || null, activo ?? 1, req.params.id]
    );
    res.json({ ok: true, mensaje: 'Grupo actualizado correctamente' });
  } catch (e) { next(e); }
};

// DELETE /api/grupos/:id  (baja lógica)
exports.eliminar = async (req, res, next) => {
  try {
    const [row] = await db.query('SELECT id FROM grupos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Grupo no encontrado' });
    const [alumnosActivos] = await db.query(
      'SELECT COUNT(*) AS total FROM alumnos WHERE grupo_id = ? AND activo = 1',
      [req.params.id]
    );
    if (alumnosActivos.total > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: `No se puede desactivar el grupo porque tiene ${alumnosActivos.total} alumno(s) activo(s)`
      });
    }
    await db.query('UPDATE grupos SET activo = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, mensaje: 'Grupo desactivado correctamente' });
  } catch (e) { next(e); }
};

// PATCH /api/grupos/:id/restaurar
exports.restaurar = async (req, res, next) => {
  try {
    await db.query('UPDATE grupos SET activo = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, mensaje: 'Grupo restaurado correctamente' });
  } catch (e) { next(e); }
};
