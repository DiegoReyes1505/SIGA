// ================================================================
// SIGA — Módulo Alumnos
// Mejoras: modal de enroll paso a paso + sistema de toasts
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  SIGA.renderSidebar("alumnos");
});

// ── DOM — formulario ──────────────────────────────────────────
const alumnoForm = document.getElementById("alumnoForm");
const alumnoId = document.getElementById("alumnoId");
const matricula = document.getElementById("matricula");
const nombre = document.getElementById("nombre");
const apellidoPat = document.getElementById("apellido_pat");
const apellidoMat = document.getElementById("apellido_mat");
const grupoId = document.getElementById("grupo_id");
const registrarHuella = document.getElementById("registrarHuella");
const tablaAlumnos = document.getElementById("tablaAlumnos");
const busqueda = document.getElementById("busqueda");
const verInactivos = document.getElementById("verInactivos");
const formTitle = document.getElementById("formTitle");
const btnCancelar = document.getElementById("btnCancelar");

// ── DOM — modal enroll ────────────────────────────────────────
const enrollModal = document.getElementById("enrollModal");
const enrollAlumnoInfo = document.getElementById("enrollAlumnoInfo");
const sensorPulso = document.getElementById("sensorPulso");
const sensorInstruccion = document.getElementById("sensorInstruccion");
const enrollMensaje = document.getElementById("enrollMensaje");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const btnCancelarEnroll = document.getElementById("btnCancelarEnroll");
const paso1El = document.getElementById("paso1");
const paso2El = document.getElementById("paso2");
const paso3El = document.getElementById("paso3");

// ── DOM — toasts ──────────────────────────────────────────────
const toastContainer = document.getElementById("toastContainer");

// ── Estado ────────────────────────────────────────────────────
let alumnos = [];
let grupos = [];
let enrollActivo = false; // bloquea cierre accidental del modal

// ================================================================
// TOASTS
// ================================================================
const ICONOS = { ok: "✓", error: "✕", warn: "⚠", info: "ℹ" };

function toast(msg, tipo = "info", duracion = 4000) {
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span class="toast-icono">${ICONOS[tipo] ?? "ℹ"}</span><span>${msg}</span>`;
  toastContainer.appendChild(el);

  const remover = () => {
    el.classList.add("saliendo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };

  const t = setTimeout(remover, duracion);
  el.addEventListener("click", () => {
    clearTimeout(t);
    remover();
  });
}

// ================================================================
// MODAL DE ENROLL
// ================================================================

// ── Pasos ─────────────────────────────────────────────────────
function resetPasos() {
  [paso1El, paso2El, paso3El].forEach((p) => {
    p.classList.remove("activo", "completado", "error");
  });
  document
    .querySelectorAll(".enroll-linea")
    .forEach((l) => l.classList.remove("activa"));
}

function setPaso(num, estado = "activo") {
  // estado: 'activo' | 'completado' | 'error'
  const pasos = [paso1El, paso2El, paso3El];
  const lineas = document.querySelectorAll(".enroll-linea");

  // Marcar pasos anteriores como completados
  for (let i = 0; i < num - 1; i++) {
    pasos[i].classList.remove("activo", "error");
    pasos[i].classList.add("completado");
    if (lineas[i]) lineas[i].classList.add("activa");
  }

  // Marcar paso actual
  pasos[num - 1].classList.remove("activo", "completado", "error");
  pasos[num - 1].classList.add(estado);
}

// ── Sensor visual ─────────────────────────────────────────────
function setSensor(estado, instruccion, detalle = "") {
  // estado: 'esperando' | 'ok' | 'error' | 'idle'
  sensorPulso.className = `sensor-pulso ${estado}`;

  const emojis = { esperando: "👆", ok: "✅", error: "❌", idle: "⏳" };
  sensorPulso.innerHTML = `<span class="pulso-emoji">${emojis[estado] ?? "⏳"}</span>`;

  sensorInstruccion.textContent = instruccion;

  enrollMensaje.className = "enroll-mensaje";
  enrollMensaje.textContent = detalle;
}

function setMensajeDetalle(msg, tipo = "") {
  enrollMensaje.className = `enroll-mensaje ${tipo}`;
  enrollMensaje.textContent = msg;
}

// ── Abrir / cerrar modal ──────────────────────────────────────
function abrirModalEnroll(alumno) {
  enrollActivo = true;
  resetPasos();
  setPaso(1, "activo");
  setSensor("esperando", "Pon el dedo en el lector", "Primera lectura");

  enrollAlumnoInfo.innerHTML = alumno
    ? `<strong>${alumno.nombre} ${alumno.apellido_pat}</strong> &nbsp;·&nbsp; ${alumno.matricula} &nbsp;·&nbsp; ${alumno.grupo}`
    : "<em>Cargando datos del alumno...</em>";

  enrollModal.classList.remove("hidden");
  btnCancelarEnroll.disabled = false;
  btnCancelarEnroll.textContent = "Cancelar registro";
}

function cerrarModalEnroll() {
  enrollActivo = false;
  enrollModal.classList.add("hidden");
}

// Cerrar con overlay click solo si no hay enroll activo
enrollModal.addEventListener("click", (e) => {
  if (e.target === enrollModal && !enrollActivo) cerrarModalEnroll();
});

btnCerrarModal.addEventListener("click", async () => {
  await cancelarEnrollServidor();
  cerrarModalEnroll();
});

btnCancelarEnroll.addEventListener("click", async () => {
  btnCancelarEnroll.disabled = true;
  btnCancelarEnroll.textContent = "Cancelando...";
  await cancelarEnrollServidor();
  cerrarModalEnroll();
  toast("Registro de huella cancelado", "warn");
});

async function cancelarEnrollServidor() {
  try {
    await SIGA.api("/api/agent/cancel", { method: "POST" });
  } catch (_) {
    /* silencioso */
  }
}

// ================================================================
// DATOS
// ================================================================
async function cargarGrupos() {
  const res = await SIGA.api("/api/grupos");
  grupos = res.datos;
  grupoId.innerHTML =
    '<option value="">Selecciona un grupo</option>' +
    grupos.map((g) => `<option value="${g.id}">${g.nombre}</option>`).join("");
}

async function cargarAlumnos() {
  const params = new URLSearchParams();
  const q = busqueda.value.trim();
  if (q) params.set("busqueda", q);
  if (verInactivos.checked) params.set("incluir_inactivos", "1");

  const url = params.toString() ? `/api/alumnos?${params}` : "/api/alumnos";
  const res = await SIGA.api(url);
  alumnos = res.datos;
  renderTabla();
}

// ================================================================
// TABLA
// ================================================================
function nombreCompleto(a) {
  return [a.nombre, a.apellido_pat, a.apellido_mat || ""]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function huellaBadge(a) {
  return a.huella_id
    ? '<span class="badge ok">Registrada</span>'
    : '<span class="badge no">Sin huella</span>';
}

function estatusBadge(a) {
  return a.activo
    ? '<span class="badge ok">Activo</span>'
    : '<span class="badge wait">Desactivado</span>';
}

function renderTabla() {
  if (!alumnos.length) {
    tablaAlumnos.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">No hay alumnos para mostrar</td></tr>';
    return;
  }

  tablaAlumnos.innerHTML = alumnos
    .map(
      (a) => `
    <tr style="${a.activo ? "" : "opacity:.65;"}">
      <td>${a.matricula}</td>
      <td>${nombreCompleto(a)}</td>
      <td>${a.grupo}</td>
      <td>${estatusBadge(a)}</td>
      <td>${huellaBadge(a)}</td>
      <td>
        ${
          a.activo
            ? `
          <button class="btn warning" onclick="editarAlumno(${a.id})">Editar</button>
          <button class="btn danger"  onclick="eliminarAlumno(${a.id})">Desactivar</button>
          ${
            a.huella_id
              ? `<button class="btn"         onclick="eliminarHuella(${a.id})">Quitar huella</button>`
              : `<button class="btn success" onclick="iniciarEnroll(${a.id})">Registrar huella</button>`
          }
        `
            : `
          <button class="btn success" onclick="restaurarAlumno(${a.id})">Restaurar</button>
        `
        }
      </td>
    </tr>
  `,
    )
    .join("");
}

// ================================================================
// ACCIONES CRUD
// ================================================================
window.editarAlumno = function (id) {
  const a = alumnos.find((x) => x.id === id);
  if (!a) return;
  alumnoId.value = a.id;
  matricula.value = a.matricula;
  nombre.value = a.nombre;
  apellidoPat.value = a.apellido_pat;
  apellidoMat.value = a.apellido_mat || "";
  grupoId.value = a.grupo_id;
  formTitle.textContent = "Editar alumno";
  registrarHuella.checked = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.eliminarAlumno = async function (id) {
  if (!confirm("¿Deseas desactivar este alumno?")) return;
  try {
    await SIGA.api(`/api/alumnos/${id}`, { method: "DELETE" });
    await cargarAlumnos();
    toast("Alumno desactivado", "warn");
  } catch (e) {
    toast(e.message, "error", 6000);
  }
};

window.restaurarAlumno = async function (id) {
  try {
    await SIGA.api(`/api/alumnos/${id}/restaurar`, { method: "PATCH" });
    await cargarAlumnos();
    toast("Alumno restaurado correctamente", "ok");
  } catch (e) {
    toast(e.message, "error", 6000);
  }
};

// ── Iniciar enroll desde la tabla ─────────────────────────────
window.iniciarEnroll = async function (id) {
  const alumno = alumnos.find((x) => x.id === id);
  abrirModalEnroll(alumno || null);
  try {
    await SIGA.api("/api/agent/enroll", {
      method: "POST",
      body: JSON.stringify({ alumno_id: id }),
    });
  } catch (e) {
    setSensor("error", "No se pudo iniciar", e.message);
    setMensajeDetalle(e.message, "error");
    setPaso(1, "error");
    enrollActivo = false;
    btnCancelarEnroll.textContent = "Cerrar";
    btnCancelarEnroll.disabled = false;
    // Sobreescribir click para solo cerrar
    btnCancelarEnroll.onclick = () => cerrarModalEnroll();
  }
};

window.eliminarHuella = async function (id) {
  try {
    await SIGA.api("/api/agent/delete", {
      method: "POST",
      body: JSON.stringify({ alumno_id: id }),
    });
    toast("Solicitud de eliminación enviada al lector", "info");
  } catch (e) {
    toast(e.message, "error", 6000);
  }
};

// ================================================================
// FORMULARIO
// ================================================================
alumnoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    matricula: matricula.value,
    nombre: nombre.value,
    apellido_pat: apellidoPat.value,
    apellido_mat: apellidoMat.value,
    grupo_id: parseInt(grupoId.value),
  };

  try {
    if (alumnoId.value) {
      // ── Editar ────────────────────────────────────────────
      const res = await SIGA.api(`/api/alumnos/${alumnoId.value}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await cargarAlumnos();
      toast(res.mensaje, "ok");
    } else {
      // ── Crear ─────────────────────────────────────────────
      const res = await SIGA.api("/api/alumnos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await cargarAlumnos();
      toast(res.mensaje, "ok", 3000);

      if (registrarHuella.checked) {
        const alumnoNuevo = alumnos.find((a) => a.id === res.id) || {
          nombre: payload.nombre,
          apellido_pat: payload.apellido_pat,
          matricula: payload.matricula,
          grupo: grupos.find((g) => g.id === payload.grupo_id)?.nombre || "",
        };
        abrirModalEnroll(alumnoNuevo);
        try {
          await SIGA.api("/api/agent/enroll", {
            method: "POST",
            body: JSON.stringify({ alumno_id: res.id }),
          });
        } catch (errHuella) {
          setSensor("error", "No se pudo iniciar el enroll", errHuella.message);
          setPaso(1, "error");
          enrollActivo = false;
          btnCancelarEnroll.textContent = "Cerrar";
          btnCancelarEnroll.onclick = () => cerrarModalEnroll();
        }
      }
    }

    alumnoForm.reset();
    alumnoId.value = "";
    formTitle.textContent = "Nuevo alumno";
    registrarHuella.checked = true;
  } catch (err) {
    toast(err.message, "error", 6000);
  }
});

btnCancelar.addEventListener("click", async () => {
  alumnoForm.reset();
  alumnoId.value = "";
  formTitle.textContent = "Nuevo alumno";
  registrarHuella.checked = true;
  // Si había enroll activo desde el form, cancelar en servidor
  if (enrollActivo) {
    await cancelarEnrollServidor();
    cerrarModalEnroll();
  }
});

// ================================================================
// SOCKET — eventos del sensor
// ================================================================

// Progreso durante el enroll
socket.on("sensor:enroll_status", (data) => {
  const msg = data.mensaje || "";
  const esPaso2 = /segundo|again|segunda|retire|retira|coloca de nuevo/i.test(
    msg,
  );

  if (esPaso2) {
    setPaso(1, "completado");
    setPaso(2, "activo");
    setSensor(
      "esperando",
      "Retira y vuelve a poner el dedo",
      "Segunda lectura",
    );
  } else {
    setPaso(1, "activo");
    setSensor(
      "esperando",
      "Pon el dedo en el lector",
      msg || "Primera lectura",
    );
  }
});

// Enroll exitoso
socket.on("sensor:enroll_ok", async (data) => {
  enrollActivo = false;
  setPaso(1, "completado");
  setPaso(2, "completado");
  setPaso(3, "completado");
  setSensor("ok", "¡Huella registrada!", `ID de huella: ${data.huella_id}`);
  setMensajeDetalle(
    "El lector volverá a modo asistencia automáticamente.",
    "ok",
  );
  btnCancelarEnroll.textContent = "Cerrar";
  btnCancelarEnroll.disabled = false;
  btnCancelarEnroll.onclick = () => cerrarModalEnroll();

  await cargarAlumnos();
  toast(`Huella registrada correctamente (ID ${data.huella_id})`, "ok", 5000);

  // Cierre automático después de 2.5 s
  setTimeout(() => {
    if (!enrollModal.classList.contains("hidden")) cerrarModalEnroll();
  }, 2500);
});

// Error en enroll
socket.on("sensor:enroll_error", (data) => {
  enrollActivo = false;
  setPaso(1, "error");
  setSensor(
    "error",
    "No se pudo registrar",
    data.mensaje || "Error en el lector",
  );
  setMensajeDetalle(data.mensaje || "Intenta de nuevo.", "error");
  btnCancelarEnroll.textContent = "Cerrar";
  btnCancelarEnroll.disabled = false;
  btnCancelarEnroll.onclick = () => cerrarModalEnroll();

  toast(data.mensaje || "Error al registrar la huella", "error", 6000);
});

// Huella eliminada
socket.on("sensor:delete_ok", async (data) => {
  await cargarAlumnos();
  toast(`Huella eliminada correctamente (ID ${data.huella_id})`, "ok");
});

// ================================================================
// INIT
// ================================================================
busqueda.addEventListener("input", cargarAlumnos);
verInactivos.addEventListener("change", cargarAlumnos);

(async function init() {
  await cargarGrupos();
  await cargarAlumnos();
})();
