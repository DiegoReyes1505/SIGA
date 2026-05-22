let state = {
  online: false,
  mode: "attendance",
  cooldown_until: null,
};

function now() {
  return Date.now();
}

function isCooldownActive() {
  return !!state.cooldown_until && state.cooldown_until > now();
}

function cooldownSeconds() {
  if (!isCooldownActive()) return 0;
  return Math.max(0, Math.ceil((state.cooldown_until - now()) / 1000));
}

function setOnline(value) {
  state.online = !!value;
}

function setMode(mode) {
  state.mode = mode;
}

function startCooldown(seconds = 3) {
  state.cooldown_until = now() + seconds * 1000;
  state.mode = "attendance";
}

function clearCooldown() {
  state.cooldown_until = null;
}

function getState() {
  if (!isCooldownActive() && state.cooldown_until) {
    clearCooldown();
  }

  return {
    online: state.online,
    mode: state.mode,
    cooldown_active: isCooldownActive(),
    cooldown_seconds: cooldownSeconds(),
  };
}

module.exports = {
  setOnline,
  setMode,
  startCooldown,
  clearCooldown,
  getState,
  isCooldownActive,
};
