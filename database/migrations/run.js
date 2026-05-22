require("dotenv").config({ override: false });
const fs = require("fs");
const path = require("path");
const db = require("../../server/utils/db");

async function runMigrations() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  // Ejecutar sentencia por sentencia
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (err) {
      // Ignorar "ya existe"
      if (!err.message.includes("already exists")) {
        console.error("Error en:", stmt.substring(0, 60));
        throw err;
      }
    }
  }
  console.log("✅ Migraciones aplicadas correctamente");
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
