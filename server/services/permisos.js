// ================================================================
// SIGA — services/permisos.js
// ================================================================
const db = require("../utils/db");

// ── Helpers de fecha ──────────────────────────────────────────
// Con dateStrings:true en db.js, MySQL devuelve fechas DATE como
// "YYYY-MM-DD" directamente. soloFecha() es defensa extra por si
// algún valor llega con hora (DATETIME).

function soloFecha(valor) {
  if (!valor) return "";
  return String(valor).slice(0, 10);
}

function sumarUnDia(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function fechasEntre(inicio, fin) {
  const out = [];
  let actual = soloFecha(inicio);
  const last = soloFecha(fin);
  while (actual <= last) {
    out.push(actual);
    actual = sumarUnDia(actual);
  }
  return out;
}

function diaSemanaSistema(fechaStr) {
  const [y, m, d] = soloFecha(fechaStr).split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

// ── Obtener horarios válidos para el alumno ───────────────────

async function obtenerHorariosValidos(alumnoId, horarioIds, fechas) {
  const alumnoRows = await db.query(
    `SELECT grupo_id FROM alumnos WHERE id = ?`,
    [alumnoId],
  );
  if (!alumnoRows.length) throw new Error("Alumno no encontrado");

  const grupoId = alumnoRows[0].grupo_id;
  const dias = [...new Set(fechas.map(diaSemanaSistema))];

  if (!horarioIds.length || !dias.length) return [];

  const phHorarios = horarioIds.map(() => "?").join(",");
  const phDias = dias.map(() => "?").join(",");

  const [rows] = await db.execute(
    `SELECT h.id, h.dia_semana
     FROM horarios h
     WHERE h.grupo_id    = ?
       AND h.id         IN (${phHorarios})
       AND h.dia_semana IN (${phDias})`,
    [grupoId, ...horarioIds, ...dias],
  );
  return rows;
}

// ── Aplicar permiso → inserta/actualiza en asistencias ────────

async function aplicarPermiso(permisoId) {
  const permisos = await db.query(`SELECT * FROM permisos WHERE id = ?`, [
    permisoId,
  ]);
  if (!permisos.length) throw new Error("Permiso no encontrado");
  const permiso = permisos[0];

  const horariosRows = await db.query(
    `SELECT horario_id FROM permiso_horarios WHERE permiso_id = ?`,
    [permisoId],
  );
  const horarioIds = horariosRows.map((r) => r.horario_id);
  if (!horarioIds.length) return;

  const fechas = fechasEntre(permiso.fecha_inicio, permiso.fecha_fin);
  const horariosValidos = await obtenerHorariosValidos(
    permiso.alumno_id,
    horarioIds,
    fechas,
  );

  for (const fecha of fechas) {
    const dia = diaSemanaSistema(fecha);
    const delDia = horariosValidos.filter((h) => Number(h.dia_semana) === dia);

    for (const horario of delDia) {
      await db.query(
        `INSERT INTO asistencias
           (alumno_id, horario_id, fecha, hora_entrada, tipo, nota, registrado_por)
         VALUES (?, ?, ?, NULL, 'permiso', ?, 'manual')
         ON DUPLICATE KEY UPDATE
           tipo           = IF(registrado_por = 'sensor', tipo,         'permiso'),
           nota           = IF(registrado_por = 'sensor', nota,         VALUES(nota)),
           hora_entrada   = IF(registrado_por = 'sensor', hora_entrada, NULL),
           registrado_por = IF(registrado_por = 'sensor', 'sensor',     'manual')`,
        [permiso.alumno_id, horario.id, fecha, permiso.motivo],
      );
    }
  }
}

// ── Revertir permiso → elimina solo los registros que él creó ─

async function recalcularAsistenciasTrasCancelar(permisoId) {
  const permisos = await db.query(`SELECT * FROM permisos WHERE id = ?`, [
    permisoId,
  ]);
  if (!permisos.length) return;
  const permiso = permisos[0];

  const horariosRows = await db.query(
    `SELECT horario_id FROM permiso_horarios WHERE permiso_id = ?`,
    [permisoId],
  );
  const horarioIds = horariosRows.map((r) => r.horario_id);
  if (!horarioIds.length) return;

  const ph = horarioIds.map(() => "?").join(",");
  await db.execute(
    `DELETE FROM asistencias
     WHERE alumno_id      = ?
       AND horario_id    IN (${ph})
       AND fecha         BETWEEN ? AND ?
       AND tipo          = 'permiso'
       AND registrado_por = 'manual'
       AND nota          = ?`,
    [
      permiso.alumno_id,
      ...horarioIds,
      soloFecha(permiso.fecha_inicio),
      soloFecha(permiso.fecha_fin),
      permiso.motivo,
    ],
  );
}

module.exports = { aplicarPermiso, recalcularAsistenciasTrasCancelar };
