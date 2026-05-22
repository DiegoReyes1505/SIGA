const db = require("../utils/db");

exports.listar = async (req, res, next) => {
  try {
    const { grupo_id, busqueda, incluir_inactivos } = req.query;

    let sql = `
      SELECT a.*, g.nombre AS grupo
      FROM alumnos a
      JOIN grupos g ON g.id = a.grupo_id
      WHERE 1=1
    `;
    const params = [];

    if (incluir_inactivos !== "1") {
      sql += " AND a.activo = 1";
    }

    if (grupo_id) {
      sql += " AND a.grupo_id = ?";
      params.push(grupo_id);
    }

    if (busqueda) {
      sql +=
        " AND (a.nombre LIKE ? OR a.apellido_pat LIKE ? OR a.apellido_mat LIKE ? OR a.matricula LIKE ?)";
      const q = `%${busqueda}%`;
      params.push(q, q, q, q);
    }

    sql += " ORDER BY a.activo DESC, a.apellido_pat, a.apellido_mat, a.nombre";

    const rows = await db.query(sql, params);
    res.json({ ok: true, datos: rows });
  } catch (e) {
    next(e);
  }
};

exports.obtener = async (req, res, next) => {
  try {
    const [row] = await db.query(
      `SELECT a.*, g.nombre AS grupo
       FROM alumnos a
       JOIN grupos g ON g.id = a.grupo_id
       WHERE a.id = ?`,
      [req.params.id],
    );

    if (!row) {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Alumno no encontrado" });
    }

    res.json({ ok: true, datos: row });
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { matricula, nombre, apellido_pat, apellido_mat, grupo_id } =
      req.body;

    if (!matricula || !nombre || !apellido_pat || !grupo_id) {
      return res.status(422).json({
        ok: false,
        mensaje: "Matrícula, nombre, apellido paterno y grupo son obligatorios",
      });
    }

    const [grupo] = await db.query(
      "SELECT id FROM grupos WHERE id = ? AND activo = 1",
      [grupo_id],
    );

    if (!grupo) {
      return res.status(422).json({ ok: false, mensaje: "Grupo inválido" });
    }

    const [duplicado] = await db.query(
      "SELECT id FROM alumnos WHERE matricula = ?",
      [matricula],
    );

    if (duplicado) {
      return res
        .status(409)
        .json({ ok: false, mensaje: "La matrícula ya existe" });
    }

    const result = await db.query(
      `INSERT INTO alumnos (matricula, nombre, apellido_pat, apellido_mat, grupo_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        matricula.trim(),
        nombre.trim(),
        apellido_pat.trim(),
        apellido_mat?.trim() || null,
        grupo_id,
      ],
    );

    res.status(201).json({
      ok: true,
      id: result.insertId,
      mensaje: "Alumno creado correctamente",
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { matricula, nombre, apellido_pat, apellido_mat, grupo_id } =
      req.body;

    if (!matricula || !nombre || !apellido_pat || !grupo_id) {
      return res.status(422).json({
        ok: false,
        mensaje: "Matrícula, nombre, apellido paterno y grupo son obligatorios",
      });
    }

    const [duplicado] = await db.query(
      "SELECT id FROM alumnos WHERE matricula = ? AND id != ?",
      [matricula, req.params.id],
    );

    if (duplicado) {
      return res
        .status(409)
        .json({ ok: false, mensaje: "La matrícula ya existe" });
    }

    await db.query(
      `UPDATE alumnos
       SET matricula = ?, nombre = ?, apellido_pat = ?, apellido_mat = ?, grupo_id = ?
       WHERE id = ?`,
      [
        matricula.trim(),
        nombre.trim(),
        apellido_pat.trim(),
        apellido_mat?.trim() || null,
        grupo_id,
        req.params.id,
      ],
    );

    res.json({ ok: true, mensaje: "Alumno actualizado correctamente" });
  } catch (e) {
    next(e);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    await db.query("UPDATE alumnos SET activo = 0 WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ ok: true, mensaje: "Alumno desactivado correctamente" });
  } catch (e) {
    next(e);
  }
};

exports.restaurar = async (req, res, next) => {
  try {
    await db.query("UPDATE alumnos SET activo = 1 WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ ok: true, mensaje: "Alumno restaurado correctamente" });
  } catch (e) {
    next(e);
  }
};

exports.asignarHuella = async (req, res, next) => {
  try {
    const { huella_id } = req.body;

    const [existente] = await db.query(
      "SELECT id FROM alumnos WHERE huella_id = ? AND id != ?",
      [huella_id, req.params.id],
    );

    if (existente) {
      return res
        .status(409)
        .json({ ok: false, mensaje: "ID de huella ya en uso" });
    }

    await db.query("UPDATE alumnos SET huella_id = ? WHERE id = ?", [
      huella_id,
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.eliminarHuella = async (req, res, next) => {
  try {
    await db.query("UPDATE alumnos SET huella_id = NULL WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.porHuellaId = async (req, res, next) => {
  try {
    const [row] = await db.query(
      `SELECT a.*, g.nombre AS grupo
       FROM alumnos a
       JOIN grupos g ON g.id = a.grupo_id
       WHERE a.huella_id = ? AND a.activo = 1`,
      [req.params.huella_id],
    );

    if (!row) {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Huella no registrada" });
    }

    res.json({ ok: true, datos: row });
  } catch (e) {
    next(e);
  }
};

exports.horariosPorAlumno = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alumnos = await db.query(
      `SELECT grupo_id FROM alumnos WHERE id = ?`,
      [id],
    );

    if (!alumnos || !alumnos.length) {
      return res.status(404).json({
        ok: false,
        mensaje: "Alumno no encontrado",
      });
    }

    const alumno = alumnos[0];

    const rows = await db.query(
      `
      SELECT
        h.id,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fin,
        m.nombre AS materia
      FROM horarios h
      INNER JOIN materias m ON m.id = h.materia_id
      WHERE h.grupo_id = ?
      ORDER BY h.dia_semana, h.hora_inicio
      `,
      [alumno.grupo_id],
    );

    res.json({
      ok: true,
      datos: rows,
    });
  } catch (e) {
    next(e);
  }
};
