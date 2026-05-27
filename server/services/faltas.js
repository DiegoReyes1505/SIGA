/**
 * faltas.js — Generación automática de faltas al terminar clase
 */

const db     = require('../utils/db');
const logger = require('../utils/logger');

async function generarFaltasDeClase(horario, fecha) {
  try {
    const sinRegistro = await db.query(
      `SELECT a.id
       FROM alumnos a
       WHERE a.grupo_id = ?
         AND a.activo = 1
         AND NOT EXISTS (
           SELECT 1 FROM asistencias x
           WHERE x.alumno_id  = a.id
             AND x.horario_id = ?
             AND x.fecha      = ?
         )`,
      [horario.grupo_id, horario.id, fecha]
    );

    if (!sinRegistro.length) return;

    const valores = sinRegistro.map(a => [a.id, horario.id, fecha, 'falta', 'sensor']);
    await db.query(
      `INSERT IGNORE INTO asistencias
         (alumno_id, horario_id, fecha, tipo, registrado_por)
       VALUES ?`,
      [valores]
    );

    logger.info('Faltas automáticas generadas', {
      horario_id: horario.id,
      grupo_id:   horario.grupo_id,
      fecha,
      total: sinRegistro.length,
    });
  } catch (e) {
    logger.error('Error generando faltas automáticas', { msg: e.message, horario_id: horario.id });
  }
}

async function revisarClasesTerminadas() {
  try {
    const ahora     = new Date();
    const diaSemana = ahora.getDay();
    const fecha     = ahora.toISOString().slice(0, 10);
    const pad       = n => String(n).padStart(2, '0');
    const hAhora    = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:00`;
    const antes     = new Date(ahora.getTime() - 60_000);
    const hAntes    = `${pad(antes.getHours())}:${pad(antes.getMinutes())}:00`;

    const horarios = await db.query(
      `SELECT * FROM horarios
       WHERE dia_semana = ?
         AND hora_fin >  ?
         AND hora_fin <= ?`,
      [diaSemana, hAntes, hAhora]
    );

    for (const h of horarios) {
      await generarFaltasDeClase(h, fecha);
    }
  } catch (e) {
    logger.error('Error en revisarClasesTerminadas', { msg: e.message });
  }
}

function iniciarJobFaltas() {
  revisarClasesTerminadas();
  setInterval(revisarClasesTerminadas, 60_000);
  logger.info('Job de faltas automáticas iniciado (cada 60 s)');
}

module.exports = { iniciarJobFaltas, revisarClasesTerminadas };
