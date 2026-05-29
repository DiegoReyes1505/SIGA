/**
 * faltas.js — Generación automática de faltas al terminar cada clase
 *
 * Causa raíz del bug original:
 *  mysql2 devuelve columnas TIME como objetos Duration/Date, no como strings
 *  'HH:MM:SS'. La comparación hora_fin <= '09:00:00' siempre fallaba.
 *  Solución: usar TIME_FORMAT(hora_fin,'%H:%i:%s') en el SELECT para forzar
 *  que llegue como string comparable, y construir hAhora/hAntes igual.
 */

const db     = require('../utils/db');
const logger = require('../utils/logger');

// ── Helpers de fecha/hora en GMT-6 ──────────────────────────────────────
function ahoraGMT6() {
  return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

function isoFecha(d) {
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Devuelve 'HH:MM:SS' (string puro, comparable con TIME_FORMAT) */
function isoHora(d) {
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

/** 1=lunes … 7=domingo (igual que la BD) */
function isoWeekday(d) {
  const day = d.getUTCDay(); // 0=dom
  return day === 0 ? 7 : day;
}

// ── Generar faltas para UN horario terminado ──────────────────────────────
async function generarFaltasDeClase(horario, fecha, io) {
  try {
    const sinRegistro = await db.query(
      `SELECT a.id
       FROM   alumnos a
       WHERE  a.grupo_id = ?
         AND  a.activo   = 1
         AND  NOT EXISTS (
               SELECT 1 FROM asistencias x
               WHERE  x.alumno_id  = a.id
                 AND  x.horario_id = ?
                 AND  x.fecha      = ?
             )
         AND  NOT EXISTS (
               SELECT 1
               FROM   permisos      p
               JOIN   permiso_horarios ph ON ph.permiso_id = p.id
               WHERE  p.alumno_id   = a.id
                 AND  p.activo      = 1
                 AND  ph.horario_id = ?
                 AND  ? BETWEEN p.fecha_inicio AND p.fecha_fin
             )`,
      [horario.grupo_id, horario.id, fecha, horario.id, fecha]
    );

    if (!sinRegistro.length) return 0;

    const valores = sinRegistro.map(a => [a.id, horario.id, fecha, 'falta', 'sensor']);
    await db.query(
      `INSERT IGNORE INTO asistencias
         (alumno_id, horario_id, fecha, tipo, registrado_por)
       VALUES ?`,
      [valores]
    );

    logger.info('Faltas automáticas generadas', {
      horario_id : horario.id,
      grupo_id   : horario.grupo_id,
      fecha,
      total      : sinRegistro.length,
    });

    if (io) {
      io.emit('faltas:generadas', {
        horario_id : horario.id,
        grupo_id   : horario.grupo_id,
        fecha,
        total      : sinRegistro.length,
      });
    }

    return sinRegistro.length;
  } catch (e) {
    logger.error('Error generando faltas automáticas', {
      msg        : e.message,
      horario_id : horario.id,
    });
    return 0;
  }
}

// ── Revisar qué clases terminaron en el último minuto ─────────────────────
async function revisarClasesTerminadas(io) {
  try {
    const ahora     = ahoraGMT6();
    const diaSemana = isoWeekday(ahora);   // 1=lun … 7=dom
    const fecha     = isoFecha(ahora);     // 'YYYY-MM-DD'
    const hAhora    = isoHora(ahora);      // 'HH:MM:00'
    const hace1min  = new Date(ahora.getTime() - 60_000);
    const hAntes    = isoHora(hace1min);   // 'HH:MM:00' hace 1 min

    // TIME_FORMAT fuerza que hora_fin llegue como string 'HH:MM:SS'
    // y así la comparación con nuestros strings funciona correctamente.
    const horarios = await db.query(
      `SELECT *,
              TIME_FORMAT(hora_fin,   '%H:%i:%s') AS hora_fin_str,
              TIME_FORMAT(hora_inicio,'%H:%i:%s') AS hora_inicio_str
       FROM   horarios
       WHERE  dia_semana = ?
         AND  TIME_FORMAT(hora_fin,'%H:%i:%s') >  ?
         AND  TIME_FORMAT(hora_fin,'%H:%i:%s') <= ?`,
      [diaSemana, hAntes, hAhora]
    );

    logger.info('Revisando clases terminadas', {
      diaSemana, fecha, hAntes, hAhora,
      encontrados: horarios.length,
    });

    for (const h of horarios) {
      await generarFaltasDeClase(h, fecha, io);
    }
  } catch (e) {
    logger.error('Error en revisarClasesTerminadas', { msg: e.message });
  }
}

// ── Arranque del job (llamado desde index.js) ────────────────────────────
function iniciarJobFaltas(io) {
  revisarClasesTerminadas(io);
  setInterval(() => revisarClasesTerminadas(io), 60_000);
  logger.info('Job de faltas automáticas iniciado (cada 60 s, GMT-6)');
}

module.exports = { iniciarJobFaltas, revisarClasesTerminadas };
