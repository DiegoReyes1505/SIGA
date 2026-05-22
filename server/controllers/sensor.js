const db = require("../utils/db");
const { registrarDesdeSensor } = require("./asistencias");
const readerState = require("../services/reader-state");

let ultimoEvento = null;

exports.procesarEvento = async (req, res, next) => {
  try {
    const { tipo, huella_id, raw } = req.body;
    const io = req.app.get("io");
    ultimoEvento = { tipo, huella_id, raw, ts: new Date() };

    if (tipo === "SENSOR_OK") {
      readerState.setOnline(true);
      io.emit("sensor:status", readerState.getState());
      return res.json({ ok: true });
    }

    if (tipo === "SENSOR_ERROR") {
      readerState.setOnline(false);
      io.emit("sensor:status", readerState.getState());
      return res.json({ ok: true });
    }

    if (tipo === "ENROLL_STATUS") {
      readerState.setMode("enroll");
      io.emit("reader:mode", readerState.getState());
      io.emit("sensor:enroll_status", {
        estado: req.body.estado,
        mensaje: req.body.mensaje,
      });
      return res.json({ ok: true });
    }

    if (tipo === "ENROLL_ERROR") {
      readerState.startCooldown(3);
      io.emit("reader:cooldown", readerState.getState());
      io.emit("sensor:enroll_error", {
        mensaje: req.body.mensaje || "Error al registrar la huella",
      });
      return res.json({ ok: true });
    }

    if (tipo === "NOT_FOUND") {
      if (
        readerState.getState().mode !== "attendance" ||
        readerState.isCooldownActive()
      ) {
        return res.json({
          ok: true,
          mensaje: "Huella ignorada fuera de modo asistencia",
        });
      }

      io.emit("sensor:not_found", {});
      return res.json({
        ok: true,
        mensaje: "Huella no registrada en el sistema",
      });
    }

    if (tipo === "MATCH" && huella_id != null) {
      const state = readerState.getState();

      if (state.mode !== "attendance" || state.cooldown_active) {
        return res.json({
          ok: true,
          mensaje: "Lectura ignorada temporalmente",
        });
      }

      const [alumno] = await db.query(
        `SELECT a.*, g.nombre AS grupo
         FROM alumnos a
         JOIN grupos g ON g.id = a.grupo_id
         WHERE a.huella_id = ? AND a.activo = 1`,
        [huella_id],
      );

      if (!alumno) {
        io.emit("sensor:alumno_no_encontrado", { huella_id });
        return res.json({ ok: false, mensaje: "Huella sin alumno asignado" });
      }

      const resultado = await registrarDesdeSensor(alumno, io);

      if (!resultado.ok) {
        io.emit("asistencia:error", {
          huella_id,
          alumno_id: alumno.id,
          mensaje: resultado.mensaje,
        });
      }

      return res.json(resultado);
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.confirmEnroll = async (req, res, next) => {
  try {
    const { huella_id, alumno_id } = req.body;
    const io = req.app.get("io");

    await db.query("UPDATE alumnos SET huella_id = ? WHERE id = ?", [
      huella_id,
      alumno_id,
    ]);
    readerState.startCooldown(3);
    io.emit("reader:cooldown", readerState.getState());
    io.emit("sensor:enroll_ok", { huella_id, alumno_id });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.confirmDelete = async (req, res, next) => {
  try {
    const { huella_id } = req.body;
    const io = req.app.get("io");

    await db.query("UPDATE alumnos SET huella_id = NULL WHERE huella_id = ?", [
      huella_id,
    ]);
    readerState.startCooldown(3);
    io.emit("reader:cooldown", readerState.getState());
    io.emit("sensor:delete_ok", { huella_id });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.status = async (req, res) => {
  res.json({ ok: true, ...readerState.getState(), ultimoEvento });
};
