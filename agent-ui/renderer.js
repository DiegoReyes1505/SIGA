let corriendo = false;

const btnIniciar = document.getElementById("btnIniciar");
const btnDetener = document.getElementById("btnDetener");
const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");
const logEl      = document.getElementById("log");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnGuardar = document.getElementById("btnGuardar");
const savedMsg   = document.getElementById("savedMsg");
const cfgPort    = document.getElementById("cfgPort");
const cfgBaud    = document.getElementById("cfgBaud");
const cfgUrl     = document.getElementById("cfgUrl");
const cfgSecret  = document.getElementById("cfgSecret");

// ── Helpers ────────────────────────────────────────────────────
function ahora() {
  return new Date().toLocaleTimeString("es-MX", { hour12: false });
}

function agregarLog(msg, tipo = "info") {
  if (tipo === "info") {
    if (/error|err|fail/i.test(msg))             tipo = "error";
    else if (/warn|desconect|cerrado/i.test(msg)) tipo = "warn";
    else if (/(\u2705|conectado|abierto|success)/i.test(msg)) tipo = "ok";
  }
  const line = document.createElement("div");
  line.className = `log-line log-${tipo}`;
  line.innerHTML =
    `<span class="log-time">${ahora()}</span>` +
    `<span class="log-msg">${msg}</span>`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setEstado(activo) {
  corriendo = activo;
  statusPill.className = `status-pill ${activo ? "corriendo" : "detenido"}`;
  statusText.textContent = activo ? "Corriendo" : "Detenido";
  btnIniciar.disabled = activo;
  btnDetener.disabled = !activo;
}

// ── Cargar config al iniciar ───────────────────────────────────
(async () => {
  const env = await window.agentAPI.leerEnv();
  cfgPort.value   = env.SERIAL_PORT   || "COM3";
  cfgBaud.value   = env.SERIAL_BAUD   || "9600";
  cfgUrl.value    = env.SERVER_URL    || "";
  cfgSecret.value = env.AGENT_SECRET  || "";

  const estado = await window.agentAPI.estado();
  setEstado(estado.corriendo);
  agregarLog("Interfaz lista. Presiona Iniciar agente para comenzar.", "system");
})();

// ── Controles ──────────────────────────────────────────────────
btnIniciar.addEventListener("click", async () => {
  agregarLog("Iniciando agente...", "system");
  await window.agentAPI.iniciar();
});

btnDetener.addEventListener("click", async () => {
  agregarLog("Deteniendo agente...", "system");
  await window.agentAPI.detener();
  setEstado(false);
});

btnLimpiar.addEventListener("click", () => { logEl.innerHTML = ""; });

// ── Guardar config ─────────────────────────────────────────────
btnGuardar.addEventListener("click", async () => {
  await window.agentAPI.guardarEnv({
    SERIAL_PORT:  cfgPort.value.trim(),
    SERIAL_BAUD:  cfgBaud.value.trim(),
    SERVER_URL:   cfgUrl.value.trim(),
    AGENT_SECRET: cfgSecret.value.trim(),
  });
  savedMsg.textContent = "\u2713 Guardado correctamente";
  agregarLog("Configuración guardada en .env", "ok");
  setTimeout(() => { savedMsg.textContent = ""; }, 3000);
});

// ── Eventos del agente ─────────────────────────────────────────
window.agentAPI.onInicio(() => {
  setEstado(true);
  agregarLog("Agente iniciado correctamente.", "ok");
});

window.agentAPI.onDetener(({ code }) => {
  setEstado(false);
  agregarLog(`Agente detenido (código de salida: ${code ?? 0}).`, "warn");
});

window.agentAPI.onLog(({ tipo, msg }) => {
  msg.split("\n").filter(Boolean).forEach((l) => agregarLog(l, tipo));
});
