// ================================================================
// SIGA — Dashboard con gráficas Chart.js
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  SIGA.renderSidebar("dashboard");
});

// ── DOM ─────────────────────────────────────────────────────────────
const fechaHoyEl         = document.getElementById("fechaHoy");
const kpiAsistenciasHoy  = document.getElementById("kpiAsistenciasHoy");
const kpiRetardosHoy     = document.getElementById("kpiRetardosHoy");
const kpiFaltasHoy       = document.getElementById("kpiFaltasHoy");
const kpiPermisosHoy     = document.getElementById("kpiPermisosHoy");
const mesAsistencias     = document.getElementById("mesAsistencias");
const mesRetardos        = document.getElementById("mesRetardos");
const mesFaltas          = document.getElementById("mesFaltas");
const mesPermisos        = document.getElementById("mesPermisos");
const tablaFaltas        = document.getElementById("tablaFaltas");
const tablaRetardos      = document.getElementById("tablaRetardos");
const feedAsistencias    = document.getElementById("feedAsistencias");
const feedContador       = document.getElementById("feedContador");
const btnRefrescar       = document.getElementById("btnRefrescar");

// ── Estado ──────────────────────────────────────────────────────────
const MAX_FEED = 20;
let feedItems = [];
let kpisHoy   = { asistencias: 0, retardos: 0, faltas: 0, permisos: 0 };

let chartDona     = null;
let chartLinea    = null;
let chartGrupos   = null;
let chartMaterias = null;

// ── Colores ─────────────────────────────────────────────────────────
const COLORES = {
  asistencia:      "#16a34a",
  retardo:         "#d97706",
  falta:           "#dc2626",
  permiso:         "#2563eb",
  asistenciaAlpha: "rgba(22,163,74,0.7)",
  retardoAlpha:    "rgba(217,119,6,0.7)",
  faltaAlpha:      "rgba(220,38,38,0.7)",
  permisoAlpha:    "rgba(37,99,235,0.7)",
};

Chart.defaults.color       = "#9ca3af";
Chart.defaults.borderColor = "#374151";

// ── Helpers ────────────────────────────────────────────────────────
function fechaHoyISO() {
  const hoy = new Date();
  const y   = hoy.getFullYear();
  const m   = String(hoy.getMonth() + 1).padStart(2, "0");
  const d   = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatFechaCorta(fechaStr) {
  const f = String(fechaStr).slice(0, 10);
  const [, m, d] = f.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

function formatFechaLarga(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

function tipoBadge(tipo) {
  const cls = tipo === "asistencia" ? "ok" : tipo === "retardo" ? "warn" : tipo === "permiso" ? "info" : "no";
  return `<span class="badge ${cls}">${tipo}</span>`;
}

function pulsarKPI(el) {
  el.classList.remove("pulso");
  void el.offsetWidth;
  el.classList.add("pulso");
  setTimeout(() => el.classList.remove("pulso"), 400);
}

function actualizarKPIHoy(tipo) {
  const mapa = {
    asistencia: kpiAsistenciasHoy,
    retardo:    kpiRetardosHoy,
    falta:      kpiFaltasHoy,
    permiso:    kpiPermisosHoy,
  };
  if (kpisHoy[tipo] !== undefined) {
    kpisHoy[tipo]++;
    const el = mapa[tipo];
    if (el) { el.textContent = kpisHoy[tipo]; pulsarKPI(el); }
  }
}

function destruirChart(instancia) {
  if (instancia) { try { instancia.destroy(); } catch (_) {} }
  return null;
}

// ── KPIs de hoy ──────────────────────────────────────────────────
async function cargarResumenHoy() {
  try {
    const res = await SIGA.api("/api/reportes/resumen");
    const d = res.datos;
    kpisHoy = { asistencias: d.asistencias || 0, retardos: d.retardos || 0, faltas: d.faltas || 0, permisos: d.permisos || 0 };
    kpiAsistenciasHoy.textContent = kpisHoy.asistencias;
    kpiRetardosHoy.textContent    = kpisHoy.retardos;
    kpiFaltasHoy.textContent      = kpisHoy.faltas;
    kpiPermisosHoy.textContent    = kpisHoy.permisos;
    fechaHoyEl.textContent        = formatFechaLarga(res.fecha);
  } catch (e) { console.error("Error KPIs hoy:", e); }
}

// ── Resumen del mes ───────────────────────────────────────────────
async function cargarResumenMes() {
  try {
    const res = await SIGA.api("/api/reportes/resumen-mes");
    const d = res.datos;
    mesAsistencias.textContent = d.asistencias || 0;
    mesRetardos.textContent    = d.retardos    || 0;
    mesFaltas.textContent      = d.faltas      || 0;
    mesPermisos.textContent    = d.permisos    || 0;
  } catch (e) { console.error("Error resumen mes:", e); }
}

// ── GRÁFICA 1: Dona ─────────────────────────────────────────────────
async function cargarChartDona() {
  try {
    const res = await SIGA.api("/api/reportes/resumen-mes");
    const d = res.datos;
    chartDona = destruirChart(chartDona);
    const ctx = document.getElementById("chartDona").getContext("2d");
    chartDona = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Asistencias", "Retardos", "Faltas", "Permisos"],
        datasets: [{ data: [d.asistencias||0, d.retardos||0, d.faltas||0, d.permisos||0], backgroundColor: [COLORES.asistencia, COLORES.retardo, COLORES.falta, COLORES.permiso], borderWidth: 2, borderColor: "#111827", hoverOffset: 8 }],
      },
      options: { responsive: true, maintainAspectRatio: true, aspectRatio: 1.6, cutout: "60%", layout: { padding: { top: 8, bottom: 8 } }, plugins: { legend: { position: "bottom", labels: { padding: 14, font: { size: 12 }, boxWidth: 14, boxHeight: 14 } }, tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a,b)=>a+b,0); const pct = total > 0 ? Math.round((ctx.raw/total)*100) : 0; return ` ${ctx.label}: ${ctx.raw} (${pct}%)`; } } } } },
    });
  } catch (e) { console.error("Error chart dona:", e); }
}

// ── GRÁFICA 2: Línea ──────────────────────────────────────────────
async function cargarChartLinea() {
  try {
    const res = await SIGA.api("/api/reportes/tendencia-diaria?dias=14");
    const rows = res.datos || [];
    chartLinea = destruirChart(chartLinea);
    const ctx = document.getElementById("chartLinea").getContext("2d");
    chartLinea = new Chart(ctx, {
      type: "line",
      data: {
        labels: rows.map(r => formatFechaCorta(r.fecha)),
        datasets: [
          { label: "Asistencias", data: rows.map(r=>r.asistencias), borderColor: COLORES.asistencia, backgroundColor: "rgba(22,163,74,0.1)", tension: 0.3, fill: true, pointRadius: 4, pointHoverRadius: 6 },
          { label: "Retardos",    data: rows.map(r=>r.retardos),    borderColor: COLORES.retardo,    backgroundColor: "transparent", tension: 0.3, borderDash: [4,3], pointRadius: 4, pointHoverRadius: 6 },
          { label: "Faltas",      data: rows.map(r=>r.faltas),      borderColor: COLORES.falta,      backgroundColor: "transparent", tension: 0.3, borderDash: [4,3], pointRadius: 4, pointHoverRadius: 6 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: true, interaction: { mode: "index", intersect: false }, scales: { x: { grid: { color: "#1f2937" } }, y: { grid: { color: "#1f2937" }, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: "bottom", labels: { padding: 14, font: { size: 12 } } } } },
    });
  } catch (e) { console.error("Error chart línea:", e); }
}

// ── GRÁFICA 3: Barras por grupo ────────────────────────────────────────
async function cargarChartGrupos() {
  try {
    const res = await SIGA.api("/api/reportes/por-grupo");
    const rows = res.datos || [];
    chartGrupos = destruirChart(chartGrupos);
    const ctx = document.getElementById("chartGrupos").getContext("2d");
    chartGrupos = new Chart(ctx, {
      type: "bar",
      data: {
        labels: rows.map(r => r.grupo),
        datasets: [
          { label: "Asistencias", data: rows.map(r=>r.asistencias), backgroundColor: COLORES.asistenciaAlpha, borderColor: COLORES.asistencia, borderWidth: 1, borderRadius: 4 },
          { label: "Retardos",    data: rows.map(r=>r.retardos),    backgroundColor: COLORES.retardoAlpha,    borderColor: COLORES.retardo,    borderWidth: 1, borderRadius: 4 },
          { label: "Faltas",      data: rows.map(r=>r.faltas),      backgroundColor: COLORES.faltaAlpha,      borderColor: COLORES.falta,      borderWidth: 1, borderRadius: 4 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: true, interaction: { mode: "index", intersect: false }, scales: { x: { grid: { display: false } }, y: { grid: { color: "#1f2937" }, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: "bottom", labels: { padding: 14, font: { size: 12 } } } } },
    });
  } catch (e) { console.error("Error chart grupos:", e); }
}

// ── GRÁFICA 4: Barras horizontales por materia ─────────────────────
async function cargarChartMaterias() {
  try {
    const res = await SIGA.api("/api/reportes/por-materia");
    const rows = res.datos || [];
    chartMaterias = destruirChart(chartMaterias);
    const ctx = document.getElementById("chartMaterias").getContext("2d");
    chartMaterias = new Chart(ctx, {
      type: "bar",
      data: {
        labels: rows.map(r => r.materia),
        datasets: [
          { label: "Asistencias", data: rows.map(r=>r.asistencias), backgroundColor: COLORES.asistenciaAlpha, borderColor: COLORES.asistencia, borderWidth: 1, borderRadius: 4 },
          { label: "Retardos",    data: rows.map(r=>r.retardos),    backgroundColor: COLORES.retardoAlpha,    borderColor: COLORES.retardo,    borderWidth: 1, borderRadius: 4 },
          { label: "Faltas",      data: rows.map(r=>r.faltas),      backgroundColor: COLORES.faltaAlpha,      borderColor: COLORES.falta,      borderWidth: 1, borderRadius: 4 },
        ],
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: true, interaction: { mode: "index", intersect: false }, scales: { x: { grid: { color: "#1f2937" }, beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } }, plugins: { legend: { position: "bottom", labels: { padding: 14, font: { size: 12 } } } } },
    });
  } catch (e) { console.error("Error chart materias:", e); }
}

// ── Tablas ────────────────────────────────────────────────────────────
async function cargarFaltasCriticas() {
  try {
    const res  = await SIGA.api("/api/reportes/faltas-criticas?umbral=1&dias=30");
    const rows = (res.datos || []).slice(0, 8);
    if (!rows.length) { tablaFaltas.innerHTML = '<p class="muted-label">Sin faltas registradas.</p>'; return; }
    tablaFaltas.innerHTML = `<table class="tabla-criticos"><thead><tr><th>Alumno</th><th>Grupo</th><th style="text-align:right;">Faltas</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.alumno}</td><td>${r.grupo}</td><td style="text-align:right;"><span class="badge no">${r.faltas}</span></td></tr>`).join("")}</tbody></table>`;
  } catch (e) { console.error("Error faltas:", e); }
}

async function cargarRetardosCriticos() {
  try {
    const res  = await SIGA.api("/api/reportes/retardos-criticos?umbral=1&dias=30");
    const rows = (res.datos || []).slice(0, 8);
    if (!rows.length) { tablaRetardos.innerHTML = '<p class="muted-label">Sin retardos registrados.</p>'; return; }
    tablaRetardos.innerHTML = `<table class="tabla-criticos"><thead><tr><th>Alumno</th><th>Grupo</th><th style="text-align:right;">Retardos</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.alumno}</td><td>${r.grupo}</td><td style="text-align:right;"><span class="badge warn">${r.retardos}</span></td></tr>`).join("")}</tbody></table>`;
  } catch (e) { console.error("Error retardos:", e); }
}

// ── Feed en vivo ─────────────────────────────────────────────────────
async function cargarFeedInicial() {
  try {
    // Endpoint correcto: GET /api/asistencias?fecha=YYYY-MM-DD
    const hoy = fechaHoyISO();
    const res = await SIGA.api(`/api/asistencias?fecha=${hoy}`);
    feedItems = (res.datos || []).slice(0, MAX_FEED).map(a => ({
      alumno:       a.alumno,
      matricula:    a.matricula,
      grupo:        a.grupo,
      materia:      a.materia,
      tipo:         a.tipo,
      hora_entrada: a.hora_entrada,
    }));
    renderFeed();
  } catch (e) { console.error("Error feed:", e); }
}

function renderFeed() {
  if (!feedAsistencias) return; // guarda por si el elemento no existe
  if (!feedItems.length) {
    feedAsistencias.innerHTML = '<p class="muted-label" style="padding:12px 0;">Sin asistencias hoy.</p>';
    if (feedContador) feedContador.textContent = "";
    return;
  }
  if (feedContador) feedContador.textContent = `${feedItems.length} hoy`;
  feedAsistencias.innerHTML = feedItems.map(a => `
    <div class="feed-item">
      <span class="feed-hora">${a.hora_entrada ? a.hora_entrada.slice(0,5) : "--:--"}</span>
      <span class="feed-nombre">${a.alumno} <span style="color:var(--muted);font-size:12px;">${a.matricula}</span></span>
      <span class="feed-meta">${a.grupo} · ${a.materia}</span>
      ${tipoBadge(a.tipo)}
    </div>
  `).join("");
}

// ── Evento en vivo ────────────────────────────────────────────────────
socket.on("asistencia:nueva", (data) => {
  feedItems.unshift({
    alumno:       data.alumno,
    matricula:    data.matricula,
    grupo:        data.grupo,
    materia:      data.materia,
    tipo:         data.tipo,
    hora_entrada: data.hora_entrada,
  });
  if (feedItems.length > MAX_FEED) feedItems.pop();
  renderFeed();
  actualizarKPIHoy(data.tipo);
});

// ── Carga completa ─────────────────────────────────────────────────────
async function cargarTodo() {
  await Promise.all([
    cargarResumenHoy(), cargarResumenMes(),
    cargarChartDona(), cargarChartLinea(), cargarChartGrupos(), cargarChartMaterias(),
    cargarFaltasCriticas(), cargarRetardosCriticos(),
    cargarFeedInicial(),
  ]);
}

btnRefrescar.addEventListener("click", cargarTodo);

(async function init() { await cargarTodo(); })();
