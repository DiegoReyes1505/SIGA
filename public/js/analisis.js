// ================================================================
// SIGA — Módulo 6: Análisis (inteligencia de negocios)
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  SIGA.renderSidebar("analisis");
  inicializarFechas();
});

// ── Colores compartidos con dashboard ────────────────────────
const COLORES = {
  asistencia: "#16a34a",
  retardo: "#d97706",
  falta: "#dc2626",
  permiso: "#2563eb",
  asistenciaAlpha: "rgba(22,163,74,0.7)",
  retardoAlpha: "rgba(217,119,6,0.7)",
  faltaAlpha: "rgba(220,38,38,0.7)",
  permisoAlpha: "rgba(37,99,235,0.7)",
};

Chart.defaults.color = "#9ca3af";
Chart.defaults.borderColor = "#374151";

// ── Instancias de gráficas ────────────────────────────────────
let chartTendencia = null;
let chartMensual = null;

// ── Helpers ───────────────────────────────────────────────────
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function hace(dias) {
  return new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
}

function inicioMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatFechaCorta(fechaStr) {
  const f = String(fechaStr).slice(0, 10);
  const [, m, d] = f.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

function formatMes(mesStr) {
  const [y, m] = mesStr.split("-");
  const nombres = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${nombres[parseInt(m) - 1]} ${y}`;
}

function tasa(asistencias, total) {
  if (!total) return 0;
  return Math.round((asistencias / total) * 100);
}

function clasesTasa(pct) {
  if (pct >= 85) return "alta";
  if (pct >= 70) return "media";
  return "baja";
}

function destruirChart(inst) {
  if (inst) {
    try {
      inst.destroy();
    } catch (_) {}
  }
  return null;
}

function inicializarFechas() {
  const h = hoy();
  const inicio = inicioMes();
  document.getElementById("grupoDesde").value = inicio;
  document.getElementById("grupoHasta").value = h;
  document.getElementById("materiaDesde").value = inicio;
  document.getElementById("materiaHasta").value = h;

  // subtítulo
  const d = new Date();
  document.getElementById("subtituloFecha").textContent = d.toLocaleDateString(
    "es-MX",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );
}

// ── Ocultar/mostrar umbrales según modo ──────────────────────
function sincronizarControlesModo() {
  const modo = document.getElementById("modoAlertas").value;
  document.getElementById("wrapUmbralFaltas").style.display =
    modo === "retardos" ? "none" : "";
  document.getElementById("wrapUmbralRetardos").style.display =
    modo === "faltas" ? "none" : "";
}

// ================================================================
// SECCIÓN 1 — ALERTAS: alumnos en riesgo
// ================================================================
async function cargarAlertas() {
  const modo = document.getElementById("modoAlertas").value;
  const umbralF = parseInt(document.getElementById("umbralFaltas").value) || 3;
  const umbralR =
    parseInt(document.getElementById("umbralRetardos").value) || 3;
  const dias = parseInt(document.getElementById("diasAlertas").value) || 30;
  const contenedor = document.getElementById("alertasGrid");

  document.getElementById("labelDiasFaltas").textContent = `(${dias} días)`;
  document.getElementById("labelDiasRetardos").textContent = `(${dias} días)`;

  contenedor.innerHTML = '<p class="muted-label">Cargando...</p>';

  try {
    // Solo pedimos los endpoints que el modo necesita
    const [resFaltas, resRetardos] = await Promise.all([
      modo !== "retardos"
        ? SIGA.api(`/api/reportes/faltas-criticas?umbral=1&dias=${dias}`)
        : Promise.resolve({ datos: [] }),
      modo !== "faltas"
        ? SIGA.api(`/api/reportes/retardos-criticos?umbral=1&dias=${dias}`)
        : Promise.resolve({ datos: [] }),
    ]);

    // Unificar por alumno id
    const mapa = {};
    for (const r of resFaltas.datos || []) {
      mapa[r.id] = { ...r, retardos: r.retardos || 0 };
    }
    for (const r of resRetardos.datos || []) {
      if (mapa[r.id]) {
        mapa[r.id].retardos = r.retardos;
      } else {
        mapa[r.id] = { ...r, faltas: r.faltas || 0 };
      }
    }

    // Filtrar según modo
    const enRiesgo = Object.values(mapa).filter((a) => {
      if (modo === "faltas") return a.faltas >= umbralF;
      if (modo === "retardos") return a.retardos >= umbralR;
      return a.faltas >= umbralF || a.retardos >= umbralR; // ambos
    });

    // Ordenar según modo activo
    enRiesgo.sort((a, b) => {
      if (modo === "retardos") return b.retardos - a.retardos;
      if (modo === "faltas") return b.faltas - a.faltas;
      const scoreA =
        (a.faltas >= umbralF ? 2 : 0) + (a.retardos >= umbralR ? 1 : 0);
      const scoreB =
        (b.faltas >= umbralF ? 2 : 0) + (b.retardos >= umbralR ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.faltas - a.faltas;
    });

    if (!enRiesgo.length) {
      contenedor.innerHTML = `
        <div class="alertas-vacio">
          <div class="icono-ok">✅</div>
          <div>Sin alumnos en riesgo con los umbrales configurados.</div>
        </div>`;
      return;
    }

    contenedor.innerHTML = enRiesgo
      .map((a) => {
        const altaFalta = a.faltas >= umbralF;
        const altoRetardo = a.retardos >= umbralR;
        const nivel = altaFalta ? "riesgo-alto" : "riesgo-medio";
        const urlHistorial = `/historial.html?alumno=${a.id}`;

        return `
        <a class="alerta-card ${nivel}" href="${urlHistorial}">
          <div class="alerta-nombre">${a.alumno}</div>
          <div class="alerta-meta">${a.matricula} · ${a.grupo}</div>
          <div class="alerta-badges">
            ${altaFalta ? `<span class="alerta-badge faltas">🚨 ${a.faltas} faltas</span>` : a.faltas ? `<span class="alerta-badge faltas">${a.faltas} faltas</span>` : ""}
            ${altoRetardo ? `<span class="alerta-badge retardos">⚠ ${a.retardos} retardos</span>` : a.retardos ? `<span class="alerta-badge retardos">${a.retardos} retardos</span>` : ""}
            ${a.permisos ? `<span class="alerta-badge permisos">${a.permisos} permisos</span>` : ""}
          </div>
        </a>`;
      })
      .join("");
  } catch (e) {
    contenedor.innerHTML =
      '<p class="muted-label">Error al cargar alertas.</p>';
    console.error("Error alertas:", e);
  }
}

// ================================================================
// SECCIÓN 2 — TASAS POR GRUPO
// ================================================================
async function cargarGrupos() {
  const desde = document.getElementById("grupoDesde").value || inicioMes();
  const hasta = document.getElementById("grupoHasta").value || hoy();
  const contenedor = document.getElementById("gruposRanking");
  contenedor.innerHTML = '<p class="muted-label">Cargando...</p>';

  try {
    const res = await SIGA.api(
      `/api/reportes/por-grupo?fecha_inicio=${desde}&fecha_fin=${hasta}`,
    );
    const rows = res.datos || [];

    if (!rows.length) {
      contenedor.innerHTML =
        '<p class="muted-label">Sin datos en el rango seleccionado.</p>';
      return;
    }

    // Leyenda global (una sola vez arriba)
    const leyendaHTML = `
      <div class="barra-leyenda" style="margin-bottom:12px;">
        <span style="color:#16a34a">■</span> Asistencia
        <span style="color:#d97706">■</span> Retardo
        <span style="color:#dc2626">■</span> Falta
        <span style="color:#2563eb">■</span> Permiso
      </div>`;

    const filasHTML = rows
      .map((r) => {
        const total =
          (r.asistencias || 0) +
          (r.retardos || 0) +
          (r.faltas || 0) +
          (r.permisos || 0);
        const pctA = total ? Math.round((r.asistencias / total) * 100) : 0;
        const pctR = total ? Math.round((r.retardos / total) * 100) : 0;
        const pctF = total ? Math.round((r.faltas / total) * 100) : 0;
        const pctP = total ? 100 - pctA - pctR - pctF : 0;
        const clase = clasesTasa(pctA);

        return `
        <div class="grupo-fila">
          <div class="grupo-nombre">${r.grupo}</div>
          <div class="grupo-barra-wrap">
            <div class="barra-stack">
              <div class="barra-seg asistencia" style="width:${pctA}%" title="Asistencias: ${r.asistencias}"></div>
              <div class="barra-seg retardo"    style="width:${pctR}%" title="Retardos: ${r.retardos}"></div>
              <div class="barra-seg falta"      style="width:${pctF}%" title="Faltas: ${r.faltas}"></div>
              <div class="barra-seg permiso"    style="width:${Math.max(0, pctP)}%" title="Permisos: ${r.permisos}"></div>
            </div>
            <div class="barra-leyenda">
              <span>${r.asistencias} asist.</span>
              <span>${r.retardos} ret.</span>
              <span>${r.faltas} faltas</span>
              <span>${total} total</span>
            </div>
          </div>
          <div class="grupo-tasa ${clase}">${pctA}%</div>
        </div>`;
      })
      .join("");

    contenedor.innerHTML = leyendaHTML + filasHTML;
  } catch (e) {
    contenedor.innerHTML = '<p class="muted-label">Error al cargar grupos.</p>';
    console.error("Error grupos:", e);
  }
}

// ================================================================
// SECCIÓN 3 — TENDENCIA DIARIA
// ================================================================
async function cargarTendencia() {
  const dias = parseInt(document.getElementById("diasTendencia").value) || 14;

  try {
    const res = await SIGA.api(`/api/reportes/tendencia-diaria?dias=${dias}`);
    const rows = res.datos || [];

    chartTendencia = destruirChart(chartTendencia);
    const ctx = document.getElementById("chartTendencia").getContext("2d");

    // Calcular tasa de asistencia diaria como dataset adicional (eje derecho)
    const tasas = rows.map((r) => {
      const total = (r.asistencias || 0) + (r.retardos || 0) + (r.faltas || 0);
      return total ? Math.round((r.asistencias / total) * 100) : null;
    });

    chartTendencia = new Chart(ctx, {
      type: "line",
      data: {
        labels: rows.map((r) => formatFechaCorta(r.fecha)),
        datasets: [
          {
            label: "Asistencias",
            data: rows.map((r) => r.asistencias),
            borderColor: COLORES.asistencia,
            backgroundColor: "rgba(22,163,74,0.08)",
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            yAxisID: "y",
          },
          {
            label: "Retardos",
            data: rows.map((r) => r.retardos),
            borderColor: COLORES.retardo,
            backgroundColor: "transparent",
            tension: 0.3,
            borderDash: [4, 3],
            pointRadius: 4,
            yAxisID: "y",
          },
          {
            label: "Faltas",
            data: rows.map((r) => r.faltas),
            borderColor: COLORES.falta,
            backgroundColor: "transparent",
            tension: 0.3,
            borderDash: [4, 3],
            pointRadius: 4,
            yAxisID: "y",
          },
          {
            label: "% Asistencia",
            data: tasas,
            borderColor: "rgba(148,163,184,0.6)",
            backgroundColor: "transparent",
            tension: 0.3,
            borderDash: [2, 4],
            pointRadius: 0,
            yAxisID: "y2",
            type: "line",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { grid: { color: "#1f2937" } },
          y: {
            grid: { color: "#1f2937" },
            beginAtZero: true,
            ticks: { precision: 0 },
            title: { display: true, text: "Registros" },
          },
          y2: {
            position: "right",
            grid: { display: false },
            min: 0,
            max: 100,
            ticks: { callback: (v) => v + "%" },
            title: { display: true, text: "% Asistencia" },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 14, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === "% Asistencia") {
                  return ` % Asistencia: ${ctx.raw ?? "—"}%`;
                }
                return ` ${ctx.dataset.label}: ${ctx.raw}`;
              },
            },
          },
        },
      },
    });
  } catch (e) {
    console.error("Error tendencia:", e);
  }
}

// ================================================================
// SECCIÓN 4 — TENDENCIA MENSUAL
// ================================================================
async function cargarMensual() {
  try {
    const res = await SIGA.api("/api/reportes/tendencia-mensual");
    const rows = res.datos || [];

    chartMensual = destruirChart(chartMensual);
    const ctx = document.getElementById("chartMensual").getContext("2d");

    // Calcular tasa mensual
    const tasas = rows.map((r) => {
      const total = (r.asistencias || 0) + (r.retardos || 0) + (r.faltas || 0);
      return total ? Math.round((r.asistencias / total) * 100) : null;
    });

    chartMensual = new Chart(ctx, {
      type: "bar",
      data: {
        labels: rows.map((r) => formatMes(r.mes)),
        datasets: [
          {
            label: "Asistencias",
            data: rows.map((r) => r.asistencias),
            backgroundColor: COLORES.asistenciaAlpha,
            borderColor: COLORES.asistencia,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            label: "Retardos",
            data: rows.map((r) => r.retardos),
            backgroundColor: COLORES.retardoAlpha,
            borderColor: COLORES.retardo,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            label: "Faltas",
            data: rows.map((r) => r.faltas),
            backgroundColor: COLORES.faltaAlpha,
            borderColor: COLORES.falta,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            label: "% Asistencia",
            data: tasas,
            type: "line",
            borderColor: "rgba(148,163,184,0.8)",
            backgroundColor: "transparent",
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderDash: [4, 3],
            yAxisID: "y2",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: "#1f2937" },
            beginAtZero: true,
            ticks: { precision: 0 },
            title: { display: true, text: "Registros" },
          },
          y2: {
            position: "right",
            grid: { display: false },
            min: 0,
            max: 100,
            ticks: { callback: (v) => v + "%" },
            title: { display: true, text: "% Asistencia" },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 14, font: { size: 12 } },
          },
        },
      },
    });
  } catch (e) {
    console.error("Error mensual:", e);
  }
}

// ================================================================
// SECCIÓN 5 — RANKING MATERIAS
// ================================================================
async function cargarMaterias() {
  const desde = document.getElementById("materiaDesde").value || inicioMes();
  const hasta = document.getElementById("materiaHasta").value || hoy();
  const contenedor = document.getElementById("materiasRanking");
  contenedor.innerHTML = '<p class="muted-label">Cargando...</p>';

  try {
    const res = await SIGA.api(
      `/api/reportes/por-materia?fecha_inicio=${desde}&fecha_fin=${hasta}`,
    );
    const rows = res.datos || [];

    if (!rows.length) {
      contenedor.innerHTML =
        '<p class="muted-label">Sin datos en el rango seleccionado.</p>';
      return;
    }

    // Leyenda
    const leyendaHTML = `
      <div class="barra-leyenda" style="margin-bottom:12px;">
        <span style="color:#16a34a">■</span> Asistencia
        <span style="color:#d97706">■</span> Retardo
        <span style="color:#dc2626">■</span> Falta
        <span style="color:#2563eb">■</span> Permiso
      </div>`;

    const filasHTML = rows
      .map((r) => {
        const total = r.total || 0;
        const pctA = total ? Math.round((r.asistencias / total) * 100) : 0;
        const pctR = total ? Math.round((r.retardos / total) * 100) : 0;
        const pctF = total ? Math.round((r.faltas / total) * 100) : 0;
        const pctP = total ? 100 - pctA - pctR - pctF : 0;
        const clase = clasesTasa(pctA);

        return `
        <div class="materia-fila">
          <div class="materia-nombre" title="${r.materia}">${r.materia}</div>
          <div class="grupo-barra-wrap">
            <div class="barra-stack">
              <div class="barra-seg asistencia" style="width:${pctA}%"              title="Asistencias: ${r.asistencias}"></div>
              <div class="barra-seg retardo"    style="width:${pctR}%"              title="Retardos: ${r.retardos}"></div>
              <div class="barra-seg falta"      style="width:${pctF}%"              title="Faltas: ${r.faltas}"></div>
              <div class="barra-seg permiso"    style="width:${Math.max(0, pctP)}%"  title="Permisos: ${r.permisos}"></div>
            </div>
            <div class="barra-leyenda">
              <span>${r.asistencias} asist.</span>
              <span>${r.retardos} ret.</span>
              <span>${r.faltas} faltas</span>
              <span>${total} total</span>
            </div>
          </div>
          <div class="materia-tasa ${clase}">${pctA}%</div>
        </div>`;
      })
      .join("");

    contenedor.innerHTML = leyendaHTML + filasHTML;
  } catch (e) {
    contenedor.innerHTML =
      '<p class="muted-label">Error al cargar materias.</p>';
    console.error("Error materias:", e);
  }
}

// ================================================================
// SECCIÓN 6 — TABLAS CRÍTICOS (con link al historial)
// ================================================================
async function cargarTablaFaltas() {
  const dias = parseInt(document.getElementById("diasAlertas").value) || 30;
  const umbral = parseInt(document.getElementById("umbralFaltas").value) || 3;
  const contenedor = document.getElementById("tablaFaltasCriticas");

  try {
    const res = await SIGA.api(
      `/api/reportes/faltas-criticas?umbral=${umbral}&dias=${dias}`,
    );
    const rows = (res.datos || []).slice(0, 10);

    if (!rows.length) {
      contenedor.innerHTML =
        '<p class="muted-label">Sin alumnos con ese umbral.</p>';
      return;
    }

    contenedor.innerHTML = `
      <table class="tabla-criticos-analisis">
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Grupo</th>
            <th style="text-align:right">Faltas</th>
            <th style="text-align:right">Retardos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${r.alumno}</td>
              <td>${r.grupo}</td>
              <td style="text-align:right"><span class="badge no">${r.faltas}</span></td>
              <td style="text-align:right"><span class="badge warn">${r.retardos}</span></td>
              <td><a class="link-historial" href="/historial.html">Ver →</a></td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  } catch (e) {
    contenedor.innerHTML = '<p class="muted-label">Error.</p>';
    console.error("Error tabla faltas:", e);
  }
}

async function cargarTablaRetardos() {
  const dias = parseInt(document.getElementById("diasAlertas").value) || 30;
  const umbral = parseInt(document.getElementById("umbralRetardos").value) || 3;
  const contenedor = document.getElementById("tablaRetardosCriticos");

  try {
    const res = await SIGA.api(
      `/api/reportes/retardos-criticos?umbral=${umbral}&dias=${dias}`,
    );
    const rows = (res.datos || []).slice(0, 10);

    if (!rows.length) {
      contenedor.innerHTML =
        '<p class="muted-label">Sin alumnos con ese umbral.</p>';
      return;
    }

    contenedor.innerHTML = `
      <table class="tabla-criticos-analisis">
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Grupo</th>
            <th style="text-align:right">Retardos</th>
            <th style="text-align:right">Faltas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${r.alumno}</td>
              <td>${r.grupo}</td>
              <td style="text-align:right"><span class="badge warn">${r.retardos}</span></td>
              <td style="text-align:right"><span class="badge no">${r.faltas}</span></td>
              <td><a class="link-historial" href="/historial.html">Ver →</a></td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  } catch (e) {
    contenedor.innerHTML = '<p class="muted-label">Error.</p>';
    console.error("Error tabla retardos:", e);
  }
}

// ================================================================
// EVENTOS DE FILTROS
// ================================================================
document
  .getElementById("modoAlertas")
  .addEventListener("change", sincronizarControlesModo);

document.getElementById("btnFiltrarAlertas").addEventListener("click", () => {
  cargarAlertas();
  cargarTablaFaltas();
  cargarTablaRetardos();
});

document
  .getElementById("btnFiltrarGrupos")
  .addEventListener("click", cargarGrupos);
document
  .getElementById("btnFiltrarTendencia")
  .addEventListener("click", cargarTendencia);
document
  .getElementById("btnFiltrarMaterias")
  .addEventListener("click", cargarMaterias);
document.getElementById("btnRefrescar").addEventListener("click", cargarTodo);

// ================================================================
// CARGA INICIAL
// ================================================================
async function cargarTodo() {
  await Promise.all([
    cargarAlertas(),
    cargarGrupos(),
    cargarTendencia(),
    cargarMensual(),
    cargarMaterias(),
    cargarTablaFaltas(),
    cargarTablaRetardos(),
  ]);
}

(async function init() {
  sincronizarControlesModo(); // ajusta visibilidad según valor por defecto
  await cargarTodo();
})();
