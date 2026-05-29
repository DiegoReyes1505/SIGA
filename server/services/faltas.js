/**
 * faltas.js — Generación automática de faltas al terminar cada clase
 *
 * Fixes aplicados:
 *  1. dia_semana usa isoWeekday (1=lun…5=vie) igual que la BD
 *  2. Hora y fecha se calculan en GMT-6 (America/Mexico_City)
 *  3. Alumnos con permiso activo ese día NO reciben falta
 *  4. Emite evento socket 'faltas:generadas' para actualizar el dashboard
 */

const db     = require('../utils/db');
const logger = require('../utils/logger');

// ── Helpers de fecha/hora en GMT-6 ───────────────────────────────────────────
function ahoraGMT6() {
  // Desplaza el Date UTC a GMT-6 y devuelve un objeto Date "local"
  return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

function isoFecha(d) {
  // 'YYYY-MM-DD' tomando d como si fuera local
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoHora(d) {
  // 'HH:MM:00'
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

/**
 * isoWeekday: devuelve 1=lunes … 7=domingo (igual que la BD)
 * JS getUTCDay(): 0=domingo … 6=sábado
 */
function isoWeekday(d) {
  const day = d.getUTCDay(); // 0=dom
  return day === 0 ? 7 : day; // 1=lun … 7=dom
}

// ── Generar faltas para UN horario terminado ──────────────────────────────────
async function generarFaltasDeClase(horario, fecha, io) {
  try {
    // Alumnos del grupo activos que NO tienen asistencia, retardo ni permiso
    // registrado para este horario en esta fecha
    const sinRegistro = await db.query(
      `SELECT a.id
       FROM   alumnos a
       WHERE  a.grupo_id = ?
         AND  a.activo   = 1
         -- Sin asistencia/retardo/permiso ya registrado
         AND  NOT EXISTS (
           SELECT 1 FROM asistencias x
           WHERE  x.alumno_id  = a.id
             AND  x.horario_id = ?
             AND  x.fecha      = ?
         )
         -- Sin permiso activo que cubra este horario en esta fecha
         AND  NOT EXISTS (
           SELECT 1
           FROM   permisos      p
           JOIN   permiso_horarios ph ON ph.permiso_id = p.id
           WHERE  p.alumno_id     = a.id
             AND  p.activo        = 1
             AND  ph.horario_id   = ?
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

    // Notificar al dashboard en tiempo real
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

// ── Revisar qué clases terminaron en el último minuto ────────────────────────
async function revisarClasesTerminadas(io) {
  try {
    const ahora     = ahoraGMT6();
    const diaSemana = isoWeekday(ahora);      // 1=lun … 5=vie
    const fecha     = isoFecha(ahora);        // 'YYYY-MM-DD'
    const hAhora    = isoHora(ahora);         // 'HH:MM:00'
    const hace1min  = new Date(ahora.getTime() - 60_000);
    const hAntes    = isoHora(hace1min);      // 'HH:MM:00' hace 1 min

    // Horarios cuya hora_fin cayó dentro de la última ventana de 60 s
    const horarios = await db.query(
      `SELECT * FROM horarios
       WHERE dia_semana = ?
         AND hora_fin >  ?
         AND hora_fin <= ?`,
      [diaSemana, hAntes, hAhora]
    );

    for (const h of horarios) {
      await generarFaltasDeClase(h, fecha, io);
    }
  } catch (e) {
    logger.error('Error en revisarClasesTerminadas', { msg: e.message });
  }
}

// ── Arranque del job (llamado desde index.js) ─────────────────────────────────
function iniciarJobFaltas(io) {
  revisarClasesTerminadas(io);
  setInterval(() => revisarClasesTerminadas(io), 60_000);
  logger.info('Job de faltas automáticas iniciado (cada 60 s, GMT-6)');
}

module.exports = { iniciarJobFaltas, revisarClasesTerminadas };
