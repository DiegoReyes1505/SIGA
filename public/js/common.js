window.socket = io();

window.SIGA = {
  async api(url, options = {}) {
    let res;

    try {
      res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
    } catch (err) {
      throw new Error("No se pudo conectar con el servidor");
    }

    const raw = await res.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { mensaje: raw || "Respuesta no válida del servidor" };
    }

    if (!res.ok) {
      throw new Error(data.mensaje || "Error en la petición");
    }

    return data;
  },

  async getReaderStatus() {
    return await this.api("/api/reader/status");
  },

  renderSidebar(activeKey) {
    const nav = document.getElementById("sidebarNav");
    if (!nav) return;

    const items = [
      { key: "alumnos", label: "Alumnos", href: "/alumnos.html" },
      {
        key: "huellas",
        label: "Huellas y asistencias",
        href: "/huellas-asistencias.html",
      },
      { key: "permisos", label: "Permisos", href: "/permisos.html" },
      { key: "historial", label: "Historial", href: "/historial.html" },
      { key: "dashboard", label: "Dashboard", href: "/dashboard.html" },
      { key: "analisis", label: "Análisis", href: "/analisis.html" },
    ];

    nav.innerHTML = items
      .map(
        (item) => `
      <a class="side-link ${item.key === activeKey ? "active" : ""}" href="${item.href}">${item.label}</a>
    `,
      )
      .join("");
  },
};

// ── Estado del lector ─────────────────────────────────────────
let cooldownInterval = null;
let pintandoEstado = false;

window.SIGA.pintarEstadoLector = async function () {
  if (pintandoEstado) return;
  pintandoEstado = true;

  const badge = document.getElementById("readerStatusBadge");
  if (!badge) {
    pintandoEstado = false;
    return;
  }

  clearInterval(cooldownInterval);
  cooldownInterval = null;

  try {
    const res = await this.getReaderStatus();
    const data = res.datos || res;
    const mode = data.mode || "attendance";
    const online = !!data.online;
    const cooldown = !!data.cooldown_active;

    badge.className = "reader-badge";

    if (!online) {
      badge.className = "reader-badge wait";
      badge.textContent = "Verificando lector...";
      setTimeout(() => window.SIGA.pintarEstadoLector(), 1000);
    } else if (cooldown) {
      badge.classList.add("cooldown");
      let secsLeft = data.cooldown_seconds || 0;
      badge.textContent = `Cooldown activo (${secsLeft}s)`;

      cooldownInterval = setInterval(() => {
        secsLeft--;
        if (secsLeft <= 0) {
          clearInterval(cooldownInterval);
          cooldownInterval = null;
          badge.className = "reader-badge attendance";
          badge.textContent = "Modo asistencia";
          // Confirma con el servidor después de 800ms
          setTimeout(() => window.SIGA.pintarEstadoLector(), 800);
        } else {
          badge.textContent = `Cooldown activo (${secsLeft}s)`;
        }
      }, 1000);
    } else if (mode === "enroll") {
      badge.classList.add("enroll");
      badge.textContent = "Modo enroll";
    } else {
      badge.classList.add("attendance");
      badge.textContent = "Modo asistencia";
    }
  } catch (e) {
    badge.className = "reader-badge offline";
    badge.textContent = "Sin estado del lector";
  } finally {
    pintandoEstado = false;
  }
};

// ── Inicialización y eventos de socket ───────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await window.SIGA.pintarEstadoLector();

  const eventosLector = [
    "reader:mode",
    "reader:cooldown",
    "sensor:status",
    "sensor:enroll_ok",
    "sensor:enroll_error",
    "sensor:delete_ok",
  ];

  eventosLector.forEach((evento) => {
    socket.on(evento, () => window.SIGA.pintarEstadoLector());
  });
});
