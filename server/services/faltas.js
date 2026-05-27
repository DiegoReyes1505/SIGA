/**
 * faltas.js — Servicio de generación automática de faltas
 *
 * Lógica:
 * - Cada minuto se revisa si alguna clase acaba de terminar (dentro del
 *   último minuto).
 * - Para cada clase terminada, se buscan los alumnos del grupo que NO
 *   tienen registro de asistencia en esa fecha y horario.
 * - A esos alumnos se les inserta automáticamente una falta.
 * - Los alumnos con permiso activo ya tienen su registro en tipo='permiso'
 *   (manejado por el servicio de permisos), por lo que no se tocan.
 */

const db     = require('../utils/db');
const logger = require('../utils/logger');

/**
 * Genera faltas para una clase que acaba de terminar.
 * @param {object} horario  - fila de la tabla horarios
 * @param {string} fecha    - YYYY-MM-DD
 */
async function generarFaltasDeClase(horario, fecha) {
  try {
    // Alumnos activos del grupo que NO tienen registro en este horario+fecha
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

    // INSERT en batch — si ya existe un duplicado (por race condition) se ignora
    const valores = sinRegistro.map(a => [a.id, horario.id, fecha, 'falta', 'sensor']);
    await db.query(
      `INSERT IGNORE INTO asistencias
         (alumno_id, horario_id, fecha, tipo, registrado_por)
       VALUES ?`,
      [valores]
    );

    logger.info(`Faltas automáticas generadas`, {
      horario_id: horario.id,
      grupo_id:   horario.grupo_id,
      fecha,
      total: sinRegistro.length,
    });
  } catch (e) {
    logger.error('Error generando faltas automáticas', { msg: e.message, horario_id: horario.id });
  }
}

/**
 * Revisa todos los horarios cuya hora_fin cayó en el último minuto.
 * Se llama cada 60 segundos desde index.js.
 */
async function revisarClasesTerminadas() {
  try {
    const ahora  = new Date();
    // Día de semana local (0=Dom … 6=Sáb) — mismo convenio que la BD
    const diaSemana = ahora.getDay();
    const fecha = ahora.toISOString().slice(0, 10); // YYYY-MM-DD

    // HH:MM de hace 1 minuto y ahora
    const pad  = n => String(n).padStart(2, '0');
    const hAhora   = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:00`;
    const antes    = new Date(ahora.getTime() - 60_000);
    const hAntes   = `${pad(antes.getHours())}:${pad(antes.getMinutes())}:00`;

    // Horarios cuya hora_fin está en la ventana (hAntes, hAhora]
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

/**
 * Inicia el job que corre cada 60 segundos.
 * Llama a esta función una vez al arrancar el servidor.
 */
function iniciarJobFaltas() {
  // Ejecutar inmediatamente al iniciar (cubre arranques tardíos)
  revisarClasesTerminadas();
  // Luego cada minuto exacto
  setInterval(revisarClasesTerminadas, 60_000);
  logger.info('Job de faltas automáticas iniciado (cada 60 s)');
}

module.exports = { iniciarJobFaltas, revisarClasesTerminadas };
