// Middleware de autenticación del agente (via secret header)
const AGENT_SECRET = process.env.AGENT_SECRET || 'cambiar_en_produccion';

function agentAuth(req, res, next) {
  const secret = req.headers['x-agent-secret'];
  if (!secret || secret !== AGENT_SECRET) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
  }
  next();
}

module.exports = { agentAuth };
