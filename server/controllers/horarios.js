const db = require('../utils/db');

exports.listar = async (req, res, next) => {
  try {
    const { grupo_id } = req.query;
    let sql = `
      SELECT h.*, g.nombre AS grupo, m.nombre AS materia
      FROM horarios h
      JOIN grupos   g ON g.id = h.grupo_id
      JOIN materias m ON m.id = h.materia_id
      WHERE 1=1
    `;
    const params = [];
    if (grupo_id) { sql += ' AND h.grupo_id = ?'; params.push(grupo_id); }
    sql += ' ORDER BY h.dia_semana, h.hora_inicio';
    const rows = await db.query(sql, params);
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

exports.crear = async (req, res, next) => {
  try {
    const { grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min } = req.body;
    const result = await db.query(
      `INSERT INTO horarios (grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min || 10]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { next(e); }
};
