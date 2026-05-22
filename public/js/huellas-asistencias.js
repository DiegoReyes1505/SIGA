document.addEventListener("DOMContentLoaded", () => {
  SIGA.renderSidebar("huellas");
});

const estadoLectorDetalle = document.getElementById("estadoLectorDetalle");
const tablaAsistenciasHoy = document.getElementById("tablaAsistenciasHoy");
const btnRefrescarAsistencias = document.getElementById(
  "btnRefrescarAsistencias",
);
const estadoAsistencias = document.getElementById("estadoAsistencias");

let asistenciasHoy = [];
let timer = null;

function mostrarEstado(msg, tipo = "info", autoHide = true, delay = 4000) {
  clearTimeout(timer);
  estadoAsistencias.classList.remove("hidden");
  estadoAsistencias.textContent = msg;
  estadoAsistencias.style.background =
    tipo === "error"
      ? "#7f1d1d"
      : tipo === "ok"
        ? "#14532d"
        : tipo === "warn"
          ? "#78350f"
          : "#1d4ed8";

  if (autoHide) {
    timer = setTimeout(() => {
      estadoAsistencias.classList.add("hidden");
      estadoAsistencias.textContent = "";
    }, delay);
  }
}

function tipoBadge(tipo) {
  const cls =
    tipo === "asistencia"
      ? "ok"
      : tipo === "retardo"
        ? "warn"
        : tipo === "permiso"
          ? "info"
          : "no";
  return `<span class="badge ${cls}">${tipo}</span>`;
}

async function cargarEstadoLector() {
  try {
    const res = await SIGA.getReaderStatus();
    const s = res.datos || res;
    estadoLectorDetalle.textContent = !s.online
      ? "Lector desconectado."
      : s.cooldown_active
        ? `Lector conectado. Cooldown activo por ${s.cooldown_seconds}s. El lector volverá solo a asistencia.`
        : s.mode === "enroll"
          ? "Lector en modo enroll."
          : "Lector en modo asistencia.";
  } catch (e) {
    estadoLectorDetalle.textContent =
      "No se pudo obtener el estado del lector.";
  }
}

async function cargarAsistenciasHoy() {
  const res = await SIGA.api("/api/asistencias/hoy");
  asistenciasHoy = res.datos;
  renderTabla();
}

function renderTabla() {
  if (!asistenciasHoy.length) {
    tablaAsistenciasHoy.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">No hay asistencias registradas hoy</td></tr>';
    return;
  }

  tablaAsistenciasHoy.innerHTML = asistenciasHoy
    .map(
      (a) => `
    <tr>
      <td>${a.hora_entrada || "-"}</td>
      <td>${a.matricula}</td>
      <td>${a.alumno}</td>
      <td>${a.grupo}</td>
      <td>${a.materia}</td>
      <td>${tipoBadge(a.tipo)}</td>
    </tr>
  `,
    )
    .join("");
}

btnRefrescarAsistencias.addEventListener("click", cargarAsistenciasHoy);

socket.on("asistencia:nueva", async (data) => {
  await cargarAsistenciasHoy();
  mostrarEstado(
    `Asistencia registrada: ${data.nombre} (${data.tipo})`,
    "ok",
    true,
    4000,
  );
});

socket.on("asistencia:error", (data) => {
  mostrarEstado(
    data.mensaje || "No se pudo registrar la asistencia",
    "error",
    true,
    5000,
  );
});

socket.on("reader:mode", cargarEstadoLector);
socket.on("reader:cooldown", cargarEstadoLector);
socket.on("sensor:status", cargarEstadoLector);

(async function init() {
  await cargarEstadoLector();
  await cargarAsistenciasHoy();
})();
