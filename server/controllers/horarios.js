const db = require('../utils/db');

// GET /api/horarios
exports.listar = async (req, res, next) => {
  try {
    const { grupo_id, materia_id, dia_semana } = req.query;
    let sql = `
      SELECT h.*, g.nombre AS grupo, m.nombre AS materia, m.clave
      FROM horarios h
      JOIN grupos   g ON g.id = h.grupo_id
      JOIN materias m ON m.id = h.materia_id
      WHERE 1=1
    `;
    const params = [];
    if (grupo_id)   { sql += ' AND h.grupo_id = ?';   params.push(grupo_id); }
    if (materia_id) { sql += ' AND h.materia_id = ?'; params.push(materia_id); }
    if (dia_semana) { sql += ' AND h.dia_semana = ?'; params.push(dia_semana); }
    sql += ' ORDER BY h.dia_semana, h.hora_inicio';
    const rows = await db.query(sql, params);
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

// GET /api/horarios/:id
exports.obtener = async (req, res, next) => {
  try {
    const [row] = await db.query(
      `SELECT h.*, g.nombre AS grupo, m.nombre AS materia, m.clave
       FROM horarios h
       JOIN grupos   g ON g.id = h.grupo_id
       JOIN materias m ON m.id = h.materia_id
       WHERE h.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });
    res.json({ ok: true, datos: row });
  } catch (e) { next(e); }
};

// POST /api/horarios
exports.crear = async (req, res, next) => {
  try {
    const { grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min } = req.body;
    if (!grupo_id || !materia_id || dia_semana == null || !hora_inicio || !hora_fin)
      return res.status(422).json({ ok: false, mensaje: 'grupo_id, materia_id, dia_semana, hora_inicio y hora_fin son obligatorios' });
    if (hora_fin <= hora_inicio)
      return res.status(422).json({ ok: false, mensaje: 'La hora de fin debe ser mayor que la hora de inicio' });
    // Verificar solapamiento en el mismo grupo y día
    const [solape] = await db.query(
      `SELECT id FROM horarios
       WHERE grupo_id = ? AND dia_semana = ?
         AND hora_inicio < ? AND hora_fin > ?`,
      [grupo_id, dia_semana, hora_fin, hora_inicio]
    );
    if (solape) return res.status(409).json({ ok: false, mensaje: 'El horario se solapa con uno existente en el mismo grupo y día' });
    const result = await db.query(
      `INSERT INTO horarios (grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min || 10]
    );
    res.status(201).json({ ok: true, id: result.insertId, mensaje: 'Horario creado correctamente' });
  } catch (e) { next(e); }
};

// PUT /api/horarios/:id
exports.actualizar = async (req, res, next) => {
  try {
    const { grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min } = req.body;
    if (!grupo_id || !materia_id || dia_semana == null || !hora_inicio || !hora_fin)
      return res.status(422).json({ ok: false, mensaje: 'grupo_id, materia_id, dia_semana, hora_inicio y hora_fin son obligatorios' });
    if (hora_fin <= hora_inicio)
      return res.status(422).json({ ok: false, mensaje: 'La hora de fin debe ser mayor que la hora de inicio' });
    const [row] = await db.query('SELECT id FROM horarios WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });
    // Verificar solapamiento excluyendo el propio registro
    const [solape] = await db.query(
      `SELECT id FROM horarios
       WHERE grupo_id = ? AND dia_semana = ?
         AND hora_inicio < ? AND hora_fin > ?
         AND id != ?`,
      [grupo_id, dia_semana, hora_fin, hora_inicio, req.params.id]
    );
    if (solape) return res.status(409).json({ ok: false, mensaje: 'El horario se solapa con uno existente en el mismo grupo y día' });
    await db.query(
      `UPDATE horarios SET grupo_id=?, materia_id=?, dia_semana=?, hora_inicio=?, hora_fin=?, tolerancia_min=? WHERE id=?`,
      [grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min || 10, req.params.id]
    );
    res.json({ ok: true, mensaje: 'Horario actualizado correctamente' });
  } catch (e) { next(e); }
};

// DELETE /api/horarios/:id
exports.eliminar = async (req, res, next) => {
  try {
    const [row] = await db.query('SELECT id FROM horarios WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });
    await db.query('DELETE FROM horarios WHERE id = ?', [req.params.id]);
    res.json({ ok: true, mensaje: 'Horario eliminado correctamente' });
  } catch (e) { next(e); }
};
