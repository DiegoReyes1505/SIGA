require('dotenv').config();
const db = require('./server/utils/db');

(async () => {
  // Simular obtenerHorariosValidos para permiso 2
  const horarioIds = [2, 3];
  const dias = [2, 3];
  const grupoId = 1;

  const phH = horarioIds.map(() => '?').join(',');
  const phD = dias.map(() => '?').join(',');

  const sql = 'SELECT h.id, h.dia_semana FROM horarios h WHERE h.grupo_id = ? AND h.id IN (' + phH + ') AND h.dia_semana IN (' + phD + ')';
  const params = [grupoId, ...horarioIds, ...dias];

  console.log('SQL:', sql);
  console.log('params:', params);

  const [rows] = await db.execute(sql, params);
  console.log('rows:', JSON.stringify(rows));

  // También probar la inserción directa
  console.log('\n--- Prueba INSERT ---');
  const r = await db.query(
    'INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, nota, registrado_por) VALUES (?, ?, ?, NULL, ?, ?, ?) ON DUPLICATE KEY UPDATE tipo = tipo',
    [1, 2, '2026-05-12', 'permiso', 'Enfermedad', 'manual']
  );
  console.log('INSERT result:', JSON.stringify(r));

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });