-- ================================================================
-- SIGA — Sistema Inteligente de Gestión de Asistencias
-- Schema v1.0
-- ================================================================

DROP DATABASE IF EXISTS siga_db; 
CREATE DATABASE IF NOT EXISTS siga_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE siga_db;

-- ── Grupos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(50)  NOT NULL,           -- Ej: "1°A", "2°B"
  descripcion VARCHAR(100),
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Materias ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materias (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,            -- Ej: "Matemáticas"
  clave       VARCHAR(20)  NOT NULL UNIQUE,     -- Ej: "MAT-01"
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Horarios (grupo + materia + día + hora) ─────────────────
CREATE TABLE IF NOT EXISTS horarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grupo_id      INT UNSIGNED NOT NULL,
  materia_id    INT UNSIGNED NOT NULL,
  dia_semana    TINYINT NOT NULL,               -- 1=Lun … 5=Vie
  hora_inicio   TIME    NOT NULL,               -- Ej: 08:00:00
  hora_fin      TIME    NOT NULL,               -- Ej: 09:00:00
  tolerancia_min INT UNSIGNED NOT NULL DEFAULT 10, -- minutos de gracia
  FOREIGN KEY (grupo_id)   REFERENCES grupos(id)  ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
  UNIQUE KEY uq_grupo_materia_dia_hora (grupo_id, dia_semana, hora_inicio)
);

-- ── Alumnos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alumnos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  matricula       VARCHAR(20)  NOT NULL UNIQUE,
  nombre          VARCHAR(80)  NOT NULL,
  apellido_pat    VARCHAR(60)  NOT NULL,
  apellido_mat    VARCHAR(60),
  grupo_id        INT UNSIGNED NOT NULL,
  huella_id       TINYINT UNSIGNED,             -- ID en el sensor AS608 (1-127), NULL si no registrada
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE RESTRICT
);

-- ── Asistencias ───────────────────────────────────────────────
-- tipo: 'asistencia' | 'retardo' | 'falta' | 'permiso'
CREATE TABLE IF NOT EXISTS asistencias (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alumno_id     INT UNSIGNED NOT NULL,
  horario_id    INT UNSIGNED NOT NULL,
  fecha         DATE        NOT NULL,
  hora_entrada  TIME,                           -- NULL si es falta/permiso
  tipo          ENUM('asistencia','retardo','falta','permiso') NOT NULL,
  nota          TEXT,                           -- Para permisos: motivo
  registrado_por ENUM('sensor','manual') NOT NULL DEFAULT 'sensor',
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alumno_id)  REFERENCES alumnos(id)  ON DELETE CASCADE,
  FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_alumno_horario_fecha (alumno_id, horario_id, fecha)
);

CREATE TABLE IF NOT EXISTS permisos (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alumno_id      INT UNSIGNED NOT NULL,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  motivo         VARCHAR(255) NOT NULL,
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permiso_horarios (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  permiso_id   INT UNSIGNED NOT NULL,
  horario_id   INT UNSIGNED NOT NULL,
  FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE,
  FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_permiso_horario (permiso_id, horario_id)
);

-- ── Índices para consultas frecuentes ─────────────────────────
CREATE INDEX idx_asistencias_fecha    ON asistencias(fecha);
CREATE INDEX idx_asistencias_alumno   ON asistencias(alumno_id);
CREATE INDEX idx_asistencias_tipo     ON asistencias(tipo);
CREATE INDEX idx_alumnos_huella       ON alumnos(huella_id);
CREATE INDEX idx_horarios_dia         ON horarios(dia_semana);
CREATE INDEX idx_permisos_alumno ON permisos(alumno_id);
CREATE INDEX idx_permisos_fechas ON permisos(fecha_inicio, fecha_fin);

-- ================================================================
-- SIGA — Datos de prueba realistas (Turno Matutino)
-- Horarios: 07:00 a 13:00
-- Ejecutar después de schema.sql
-- ================================================================
 
USE siga_db;
 
-- ── Grupos ────────────────────────────────────────────────────
INSERT INTO grupos (nombre, descripcion) VALUES
  ('1°A', 'Primer semestre grupo A'),
  ('1°B', 'Primer semestre grupo B'),
  ('2°A', 'Segundo semestre grupo A'),
  ('3°A', 'Tercer semestre grupo A');
 
-- ── Materias ──────────────────────────────────────────────────
INSERT INTO materias (nombre, clave) VALUES
  ('Matemáticas',      'MAT-01'),
  ('Español',          'ESP-01'),
  ('Ciencias',         'CIE-01'),
  ('Historia',         'HIS-01'),
  ('Inglés',           'ING-01'),
  ('Educación Física', 'EDF-01'),
  ('Informática',      'INF-01'),
  ('Química',          'QUI-01');
 
-- ── Horarios — todos entre 07:00 y 13:00 ─────────────────────
-- día: 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie
INSERT INTO horarios (grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, tolerancia_min) VALUES
  -- 1°A (horarios id 1-10)
  (1, 1, 1, '07:00:00', '08:00:00', 10),  -- Lun Matemáticas
  (1, 2, 1, '08:00:00', '09:00:00', 10),  -- Lun Español
  (1, 3, 2, '07:00:00', '08:00:00', 10),  -- Mar Ciencias
  (1, 4, 2, '08:00:00', '09:00:00', 10),  -- Mar Historia
  (1, 5, 3, '07:00:00', '08:00:00', 10),  -- Mié Inglés
  (1, 6, 3, '08:00:00', '09:00:00', 10),  -- Mié Ed. Física
  (1, 7, 4, '07:00:00', '08:00:00', 10),  -- Jue Informática
  (1, 1, 4, '08:00:00', '09:00:00', 10),  -- Jue Matemáticas
  (1, 2, 5, '07:00:00', '08:00:00', 10),  -- Vie Español
  (1, 8, 5, '08:00:00', '09:00:00', 10),  -- Vie Química
  -- 1°B (horarios id 11-17)
  (2, 1, 1, '09:00:00', '10:00:00', 10),  -- Lun Matemáticas
  (2, 2, 1, '10:00:00', '11:00:00', 10),  -- Lun Español
  (2, 3, 2, '09:00:00', '10:00:00', 10),  -- Mar Ciencias
  (2, 4, 2, '10:00:00', '11:00:00', 10),  -- Mar Historia
  (2, 5, 3, '09:00:00', '10:00:00', 10),  -- Mié Inglés
  (2, 7, 4, '09:00:00', '10:00:00', 10),  -- Jue Informática
  (2, 8, 5, '09:00:00', '10:00:00', 10),  -- Vie Química
  -- 2°A (horarios id 18-22)
  (3, 1, 1, '11:00:00', '12:00:00', 10),  -- Lun Matemáticas
  (3, 5, 2, '11:00:00', '12:00:00', 10),  -- Mar Inglés
  (3, 7, 3, '11:00:00', '12:00:00', 10),  -- Mié Informática
  (3, 8, 4, '11:00:00', '12:00:00', 10),  -- Jue Química
  (3, 4, 5, '11:00:00', '12:00:00', 10),  -- Vie Historia
  -- 3°A (horarios id 23-27)
  (4, 1, 1, '12:00:00', '13:00:00', 10),  -- Lun Matemáticas
  (4, 5, 2, '12:00:00', '13:00:00', 10),  -- Mar Inglés
  (4, 8, 3, '12:00:00', '13:00:00', 10),  -- Mié Química
  (4, 7, 4, '12:00:00', '13:00:00', 10),  -- Jue Informática
  (4, 2, 5, '12:00:00', '13:00:00', 10);  -- Vie Español
 
-- ── Alumnos 1°A (10 alumnos) ──────────────────────────────────
INSERT INTO alumnos (matricula, nombre, apellido_pat, apellido_mat, grupo_id) VALUES
  ('A001', 'Carlos',   'Ramírez',   'López',     1),
  ('A002', 'María',    'Hernández', 'Martínez',  1),
  ('A003', 'José',     'González',  'Pérez',     1),
  ('A004', 'Ana',      'Torres',    'Sánchez',   1),
  ('A005', 'Luis',     'Flores',    'García',    1),
  ('A006', 'Sofía',    'Morales',   'Jiménez',   1),
  ('A007', 'Diego',    'Reyes',     'Vargas',    1),
  ('A008', 'Valeria',  'Cruz',      'Mendoza',   1),
  ('A009', 'Miguel',   'Ramos',     'Ortiz',     1),
  ('A010', 'Fernanda', 'Díaz',      'Castillo',  1);
 
-- ── Alumnos 1°B (8 alumnos) ───────────────────────────────────
INSERT INTO alumnos (matricula, nombre, apellido_pat, apellido_mat, grupo_id) VALUES
  ('B001', 'Jorge',     'Mendoza',   'Ríos',      2),
  ('B002', 'Daniela',   'Vega',      'Luna',      2),
  ('B003', 'Andrés',    'Salinas',   'Mora',      2),
  ('B004', 'Camila',    'Gutiérrez', 'Espinoza',  2),
  ('B005', 'Ricardo',   'Jiménez',   'Fuentes',   2),
  ('B006', 'Paola',     'Rojas',     'Delgado',   2),
  ('B007', 'Sebastián', 'Núñez',     'Medina',    2),
  ('B008', 'Valentina', 'Aguilar',   'Cervantes', 2);
 
-- ── Alumnos 2°A (8 alumnos) ───────────────────────────────────
INSERT INTO alumnos (matricula, nombre, apellido_pat, apellido_mat, grupo_id) VALUES
  ('C001', 'Eduardo',  'Paredes',   'Villanueva', 3),
  ('C002', 'Gabriela', 'Espinosa',  'Campos',     3),
  ('C003', 'Héctor',   'Guerrero',  'Ibáñez',     3),
  ('C004', 'Isabella', 'Peña',      'Contreras',  3),
  ('C005', 'Kevin',    'Soto',      'Herrera',    3),
  ('C006', 'Laura',    'Miranda',   'Cabrera',    3),
  ('C007', 'Martín',   'Castillo',  'Navarro',    3),
  ('C008', 'Natalia',  'Ávila',     'Domínguez',  3);
 
-- ── Alumnos 3°A (6 alumnos) ───────────────────────────────────
INSERT INTO alumnos (matricula, nombre, apellido_pat, apellido_mat, grupo_id) VALUES
  ('D001', 'Omar',     'Serrano',  'Fuentes',  4),
  ('D002', 'Patricia', 'Lara',     'Sandoval', 4),
  ('D003', 'Rodrigo',  'Montes',   'Acosta',   4),
  ('D004', 'Sara',     'Valencia', 'Mejía',    4),
  ('D005', 'Tomás',    'Cortés',   'Palacios', 4),
  ('D006', 'Ximena',   'Bravo',    'Escobar',  4);
 
-- ================================================================
-- ASISTENCIAS — 20 días hábiles (2026-04-20 al 2026-05-15)
-- ================================================================
 
-- ── 1°A — Alumno A001 (excelente, 2 retardos) ─────────────────
INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por) VALUES
  (1,1,'2026-04-20','07:02:00','asistencia','sensor'),
  (1,2,'2026-04-20','08:05:00','asistencia','sensor'),
  (1,3,'2026-04-21','07:01:00','asistencia','sensor'),
  (1,4,'2026-04-21','08:03:00','asistencia','sensor'),
  (1,5,'2026-04-22','07:00:00','asistencia','sensor'),
  (1,6,'2026-04-22','08:02:00','asistencia','sensor'),
  (1,7,'2026-04-23','07:04:00','asistencia','sensor'),
  (1,8,'2026-04-23','08:01:00','asistencia','sensor'),
  (1,9,'2026-04-24','07:03:00','asistencia','sensor'),
  (1,10,'2026-04-24','08:00:00','asistencia','sensor'),
  (1,1,'2026-04-27','07:15:00','retardo','sensor'),
  (1,2,'2026-04-27','08:02:00','asistencia','sensor'),
  (1,3,'2026-04-28','07:01:00','asistencia','sensor'),
  (1,4,'2026-04-28','08:00:00','asistencia','sensor'),
  (1,5,'2026-04-29','07:02:00','asistencia','sensor'),
  (1,6,'2026-04-29','08:03:00','asistencia','sensor'),
  (1,7,'2026-04-30','07:00:00','asistencia','sensor'),
  (1,8,'2026-04-30','08:01:00','asistencia','sensor'),
  (1,9,'2026-05-04','07:02:00','asistencia','sensor'),
  (1,10,'2026-05-04','08:00:00','asistencia','sensor'),
  (1,1,'2026-05-05','07:01:00','asistencia','sensor'),
  (1,2,'2026-05-05','08:00:00','asistencia','sensor'),
  (1,3,'2026-05-06','07:03:00','asistencia','sensor'),
  (1,4,'2026-05-06','08:02:00','asistencia','sensor'),
  (1,5,'2026-05-07','07:00:00','asistencia','sensor'),
  (1,6,'2026-05-07','08:01:00','asistencia','sensor'),
  (1,7,'2026-05-08','07:02:00','asistencia','sensor'),
  (1,8,'2026-05-08','08:00:00','asistencia','sensor'),
  (1,9,'2026-05-11','07:20:00','retardo','sensor'),
  (1,10,'2026-05-11','08:02:00','asistencia','sensor'),
  (1,1,'2026-05-12','07:01:00','asistencia','sensor'),
  (1,2,'2026-05-12','08:00:00','asistencia','sensor'),
  (1,3,'2026-05-13','07:02:00','asistencia','sensor'),
  (1,4,'2026-05-13','08:01:00','asistencia','sensor'),
  (1,5,'2026-05-14','07:00:00','asistencia','sensor'),
  (1,6,'2026-05-14','08:02:00','asistencia','sensor'),
  (1,7,'2026-05-15','07:03:00','asistencia','sensor'),
  (1,8,'2026-05-15','08:00:00','asistencia','sensor');
 
-- ── A002 (irregular — muchas faltas y retardos) ───────────────
INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por) VALUES
  (2,1,'2026-04-20','07:18:00','retardo','sensor'),
  (2,2,'2026-04-20','08:22:00','retardo','sensor'),
  (2,3,'2026-04-21',NULL,'falta','manual'),
  (2,4,'2026-04-21',NULL,'falta','manual'),
  (2,5,'2026-04-22','07:01:00','asistencia','sensor'),
  (2,6,'2026-04-22','08:00:00','asistencia','sensor'),
  (2,7,'2026-04-23','07:19:00','retardo','sensor'),
  (2,8,'2026-04-23','08:02:00','asistencia','sensor'),
  (2,9,'2026-04-24',NULL,'falta','manual'),
  (2,10,'2026-04-24',NULL,'falta','manual'),
  (2,1,'2026-04-27','07:02:00','asistencia','sensor'),
  (2,2,'2026-04-27','08:01:00','asistencia','sensor'),
  (2,3,'2026-04-28','07:25:00','retardo','sensor'),
  (2,4,'2026-04-28','08:03:00','asistencia','sensor'),
  (2,5,'2026-04-29',NULL,'falta','manual'),
  (2,6,'2026-04-29',NULL,'falta','manual'),
  (2,7,'2026-04-30','07:00:00','asistencia','sensor'),
  (2,8,'2026-04-30','08:02:00','asistencia','sensor'),
  (2,9,'2026-05-04','07:17:00','retardo','sensor'),
  (2,10,'2026-05-04','08:00:00','asistencia','sensor'),
  (2,1,'2026-05-05',NULL,'falta','manual'),
  (2,2,'2026-05-05',NULL,'falta','manual'),
  (2,3,'2026-05-06','07:02:00','asistencia','sensor'),
  (2,4,'2026-05-06','08:01:00','asistencia','sensor'),
  (2,5,'2026-05-07','07:21:00','retardo','sensor'),
  (2,6,'2026-05-07','08:00:00','asistencia','sensor'),
  (2,7,'2026-05-08',NULL,'falta','manual'),
  (2,8,'2026-05-08',NULL,'falta','manual'),
  (2,9,'2026-05-11','07:03:00','asistencia','sensor'),
  (2,10,'2026-05-11','08:02:00','asistencia','sensor'),
  (2,1,'2026-05-12','07:16:00','retardo','sensor'),
  (2,2,'2026-05-12','08:00:00','asistencia','sensor'),
  (2,3,'2026-05-13',NULL,'falta','manual'),
  (2,4,'2026-05-13',NULL,'falta','manual'),
  (2,5,'2026-05-14','07:01:00','asistencia','sensor'),
  (2,6,'2026-05-14','08:03:00','asistencia','sensor'),
  (2,7,'2026-05-15','07:20:00','retardo','sensor'),
  (2,8,'2026-05-15','08:01:00','asistencia','sensor');
 
-- ── A003 (buen alumno, 2 retardos, 1 falta) ───────────────────
INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por) VALUES
  (3,1,'2026-04-20','07:01:00','asistencia','sensor'),
  (3,2,'2026-04-20','08:00:00','asistencia','sensor'),
  (3,3,'2026-04-21','07:02:00','asistencia','sensor'),
  (3,4,'2026-04-21','08:01:00','asistencia','sensor'),
  (3,5,'2026-04-22','07:00:00','asistencia','sensor'),
  (3,6,'2026-04-22','08:02:00','asistencia','sensor'),
  (3,7,'2026-04-23','07:03:00','asistencia','sensor'),
  (3,8,'2026-04-23','08:00:00','asistencia','sensor'),
  (3,9,'2026-04-24','07:14:00','retardo','sensor'),
  (3,10,'2026-04-24','08:01:00','asistencia','sensor'),
  (3,1,'2026-04-27','07:00:00','asistencia','sensor'),
  (3,2,'2026-04-27','08:02:00','asistencia','sensor'),
  (3,3,'2026-04-28','07:01:00','asistencia','sensor'),
  (3,4,'2026-04-28','08:00:00','asistencia','sensor'),
  (3,5,'2026-04-29','07:02:00','asistencia','sensor'),
  (3,6,'2026-04-29','08:01:00','asistencia','sensor'),
  (3,7,'2026-04-30',NULL,'falta','manual'),
  (3,8,'2026-04-30',NULL,'falta','manual'),
  (3,9,'2026-05-04','07:00:00','asistencia','sensor'),
  (3,10,'2026-05-04','08:03:00','asistencia','sensor'),
  (3,1,'2026-05-05','07:01:00','asistencia','sensor'),
  (3,2,'2026-05-05','08:00:00','asistencia','sensor'),
  (3,3,'2026-05-06','07:02:00','asistencia','sensor'),
  (3,4,'2026-05-06','08:01:00','asistencia','sensor'),
  (3,5,'2026-05-07','07:00:00','asistencia','sensor'),
  (3,6,'2026-05-07','08:02:00','asistencia','sensor'),
  (3,7,'2026-05-08','07:03:00','asistencia','sensor'),
  (3,8,'2026-05-08','08:00:00','asistencia','sensor'),
  (3,9,'2026-05-11','07:01:00','asistencia','sensor'),
  (3,10,'2026-05-11','08:02:00','asistencia','sensor'),
  (3,1,'2026-05-12','07:02:00','asistencia','sensor'),
  (3,2,'2026-05-12','08:00:00','asistencia','sensor'),
  (3,3,'2026-05-13','07:16:00','retardo','sensor'),
  (3,4,'2026-05-13','08:03:00','asistencia','sensor'),
  (3,5,'2026-05-14','07:01:00','asistencia','sensor'),
  (3,6,'2026-05-14','08:02:00','asistencia','sensor'),
  (3,7,'2026-05-15','07:00:00','asistencia','sensor'),
  (3,8,'2026-05-15','08:01:00','asistencia','sensor');
 
-- ── A004–A010 patrón variado ───────────────────────────────────
INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por) VALUES
  -- A004 buena asistencia
  (4,1,'2026-04-20','07:02:00','asistencia','sensor'),(4,3,'2026-04-21','07:01:00','asistencia','sensor'),
  (4,5,'2026-04-22','07:00:00','asistencia','sensor'),(4,7,'2026-04-23','07:03:00','asistencia','sensor'),
  (4,9,'2026-04-24','07:15:00','retardo','sensor'),(4,1,'2026-04-27','07:01:00','asistencia','sensor'),
  (4,3,'2026-04-28','07:02:00','asistencia','sensor'),(4,5,'2026-04-29','07:00:00','asistencia','sensor'),
  (4,7,'2026-04-30','07:01:00','asistencia','sensor'),(4,9,'2026-05-04','07:02:00','asistencia','sensor'),
  (4,1,'2026-05-05','07:00:00','asistencia','sensor'),(4,3,'2026-05-06','07:01:00','asistencia','sensor'),
  (4,5,'2026-05-07','07:02:00','asistencia','sensor'),(4,7,'2026-05-08','07:00:00','asistencia','sensor'),
  (4,9,'2026-05-11','07:18:00','retardo','sensor'),(4,1,'2026-05-12','07:01:00','asistencia','sensor'),
  (4,3,'2026-05-13','07:02:00','asistencia','sensor'),(4,5,'2026-05-14','07:00:00','asistencia','sensor'),
  (4,7,'2026-05-15','07:01:00','asistencia','sensor'),
  -- A005 con faltas y retardos
  (5,1,'2026-04-20',NULL,'falta','manual'),(5,3,'2026-04-21','07:19:00','retardo','sensor'),
  (5,5,'2026-04-22',NULL,'falta','manual'),(5,7,'2026-04-23','07:02:00','asistencia','sensor'),
  (5,9,'2026-04-24','07:01:00','asistencia','sensor'),(5,1,'2026-04-27','07:22:00','retardo','sensor'),
  (5,3,'2026-04-28',NULL,'falta','manual'),(5,5,'2026-04-29','07:01:00','asistencia','sensor'),
  (5,7,'2026-04-30','07:00:00','asistencia','sensor'),(5,9,'2026-05-04',NULL,'falta','manual'),
  (5,1,'2026-05-05','07:02:00','asistencia','sensor'),(5,3,'2026-05-06','07:17:00','retardo','sensor'),
  (5,5,'2026-05-07',NULL,'falta','manual'),(5,7,'2026-05-08','07:01:00','asistencia','sensor'),
  (5,9,'2026-05-11','07:00:00','asistencia','sensor'),(5,1,'2026-05-12',NULL,'falta','manual'),
  (5,3,'2026-05-13','07:02:00','asistencia','sensor'),(5,5,'2026-05-14','07:21:00','retardo','sensor'),
  (5,7,'2026-05-15',NULL,'falta','manual'),
  -- A006 normal
  (6,1,'2026-04-20','07:01:00','asistencia','sensor'),(6,3,'2026-04-21','07:00:00','asistencia','sensor'),
  (6,5,'2026-04-22','07:02:00','asistencia','sensor'),(6,7,'2026-04-23','07:14:00','retardo','sensor'),
  (6,9,'2026-04-24','07:01:00','asistencia','sensor'),(6,1,'2026-04-27','07:00:00','asistencia','sensor'),
  (6,3,'2026-04-28','07:02:00','asistencia','sensor'),(6,5,'2026-04-29',NULL,'falta','manual'),
  (6,7,'2026-04-30','07:01:00','asistencia','sensor'),(6,9,'2026-05-04','07:00:00','asistencia','sensor'),
  (6,1,'2026-05-05','07:02:00','asistencia','sensor'),(6,3,'2026-05-06','07:01:00','asistencia','sensor'),
  (6,5,'2026-05-07','07:00:00','asistencia','sensor'),(6,7,'2026-05-08','07:16:00','retardo','sensor'),
  (6,9,'2026-05-11','07:01:00','asistencia','sensor'),(6,1,'2026-05-12','07:00:00','asistencia','sensor'),
  (6,3,'2026-05-13',NULL,'falta','manual'),(6,5,'2026-05-14','07:02:00','asistencia','sensor'),
  (6,7,'2026-05-15','07:01:00','asistencia','sensor'),
  -- A007 retardos frecuentes
  (7,1,'2026-04-20','07:20:00','retardo','sensor'),(7,3,'2026-04-21',NULL,'falta','manual'),
  (7,5,'2026-04-22','07:01:00','asistencia','sensor'),(7,7,'2026-04-23','07:00:00','asistencia','sensor'),
  (7,9,'2026-04-24','07:19:00','retardo','sensor'),(7,1,'2026-04-27',NULL,'falta','manual'),
  (7,3,'2026-04-28','07:02:00','asistencia','sensor'),(7,5,'2026-04-29','07:01:00','asistencia','sensor'),
  (7,7,'2026-04-30','07:00:00','asistencia','sensor'),(7,9,'2026-05-04','07:18:00','retardo','sensor'),
  (7,1,'2026-05-05',NULL,'falta','manual'),(7,3,'2026-05-06','07:01:00','asistencia','sensor'),
  (7,5,'2026-05-07','07:02:00','asistencia','sensor'),(7,7,'2026-05-08','07:00:00','asistencia','sensor'),
  (7,9,'2026-05-11','07:21:00','retardo','sensor'),(7,1,'2026-05-12',NULL,'falta','manual'),
  (7,3,'2026-05-13','07:01:00','asistencia','sensor'),(7,5,'2026-05-14','07:00:00','asistencia','sensor'),
  (7,7,'2026-05-15',NULL,'falta','manual'),
  -- A008 muy buena
  (8,1,'2026-04-20','07:01:00','asistencia','sensor'),(8,3,'2026-04-21','07:02:00','asistencia','sensor'),
  (8,5,'2026-04-22','07:00:00','asistencia','sensor'),(8,7,'2026-04-23','07:01:00','asistencia','sensor'),
  (8,9,'2026-04-24','07:02:00','asistencia','sensor'),(8,1,'2026-04-27','07:00:00','asistencia','sensor'),
  (8,3,'2026-04-28','07:15:00','retardo','sensor'),(8,5,'2026-04-29','07:01:00','asistencia','sensor'),
  (8,7,'2026-04-30','07:02:00','asistencia','sensor'),(8,9,'2026-05-04','07:00:00','asistencia','sensor'),
  (8,1,'2026-05-05','07:01:00','asistencia','sensor'),(8,3,'2026-05-06','07:02:00','asistencia','sensor'),
  (8,5,'2026-05-07','07:00:00','asistencia','sensor'),(8,7,'2026-05-08','07:17:00','retardo','sensor'),
  (8,9,'2026-05-11','07:01:00','asistencia','sensor'),(8,1,'2026-05-12','07:02:00','asistencia','sensor'),
  (8,3,'2026-05-13','07:00:00','asistencia','sensor'),(8,5,'2026-05-14','07:01:00','asistencia','sensor'),
  (8,7,'2026-05-15','07:02:00','asistencia','sensor'),
  -- A009 crítico — mayoría faltas
  (9,1,'2026-04-20',NULL,'falta','manual'),(9,3,'2026-04-21',NULL,'falta','manual'),
  (9,5,'2026-04-22','07:22:00','retardo','sensor'),(9,7,'2026-04-23',NULL,'falta','manual'),
  (9,9,'2026-04-24',NULL,'falta','manual'),(9,1,'2026-04-27','07:01:00','asistencia','sensor'),
  (9,3,'2026-04-28',NULL,'falta','manual'),(9,5,'2026-04-29',NULL,'falta','manual'),
  (9,7,'2026-04-30','07:20:00','retardo','sensor'),(9,9,'2026-05-04',NULL,'falta','manual'),
  (9,1,'2026-05-05',NULL,'falta','manual'),(9,3,'2026-05-06','07:01:00','asistencia','sensor'),
  (9,5,'2026-05-07',NULL,'falta','manual'),(9,7,'2026-05-08',NULL,'falta','manual'),
  (9,9,'2026-05-11','07:19:00','retardo','sensor'),(9,1,'2026-05-12',NULL,'falta','manual'),
  (9,3,'2026-05-13',NULL,'falta','manual'),(9,5,'2026-05-14','07:02:00','asistencia','sensor'),
  (9,7,'2026-05-15',NULL,'falta','manual'),
  -- A010 normal
  (10,1,'2026-04-20','07:02:00','asistencia','sensor'),(10,3,'2026-04-21','07:01:00','asistencia','sensor'),
  (10,5,'2026-04-22','07:00:00','asistencia','sensor'),(10,7,'2026-04-23','07:16:00','retardo','sensor'),
  (10,9,'2026-04-24','07:02:00','asistencia','sensor'),(10,1,'2026-04-27','07:01:00','asistencia','sensor'),
  (10,3,'2026-04-28','07:00:00','asistencia','sensor'),(10,5,'2026-04-29','07:02:00','asistencia','sensor'),
  (10,7,'2026-04-30','07:01:00','asistencia','sensor'),(10,9,'2026-05-04','07:00:00','asistencia','sensor'),
  (10,1,'2026-05-05',NULL,'falta','manual'),(10,3,'2026-05-06','07:02:00','asistencia','sensor'),
  (10,5,'2026-05-07','07:01:00','asistencia','sensor'),(10,7,'2026-05-08','07:00:00','asistencia','sensor'),
  (10,9,'2026-05-11','07:18:00','retardo','sensor'),(10,1,'2026-05-12','07:01:00','asistencia','sensor'),
  (10,3,'2026-05-13','07:02:00','asistencia','sensor'),(10,5,'2026-05-14','07:00:00','asistencia','sensor'),
  (10,7,'2026-05-15','07:01:00','asistencia','sensor');
 
-- ── 1°B — Alumnos 11-18, Horarios 11-17 ───────────────────────
INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por) VALUES
  (11,11,'2026-04-20','09:02:00','asistencia','sensor'),(11,13,'2026-04-21','09:01:00','asistencia','sensor'),
  (11,15,'2026-04-22','09:00:00','asistencia','sensor'),(11,16,'2026-04-23','09:02:00','asistencia','sensor'),
  (11,17,'2026-04-24','09:01:00','asistencia','sensor'),(11,11,'2026-04-27','09:18:00','retardo','sensor'),
  (11,13,'2026-04-28','09:01:00','asistencia','sensor'),(11,15,'2026-04-29','09:00:00','asistencia','sensor'),
  (11,16,'2026-04-30','09:02:00','asistencia','sensor'),(11,17,'2026-05-04','09:01:00','asistencia','sensor'),
  (11,11,'2026-05-05','09:00:00','asistencia','sensor'),(11,13,'2026-05-06','09:02:00','asistencia','sensor'),
  (11,15,'2026-05-07','09:01:00','asistencia','sensor'),(11,16,'2026-05-08','09:16:00','retardo','sensor'),
  (11,17,'2026-05-11','09:00:00','asistencia','sensor'),(11,11,'2026-05-12','09:01:00','asistencia','sensor'),
  (11,13,'2026-05-13','09:02:00','asistencia','sensor'),(11,15,'2026-05-14','09:00:00','asistencia','sensor'),
  (11,16,'2026-05-15','09:01:00','asistencia','sensor'),
  (12,11,'2026-04-20',NULL,'falta','manual'),(12,13,'2026-04-21','09:20:00','retardo','sensor'),
  (12,15,'2026-04-22','09:01:00','asistencia','sensor'),(12,16,'2026-04-23',NULL,'falta','manual'),
  (12,17,'2026-04-24','09:02:00','asistencia','sensor'),(12,11,'2026-04-27','09:01:00','asistencia','sensor'),
  (12,13,'2026-04-28',NULL,'falta','manual'),(12,15,'2026-04-29','09:19:00','retardo','sensor'),
  (12,16,'2026-04-30','09:01:00','asistencia','sensor'),(12,17,'2026-05-04',NULL,'falta','manual'),
  (12,11,'2026-05-05','09:02:00','asistencia','sensor'),(12,13,'2026-05-06','09:01:00','asistencia','sensor'),
  (12,15,'2026-05-07',NULL,'falta','manual'),(12,16,'2026-05-08','09:21:00','retardo','sensor'),
  (12,17,'2026-05-11','09:00:00','asistencia','sensor'),(12,11,'2026-05-12',NULL,'falta','manual'),
  (12,13,'2026-05-13','09:01:00','asistencia','sensor'),(12,15,'2026-05-14','09:02:00','asistencia','sensor'),
  (12,16,'2026-05-15',NULL,'falta','manual'),
  (13,11,'2026-04-20','09:01:00','asistencia','sensor'),(13,13,'2026-04-21','09:02:00','asistencia','sensor'),
  (13,15,'2026-04-22','09:00:00','asistencia','sensor'),(13,16,'2026-04-23','09:01:00','asistencia','sensor'),
  (13,17,'2026-04-24','09:17:00','retardo','sensor'),(13,11,'2026-04-27','09:02:00','asistencia','sensor'),
  (13,13,'2026-04-28','09:01:00','asistencia','sensor'),(13,15,'2026-04-29','09:00:00','asistencia','sensor'),
  (13,16,'2026-04-30',NULL,'falta','manual'),(13,17,'2026-05-04','09:01:00','asistencia','sensor'),
  (13,11,'2026-05-05','09:02:00','asistencia','sensor'),(13,13,'2026-05-06','09:00:00','asistencia','sensor'),
  (13,15,'2026-05-07','09:01:00','asistencia','sensor'),(13,16,'2026-05-08','09:02:00','asistencia','sensor'),
  (13,17,'2026-05-11','09:19:00','retardo','sensor'),(13,11,'2026-05-12','09:01:00','asistencia','sensor'),
  (13,13,'2026-05-13','09:02:00','asistencia','sensor'),(13,15,'2026-05-14','09:00:00','asistencia','sensor'),
  (13,16,'2026-05-15','09:01:00','asistencia','sensor'),
  (14,11,'2026-04-20','09:02:00','asistencia','sensor'),(14,13,'2026-04-21','09:00:00','asistencia','sensor'),
  (14,15,'2026-04-22','09:01:00','asistencia','sensor'),(14,16,'2026-04-23','09:18:00','retardo','sensor'),
  (14,17,'2026-04-24','09:02:00','asistencia','sensor'),(14,11,'2026-04-27','09:01:00','asistencia','sensor'),
  (14,13,'2026-04-28','09:00:00','asistencia','sensor'),(14,15,'2026-04-29','09:02:00','asistencia','sensor'),
  (14,16,'2026-04-30','09:01:00','asistencia','sensor'),(14,17,'2026-05-04','09:00:00','asistencia','sensor'),
  (14,11,'2026-05-05',NULL,'falta','manual'),(14,13,'2026-05-06','09:02:00','asistencia','sensor'),
  (14,15,'2026-05-07','09:01:00','asistencia','sensor'),(14,16,'2026-05-08','09:00:00','asistencia','sensor'),
  (14,17,'2026-05-11','09:16:00','retardo','sensor'),(14,11,'2026-05-12','09:01:00','asistencia','sensor'),
  (14,13,'2026-05-13','09:02:00','asistencia','sensor'),(14,15,'2026-05-14','09:00:00','asistencia','sensor'),
  (14,16,'2026-05-15','09:01:00','asistencia','sensor'),
  (15,11,'2026-04-20','09:01:00','asistencia','sensor'),(15,13,'2026-04-21','09:02:00','asistencia','sensor'),
  (15,15,'2026-04-22','09:00:00','asistencia','sensor'),(15,16,'2026-04-23','09:01:00','asistencia','sensor'),
  (15,17,'2026-04-24','09:02:00','asistencia','sensor'),(15,11,'2026-04-27','09:00:00','asistencia','sensor'),
  (15,13,'2026-04-28','09:19:00','retardo','sensor'),(15,15,'2026-04-29','09:01:00','asistencia','sensor'),
  (15,16,'2026-04-30','09:02:00','asistencia','sensor'),(15,17,'2026-05-04','09:00:00','asistencia','sensor'),
  (15,11,'2026-05-05','09:01:00','asistencia','sensor'),(15,13,'2026-05-06','09:02:00','asistencia','sensor'),
  (15,15,'2026-05-07','09:00:00','asistencia','sensor'),(15,16,'2026-05-08','09:01:00','asistencia','sensor'),
  (15,17,'2026-05-11','09:02:00','asistencia','sensor'),(15,11,'2026-05-12','09:17:00','retardo','sensor'),
  (15,13,'2026-05-13','09:00:00','asistencia','sensor'),(15,15,'2026-05-14','09:01:00','asistencia','sensor'),
  (15,16,'2026-05-15','09:02:00','asistencia','sensor'),
  (16,11,'2026-04-20','09:20:00','retardo','sensor'),(16,13,'2026-04-21',NULL,'falta','manual'),
  (16,15,'2026-04-22','09:01:00','asistencia','sensor'),(16,16,'2026-04-23','09:00:00','asistencia','sensor'),
  (16,17,'2026-04-24','09:18:00','retardo','sensor'),(16,11,'2026-04-27',NULL,'falta','manual'),
  (16,13,'2026-04-28','09:02:00','asistencia','sensor'),(16,15,'2026-04-29','09:01:00','asistencia','sensor'),
  (16,16,'2026-04-30','09:00:00','asistencia','sensor'),(16,17,'2026-05-04','09:21:00','retardo','sensor'),
  (16,11,'2026-05-05',NULL,'falta','manual'),(16,13,'2026-05-06','09:01:00','asistencia','sensor'),
  (16,15,'2026-05-07','09:02:00','asistencia','sensor'),(16,16,'2026-05-08','09:00:00','asistencia','sensor'),
  (16,17,'2026-05-11','09:19:00','retardo','sensor'),(16,11,'2026-05-12',NULL,'falta','manual'),
  (16,13,'2026-05-13','09:01:00','asistencia','sensor'),(16,15,'2026-05-14','09:02:00','asistencia','sensor'),
  (16,16,'2026-05-15','09:00:00','asistencia','sensor'),
  (17,11,'2026-04-20','09:01:00','asistencia','sensor'),(17,13,'2026-04-21','09:02:00','asistencia','sensor'),
  (17,15,'2026-04-22','09:00:00','asistencia','sensor'),(17,16,'2026-04-23','09:01:00','asistencia','sensor'),
  (17,17,'2026-04-24','09:02:00','asistencia','sensor'),(17,11,'2026-04-27','09:00:00','asistencia','sensor'),
  (17,13,'2026-04-28','09:01:00','asistencia','sensor'),(17,15,'2026-04-29','09:16:00','retardo','sensor'),
  (17,16,'2026-04-30','09:02:00','asistencia','sensor'),(17,17,'2026-05-04','09:01:00','asistencia','sensor'),
  (17,11,'2026-05-05','09:00:00','asistencia','sensor'),(17,13,'2026-05-06','09:02:00','asistencia','sensor'),
  (17,15,'2026-05-07','09:01:00','asistencia','sensor'),(17,16,'2026-05-08','09:00:00','asistencia','sensor'),
  (17,17,'2026-05-11','09:02:00','asistencia','sensor'),(17,11,'2026-05-12','09:01:00','asistencia','sensor'),
  (17,13,'2026-05-13','09:00:00','asistencia','sensor'),(17,15,'2026-05-14','09:18:00','retardo','sensor'),
  (17,16,'2026-05-15','09:01:00','asistencia','sensor'),
  (18,11,'2026-04-20','09:02:00','asistencia','sensor'),(18,13,'2026-04-21','09:01:00','asistencia','sensor'),
  (18,15,'2026-04-22','09:17:00','retardo','sensor'),(18,16,'2026-04-23','09:02:00','asistencia','sensor'),
  (18,17,'2026-04-24','09:01:00','asistencia','sensor'),(18,11,'2026-04-27','09:00:00','asistencia','sensor'),
  (18,13,'2026-04-28','09:02:00','asistencia','sensor'),(18,15,'2026-04-29','09:01:00','asistencia','sensor'),
  (18,16,'2026-04-30',NULL,'falta','manual'),(18,17,'2026-05-04','09:02:00','asistencia','sensor'),
  (18,11,'2026-05-05','09:01:00','asistencia','sensor'),(18,13,'2026-05-06','09:00:00','asistencia','sensor'),
  (18,15,'2026-05-07','09:02:00','asistencia','sensor'),(18,16,'2026-05-08','09:01:00','asistencia','sensor'),
  (18,17,'2026-05-11','09:20:00','retardo','sensor'),(18,11,'2026-05-12','09:02:00','asistencia','sensor'),
  (18,13,'2026-05-13','09:01:00','asistencia','sensor'),(18,15,'2026-05-14','09:00:00','asistencia','sensor'),
  (18,16,'2026-05-15','09:02:00','asistencia','sensor');
 
-- ── 2°A — Alumnos 19-26, Horarios 18-22 ───────────────────────
INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por) VALUES
  (19,18,'2026-04-20','11:02:00','asistencia','sensor'),(19,19,'2026-04-21','11:01:00','asistencia','sensor'),
  (19,20,'2026-04-22','11:00:00','asistencia','sensor'),(19,21,'2026-04-23','11:02:00','asistencia','sensor'),
  (19,22,'2026-04-24','11:15:00','retardo','sensor'),(19,18,'2026-04-27','11:01:00','asistencia','sensor'),
  (19,19,'2026-04-28','11:00:00','asistencia','sensor'),(19,20,'2026-04-29','11:02:00','asistencia','sensor'),
  (19,21,'2026-04-30','11:01:00','asistencia','sensor'),(19,22,'2026-05-04','11:00:00','asistencia','sensor'),
  (19,18,'2026-05-05','11:02:00','asistencia','sensor'),(19,19,'2026-05-06','11:01:00','asistencia','sensor'),
  (19,20,'2026-05-07','11:00:00','asistencia','sensor'),(19,21,'2026-05-08','11:18:00','retardo','sensor'),
  (19,22,'2026-05-11','11:01:00','asistencia','sensor'),(19,18,'2026-05-12','11:00:00','asistencia','sensor'),
  (19,19,'2026-05-13','11:02:00','asistencia','sensor'),(19,20,'2026-05-14','11:01:00','asistencia','sensor'),
  (19,21,'2026-05-15','11:00:00','asistencia','sensor'),
  (20,18,'2026-04-20','11:19:00','retardo','sensor'),(20,19,'2026-04-21',NULL,'falta','manual'),
  (20,20,'2026-04-22','11:01:00','asistencia','sensor'),(20,21,'2026-04-23',NULL,'falta','manual'),
  (20,22,'2026-04-24','11:02:00','asistencia','sensor'),(20,18,'2026-04-27','11:00:00','asistencia','sensor'),
  (20,19,'2026-04-28','11:20:00','retardo','sensor'),(20,20,'2026-04-29',NULL,'falta','manual'),
  (20,21,'2026-04-30','11:01:00','asistencia','sensor'),(20,22,'2026-05-04','11:00:00','asistencia','sensor'),
  (20,18,'2026-05-05',NULL,'falta','manual'),(20,19,'2026-05-06','11:02:00','asistencia','sensor'),
  (20,20,'2026-05-07','11:17:00','retardo','sensor'),(20,21,'2026-05-08',NULL,'falta','manual'),
  (20,22,'2026-05-11','11:01:00','asistencia','sensor'),(20,18,'2026-05-12',NULL,'falta','manual'),
  (20,19,'2026-05-13','11:02:00','asistencia','sensor'),(20,20,'2026-05-14','11:21:00','retardo','sensor'),
  (20,21,'2026-05-15',NULL,'falta','manual'),
  (21,18,'2026-04-20','11:01:00','asistencia','sensor'),(21,19,'2026-04-21','11:02:00','asistencia','sensor'),
  (21,20,'2026-04-22','11:00:00','asistencia','sensor'),(21,21,'2026-04-23','11:01:00','asistencia','sensor'),
  (21,22,'2026-04-24','11:02:00','asistencia','sensor'),(21,18,'2026-04-27','11:00:00','asistencia','sensor'),
  (21,19,'2026-04-28','11:16:00','retardo','sensor'),(21,20,'2026-04-29','11:01:00','asistencia','sensor'),
  (21,21,'2026-04-30','11:02:00','asistencia','sensor'),(21,22,'2026-05-04','11:00:00','asistencia','sensor'),
  (21,18,'2026-05-05','11:01:00','asistencia','sensor'),(21,19,'2026-05-06','11:02:00','asistencia','sensor'),
  (21,20,'2026-05-07','11:00:00','asistencia','sensor'),(21,21,'2026-05-08','11:01:00','asistencia','sensor'),
  (21,22,'2026-05-11','11:19:00','retardo','sensor'),(21,18,'2026-05-12','11:02:00','asistencia','sensor'),
  (21,19,'2026-05-13','11:01:00','asistencia','sensor'),(21,20,'2026-05-14','11:00:00','asistencia','sensor'),
  (21,21,'2026-05-15','11:02:00','asistencia','sensor'),
  (22,18,'2026-04-20','11:02:00','asistencia','sensor'),(22,19,'2026-04-21','11:00:00','asistencia','sensor'),
  (22,20,'2026-04-22','11:17:00','retardo','sensor'),(22,21,'2026-04-23','11:02:00','asistencia','sensor'),
  (22,22,'2026-04-24','11:01:00','asistencia','sensor'),(22,18,'2026-04-27',NULL,'falta','manual'),
  (22,19,'2026-04-28','11:00:00','asistencia','sensor'),(22,20,'2026-04-29','11:02:00','asistencia','sensor'),
  (22,21,'2026-04-30','11:01:00','asistencia','sensor'),(22,22,'2026-05-04','11:00:00','asistencia','sensor'),
  (22,18,'2026-05-05','11:18:00','retardo','sensor'),(22,19,'2026-05-06','11:02:00','asistencia','sensor'),
  (22,20,'2026-05-07','11:01:00','asistencia','sensor'),(22,21,'2026-05-08','11:00:00','asistencia','sensor'),
  (22,22,'2026-05-11','11:02:00','asistencia','sensor'),(22,18,'2026-05-12','11:01:00','asistencia','sensor'),
  (22,19,'2026-05-13',NULL,'falta','manual'),(22,20,'2026-05-14','11:00:00','asistencia','sensor'),
  (22,21,'2026-05-15','11:02:00','asistencia','sensor'),
  (23,18,'2026-04-20','11:01:00','asistencia','sensor'),(23,19,'2026-04-21','11:02:00','asistencia','sensor'),
  (23,20,'2026-04-22','11:00:00','asistencia','sensor'),(23,21,'2026-04-23','11:16:00','retardo','sensor'),
  (23,22,'2026-04-24','11:01:00','asistencia','sensor'),(23,18,'2026-04-27','11:02:00','asistencia','sensor'),
  (23,19,'2026-04-28','11:00:00','asistencia','sensor'),(23,20,'2026-04-29','11:01:00','asistencia','sensor'),
  (23,21,'2026-04-30','11:02:00','asistencia','sensor'),(23,22,'2026-05-04','11:00:00','asistencia','sensor'),
  (23,18,'2026-05-05','11:01:00','asistencia','sensor'),(23,19,'2026-05-06','11:19:00','retardo','sensor'),
  (23,20,'2026-05-07','11:02:00','asistencia','sensor'),(23,21,'2026-05-08','11:01:00','asistencia','sensor'),
  (23,22,'2026-05-11','11:00:00','asistencia','sensor'),(23,18,'2026-05-12','11:02:00','asistencia','sensor'),
  (23,19,'2026-05-13','11:01:00','asistencia','sensor'),(23,20,'2026-05-14','11:00:00','asistencia','sensor'),
  (23,21,'2026-05-15','11:02:00','asistencia','sensor'),
  (24,18,'2026-04-20',NULL,'falta','manual'),(24,19,'2026-04-21','11:20:00','retardo','sensor'),
  (24,20,'2026-04-22','11:01:00','asistencia','sensor'),(24,21,'2026-04-23',NULL,'falta','manual'),
  (24,22,'2026-04-24','11:02:00','asistencia','sensor'),(24,18,'2026-04-27','11:01:00','asistencia','sensor'),
  (24,19,'2026-04-28',NULL,'falta','manual'),(24,20,'2026-04-29','11:00:00','asistencia','sensor'),
  (24,21,'2026-04-30','11:17:00','retardo','sensor'),(24,22,'2026-05-04',NULL,'falta','manual'),
  (24,18,'2026-05-05','11:01:00','asistencia','sensor'),(24,19,'2026-05-06','11:02:00','asistencia','sensor'),
  (24,20,'2026-05-07',NULL,'falta','manual'),(24,21,'2026-05-08','11:18:00','retardo','sensor'),
  (24,22,'2026-05-11','11:00:00','asistencia','sensor'),(24,18,'2026-05-12',NULL,'falta','manual'),
  (24,19,'2026-05-13','11:01:00','asistencia','sensor'),(24,20,'2026-05-14','11:02:00','asistencia','sensor'),
  (24,21,'2026-05-15',NULL,'falta','manual'),
  (25,18,'2026-04-20','11:02:00','asistencia','sensor'),(25,19,'2026-04-21','11:01:00','asistencia','sensor'),
  (25,20,'2026-04-22','11:00:00','asistencia','sensor'),(25,21,'2026-04-23','11:02:00','asistencia','sensor'),
  (25,22,'2026-04-24','11:01:00','asistencia','sensor'),(25,18,'2026-04-27','11:16:00','retardo','sensor'),
  (25,19,'2026-04-28','11:02:00','asistencia','sensor'),(25,20,'2026-04-29','11:01:00','asistencia','sensor'),
  (25,21,'2026-04-30','11:00:00','asistencia','sensor'),(25,22,'2026-05-04','11:02:00','asistencia','sensor'),
  (25,18,'2026-05-05','11:01:00','asistencia','sensor'),(25,19,'2026-05-06','11:00:00','asistencia','sensor'),
  (25,20,'2026-05-07','11:19:00','retardo','sensor'),(25,21,'2026-05-08','11:02:00','asistencia','sensor'),
  (25,22,'2026-05-11','11:01:00','asistencia','sensor'),(25,18,'2026-05-12','11:00:00','asistencia','sensor'),
  (25,19,'2026-05-13','11:02:00','asistencia','sensor'),(25,20,'2026-05-14','11:01:00','asistencia','sensor'),
  (25,21,'2026-05-15','11:00:00','asistencia','sensor'),
  (26,18,'2026-04-20','11:01:00','asistencia','sensor'),(26,19,'2026-04-21','11:00:00','asistencia','sensor'),
  (26,20,'2026-04-22','11:02:00','asistencia','sensor'),(26,21,'2026-04-23','11:01:00','asistencia','sensor'),
  (26,22,'2026-04-24','11:17:00','retardo','sensor'),(26,18,'2026-04-27','11:00:00','asistencia','sensor'),
  (26,19,'2026-04-28','11:02:00','asistencia','sensor'),(26,20,'2026-04-29','11:01:00','asistencia','sensor'),
  (26,21,'2026-04-30',NULL,'falta','manual'),(26,22,'2026-05-04','11:00:00','asistencia','sensor'),
  (26,18,'2026-05-05','11:02:00','asistencia','sensor'),(26,19,'2026-05-06','11:01:00','asistencia','sensor'),
  (26,20,'2026-05-07','11:00:00','asistencia','sensor'),(26,21,'2026-05-08','11:02:00','asistencia','sensor'),
  (26,22,'2026-05-11','11:01:00','asistencia','sensor'),(26,18,'2026-05-12','11:18:00','retardo','sensor'),
  (26,19,'2026-05-13','11:00:00','asistencia','sensor'),(26,20,'2026-05-14','11:02:00','asistencia','sensor'),
  (26,21,'2026-05-15','11:01:00','asistencia','sensor');
 
-- ── 3°A — Alumnos 27-32, Horarios 23-27 ───────────────────────
INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por) VALUES
  (27,23,'2026-04-20','12:01:00','asistencia','sensor'),(27,24,'2026-04-21','12:02:00','asistencia','sensor'),
  (27,25,'2026-04-22','12:00:00','asistencia','sensor'),(27,26,'2026-04-23','12:01:00','asistencia','sensor'),
  (27,27,'2026-04-24','12:02:00','asistencia','sensor'),(27,23,'2026-04-27','12:17:00','retardo','sensor'),
  (27,24,'2026-04-28','12:01:00','asistencia','sensor'),(27,25,'2026-04-29','12:00:00','asistencia','sensor'),
  (27,26,'2026-04-30','12:02:00','asistencia','sensor'),(27,27,'2026-05-04','12:01:00','asistencia','sensor'),
  (27,23,'2026-05-05','12:00:00','asistencia','sensor'),(27,24,'2026-05-06','12:02:00','asistencia','sensor'),
  (27,25,'2026-05-07','12:01:00','asistencia','sensor'),(27,26,'2026-05-08','12:18:00','retardo','sensor'),
  (27,27,'2026-05-11','12:00:00','asistencia','sensor'),(27,23,'2026-05-12','12:02:00','asistencia','sensor'),
  (27,24,'2026-05-13','12:01:00','asistencia','sensor'),(27,25,'2026-05-14','12:00:00','asistencia','sensor'),
  (27,26,'2026-05-15','12:02:00','asistencia','sensor'),
  (28,23,'2026-04-20',NULL,'falta','manual'),(28,24,'2026-04-21','12:20:00','retardo','sensor'),
  (28,25,'2026-04-22','12:01:00','asistencia','sensor'),(28,26,'2026-04-23',NULL,'falta','manual'),
  (28,27,'2026-04-24','12:02:00','asistencia','sensor'),(28,23,'2026-04-27','12:01:00','asistencia','sensor'),
  (28,24,'2026-04-28',NULL,'falta','manual'),(28,25,'2026-04-29','12:00:00','asistencia','sensor'),
  (28,26,'2026-04-30','12:19:00','retardo','sensor'),(28,27,'2026-05-04',NULL,'falta','manual'),
  (28,23,'2026-05-05','12:01:00','asistencia','sensor'),(28,24,'2026-05-06','12:02:00','asistencia','sensor'),
  (28,25,'2026-05-07',NULL,'falta','manual'),(28,26,'2026-05-08','12:18:00','retardo','sensor'),
  (28,27,'2026-05-11','12:00:00','asistencia','sensor'),(28,23,'2026-05-12',NULL,'falta','manual'),
  (28,24,'2026-05-13','12:01:00','asistencia','sensor'),(28,25,'2026-05-14','12:02:00','asistencia','sensor'),
  (28,26,'2026-05-15',NULL,'falta','manual'),
  (29,23,'2026-04-20','12:02:00','asistencia','sensor'),(29,24,'2026-04-21','12:01:00','asistencia','sensor'),
  (29,25,'2026-04-22','12:00:00','asistencia','sensor'),(29,26,'2026-04-23','12:02:00','asistencia','sensor'),
  (29,27,'2026-04-24','12:16:00','retardo','sensor'),(29,23,'2026-04-27','12:01:00','asistencia','sensor'),
  (29,24,'2026-04-28','12:00:00','asistencia','sensor'),(29,25,'2026-04-29','12:02:00','asistencia','sensor'),
  (29,26,'2026-04-30','12:01:00','asistencia','sensor'),(29,27,'2026-05-04','12:00:00','asistencia','sensor'),
  (29,23,'2026-05-05','12:02:00','asistencia','sensor'),(29,24,'2026-05-06','12:01:00','asistencia','sensor'),
  (29,25,'2026-05-07','12:00:00','asistencia','sensor'),(29,26,'2026-05-08','12:17:00','retardo','sensor'),
  (29,27,'2026-05-11','12:02:00','asistencia','sensor'),(29,23,'2026-05-12','12:01:00','asistencia','sensor'),
  (29,24,'2026-05-13','12:00:00','asistencia','sensor'),(29,25,'2026-05-14','12:02:00','asistencia','sensor'),
  (29,26,'2026-05-15','12:01:00','asistencia','sensor'),
  (30,23,'2026-04-20','12:01:00','asistencia','sensor'),(30,24,'2026-04-21','12:02:00','asistencia','sensor'),
  (30,25,'2026-04-22','12:17:00','retardo','sensor'),(30,26,'2026-04-23','12:01:00','asistencia','sensor'),
  (30,27,'2026-04-24','12:00:00','asistencia','sensor'),(30,23,'2026-04-27','12:02:00','asistencia','sensor'),
  (30,24,'2026-04-28','12:01:00','asistencia','sensor'),(30,25,'2026-04-29','12:00:00','asistencia','sensor'),
  (30,26,'2026-04-30',NULL,'falta','manual'),(30,27,'2026-05-04','12:02:00','asistencia','sensor'),
  (30,23,'2026-05-05','12:01:00','asistencia','sensor'),(30,24,'2026-05-06','12:00:00','asistencia','sensor'),
  (30,25,'2026-05-07','12:19:00','retardo','sensor'),(30,26,'2026-05-08','12:02:00','asistencia','sensor'),
  (30,27,'2026-05-11','12:01:00','asistencia','sensor'),(30,23,'2026-05-12','12:00:00','asistencia','sensor'),
  (30,24,'2026-05-13','12:02:00','asistencia','sensor'),(30,25,'2026-05-14','12:01:00','asistencia','sensor'),
  (30,26,'2026-05-15','12:00:00','asistencia','sensor'),
  (31,23,'2026-04-20','12:02:00','asistencia','sensor'),(31,24,'2026-04-21','12:00:00','asistencia','sensor'),
  (31,25,'2026-04-22','12:01:00','asistencia','sensor'),(31,26,'2026-04-23','12:18:00','retardo','sensor'),
  (31,27,'2026-04-24','12:02:00','asistencia','sensor'),(31,23,'2026-04-27','12:01:00','asistencia','sensor'),
  (31,24,'2026-04-28','12:00:00','asistencia','sensor'),(31,25,'2026-04-29','12:02:00','asistencia','sensor'),
  (31,26,'2026-04-30','12:01:00','asistencia','sensor'),(31,27,'2026-05-04','12:00:00','asistencia','sensor'),
  (31,23,'2026-05-05','12:16:00','retardo','sensor'),(31,24,'2026-05-06','12:02:00','asistencia','sensor'),
  (31,25,'2026-05-07','12:01:00','asistencia','sensor'),(31,26,'2026-05-08','12:00:00','asistencia','sensor'),
  (31,27,'2026-05-11','12:02:00','asistencia','sensor'),(31,23,'2026-05-12','12:01:00','asistencia','sensor'),
  (31,24,'2026-05-13','12:00:00','asistencia','sensor'),(31,25,'2026-05-14','12:19:00','retardo','sensor'),
  (31,26,'2026-05-15','12:02:00','asistencia','sensor'),
  (32,23,'2026-04-20','12:01:00','asistencia','sensor'),(32,24,'2026-04-21','12:02:00','asistencia','sensor'),
  (32,25,'2026-04-22','12:00:00','asistencia','sensor'),(32,26,'2026-04-23','12:01:00','asistencia','sensor'),
  (32,27,'2026-04-24','12:20:00','retardo','sensor'),(32,23,'2026-04-27','12:02:00','asistencia','sensor'),
  (32,24,'2026-04-28','12:01:00','asistencia','sensor'),(32,25,'2026-04-29','12:00:00','asistencia','sensor'),
  (32,26,'2026-04-30','12:02:00','asistencia','sensor'),(32,27,'2026-05-04',NULL,'falta','manual'),
  (32,23,'2026-05-05','12:01:00','asistencia','sensor'),(32,24,'2026-05-06','12:00:00','asistencia','sensor'),
  (32,25,'2026-05-07','12:02:00','asistencia','sensor'),(32,26,'2026-05-08','12:01:00','asistencia','sensor'),
  (32,27,'2026-05-11','12:00:00','asistencia','sensor'),(32,23,'2026-05-12','12:17:00','retardo','sensor'),
  (32,24,'2026-05-13','12:02:00','asistencia','sensor'),(32,25,'2026-05-14','12:01:00','asistencia','sensor'),
  (32,26,'2026-05-15','12:00:00','asistencia','sensor');
 
-- ── Permisos de ejemplo ───────────────────────────────────────
INSERT INTO permisos (alumno_id, fecha_inicio, fecha_fin, motivo, activo) VALUES
  (5,  '2026-05-05', '2026-05-07', 'Cita médica',           1),
  (9,  '2026-04-28', '2026-04-29', 'Trámite familiar',      1),
  (20, '2026-05-12', '2026-05-13', 'Competencia deportiva', 1);
 
INSERT INTO permiso_horarios (permiso_id, horario_id) VALUES
  (1, 3),(1, 5),
  (2, 7),(2, 9),
  (3, 19),(3, 20);
