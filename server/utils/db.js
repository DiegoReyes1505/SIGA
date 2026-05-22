const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "local",
  charset: "utf8mb4",
  // Fuerza que los campos DATE y DATETIME lleguen como strings "YYYY-MM-DD"
  // en lugar de objetos Date de JavaScript, evitando desfases por timezone.
  dateStrings: true,
});

// Helper: ejecutar query con pool
pool.query = async (sql, params) => {
  const [rows] = await pool.execute(sql, params || []);
  return rows;
};

module.exports = pool;
