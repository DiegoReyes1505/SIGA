const db                    = require('../utils/db');
const { registrarDesdeSensor } = require('./asistencias');
const readerState           = require('../services/reader-state');
const { procesarEventoSensor } = require('../services/sensor-eventos');

let ultimoEvento = null;

exports.procesarEvento = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    ultimoEvento = { ...req.body, ts: new Date() };
    await procesarEventoSensor(req.body, io);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.confirmEnroll = async (req, res, next) => {
  try {
    const { huella_id, alumno_id } = req.body;
    const io = req.app.get('io');

    await db.query('UPDATE alumnos SET huella_id = ? WHERE id = ?', [huella_id, alumno_id]);

    // Enroll finalizado → volver a modo attendance sin cooldown
    readerState.clearCooldown();
    readerState.setMode('attendance');
    io.emit('reader:state', readerState.getState());
    io.emit('sensor:enroll_ok', { huella_id, alumno_id });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.confirmDelete = async (req, res, next) => {
  try {
    const { huella_id } = req.body;
    const io = req.app.get('io');

    await db.query('UPDATE alumnos SET huella_id = NULL WHERE huella_id = ?', [huella_id]);

    // Delete finalizado → volver a modo attendance sin cooldown
    readerState.clearCooldown();
    readerState.setMode('attendance');
    io.emit('reader:state', readerState.getState());
    io.emit('sensor:delete_ok', { huella_id });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.status = async (req, res) => {
  res.json({ ok: true, ...readerState.getState(), ultimoEvento });
};
