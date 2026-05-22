document.addEventListener("DOMContentLoaded", () => {
  SIGA.renderSidebar("permisos");
});

const permisoForm = document.getElementById("permisoForm");
const permisoId = document.getElementById("permisoId");
const alumnoSelect = document.getElementById("alumno_id");
const fechaInicio = document.getElementById("fecha_inicio");
const fechaFin = document.getElementById("fecha_fin");
const motivo = document.getElementById("motivo");
const listaHorarios = document.getElementById("listaHorarios");
const tablaPermisos = document.getElementById("tablaPermisos");
const estadoPermiso = document.getElementById("estadoPermiso");
const formTitle = document.getElementById("formTitle");
const btnCancelar = document.getElementById("btnCancelar");

let permisos = [];
let horariosAlumno = [];

// ── Mensajes ──────────────────────────────────────────────────
function showMsg(msg, ok = true) {
  estadoPermiso.classList.remove("hidden");
  estadoPermiso.textContent = msg;
  estadoPermiso.style.background = ok ? "#14532d" : "#7f1d1d";
  setTimeout(() => {
    estadoPermiso.classList.add("hidden");
    estadoPermiso.textContent = "";
  }, 4000);
}

// ── Fechas ────────────────────────────────────────────────────
// MySQL devuelve "2026-05-14T06:00:00.000Z" — extraer solo YYYY-MM-DD
function soloFecha(valor) {
  if (!valor) return "";
  return String(valor).slice(0, 10);
}

function formatearFecha(fecha) {
  const f = soloFecha(fecha);
  if (!f) return "";
  const [anio, mes, dia] = f.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearRango(inicio, fin) {
  return `Del ${formatearFecha(inicio)} al ${formatearFecha(fin)}`;
}

function fechasEnRango(inicio, fin) {
  if (!inicio || !fin) return [];
  // soloFecha() evita "2026-05-12T06:00:00.000ZT00:00:00" → Invalid Date
  const out = [];
  let d = new Date(`${soloFecha(inicio)}T00:00:00`);
  const end = new Date(`${soloFecha(fin)}T00:00:00`);
  while (d <= end) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function diasPermitidosPorRango(inicio, fin) {
  const dias = new Set();
  fechasEnRango(inicio, fin).forEach((f) => {
    const js = f.getDay();
    dias.add(js === 0 ? 7 : js);
  });
  return dias;
}

// ── Nombres ───────────────────────────────────────────────────
function nombreDia(d) {
  return (
    [
      "",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ][d] || `Día ${d}`
  );
}

// ── Alumnos ───────────────────────────────────────────────────
async function cargarAlumnos() {
  const res = await SIGA.api("/api/alumnos");
  alumnoSelect.innerHTML =
    '<option value="">Selecciona un alumno</option>' +
    (res.datos || [])
      .filter((a) => a.activo)
      .map(
        (a) =>
          `<option value="${a.id}">${a.matricula} - ${a.nombre} ${a.apellido_pat}</option>`,
      )
      .join("");
}

// ── Horarios ──────────────────────────────────────────────────
function renderHorariosFiltrados() {
  listaHorarios.innerHTML = "";

  if (!horariosAlumno.length) {
    listaHorarios.innerHTML =
      "<p>No hay horarios disponibles para este alumno.</p>";
    return;
  }

  if (!fechaInicio.value || !fechaFin.value) {
    listaHorarios.innerHTML =
      "<p>Selecciona fecha inicio y fecha fin para mostrar las clases afectadas.</p>";
    return;
  }

  const diasPermitidos = diasPermitidosPorRango(
    fechaInicio.value,
    fechaFin.value,
  );
  const filtrados = horariosAlumno.filter((h) =>
    diasPermitidos.has(Number(h.dia_semana)),
  );

  if (!filtrados.length) {
    listaHorarios.innerHTML =
      "<p>No hay clases dentro del rango de fechas seleccionado.</p>";
    return;
  }

  listaHorarios.innerHTML = filtrados
    .map(
      (h) => `
      <label class="check-item">
        <input type="checkbox" value="${h.id}" />
        <span>${nombreDia(Number(h.dia_semana))} · ${h.hora_inicio.slice(0, 5)}-${h.hora_fin.slice(0, 5)} · ${h.materia}</span>
      </label>
    `,
    )
    .join("");
}

async function cargarHorariosAlumno(alumnoId, marcarIds = []) {
  listaHorarios.innerHTML = "";
  horariosAlumno = [];
  if (!alumnoId) return;

  const res = await SIGA.api(`/api/alumnos/${alumnoId}/horarios`);
  horariosAlumno = res.datos || [];
  renderHorariosFiltrados();

  if (marcarIds.length) {
    marcarIds.forEach((idHorario) => {
      const chk = listaHorarios.querySelector(`input[value="${idHorario}"]`);
      if (chk) chk.checked = true;
    });
  }
}

function horariosSeleccionados() {
  return [
    ...listaHorarios.querySelectorAll('input[type="checkbox"]:checked'),
  ].map((x) => Number(x.value));
}

// ── Tabla de permisos ─────────────────────────────────────────
async function cargarPermisos() {
  const res = await SIGA.api("/api/permisos");
  permisos = res.datos || [];

  if (!permisos.length) {
    tablaPermisos.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">No hay permisos registrados.</td></tr>';
    return;
  }

  tablaPermisos.innerHTML = permisos
    .map(
      (p) => `
      <tr>
        <td>${p.alumno}</td>
        <td>${formatearRango(p.fecha_inicio, p.fecha_fin)}</td>
        <td>${p.motivo}</td>
        <td>${(p.horarios || []).map((h) => `${nombreDia(Number(h.dia_semana))} ${h.hora_inicio.slice(0, 5)}-${h.hora_fin.slice(0, 5)} · ${h.materia}`).join("<br>")}</td>
        <td>${p.activo ? '<span class="badge ok">Activo</span>' : '<span class="badge no">Cancelado</span>'}</td>
        <td style="white-space:nowrap;">
          <button class="btn warning" onclick="editarPermiso(${p.id})">Editar</button>
          ${
            p.activo
              ? `<button class="btn danger" onclick="cancelarPermiso(${p.id})">Cancelar</button>`
              : ""
          }
        </td>
      </tr>
    `,
    )
    .join("");
}

// ── Editar ────────────────────────────────────────────────────
window.editarPermiso = async function (id) {
  try {
    const res = await SIGA.api(`/api/permisos/${id}`);
    const p = res.datos;

    permisoId.value = p.id;
    alumnoSelect.value = p.alumno_id;
    fechaInicio.value = soloFecha(p.fecha_inicio);
    fechaFin.value = soloFecha(p.fecha_fin);
    motivo.value = p.motivo;
    formTitle.textContent = "Editar permiso";

    await cargarHorariosAlumno(p.alumno_id, p.horario_ids || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    showMsg(e.message || "Error al cargar el permiso", false);
  }
};

// ── Cancelar permiso ──────────────────────────────────────────
window.cancelarPermiso = async function (id) {
  if (
    !confirm(
      "¿Deseas cancelar este permiso? Se eliminarán sus registros de asistencia futuros.",
    )
  )
    return;
  try {
    await SIGA.api(`/api/permisos/${id}/cancelar`, { method: "PATCH" });
    showMsg("Permiso cancelado correctamente");
    await cargarPermisos();
  } catch (e) {
    showMsg(e.message || "Error al cancelar el permiso", false);
  }
};

// ── Guardar (crear / actualizar) ──────────────────────────────
permisoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    alumno_id: Number(alumnoSelect.value),
    fecha_inicio: fechaInicio.value,
    fecha_fin: fechaFin.value,
    motivo: motivo.value.trim(),
    horario_ids: horariosSeleccionados(),
    activo: true,
  };

  if (
    !payload.alumno_id ||
    !payload.fecha_inicio ||
    !payload.fecha_fin ||
    !payload.motivo
  ) {
    showMsg("Completa todos los campos obligatorios", false);
    return;
  }

  if (payload.fecha_fin < payload.fecha_inicio) {
    showMsg("La fecha fin no puede ser menor que la fecha inicio", false);
    return;
  }

  if (!payload.horario_ids.length) {
    showMsg("Selecciona al menos una clase dentro del rango", false);
    return;
  }

  try {
    if (permisoId.value) {
      await SIGA.api(`/api/permisos/${permisoId.value}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showMsg("Permiso actualizado correctamente");
    } else {
      await SIGA.api("/api/permisos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showMsg("Permiso registrado correctamente");
    }

    resetForm();
    await cargarPermisos();
  } catch (e) {
    showMsg(e.message || "Error al guardar el permiso", false);
  }
});

// ── Reset form ────────────────────────────────────────────────
function resetForm() {
  permisoForm.reset();
  permisoId.value = "";
  formTitle.textContent = "Nuevo permiso";
  listaHorarios.innerHTML = "";
  horariosAlumno = [];
}

btnCancelar.addEventListener("click", resetForm);

// ── Eventos de filtro ─────────────────────────────────────────
alumnoSelect.addEventListener("change", () =>
  cargarHorariosAlumno(alumnoSelect.value),
);
fechaInicio.addEventListener("change", renderHorariosFiltrados);
fechaFin.addEventListener("change", renderHorariosFiltrados);

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  await cargarAlumnos();
  await cargarPermisos();
})();
