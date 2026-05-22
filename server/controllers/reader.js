const readerState = require("../services/reader-state");

exports.status = async (req, res) => {
  res.json({ ok: true, datos: readerState.getState() });
};
