// ================================================================
// SIGA — Módulo 4: Historial de asistencias
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  SIGA.renderSidebar("historial");
});

// ── DOM ───────────────────────────────────────────────────────
const filtroGrupo       = document.getElementById("filtroGrupo");
const filtroAlumno      = document.getElementById("filtroAlumno");
const filtroTipo        = document.getElementById("filtroTipo");
const filtroFechaInicio = document.getElementById("filtroFechaInicio");
const filtroFechaFin    = document.getElementById("filtroFechaFin");
const btnBuscar         = document.getElementById("btnBuscar");
const btnLimpiar        = document.getElementById("btnLimpiar");
const tablaHistorial    = document.getElementById("tablaHistorial");
const estadoHistorial   = document.getElementById("estadoHistorial");
const totalRegistros    = document.getElementById("totalRegistros");
const seccionResumen    = document.getElementById("seccionResumen");
const resumenTexto      = document.getElementById("resumenTexto");
const paginacion        = document.getElementById("paginacion");
const btnAnterior       = document.getElementById("btnAnterior");
const btnSiguiente      = document.getElementById("btnSiguiente");
const infoPagina        = document.getElementById("infoPagina");
const inputIrPagina     = document.getElementById("inputIrPagina");
const btnIr             = document.getElementById("btnIr");
const selPorPagina      = document.getElementById("selPorPagina");
const porPaginaWrap     = document.getElementById("porPaginaWrap");

// ── Estado ────────────────────────────────────────────────────
let porPagina      = 20;
let todosLosDatos  = [];
let paginaActual   = 1;

// ── Helpers ───────────────────────────────────────────────────
function tipoBadge(tipo) {
  const cls =
    tipo === "asistencia" ? "ok" :
    tipo === "retardo"    ? "warn" :
    tipo === "permiso"    ? "info" : "no";
  return `<span class="badge ${cls}">${tipo}</span>`;
}

function origenBadge(origen) {
  return origen === "sensor"
    ? `<span class="badge info">sensor</span>`
    : `<span class="badge">manual</span>`;
}

function formatFecha(fechaStr) {
  if (!fechaStr) return "-";
  const [y, m, d] = fechaStr.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function mostrarEstado(msg, tipo = "info") {
  estadoHistorial.classList.remove("hidden");
  estadoHistorial.textContent = msg;
  estadoHistorial.style.background =
    tipo === "error" ? "#7f1d1d" :
    tipo === "ok"    ? "#14532d" :
    tipo === "warn"  ? "#78350f" : "#1d4ed8";
}

function ocultarEstado() {
  estadoHistorial.classList.add("hidden");
  estadoHistorial.textContent = "";
}

function filaVacia(msg) {
  tablaHistorial.innerHTML = `<tr><td colspan="8" class="td-empty">${msg}</td></tr>`;
}

function totalPaginas() {
  return Math.ceil(todosLosDatos.length / porPagina);
}

// ── Carga inicial de selects ──────────────────────────────────
async function cargarFiltros() {
  try {
    const [resGrupos] = await Promise.all([SIGA.api("/api/grupos")]);
    (resGrupos.datos || resGrupos).forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.nombre;
      filtroGrupo.appendChild(opt);
    });
  } catch (e) {
    console.error("Error cargando filtros:", e);
  }
}

// Al cambiar grupo → puebla alumnos
filtroGrupo.addEventListener("change", async () => {
  filtroAlumno.innerHTML = '<option value="">Todos los alumnos</option>';
  const grupoId = filtroGrupo.value;
  if (!grupoId) return;
  try {
    const res = await SIGA.api(`/api/alumnos?grupo_id=${grupoId}`);
    (res.datos || []).forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      const nombre = `${a.apellido_pat}${a.apellido_mat ? " " + a.apellido_mat : ""}, ${a.nombre}`;
      opt.textContent = `${nombre} — ${a.matricula}`;
      filtroAlumno.appendChild(opt);
    });
  } catch (e) {
    console.error("Error cargando alumnos:", e);
  }
});

// Selector de registros por página
selPorPagina.addEventListener("change", () => {
  porPagina = parseInt(selPorPagina.value, 10);
  paginaActual = 1;
  renderPagina();
});

// ── Búsqueda ──────────────────────────────────────────────────
async function buscar() {
  ocultarEstado();
  filaVacia("Cargando...");
  totalRegistros.textContent = "";
  seccionResumen.style.display = "none";
  paginacion.classList.add("hidden");
  porPaginaWrap.style.display = "none";
  todosLosDatos = [];
  paginaActual  = 1;

  if (filtroFechaInicio.value && filtroFechaFin.value) {
    if (filtroFechaInicio.value > filtroFechaFin.value) {
      mostrarEstado("La fecha de inicio no puede ser mayor que la fecha fin.", "error");
      filaVacia("Corrige el rango de fechas.");
      return;
    }
  }

  const params = new URLSearchParams();
  if (filtroAlumno.value)      params.append("alumno_id",    filtroAlumno.value);
  if (filtroGrupo.value)       params.append("grupo_id",     filtroGrupo.value);
  if (filtroTipo.value)        params.append("tipo",         filtroTipo.value);
  if (filtroFechaInicio.value) params.append("fecha_inicio", filtroFechaInicio.value);
  if (filtroFechaFin.value)    params.append("fecha_fin",    filtroFechaFin.value);

  try {
    const res = await SIGA.api(`/api/asistencias?${params.toString()}`);
    todosLosDatos = res.datos || [];

    if (!todosLosDatos.length) {
      filaVacia("No se encontraron registros con los filtros aplicados.");
      totalRegistros.textContent = "0 registros";
      return;
    }

    renderResumen();
    renderPagina();
  } catch (e) {
    mostrarEstado(e.message || "Error al obtener los datos.", "error");
    filaVacia("Error al cargar datos.");
  }
}

// ── Resumen por tipo ──────────────────────────────────────────
function renderResumen() {
  const conteo = { asistencia: 0, retardo: 0, falta: 0, permiso: 0 };
  todosLosDatos.forEach((r) => {
    if (conteo[r.tipo] !== undefined) conteo[r.tipo]++;
  });

  const partes = [];
  if (conteo.asistencia) partes.push(`<span class="badge ok">${conteo.asistencia} asistencia${conteo.asistencia !== 1 ? "s" : ""}</span>`);
  if (conteo.retardo)    partes.push(`<span class="badge warn">${conteo.retardo} retardo${conteo.retardo !== 1 ? "s" : ""}</span>`);
  if (conteo.falta)      partes.push(`<span class="badge no">${conteo.falta} falta${conteo.falta !== 1 ? "s" : ""}</span>`);
  if (conteo.permiso)    partes.push(`<span class="badge info">${conteo.permiso} permiso${conteo.permiso !== 1 ? "s" : ""}</span>`);

  resumenTexto.innerHTML = partes.join("&nbsp;&nbsp;");
  seccionResumen.style.display = "block";

  const total = todosLosDatos.length;
  totalRegistros.textContent = `${total} registro${total !== 1 ? "s" : ""}`;
}

// ── Tabla paginada ────────────────────────────────────────────
function renderPagina() {
  const total     = todosLosDatos.length;
  const totPags   = totalPaginas();
  const inicio    = (paginaActual - 1) * porPagina;
  const fin       = Math.min(inicio + porPagina, total);
  const slice     = todosLosDatos.slice(inicio, fin);

  tablaHistorial.innerHTML = slice.map((a) => `
    <tr>
      <td>${formatFecha(a.fecha)}</td>
      <td>${a.hora_entrada || "—"}</td>
      <td>${a.alumno}</td>
      <td>${a.matricula}</td>
      <td>${a.grupo}</td>
      <td>${a.materia}</td>
      <td>${tipoBadge(a.tipo)}</td>
      <td>${origenBadge(a.registrado_por)}</td>
    </tr>
  `).join("");

  if (totPags > 1) {
    // Actualizar input "Ir a página"
    inputIrPagina.value = paginaActual;
    inputIrPagina.max   = totPags;
    infoPagina.textContent = `de ${totPags}`;

    btnAnterior.disabled  = paginaActual === 1;
    btnSiguiente.disabled = paginaActual === totPags;
    paginacion.classList.remove("hidden");
    porPaginaWrap.style.display = "flex";
  } else {
    paginacion.classList.add("hidden");
    // Mostrar selector aunque no haya paginación (puede querer cambiar densidad)
    porPaginaWrap.style.display = "flex";
  }
}

// ── Navegación ────────────────────────────────────────────────
function irAPagina(num) {
  const totPags = totalPaginas();
  const p = Math.max(1, Math.min(num, totPags));
  if (p === paginaActual) return;
  paginaActual = p;
  renderPagina();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

btnAnterior.addEventListener("click", () => irAPagina(paginaActual - 1));
btnSiguiente.addEventListener("click", () => irAPagina(paginaActual + 1));

btnIr.addEventListener("click", () => {
  const val = parseInt(inputIrPagina.value, 10);
  if (!isNaN(val)) irAPagina(val);
});

// Enter en el input "Ir a" también navega
inputIrPagina.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = parseInt(inputIrPagina.value, 10);
    if (!isNaN(val)) irAPagina(val);
  }
});

// ── Limpiar ───────────────────────────────────────────────────
btnLimpiar.addEventListener("click", () => {
  filtroGrupo.value = "";
  filtroAlumno.innerHTML = '<option value="">Todos los alumnos</option>';
  filtroTipo.value = "";
  filtroFechaInicio.value = "";
  filtroFechaFin.value = "";
  ocultarEstado();
  totalRegistros.textContent = "";
  seccionResumen.style.display = "none";
  paginacion.classList.add("hidden");
  porPaginaWrap.style.display = "none";
  selPorPagina.value = "20";
  porPagina = 20;
  todosLosDatos = [];
  paginaActual = 1;
  filaVacia("Usa los filtros para buscar asistencias.");
});

// Enter en fechas dispara búsqueda
[filtroFechaInicio, filtroFechaFin].forEach((el) => {
  el.addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });
});

btnBuscar.addEventListener("click", buscar);

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  await cargarFiltros();
})();
