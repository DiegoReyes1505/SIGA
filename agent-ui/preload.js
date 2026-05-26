const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentAPI", {
  iniciar:    () => ipcRenderer.invoke("agent:start"),
  detener:    () => ipcRenderer.invoke("agent:stop"),
  estado:     () => ipcRenderer.invoke("agent:status"),
  leerEnv:    () => ipcRenderer.invoke("env:read"),
  guardarEnv: (d) => ipcRenderer.invoke("env:write", d),

  onLog:     (cb) => ipcRenderer.on("agent:log",     (_e, d) => cb(d)),
  onInicio:  (cb) => ipcRenderer.on("agent:started", ()      => cb()),
  onDetener: (cb) => ipcRenderer.on("agent:stopped", (_e, d) => cb(d)),
});
