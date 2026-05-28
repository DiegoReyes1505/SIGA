document.addEventListener("DOMContentLoaded", () => {
  SIGA.renderSidebar("huellas");
});

// ── DOM ─────────────────────────────────────────────────────────────
const estadoLectorDetalle     = document.getElementById("estadoLectorDetalle");
const tablaAsistenciasHoy     = document.getElementById("tablaAsistenciasHoy");
const btnRefrescarAsistencias = document.getElementById("btnRefrescarAsistencias");
const estadoAsistencias       = document.getElementById("estadoAsistencias");

let asistenciasHoy = [];
let timer = null;

// ── Helper fecha ────────────────────────────────────────────────
function fechaHoyISO() {
  const hoy = new Date();
  const y   = hoy.getFullYear();
  const m   = String(hoy.getMonth() + 1).padStart(2, "0");
  const d   = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── UI helpers ────────────────────────────────────────────────────
function mostrarEstado(msg, tipo = "info", autoHide = true, delay = 4000) {
  if (!estadoAsistencias) return;
  clearTimeout(timer);
  estadoAsistencias.classList.remove("hidden");
  estadoAsistencias.textContent = msg;
  estadoAsistencias.style.background =
    tipo === "error" ? "#7f1d1d"
    : tipo === "ok"  ? "#14532d"
    : tipo === "warn" ? "#78350f"
    : "#1d4ed8";
  if (autoHide) {
    timer = setTimeout(() => {
      estadoAsistencias.classList.add("hidden");
      estadoAsistencias.textContent = "";
    }, delay);
  }
}

function tipoBadge(tipo) {
  const cls = tipo === "asistencia" ? "ok" : tipo === "retardo" ? "warn" : tipo === "permiso" ? "info" : "no";
  return `<span class="badge ${cls}">${tipo}</span>`;
}

// ── Estado del lector ──────────────────────────────────────────────
async function cargarEstadoLector() {
  try {
    const res = await SIGA.getReaderStatus();
    const s   = res.datos || res;
    estadoLectorDetalle.textContent = !s.online
      ? "Lector desconectado."
      : s.cooldown_active
        ? `Lector conectado. Cooldown activo por ${s.cooldown_seconds}s.`
        : s.mode === "enroll"
          ? "Lector en modo enroll."
          : "Lector en modo asistencia.";
  } catch (e) {
    estadoLectorDetalle.textContent = "No se pudo obtener el estado del lector.";
  }
}

// ── Tabla de asistencias ──────────────────────────────────────────
async function cargarAsistenciasHoy() {
  try {
    const hoy = fechaHoyISO();
    const res = await SIGA.api(`/api/asistencias?fecha=${hoy}`);
    asistenciasHoy = res.datos || [];
    renderTabla();
  } catch (e) {
    console.error("Error cargando asistencias:", e);
  }
}

function renderTabla() {
  if (!tablaAsistenciasHoy) return;
  if (!asistenciasHoy.length) {
    tablaAsistenciasHoy.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">No hay asistencias registradas hoy</td></tr>';
    return;
  }
  tablaAsistenciasHoy.innerHTML = asistenciasHoy.map(a => `
    <tr>
      <td>${a.hora_entrada || "-"}</td>
      <td>${a.matricula}</td>
      <td>${a.alumno}</td>
      <td>${a.grupo}</td>
      <td>${a.materia}</td>
      <td>${tipoBadge(a.tipo)}</td>
    </tr>
  `).join("");
}

btnRefrescarAsistencias.addEventListener("click", cargarAsistenciasHoy);

// ── Eventos socket ──────────────────────────────────────────────────
socket.on("asistencia:nueva", async (data) => {
  await cargarAsistenciasHoy();
  const tipoLabel = data.tipo === "retardo" ? "⏰ Retardo" : "✅ Asistencia";
  mostrarEstado(
    `${tipoLabel} — ${data.alumno} (${data.materia}, ${data.hora_entrada ? data.hora_entrada.slice(0,5) : ""})`,
    "ok", true, 4000
  );
});

socket.on("asistencia:sin_horario", (data) => {
  mostrarEstado(`⚠️ Sin horario activo — ${data.alumno} (${data.hora})`, "error", true, 5000);
});

socket.on("asistencia:duplicada", (data) => {
  mostrarEstado(`ℹ️ Ya registrado — ${data.alumno} tiene ${data.tipo} hoy`, "warn", true, 4000);
});

socket.on("asistencia:error", (data) => {
  mostrarEstado(data.mensaje || "No se pudo registrar la asistencia", "error", true, 5000);
});

// ── Estado del lector ──────────────────────────────────────────────────
["reader:mode", "reader:cooldown", "sensor:status", "reader:state",
 "sensor:enroll_ok", "sensor:delete_ok", "sensor:enroll_error"]
  .forEach(ev => socket.on(ev, cargarEstadoLector));

// ── Init ──────────────────────────────────────────────────────────────────
(async function init() {
  await cargarEstadoLector();
  await cargarAsistenciasHoy();
})();
