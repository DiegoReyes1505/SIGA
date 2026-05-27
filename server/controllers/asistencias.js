const db          = require('../utils/db');
const { ahoraLocal } = require('../utils/fechaLocal');

const TIPOS_MANUALES = ['asistencia', 'retardo', 'permiso']; // 'falta' excluida — es automática
const TIPOS_TODOS    = ['asistencia', 'retardo', 'falta', 'permiso'];

// GET /api/asistencias
exports.listar = async (req, res, next) => {
  try {
    const { alumno_id, horario_id, fecha, fecha_inicio, fecha_fin, tipo, grupo_id } = req.query;
    let sql = `
      SELECT
        a.id, a.alumno_id, a.horario_id, a.fecha, a.hora_entrada,
        a.tipo, a.nota, a.registrado_por, a.creado_en,
        CONCAT(al.nombre, ' ', al.apellido_pat) AS alumno,
        al.matricula,
        m.nombre  AS materia,
        g.nombre  AS grupo,
        h.dia_semana, h.hora_inicio, h.hora_fin
      FROM asistencias a
      JOIN alumnos  al ON al.id = a.alumno_id
      JOIN horarios h  ON h.id  = a.horario_id
      JOIN materias m  ON m.id  = h.materia_id
      JOIN grupos   g  ON g.id  = al.grupo_id
      WHERE 1=1
    `;
    const params = [];
    if (alumno_id)   { sql += ' AND a.alumno_id = ?';  params.push(alumno_id); }
    if (horario_id)  { sql += ' AND a.horario_id = ?'; params.push(horario_id); }
    if (tipo)        { sql += ' AND a.tipo = ?';        params.push(tipo); }
    if (grupo_id)    { sql += ' AND g.id = ?';          params.push(grupo_id); }
    if (fecha)       { sql += ' AND a.fecha = ?';       params.push(fecha); }
    else if (fecha_inicio && fecha_fin) {
      sql += ' AND a.fecha BETWEEN ? AND ?'; params.push(fecha_inicio, fecha_fin);
    } else if (fecha_inicio) {
      sql += ' AND a.fecha >= ?'; params.push(fecha_inicio);
    } else if (fecha_fin) {
      sql += ' AND a.fecha <= ?'; params.push(fecha_fin);
    }
    sql += ' ORDER BY a.fecha DESC, h.hora_inicio';
    const rows = await db.query(sql, params);
    res.json({ ok: true, datos: rows });
  } catch (e) { next(e); }
};

// GET /api/asistencias/:id
exports.obtener = async (req, res, next) => {
  try {
    const [row] = await db.query(
      `SELECT
        a.*,
        CONCAT(al.nombre, ' ', al.apellido_pat) AS alumno,
        al.matricula,
        m.nombre AS materia,
        g.nombre AS grupo,
        h.dia_semana, h.hora_inicio, h.hora_fin
       FROM asistencias a
       JOIN alumnos  al ON al.id = a.alumno_id
       JOIN horarios h  ON h.id  = a.horario_id
       JOIN materias m  ON m.id  = h.materia_id
       JOIN grupos   g  ON g.id  = al.grupo_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Asistencia no encontrada' });
    res.json({ ok: true, datos: row });
  } catch (e) { next(e); }
};

// POST /api/asistencias  (registro manual — faltas NO permitidas)
exports.crear = async (req, res, next) => {
  try {
    const { alumno_id, horario_id, fecha, hora_entrada, tipo, nota } = req.body;
    if (!alumno_id || !horario_id || !fecha || !tipo)
      return res.status(422).json({ ok: false, mensaje: 'alumno_id, horario_id, fecha y tipo son obligatorios' });
    if (!TIPOS_MANUALES.includes(tipo))
      return res.status(422).json({
        ok: false,
        mensaje: `Las faltas se generan automáticamente al terminar la clase. Tipos permitidos manualmente: ${TIPOS_MANUALES.join(', ')}`
      });
    const [dup] = await db.query(
      'SELECT id FROM asistencias WHERE alumno_id = ? AND horario_id = ? AND fecha = ?',
      [alumno_id, horario_id, fecha]
    );
    if (dup) return res.status(409).json({ ok: false, mensaje: 'Ya existe un registro para ese alumno, horario y fecha' });
    const result = await db.query(
      `INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, nota, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
      [alumno_id, horario_id, fecha, hora_entrada || null, tipo, nota || null]
    );
    res.status(201).json({ ok: true, id: result.insertId, mensaje: 'Asistencia registrada correctamente' });
  } catch (e) { next(e); }
};

// PUT /api/asistencias/:id
exports.actualizar = async (req, res, next) => {
  try {
    const { tipo, hora_entrada, nota } = req.body;
    if (tipo && !TIPOS_TODOS.includes(tipo))
      return res.status(422).json({ ok: false, mensaje: `Tipo inválido. Debe ser: ${TIPOS_TODOS.join(', ')}` });
    if (tipo === 'falta') {
      const [actual] = await db.query('SELECT tipo FROM asistencias WHERE id = ?', [req.params.id]);
      if (!actual) return res.status(404).json({ ok: false, mensaje: 'Asistencia no encontrada' });
      if (actual.tipo !== 'falta')
        return res.status(422).json({
          ok: false,
          mensaje: 'No se puede cambiar a falta manualmente. Las faltas son generadas automáticamente.'
        });
    }
    const [row] = await db.query('SELECT id FROM asistencias WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Asistencia no encontrada' });
    await db.query(
      `UPDATE asistencias
       SET tipo         = COALESCE(?, tipo),
           hora_entrada = COALESCE(?, hora_entrada),
           nota         = COALESCE(?, nota)
       WHERE id = ?`,
      [tipo || null, hora_entrada || null, nota || null, req.params.id]
    );
    res.json({ ok: true, mensaje: 'Asistencia actualizada correctamente' });
  } catch (e) { next(e); }
};

// DELETE /api/asistencias/:id
exports.eliminar = async (req, res, next) => {
  try {
    const [row] = await db.query('SELECT id, tipo FROM asistencias WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, mensaje: 'Asistencia no encontrada' });
    await db.query('DELETE FROM asistencias WHERE id = ?', [req.params.id]);
    res.json({ ok: true, mensaje: 'Registro eliminado correctamente' });
  } catch (e) { next(e); }
};

// GET /api/asistencias/alumno/:alumno_id/resumen
exports.resumenAlumno = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const desde = fecha_inicio || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const hasta = fecha_fin   || new Date().toISOString().slice(0, 10);
    const [totales] = await db.query(
      `SELECT
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN tipo = 'permiso'    THEN 1 END) AS permisos,
        COUNT(*) AS total
       FROM asistencias
       WHERE alumno_id = ? AND fecha BETWEEN ? AND ?`,
      [req.params.alumno_id, desde, hasta]
    );
    const detalle = await db.query(
      `SELECT a.fecha, a.tipo, a.hora_entrada, a.nota, a.registrado_por,
              m.nombre AS materia, h.hora_inicio, h.hora_fin
       FROM asistencias a
       JOIN horarios h ON h.id = a.horario_id
       JOIN materias m ON m.id = h.materia_id
       WHERE a.alumno_id = ? AND a.fecha BETWEEN ? AND ?
       ORDER BY a.fecha DESC, h.hora_inicio`,
      [req.params.alumno_id, desde, hasta]
    );
    res.json({ ok: true, rango: { desde, hasta }, totales, detalle });
  } catch (e) { next(e); }
};

// ── Registro automático desde sensor biométrico ────────────────────────────
// Días en BD: 1=Lunes … 7=Domingo  (igual que el helper ahoraLocal)
exports.registrarDesdeSensor = async (alumno, io) => {
  try {
    // Usar hora local de Cancún, no UTC del servidor
    const { hoy, hora, diaSemana, ahora } = ahoraLocal();

    // Buscar horario activo para el grupo del alumno en este momento
    const [horario] = await db.query(
      `SELECT h.*, m.nombre AS materia_nombre
       FROM horarios h
       JOIN materias m ON m.id = h.materia_id
       WHERE h.grupo_id   = ?
         AND h.dia_semana = ?
         AND h.hora_inicio <= ?
         AND h.hora_fin   >= ?
       LIMIT 1`,
      [alumno.grupo_id, diaSemana, hora, hora]
    );

    if (!horario) {
      io.emit('asistencia:sin_horario', {
        alumno_id: alumno.id,
        alumno:    `${alumno.nombre} ${alumno.apellido_pat}`,
        hora,
        dia: diaSemana
      });
      return { ok: false, mensaje: 'No hay clase activa en este momento para este alumno' };
    }

    // Verificar registro duplicado
    const [existente] = await db.query(
      'SELECT id, tipo FROM asistencias WHERE alumno_id = ? AND horario_id = ? AND fecha = ?',
      [alumno.id, horario.id, hoy]
    );

    if (existente) {
      io.emit('asistencia:duplicada', {
        alumno_id: alumno.id,
        alumno:    `${alumno.nombre} ${alumno.apellido_pat}`,
        tipo:      existente.tipo
      });
      return { ok: false, mensaje: `Ya tiene ${existente.tipo} registrada hoy en esta clase` };
    }

    // Determinar tipo usando tolerancia_min de la BD (default 10)
    const [hIni_h, hIni_m] = horario.hora_inicio.split(':').map(Number);
    const inicioMin  = hIni_h * 60 + hIni_m;
    const [hora_h, hora_m] = hora.split(':').map(Number);
    const ahoraMin   = hora_h * 60 + hora_m;
    const tolerancia = horario.tolerancia_min || 10;
    const tipo       = (ahoraMin - inicioMin) > tolerancia ? 'retardo' : 'asistencia';

    // Insertar asistencia
    const result = await db.query(
      `INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por)
       VALUES (?, ?, ?, ?, ?, 'sensor')`,
      [alumno.id, horario.id, hoy, hora, tipo]
    );

    // Notificar a todos los clientes web
    io.emit('asistencia:nueva', {
      id:           result.insertId,
      alumno_id:    alumno.id,
      alumno:       `${alumno.nombre} ${alumno.apellido_pat}`,
      matricula:    alumno.matricula,
      grupo:        alumno.grupo,
      materia:      horario.materia_nombre,
      tipo,
      hora_entrada: hora,
      fecha:        hoy
    });

    // Cooldown de 5 segundos para evitar doble lectura
    const readerState = require('./reader-state');
    readerState.startCooldown(5);
    io.emit('reader:cooldown', readerState.getState());

    return { ok: true, tipo, alumno_id: alumno.id };

  } catch (e) {
    return { ok: false, mensaje: e.message };
  }
};
