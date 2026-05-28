window.socket = io();

window.SIGA = {
  async api(url, options = {}) {
    let res;
    try {
      res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
    } catch (err) {
      throw new Error('No se pudo conectar con el servidor');
    }
    const raw = await res.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { mensaje: raw || 'Respuesta no válida del servidor' }; }
    if (!res.ok) throw new Error(data.mensaje || 'Error en la petición');
    return data;
  },

  async getReaderStatus() {
    return await this.api('/api/reader/status');
  },

  renderSidebar(activeKey) {
    const nav = document.getElementById('sidebarNav');
    if (!nav) return;
    const items = [
      { key: 'alumnos',    label: '👤 Alumnos',             href: '/alumnos.html' },
      { key: 'grupos',     label: '🏫 Grupos',              href: '/grupos.html' },
      { key: 'materias',   label: '📚 Materias',            href: '/materias.html' },
      { key: 'horarios',   label: '🕐 Horarios',            href: '/horarios.html' },
      { key: 'huellas',    label: '🖐 Huellas y asist.',    href: '/huellas-asistencias.html' },
      { key: 'asistencias',label: '📋 Asistencias',         href: '/asistencias.html' },
      { key: 'permisos',   label: '📝 Permisos',            href: '/permisos.html' },
      { key: 'historial',  label: '📊 Historial',           href: '/historial.html' },
      { key: 'dashboard',  label: '🏠 Dashboard',           href: '/dashboard.html' },
      { key: 'analisis',   label: '🔍 Análisis',            href: '/analisis.html' },
    ];
    nav.innerHTML = items.map(item =>
      `<a class="side-link ${item.key === activeKey ? 'active' : ''}" href="${item.href}">${item.label}</a>`
    ).join('');
  },

  toast(msg, tipo = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
  },
};

// ── Eventos del sensor (todas las páginas) ───────────────────────────────
// Registro exitoso por sensor
window.socket.on('asistencia:nueva', data => {
  const tipoLabel = data.tipo === 'retardo' ? '⏰ Retardo' : '✅ Asistencia';
  SIGA.toast(`${tipoLabel} — ${data.alumno} (${data.materia}, ${data.hora_entrada ? data.hora_entrada.slice(0, 5) : ''})`, 'ok');
});

// Sin horario activo en este momento
window.socket.on('asistencia:sin_horario', data => {
  SIGA.toast(`⚠️ Sin horario activo — ${data.alumno} (${data.hora})`, 'error');
});

// Asistencia duplicada
window.socket.on('asistencia:duplicada', data => {
  SIGA.toast(`ℹ️ Ya registrado — ${data.alumno} tiene ${data.tipo} hoy`, 'info');
});

// ── Estado del lector ─────────────────────────────────────────────────
let cooldownInterval = null;
let pintandoEstado = false;
let pollingTimeout = null;

window.SIGA.pintarEstadoLector = async function (detenerPolling = false) {
  if (detenerPolling && pollingTimeout) { clearTimeout(pollingTimeout); pollingTimeout = null; }
  if (pintandoEstado) return;
  pintandoEstado = true;
  const badge = document.getElementById('readerStatusBadge');
  if (!badge) { pintandoEstado = false; return; }
  clearInterval(cooldownInterval); cooldownInterval = null;
  try {
    const res = await this.getReaderStatus();
    const data = res.datos || res;
    const mode = data.mode || 'attendance';
    const online = !!data.online;
    const cooldown = !!data.cooldown_active;
    badge.className = 'reader-badge';
    if (!online) {
      badge.className = 'reader-badge wait';
      badge.textContent = 'Verificando lector...';
      if (!detenerPolling) { pollingTimeout = setTimeout(() => { pollingTimeout = null; window.SIGA.pintarEstadoLector(); }, 2000); }
    } else if (cooldown) {
      badge.classList.add('cooldown');
      let secsLeft = data.cooldown_seconds || 0;
      badge.textContent = `Cooldown activo (${secsLeft}s)`;
      cooldownInterval = setInterval(() => {
        secsLeft--;
        if (secsLeft <= 0) { clearInterval(cooldownInterval); cooldownInterval = null; badge.className = 'reader-badge attendance'; badge.textContent = 'Modo asistencia'; setTimeout(() => window.SIGA.pintarEstadoLector(), 800); }
        else badge.textContent = `Cooldown activo (${secsLeft}s)`;
      }, 1000);
    } else if (mode === 'enroll') {
      badge.classList.add('enroll'); badge.textContent = 'Modo enroll';
    } else {
      badge.classList.add('attendance'); badge.textContent = 'Modo asistencia';
    }
  } catch (e) {
    badge.className = 'reader-badge offline'; badge.textContent = 'Sin estado del lector';
  } finally { pintandoEstado = false; }
};

document.addEventListener('DOMContentLoaded', async () => {
  await window.SIGA.pintarEstadoLector();
  const eventosLector = ['reader:mode','reader:cooldown','sensor:status','sensor:enroll_ok','sensor:enroll_error','sensor:delete_ok'];
  eventosLector.forEach(e => socket.on(e, () => window.SIGA.pintarEstadoLector(true)));
});
