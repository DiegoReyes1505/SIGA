const db = require("../utils/db");

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaActual() {
  return new Date().toTimeString().slice(0, 8);
}

function diaSemanaActual() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

async function horarioActivo(grupo_id) {
  const dia = diaSemanaActual();
  const hora = horaActual();

  const [horario] = await db.query(
    `
    SELECT h.*, m.nombre AS materia
    FROM horarios h
    JOIN materias m ON m.id = h.materia_id
    WHERE h.grupo_id = ?
      AND h.dia_semana = ?
      AND SUBTIME(h.hora_inicio, SEC_TO_TIME(h.tolerancia_min * 60)) <= ?
      AND h.hora_fin >= ?
    ORDER BY h.hora_inicio
    LIMIT 1
  `,
    [grupo_id, dia, hora, hora],
  );

  return horario || null;
}

function calcularTipo(horario) {
  const hora = horaActual();
  const [hh, mm, ss] = horario.hora_inicio.split(":").map(Number);
  const inicio = new Date();
  inicio.setHours(hh, mm, ss || 0, 0);

  const limite = new Date(inicio.getTime() + horario.tolerancia_min * 60000);
  const ahora = new Date();

  return ahora > limite ? "retardo" : "asistencia";
}

exports.listar = async (req, res, next) => {
  try {
    const { alumno_id, grupo_id, fecha_inicio, fecha_fin, tipo } = req.query;
    let sql = `
      SELECT a2.*, 
             CONCAT(a.nombre, ' ', a.apellido_pat, ' ', COALESCE(a.apellido_mat, '')) AS alumno,
             a.matricula,
             g.nombre AS grupo,
             m.nombre AS materia,
             h.hora_inicio,
             h.hora_fin
      FROM asistencias a2
      JOIN alumnos a  ON a.id = a2.alumno_id
      JOIN grupos g   ON g.id = a.grupo_id
      JOIN horarios h ON h.id = a2.horario_id
      JOIN materias m ON m.id = h.materia_id
      WHERE 1=1
    `;

    const params = [];

    if (alumno_id) {
      sql += " AND a2.alumno_id = ?";
      params.push(alumno_id);
    }

    if (grupo_id) {
      sql += " AND a.grupo_id = ?";
      params.push(grupo_id);
    }

    if (fecha_inicio) {
      sql += " AND a2.fecha >= ?";
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += " AND a2.fecha <= ?";
      params.push(fecha_fin);
    }

    if (tipo) {
      sql += " AND a2.tipo = ?";
      params.push(tipo);
    }

    sql += " ORDER BY a2.fecha DESC, a2.hora_entrada DESC, a2.creado_en DESC";

    const rows = await db.query(sql, params);
    res.json({ ok: true, datos: rows });
  } catch (e) {
    next(e);
  }
};

exports.hoy = async (req, res, next) => {
  try {
    const hoy = hoyISO();
    const rows = await db.query(
      `
      SELECT a2.*, 
             CONCAT(a.nombre, ' ', a.apellido_pat, ' ', COALESCE(a.apellido_mat, '')) AS alumno,
             a.matricula,
             g.nombre AS grupo,
             m.nombre AS materia,
             h.hora_inicio,
             h.hora_fin
      FROM asistencias a2
      JOIN alumnos a  ON a.id = a2.alumno_id
      JOIN grupos g   ON g.id = a.grupo_id
      JOIN horarios h ON h.id = a2.horario_id
      JOIN materias m ON m.id = h.materia_id
      WHERE a2.fecha = ?
      ORDER BY a2.creado_en DESC
    `,
      [hoy],
    );

    res.json({ ok: true, fecha: hoy, datos: rows });
  } catch (e) {
    next(e);
  }
};

exports.registrar = async (req, res, next) => {
  try {
    const { alumno_id, horario_id, fecha, hora_entrada, tipo, nota } = req.body;

    const result = await db.query(
      `INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, nota, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, 'manual')
       ON DUPLICATE KEY UPDATE
         hora_entrada = VALUES(hora_entrada),
         tipo = VALUES(tipo),
         nota = VALUES(nota),
         registrado_por = 'manual'`,
      [alumno_id, horario_id, fecha, hora_entrada || null, tipo, nota || null],
    );

    res
      .status(201)
      .json({
        ok: true,
        id: result.insertId || 0,
        mensaje: "Asistencia manual registrada",
      });
  } catch (e) {
    next(e);
  }
};

exports.registrarPermiso = async (req, res, next) => {
  try {
    const { alumno_id, horario_id, fecha, nota } = req.body;

    if (!alumno_id || !horario_id || !fecha) {
      return res
        .status(422)
        .json({
          ok: false,
          mensaje: "Alumno, horario y fecha son obligatorios",
        });
    }

    await db.query(
      `INSERT INTO asistencias (alumno_id, horario_id, fecha, tipo, nota, registrado_por)
       VALUES (?, ?, ?, 'permiso', ?, 'manual')
       ON DUPLICATE KEY UPDATE
         tipo = 'permiso',
         nota = VALUES(nota),
         registrado_por = 'manual'`,
      [alumno_id, horario_id, fecha, nota || null],
    );

    res
      .status(201)
      .json({ ok: true, mensaje: "Permiso registrado correctamente" });
  } catch (e) {
    next(e);
  }
};

exports.horariosDeAlumno = async (req, res, next) => {
  try {
    const alumno_id = req.params.alumno_id;
    const fecha = req.query.fecha || hoyISO();
    const dia = new Date(fecha + "T00:00:00").getDay();
    const diaSemana = dia === 0 ? 7 : dia;

    const [alumno] = await db.query(
      "SELECT grupo_id FROM alumnos WHERE id = ? AND activo = 1",
      [alumno_id],
    );
    if (!alumno) {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Alumno no encontrado" });
    }

    const rows = await db.query(
      `
      SELECT h.id, h.hora_inicio, h.hora_fin, h.tolerancia_min, m.nombre AS materia
      FROM horarios h
      JOIN materias m ON m.id = h.materia_id
      WHERE h.grupo_id = ? AND h.dia_semana = ?
      ORDER BY h.hora_inicio
    `,
      [alumno.grupo_id, diaSemana],
    );

    res.json({ ok: true, datos: rows, fecha });
  } catch (e) {
    next(e);
  }
};

exports.registrarDesdeSensor = async (alumno, io) => {
  const horario = await horarioActivo(alumno.grupo_id);
  if (!horario) {
    return {
      ok: false,
      mensaje: "No hay clase activa para este alumno en este momento",
    };
  }

  const fecha = hoyISO();
  const horaEntrada = horaActual();
  const tipo = calcularTipo(horario);

  const [existente] = await db.query(
    "SELECT id FROM asistencias WHERE alumno_id = ? AND horario_id = ? AND fecha = ?",
    [alumno.id, horario.id, fecha],
  );

  if (existente) {
    return {
      ok: false,
      mensaje: "La asistencia ya fue registrada para esta clase",
    };
  }

  const result = await db.query(
    `INSERT INTO asistencias (alumno_id, horario_id, fecha, hora_entrada, tipo, registrado_por)
     VALUES (?, ?, ?, ?, ?, 'sensor')`,
    [alumno.id, horario.id, fecha, horaEntrada, tipo],
  );

  const payload = {
    id: result.insertId,
    alumno_id: alumno.id,
    nombre: `${alumno.nombre} ${alumno.apellido_pat}`,
    matricula: alumno.matricula,
    grupo: alumno.grupo,
    materia: horario.materia,
    tipo,
    hora_entrada: horaEntrada,
    fecha,
  };

  if (io) io.emit("asistencia:nueva", payload);

  return { ok: true, datos: payload };
};
