const db = require('../utils/db');

async function buscarHuellaLibre() {
  const rows = await db.query(`
    SELECT huella_id
    FROM alumnos
    WHERE huella_id IS NOT NULL
    ORDER BY huella_id
  `);

  const ocupados = new Set(rows.map((r) => r.huella_id));
  for (let i = 1; i <= 127; i++) {
    if (!ocupados.has(i)) return i;
  }
  return null;
}

// Emite un comando al agente local. Si el agente no está conectado, devuelve false.
function emitirAlAgente(req, cmd) {
  const getAgente = req.app.get('agenteSocket');
  const agente = getAgente ? getAgente() : null;
  if (!agente) return false;
  agente.emit('agente:comando', { cmd });
  return true;
}

exports.enroll = async (req, res, next) => {
  try {
    const { alumno_id } = req.body;
    if (!alumno_id) {
      return res.status(422).json({ ok: false, mensaje: 'alumno_id es obligatorio' });
    }

    const [alumno] = await db.query(
      'SELECT * FROM alumnos WHERE id = ? AND activo = 1',
      [alumno_id]
    );
    if (!alumno) {
      return res.status(404).json({ ok: false, mensaje: 'Alumno no encontrado' });
    }

    if (alumno.huella_id) {
      return res.status(409).json({ ok: false, mensaje: 'El alumno ya tiene huella registrada' });
    }

    const huella_id = await buscarHuellaLibre();
    if (!huella_id) {
      return res.status(409).json({ ok: false, mensaje: 'No hay espacios libres en el sensor' });
    }

    const enviado = emitirAlAgente(req, `ENROLL:${huella_id}:${alumno_id}`);
    if (!enviado) {
      return res.status(503).json({ ok: false, mensaje: 'El agente local no está conectado' });
    }

    // Cambiar a modo enroll mientras dura el proceso
    const readerState = require('../services/reader-state');
    readerState.clearCooldown();
    readerState.setMode('enroll');

    const io = req.app.get('io');
    io.emit('reader:state', readerState.getState());
    io.emit('sensor:enroll_status', {
      alumno_id,
      huella_id,
      estado: 'iniciado',
      mensaje: 'Coloca el dedo en el sensor',
    });

    res.json({ ok: true, alumno_id, huella_id, mensaje: 'Proceso de enrolamiento iniciado' });
  } catch (e) {
    next(e);
  }
};

exports.deleteFingerprint = async (req, res, next) => {
  try {
    const { alumno_id } = req.body;
    if (!alumno_id) {
      return res.status(422).json({ ok: false, mensaje: 'alumno_id es obligatorio' });
    }

    const [alumno] = await db.query(
      'SELECT * FROM alumnos WHERE id = ? AND activo = 1',
      [alumno_id]
    );
    if (!alumno) {
      return res.status(404).json({ ok: false, mensaje: 'Alumno no encontrado' });
    }

    if (!alumno.huella_id) {
      return res.status(409).json({ ok: false, mensaje: 'El alumno no tiene huella registrada' });
    }

    const enviado = emitirAlAgente(req, `DELETE:${alumno.huella_id}`);
    if (!enviado) {
      return res.status(503).json({ ok: false, mensaje: 'El agente local no está conectado' });
    }

    res.json({ ok: true, mensaje: 'Comando de eliminación enviado al sensor' });
  } catch (e) {
    next(e);
  }
};

exports.cancelEnroll = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const readerState = require('../services/reader-state');

    // Cancelar enroll → volver a attendance sin cooldown
    readerState.clearCooldown();
    readerState.setMode('attendance');
    io.emit('reader:state', readerState.getState());
    emitirAlAgente(req, 'CANCEL_ENROLL');

    res.json({ ok: true, mensaje: 'Enroll cancelado' });
  } catch (e) {
    next(e);
  }
};
