require("dotenv").config({ override: false });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function runMigrations() {
  // Conexión separada con multipleStatements activado
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true, // 👈 clave: permite ejecutar todo el SQL de una vez
  });

  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

  try {
    await conn.query(sql);
    console.log("✅ Migraciones aplicadas correctamente");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("✅ Tablas ya existentes, nada que migrar");
    } else {
      console.error("❌", err.message);
      process.exit(1);
    }
  } finally {
    await conn.end();
    process.exit(0);
  }
}

runMigrations();
