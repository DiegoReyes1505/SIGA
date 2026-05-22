const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

const fmt = (level, msg, meta) => {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
};

const logger = {
  error: (msg, meta) => CURRENT_LEVEL >= 0 && console.error(fmt('error', msg, meta)),
  warn:  (msg, meta) => CURRENT_LEVEL >= 1 && console.warn(fmt('warn',  msg, meta)),
  info:  (msg, meta) => CURRENT_LEVEL >= 2 && console.log(fmt('info',   msg, meta)),
  debug: (msg, meta) => CURRENT_LEVEL >= 3 && console.log(fmt('debug',  msg, meta)),
};

module.exports = logger;
