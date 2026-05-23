/**
 * Lógica pura para procesar eventos del sensor (sin req/res).
 * Usada tanto por la ruta HTTP /api/sensor/evento
 * como por el handler Socket.io agente:evento.
 */
const db = require("../utils/db");
const readerState = require("./reader-state");
const { registrarDesdeSensor } = require("../controllers/asistencias");

async function procesarEventoSensor(datos, io) {
  const { tipo, huella_id, raw } = datos;

  if (tipo === "SENSOR_OK") {
    readerState.setOnline(true);
    io.emit("sensor:status", readerState.getState());
    return;
  }

  if (tipo === "SENSOR_ERROR") {
    readerState.setOnline(false);
    io.emit("sensor:status", readerState.getState());
    return;
  }

  if (tipo === "ENROLL_STATUS") {
    readerState.setMode("enroll");
    io.emit("reader:mode", readerState.getState());
    io.emit("sensor:enroll_status", {
      estado: datos.estado,
      mensaje: datos.mensaje,
    });
    return;
  }

  if (tipo === "ENROLL_ERROR") {
    readerState.startCooldown(3);
    io.emit("reader:cooldown", readerState.getState());
    io.emit("sensor:enroll_error", {
      mensaje: datos.mensaje || "Error al registrar la huella",
    });
    return;
  }

  if (tipo === "NOT_FOUND") {
    if (
      readerState.getState().mode !== "attendance" ||
      readerState.isCooldownActive()
    ) return;
    io.emit("sensor:not_found", {});
    return;
  }

  if (tipo === "MATCH" && huella_id != null) {
    const state = readerState.getState();
    if (state.mode !== "attendance" || state.cooldown_active) return;

    const [alumno] = await db.query(
      `SELECT a.*, g.nombre AS grupo
       FROM alumnos a
       JOIN grupos g ON g.id = a.grupo_id
       WHERE a.huella_id = ? AND a.activo = 1`,
      [huella_id],
    );

    if (!alumno) {
      io.emit("sensor:alumno_no_encontrado", { huella_id });
      return;
    }

    const resultado = await registrarDesdeSensor(alumno, io);
    if (!resultado.ok) {
      io.emit("asistencia:error", {
        huella_id,
        alumno_id: alumno.id,
        mensaje: resultado.mensaje,
      });
    }
  }
}

module.exports = { procesarEventoSensor };
