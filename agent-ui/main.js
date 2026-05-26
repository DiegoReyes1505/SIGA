/**
 * SIGA Agent UI — Electron main process
 * Arranca la ventana y gestiona el proceso del agente como hijo.
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let win = null;
let agentProcess = null;

const ENV_PATH = path.join(__dirname, "../.env");

// ── Leer .env como objeto ──────────────────────────────────────
function leerEnv() {
  const vars = {
    SERIAL_PORT: "COM3",
    SERIAL_BAUD: "9600",
    SERVER_URL: "",
    AGENT_SECRET: "",
  };
  if (!fs.existsSync(ENV_PATH)) return vars;
  const lines = fs.readFileSync(ENV_PATH, "utf-8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) vars[key.trim()] = rest.join("=").trim();
  }
  return vars;
}

// ── Escribir .env ──────────────────────────────────────────────
function escribirEnv(nuevos) {
  let contenido = "";
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, "utf-8").split("\n");
    const actualizadas = new Set();
    const resultado = [];
    for (const line of lines) {
      const [key] = line.split("=");
      if (key && nuevos[key.trim()] !== undefined) {
        resultado.push(`${key.trim()}=${nuevos[key.trim()]}`);
        actualizadas.add(key.trim());
      } else {
        resultado.push(line);
      }
    }
    for (const [k, v] of Object.entries(nuevos)) {
      if (!actualizadas.has(k)) resultado.push(`${k}=${v}`);
    }
    contenido = resultado.join("\n");
  } else {
    contenido = Object.entries(nuevos).map(([k, v]) => `${k}=${v}`).join("\n");
  }
  fs.writeFileSync(ENV_PATH, contenido, "utf-8");
}

// ── Crear ventana ──────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 820,
    height: 620,
    minWidth: 640,
    minHeight: 480,
    title: "SIGA — Agente Local",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  detenerAgente();
  app.quit();
});

// ── Iniciar agente ─────────────────────────────────────────────
function iniciarAgente() {
  if (agentProcess) return;
  const agentPath = path.join(__dirname, "../agent/index.js");
  agentProcess = spawn(process.execPath, [agentPath], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env },
  });
  agentProcess.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    win?.webContents.send("agent:log", { tipo: "info", msg });
  });
  agentProcess.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    win?.webContents.send("agent:log", { tipo: "error", msg });
  });
  agentProcess.on("exit", (code) => {
    agentProcess = null;
    win?.webContents.send("agent:stopped", { code });
  });
  win?.webContents.send("agent:started");
}

// ── Detener agente ─────────────────────────────────────────────
function detenerAgente() {
  if (!agentProcess) return;
  agentProcess.kill();
  agentProcess = null;
}

// ── IPC handlers ───────────────────────────────────────────────
ipcMain.handle("agent:start",  () => { iniciarAgente(); return true; });
ipcMain.handle("agent:stop",   () => { detenerAgente(); return true; });
ipcMain.handle("agent:status", () => ({ corriendo: !!agentProcess }));
ipcMain.handle("env:read",     () => leerEnv());
ipcMain.handle("env:write",    (_e, datos) => { escribirEnv(datos); return true; });
