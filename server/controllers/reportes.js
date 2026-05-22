const db = require("../utils/db");

// ── Resumen de hoy ────────────────────────────────────────────
exports.resumenGeneral = async (req, res, next) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const [stats] = await db.query(
      `
      SELECT
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN tipo = 'permiso'    THEN 1 END) AS permisos,
        COUNT(*) AS total
      FROM asistencias WHERE fecha = ?
    `,
      [hoy],
    );
    res.json({ ok: true, datos: stats, fecha: hoy });
  } catch (e) {
    next(e);
  }
};

// ── Faltas críticas ───────────────────────────────────────────
exports.faltasCriticas = async (req, res, next) => {
  try {
    const { umbral = 3, dias = 30 } = req.query;
    const desde = new Date(Date.now() - dias * 86400000)
      .toISOString()
      .slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        a.id, a.matricula,
        CONCAT(a.nombre,' ',a.apellido_pat) AS alumno,
        g.nombre AS grupo,
        COUNT(CASE WHEN as2.tipo = 'falta'   THEN 1 END) AS faltas,
        COUNT(CASE WHEN as2.tipo = 'retardo' THEN 1 END) AS retardos,
        COUNT(CASE WHEN as2.tipo = 'permiso' THEN 1 END) AS permisos
      FROM alumnos a
      JOIN grupos g ON g.id = a.grupo_id
      LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha >= ?
      WHERE a.activo = 1
      GROUP BY a.id
      HAVING faltas >= ?
      ORDER BY faltas DESC
    `,
      [desde, parseInt(umbral)],
    );
    res.json({ ok: true, datos: rows, parametros: { umbral, dias, desde } });
  } catch (e) {
    next(e);
  }
};

// ── Por grupo ─────────────────────────────────────────────────
exports.porGrupo = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const desde =
      fecha_inicio ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const hasta = fecha_fin || new Date().toISOString().slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        g.nombre AS grupo,
        COUNT(CASE WHEN as2.tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN as2.tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN as2.tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN as2.tipo = 'permiso'    THEN 1 END) AS permisos
      FROM grupos g
      LEFT JOIN alumnos a       ON a.grupo_id = g.id AND a.activo = 1
      LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha BETWEEN ? AND ?
      WHERE g.activo = 1
      GROUP BY g.id
      ORDER BY g.nombre
    `,
      [desde, hasta],
    );
    res.json({ ok: true, datos: rows, rango: { desde, hasta } });
  } catch (e) {
    next(e);
  }
};

// ── Tendencia mensual (6 meses) ───────────────────────────────
exports.tendenciaMensual = async (req, res, next) => {
  try {
    const rows = await db.query(`
      SELECT
        DATE_FORMAT(fecha, '%Y-%m') AS mes,
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas
      FROM asistencias
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes
      ORDER BY mes
    `);
    res.json({ ok: true, datos: rows });
  } catch (e) {
    next(e);
  }
};

// ── Resumen del mes actual ────────────────────────────────────
exports.resumenMes = async (req, res, next) => {
  try {
    const [stats] = await db.query(`
      SELECT
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN tipo = 'permiso'    THEN 1 END) AS permisos,
        COUNT(*) AS total
      FROM asistencias
      WHERE YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())
    `);
    res.json({ ok: true, datos: stats });
  } catch (e) {
    next(e);
  }
};

// ── Retardos críticos ─────────────────────────────────────────
exports.retardosCriticos = async (req, res, next) => {
  try {
    const { umbral = 2, dias = 30 } = req.query;
    const desde = new Date(Date.now() - dias * 86400000)
      .toISOString()
      .slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        a.id, a.matricula,
        CONCAT(a.nombre,' ',a.apellido_pat) AS alumno,
        g.nombre AS grupo,
        COUNT(CASE WHEN as2.tipo = 'retardo' THEN 1 END) AS retardos,
        COUNT(CASE WHEN as2.tipo = 'falta'   THEN 1 END) AS faltas
      FROM alumnos a
      JOIN grupos g ON g.id = a.grupo_id
      LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha >= ?
      WHERE a.activo = 1
      GROUP BY a.id
      HAVING retardos >= ?
      ORDER BY retardos DESC
      LIMIT 10
    `,
      [desde, parseInt(umbral)],
    );
    res.json({ ok: true, datos: rows, parametros: { umbral, dias, desde } });
  } catch (e) {
    next(e);
  }
};

// ── NUEVO: Tendencia por día (últimos N días) ─────────────────
exports.tendenciaDiaria = async (req, res, next) => {
  try {
    const { dias = 14 } = req.query;
    const rows = await db.query(
      `
      SELECT
        fecha,
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas
      FROM asistencias
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY fecha
      ORDER BY fecha ASC
    `,
      [parseInt(dias)],
    );
    res.json({ ok: true, datos: rows });
  } catch (e) {
    next(e);
  }
};

// ── NUEVO: Asistencia por materia (último mes) ────────────────
exports.porMateria = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const desde =
      fecha_inicio ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const hasta = fecha_fin || new Date().toISOString().slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        m.nombre AS materia,
        COUNT(CASE WHEN a.tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN a.tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN a.tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN a.tipo = 'permiso'    THEN 1 END) AS permisos,
        COUNT(*) AS total
      FROM asistencias a
      JOIN horarios h  ON h.id = a.horario_id
      JOIN materias m  ON m.id = h.materia_id
      WHERE a.fecha BETWEEN ? AND ?
      GROUP BY m.id
      ORDER BY total DESC
    `,
      [desde, hasta],
    );
    res.json({ ok: true, datos: rows, rango: { desde, hasta } });
  } catch (e) {
    next(e);
  }
};
