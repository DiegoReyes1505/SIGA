-- ============================================================
-- SIGA — Schema de base de datos
-- Seguro para ejecutar múltiples veces (IF NOT EXISTS)
-- Orden correcto de tablas para respetar Foreign Keys
-- ============================================================
 
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
 
-- 1. grupos (sin dependencias)
CREATE TABLE IF NOT EXISTS `grupos` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(50)  NOT NULL,
  `descripcion` VARCHAR(100) DEFAULT NULL,
  `activo`      TINYINT(1)   NOT NULL DEFAULT '1',
  `creado_en`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- 2. materias (sin dependencias)
CREATE TABLE IF NOT EXISTS `materias` (
  `id`        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nombre`    VARCHAR(100)  NOT NULL,
  `clave`     VARCHAR(20)   NOT NULL,
  `activo`    TINYINT(1)    NOT NULL DEFAULT '1',
  `creado_en` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- 3. alumnos (depende de grupos)
CREATE TABLE IF NOT EXISTS `alumnos` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `matricula`    VARCHAR(20)   NOT NULL,
  `nombre`       VARCHAR(80)   NOT NULL,
  `apellido_pat` VARCHAR(60)   NOT NULL,
  `apellido_mat` VARCHAR(60)   DEFAULT NULL,
  `grupo_id`     INT UNSIGNED  NOT NULL,
  `huella_id`    TINYINT UNSIGNED DEFAULT NULL,
  `activo`       TINYINT(1)    NOT NULL DEFAULT '1',
  `creado_en`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `matricula` (`matricula`),
  KEY `grupo_id` (`grupo_id`),
  KEY `idx_alumnos_huella` (`huella_id`),
  CONSTRAINT `alumnos_ibfk_1`
    FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- 4. horarios (depende de grupos y materias)
CREATE TABLE IF NOT EXISTS `horarios` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `grupo_id`       INT UNSIGNED NOT NULL,
  `materia_id`     INT UNSIGNED NOT NULL,
  `dia_semana`     TINYINT      NOT NULL,
  `hora_inicio`    TIME         NOT NULL,
  `hora_fin`       TIME         NOT NULL,
  `tolerancia_min` INT UNSIGNED NOT NULL DEFAULT '10',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grupo_materia_dia_hora` (`grupo_id`, `dia_semana`, `hora_inicio`),
  KEY `materia_id` (`materia_id`),
  KEY `idx_horarios_dia` (`dia_semana`),
  CONSTRAINT `horarios_ibfk_1`
    FOREIGN KEY (`grupo_id`)   REFERENCES `grupos`   (`id`) ON DELETE CASCADE,
  CONSTRAINT `horarios_ibfk_2`
    FOREIGN KEY (`materia_id`) REFERENCES `materias` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- 5. permisos (depende de alumnos)
CREATE TABLE IF NOT EXISTS `permisos` (
  `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `alumno_id`      INT UNSIGNED  NOT NULL,
  `fecha_inicio`   DATE          NOT NULL,
  `fecha_fin`      DATE          NOT NULL,
  `motivo`         VARCHAR(255)  NOT NULL,
  `activo`         TINYINT(1)    NOT NULL DEFAULT '1',
  `creado_en`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_permisos_alumno`  (`alumno_id`),
  KEY `idx_permisos_fechas`  (`fecha_inicio`, `fecha_fin`),
  CONSTRAINT `permisos_ibfk_1`
    FOREIGN KEY (`alumno_id`) REFERENCES `alumnos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- 6. permiso_horarios (depende de permisos y horarios)
CREATE TABLE IF NOT EXISTS `permiso_horarios` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `permiso_id` INT UNSIGNED NOT NULL,
  `horario_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permiso_horario` (`permiso_id`, `horario_id`),
  KEY `horario_id` (`horario_id`),
  CONSTRAINT `permiso_horarios_ibfk_1`
    FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `permiso_horarios_ibfk_2`
    FOREIGN KEY (`horario_id`) REFERENCES `horarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- 7. asistencias (depende de alumnos y horarios)
CREATE TABLE IF NOT EXISTS `asistencias` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `alumno_id`      INT UNSIGNED NOT NULL,
  `horario_id`     INT UNSIGNED NOT NULL,
  `fecha`          DATE         NOT NULL,
  `hora_entrada`   TIME         DEFAULT NULL,
  `tipo`           ENUM('asistencia','retardo','falta','permiso') NOT NULL,
  `nota`           TEXT         DEFAULT NULL,
  `registrado_por` ENUM('sensor','manual') NOT NULL DEFAULT 'sensor',
  `creado_en`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_alumno_horario_fecha` (`alumno_id`, `horario_id`, `fecha`),
  KEY `horario_id`              (`horario_id`),
  KEY `idx_asistencias_fecha`   (`fecha`),
  KEY `idx_asistencias_alumno`  (`alumno_id`),
  KEY `idx_asistencias_tipo`    (`tipo`),
  CONSTRAINT `asistencias_ibfk_1`
    FOREIGN KEY (`alumno_id`)  REFERENCES `alumnos`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `asistencias_ibfk_2`
    FOREIGN KEY (`horario_id`) REFERENCES `horarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
SET FOREIGN_KEY_CHECKS = 1;