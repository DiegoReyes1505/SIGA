require('dotenv').config();
const db = require('../../server/utils/db');

async function seed() {
  // ── Grupos ────────────────────────────────────────────────
  await db.query(`
    INSERT IGNORE INTO grupos (id, nombre, descripcion) VALUES
    (1, '1°A', 'Primer grado grupo A'),
    (2, '2°B', 'Segundo grado grupo B'),
    (3, '3°C', 'Tercer grado grupo C')
  `);

  // ── Materias ──────────────────────────────────────────────
  await db.query(`
    INSERT IGNORE INTO materias (id, nombre, clave) VALUES
    (1, 'Matemáticas',  'MAT-01'),
    (2, 'Español',      'ESP-01'),
    (3, 'Ciencias',     'CIE-01')
  `);

  // ── Horarios (Lun-Vie, 3 grupos × 3 materias) ────────────
  // Tolerancia: 10 minutos
  // Grupo 1°A
  await db.query(`
    INSERT IGNORE INTO horarios (grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min) VALUES
    -- 1°A
    (1, 1, 1, '08:00:00', '09:00:00', 10),
    (1, 2, 2, '08:00:00', '09:00:00', 10),
    (1, 3, 3, '08:00:00', '09:00:00', 10),
    (1, 1, 4, '08:00:00', '09:00:00', 10),
    (1, 2, 5, '08:00:00', '09:00:00', 10),
    -- 2°B
    (2, 1, 1, '09:00:00', '10:00:00', 10),
    (2, 2, 2, '09:00:00', '10:00:00', 10),
    (2, 3, 3, '09:00:00', '10:00:00', 10),
    (2, 1, 4, '09:00:00', '10:00:00', 10),
    (2, 2, 5, '09:00:00', '10:00:00', 10),
    -- 3°C
    (3, 1, 1, '10:00:00', '11:00:00', 10),
    (3, 2, 2, '10:00:00', '11:00:00', 10),
    (3, 3, 3, '10:00:00', '11:00:00', 10),
    (3, 1, 4, '10:00:00', '11:00:00', 10),
    (3, 2, 5, '10:00:00', '11:00:00', 10)
  `);

  // ── Alumnos de prueba ─────────────────────────────────────
  await db.query(`
    INSERT IGNORE INTO alumnos (matricula, nombre, apellido_pat, apellido_mat, grupo_id) VALUES
    ('A001', 'Carlos',    'García',    'López',    1),
    ('A002', 'María',     'Hernández', 'Martínez', 1),
    ('A003', 'Luis',      'Pérez',     'Sánchez',  2),
    ('A004', 'Ana',       'Torres',    'Ramírez',  2),
    ('A005', 'Jorge',     'Flores',    'Jiménez',  3),
    ('A006', 'Sofía',     'Ruiz',      'Morales',  3)
  `);

  console.log('✅ Seeds insertados correctamente');
  process.exit(0);
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
