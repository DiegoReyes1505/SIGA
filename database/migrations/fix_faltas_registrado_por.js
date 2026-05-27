/**
 * fix_faltas_registrado_por.js
 *
 * Cambia el campo `registrado_por` de todas las faltas que tienen
 * valor 'manual' o NULL a 'automatico'.
 *
 * Uso:
 *   node database/migrations/fix_faltas_registrado_por.js
 *
 * Es seguro ejecutarlo múltiples veces (idempotente).
 */

require('dotenv').config();
const db = require('../../server/utils/db');

async function run() {
  console.log('\n🔧  Iniciando migración de faltas...\n');

  // Cuantas faltas serán afectadas
  const [{ total }] = await db.query(
    `SELECT COUNT(*) AS total
     FROM asistencias
     WHERE tipo = 'falta'
       AND (registrado_por = 'manual' OR registrado_por IS NULL)`
  );

  if (total === 0) {
    console.log('✅  No hay faltas con registrado_por=manual o NULL. Nada que hacer.');
    process.exit(0);
  }

  console.log(`📌  Se encontraron ${total} falta(s) con registrado_por='manual' o NULL.`);

  // Ejecutar actualización
  const result = await db.query(
    `UPDATE asistencias
     SET registrado_por = 'automatico'
     WHERE tipo = 'falta'
       AND (registrado_por = 'manual' OR registrado_por IS NULL)`
  );

  console.log(`✅  ${result.affectedRows} falta(s) actualizadas a registrado_por='automatico'.\n`);
  process.exit(0);
}

run().catch(e => {
  console.error('\n❌  Error durante la migración:', e.message);
  process.exit(1);
});
