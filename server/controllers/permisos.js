const db = require("../utils/db");
const {
  aplicarPermiso,
  recalcularAsistenciasTrasCancelar,
} = require("../services/permisos");

exports.listar = async (req, res, next) => {
  try {
    const rows = await db.query(`
      SELECT
        p.id,
        p.alumno_id,
        p.fecha_inicio,
        p.fecha_fin,
        p.motivo,
        p.activo,
        CONCAT(
          a.matricula, ' - ', a.nombre, ' ', a.apellido_pat, ' ', COALESCE(a.apellido_mat, '')
        ) AS alumno
      FROM permisos p
      INNER JOIN alumnos a ON a.id = p.alumno_id
      ORDER BY p.id DESC
    `);

    for (const row of rows) {
      const hs = await db.query(
        `SELECT
           h.id,
           m.nombre AS materia,
           h.dia_semana,
           h.hora_inicio,
           h.hora_fin
         FROM permiso_horarios ph
         INNER JOIN horarios h ON h.id = ph.horario_id
         INNER JOIN materias m ON m.id = h.materia_id
         WHERE ph.permiso_id = ?
         ORDER BY h.dia_semana, h.hora_inicio`,
        [row.id],
      );
      row.horarios = hs;
    }

    res.json({ ok: true, datos: rows });
  } catch (e) {
    next(e);
  }
};

exports.detalle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const permisos = await db.query(`SELECT * FROM permisos WHERE id = ?`, [
      id,
    ]);

    if (!permisos.length) {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Permiso no encontrado" });
    }

    const permiso = permisos[0];
    const horarios = await db.query(
      `SELECT horario_id FROM permiso_horarios WHERE permiso_id = ?`,
      [id],
    );
    permiso.horario_ids = horarios.map((h) => h.horario_id);

    res.json({ ok: true, datos: permiso });
  } catch (e) {
    next(e);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { alumno_id, fecha_inicio, fecha_fin, motivo, horario_ids } =
      req.body;

    if (
      !alumno_id ||
      !fecha_inicio ||
      !fecha_fin ||
      !motivo ||
      !Array.isArray(horario_ids) ||
      !horario_ids.length
    ) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "Faltan datos obligatorios" });
    }

    if (fecha_fin < fecha_inicio) {
      return res
        .status(400)
        .json({
          ok: false,
          mensaje: "La fecha fin no puede ser menor que la fecha inicio",
        });
    }

    const result = await db.query(
      `INSERT INTO permisos (alumno_id, fecha_inicio, fecha_fin, motivo, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [alumno_id, fecha_inicio, fecha_fin, motivo],
    );

    const permisoId = result.insertId;

    for (const horarioId of horario_ids) {
      await db.query(
        `INSERT INTO permiso_horarios (permiso_id, horario_id) VALUES (?, ?)`,
        [permisoId, horarioId],
      );
    }

    await aplicarPermiso(permisoId);

    res.json({
      ok: true,
      mensaje: "Permiso registrado correctamente",
      id: permisoId,
    });
  } catch (e) {
    next(e);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { alumno_id, fecha_inicio, fecha_fin, motivo, horario_ids, activo } =
      req.body;

    if (
      !alumno_id ||
      !fecha_inicio ||
      !fecha_fin ||
      !motivo ||
      !Array.isArray(horario_ids) ||
      !horario_ids.length
    ) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "Faltan datos obligatorios" });
    }

    if (fecha_fin < fecha_inicio) {
      return res
        .status(400)
        .json({
          ok: false,
          mensaje: "La fecha fin no puede ser menor que la fecha inicio",
        });
    }

    await recalcularAsistenciasTrasCancelar(id);

    await db.query(
      `UPDATE permisos
       SET alumno_id = ?, fecha_inicio = ?, fecha_fin = ?, motivo = ?, activo = ?
       WHERE id = ?`,
      [alumno_id, fecha_inicio, fecha_fin, motivo, activo ? 1 : 0, id],
    );

    await db.query(`DELETE FROM permiso_horarios WHERE permiso_id = ?`, [id]);

    for (const horarioId of horario_ids) {
      await db.query(
        `INSERT INTO permiso_horarios (permiso_id, horario_id) VALUES (?, ?)`,
        [id, horarioId],
      );
    }

    if (activo) {
      await aplicarPermiso(id);
    }

    res.json({ ok: true, mensaje: "Permiso actualizado correctamente" });
  } catch (e) {
    next(e);
  }
};

exports.cancelar = async (req, res, next) => {
  try {
    const { id } = req.params;
    await recalcularAsistenciasTrasCancelar(id);
    await db.query(`UPDATE permisos SET activo = 0 WHERE id = ?`, [id]);
    res.json({ ok: true, mensaje: "Permiso cancelado correctamente" });
  } catch (e) {
    next(e);
  }
};
