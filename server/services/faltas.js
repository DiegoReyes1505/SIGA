/**
 * faltas.js — Generación automática de faltas al terminar cada clase
 *
 * Bugs corregidos:
 *  1. mysql2 pool.execute() NO soporta INSERT ... VALUES ? con array 2D.
 *     Se usa un loop con INSERT individual + INSERT IGNORE.
 *  2. TIME_FORMAT() en WHERE para que hora_fin llegue como string comparable.
 *  3. Aritmética de fecha/hora en UTC-6 sin depender de TZ del servidor.
 */

const db     = require('../utils/db');
const logger = require('../utils/logger');

// ── Helpers GMT-6 ─────────────────────────────────────────────────────────────
function ahoraGMT6() {
  return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

function isoFecha(d) {
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Devuelve 'HH:MM:SS' como string puro */
function isoHora(d) {
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

/** 1=lunes … 7=domingo */
function isoWeekday(d) {
  const day = d.getUTCDay(); // 0=dom
  return day === 0 ? 7 : day;
}

// ── Generar faltas para UN horario terminado ──────────────────────────────────
async function generarFaltasDeClase(horario, fecha, io) {
  try {
    // Alumnos del grupo sin registro HOY en este horario y sin permiso vigente
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
               FROM   permisos p
               JOIN   permiso_horarios ph ON ph.permiso_id = p.id
               WHERE  p.alumno_id   = a.id
                 AND  p.activo      = 1
                 AND  ph.horario_id = ?
                 AND  ? BETWEEN p.fecha_inicio AND p.fecha_fin
             )`,
      [horario.grupo_id, horario.id, fecha, horario.id, fecha]
    );

    if (!sinRegistro.length) {
      logger.info('Sin faltas nuevas', { horario_id: horario.id, fecha });
      return 0;
    }

    // INSERT individual con IGNORE para evitar duplicados
    let insertados = 0;
    for (const alumno of sinRegistro) {
      await db.query(
        `INSERT IGNORE INTO asistencias
           (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por)
         VALUES (?, ?, ?, NULL, 'falta', 'sensor')`,
        [alumno.id, horario.id, fecha]
      );
      insertados++;
    }

    logger.info('Faltas automáticas generadas', {
      horario_id : horario.id,
      grupo_id   : horario.grupo_id,
      fecha,
      total      : insertados,
    });

    if (io) {
      io.emit('faltas:generadas', {
        horario_id : horario.id,
        grupo_id   : horario.grupo_id,
        fecha,
        total      : insertados,
      });
    }

    return insertados;
  } catch (e) {
    logger.error('Error generando faltas automáticas', {
      msg        : e.message,
      stack      : e.stack,
      horario_id : horario.id,
    });
    return 0;
  }
}

// ── Revisar clases que terminaron en el último minuto ─────────────────────────
async function revisarClasesTerminadas(io) {
  try {
    const ahora     = ahoraGMT6();
    const diaSemana = isoWeekday(ahora);
    const fecha     = isoFecha(ahora);
    const hAhora    = isoHora(ahora);
    const hace1min  = new Date(ahora.getTime() - 60_000);
    const hAntes    = isoHora(hace1min);

    logger.info('Job faltas — revisando', { diaSemana, fecha, hAntes, hAhora });

    // TIME_FORMAT fuerza que hora_fin llegue como string 'HH:MM:SS'
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

    logger.info('Horarios terminados encontrados', { total: horarios.length });

    for (const h of horarios) {
      await generarFaltasDeClase(h, fecha, io);
    }
  } catch (e) {
    logger.error('Error en revisarClasesTerminadas', { msg: e.message, stack: e.stack });
  }
}

// ── Arranque del job (llamado desde index.js) ─────────────────────────────────
function iniciarJobFaltas(io) {
  revisarClasesTerminadas(io);                           // primera ejecución inmediata
  setInterval(() => revisarClasesTerminadas(io), 60_000); // cada 60 segundos
  logger.info('Job de faltas automáticas iniciado (cada 60 s, GMT-6)');
}

module.exports = { iniciarJobFaltas, revisarClasesTerminadas };
