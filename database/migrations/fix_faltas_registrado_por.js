/**
 * fix_faltas_registrado_por.js
 *
 * Cambia registrado_por a 'sensor' en todas las faltas que tienen
 * valor 'manual', 'automatico' o NULL.
 *
 * Uso:
 *   node database/migrations/fix_faltas_registrado_por.js
 *
 * Es idempotente: ejecutarlo varias veces no genera duplicados.
 */

require('dotenv').config();
const db = require('../../server/utils/db');

async function run() {
  console.log('\n🔧  Iniciando migración de faltas...\n');

  const [{ total }] = await db.query(
    `SELECT COUNT(*) AS total
     FROM asistencias
     WHERE tipo = 'falta'
       AND (registrado_por != 'sensor' OR registrado_por IS NULL)`
  );

  if (total === 0) {
    console.log('✅  Todas las faltas ya tienen registrado_por=sensor. Nada que hacer.');
    process.exit(0);
  }

  console.log(`📌  Se encontraron ${total} falta(s) con registrado_por != 'sensor'.`);

  const result = await db.query(
    `UPDATE asistencias
     SET registrado_por = 'sensor'
     WHERE tipo = 'falta'
       AND (registrado_por != 'sensor' OR registrado_por IS NULL)`
  );

  console.log(`✅  ${result.affectedRows} falta(s) actualizadas a registrado_por='sensor'.\n`);
  process.exit(0);
}

run().catch(e => {
  console.error('\n❌  Error durante la migración:', e.message);
  process.exit(1);
});
