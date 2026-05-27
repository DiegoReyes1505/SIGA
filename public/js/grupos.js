document.addEventListener('DOMContentLoaded', () => {
  SIGA.renderSidebar('grupos');

  const form       = document.getElementById('grupoForm');
  const inputId    = document.getElementById('grupoId');
  const inputNom   = document.getElementById('nombre');
  const inputDesc  = document.getElementById('descripcion');
  const formTitle  = document.getElementById('formTitle');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnCancel  = document.getElementById('btnCancelar');
  const inputBusc  = document.getElementById('busqueda');
  const chkInact   = document.getElementById('verInactivos');
  const tbody      = document.getElementById('tablaGrupos');

  let grupos = [];

  // ── Cargar ──────────────────────────────────────────────────
  async function cargar() {
    try {
      const p = chkInact.checked ? '?incluir_inactivos=1' : '';
      const r = await SIGA.api('/api/grupos' + p);
      grupos = r.datos;
      renderTabla();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  }

  // ── Render tabla ─────────────────────────────────────────────
  function renderTabla() {
    const q = inputBusc.value.toLowerCase();
    const filtrados = grupos.filter(g => g.nombre.toLowerCase().includes(q) || (g.descripcion||'').toLowerCase().includes(q));
    tbody.innerHTML = filtrados.length ? filtrados.map(g => `
      <tr>
        <td><strong>${g.nombre}</strong></td>
        <td>${g.descripcion || '<span style="color:#6b7280">—</span>'}</td>
        <td id="cnt-${g.id}">...</td>
        <td><span class="badge ${g.activo ? 'activo' : 'inactivo'}">${g.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn btn-sm" onclick="editar(${g.id})">Editar</button>
          ${g.activo
            ? `<button class="btn btn-sm danger" onclick="desactivar(${g.id})">Desactivar</button>`
            : `<button class="btn btn-sm success" onclick="restaurar(${g.id})">Restaurar</button>`}
        </td>
      </tr>`).join('')
      : '<tr class="empty-row"><td colspan="5">Sin grupos encontrados</td></tr>';
    filtrados.forEach(g => contarAlumnos(g.id));
  }

  async function contarAlumnos(id) {
    try {
      const r = await SIGA.api(`/api/grupos/${id}/alumnos`);
      const el = document.getElementById(`cnt-${id}`);
      if (el) el.textContent = r.datos.length;
    } catch { /* ignorar */ }
  }

  // ── Guardar ──────────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = inputId.value;
    const body = { nombre: inputNom.value.trim(), descripcion: inputDesc.value.trim() };
    try {
      if (id) {
        await SIGA.api(`/api/grupos/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        SIGA.toast('Grupo actualizado', 'ok');
      } else {
        await SIGA.api('/api/grupos', { method: 'POST', body: JSON.stringify(body) });
        SIGA.toast('Grupo creado', 'ok');
      }
      resetForm();
      cargar();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  });

  // ── Editar ───────────────────────────────────────────────────
  window.editar = async id => {
    const g = grupos.find(x => x.id === id);
    if (!g) return;
    inputId.value   = g.id;
    inputNom.value  = g.nombre;
    inputDesc.value = g.descripcion || '';
    formTitle.textContent = 'Editar grupo';
    btnGuardar.textContent = 'Actualizar grupo';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Desactivar ───────────────────────────────────────────────
  window.desactivar = async id => {
    if (!confirm('¿Desactivar este grupo?')) return;
    try {
      await SIGA.api(`/api/grupos/${id}`, { method: 'DELETE' });
      SIGA.toast('Grupo desactivado', 'ok');
      cargar();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  };

  // ── Restaurar ────────────────────────────────────────────────
  window.restaurar = async id => {
    try {
      await SIGA.api(`/api/grupos/${id}/restaurar`, { method: 'PATCH' });
      SIGA.toast('Grupo restaurado', 'ok');
      cargar();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  };

  function resetForm() {
    form.reset();
    inputId.value = '';
    formTitle.textContent = 'Nuevo grupo';
    btnGuardar.textContent = 'Guardar grupo';
  }

  btnCancel.addEventListener('click', resetForm);
  inputBusc.addEventListener('input', renderTabla);
  chkInact.addEventListener('change', cargar);
  cargar();
});
