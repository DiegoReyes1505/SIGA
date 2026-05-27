document.addEventListener('DOMContentLoaded', () => {
  SIGA.renderSidebar('materias');

  const form      = document.getElementById('materiaForm');
  const inputId   = document.getElementById('materiaId');
  const inputNom  = document.getElementById('nombre');
  const inputClv  = document.getElementById('clave');
  const formTitle = document.getElementById('formTitle');
  const btnGuard  = document.getElementById('btnGuardar');
  const btnCancel = document.getElementById('btnCancelar');
  const inputBusc = document.getElementById('busqueda');
  const chkInact  = document.getElementById('verInactivos');
  const tbody     = document.getElementById('tablaMaterias');

  let materias = [];

  async function cargar() {
    try {
      const p = chkInact.checked ? '?incluir_inactivos=1' : '';
      const r = await SIGA.api('/api/materias' + p);
      materias = r.datos;
      renderTabla();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  }

  function renderTabla() {
    const q = inputBusc.value.toLowerCase();
    const f = materias.filter(m => m.nombre.toLowerCase().includes(q) || m.clave.toLowerCase().includes(q));
    tbody.innerHTML = f.length ? f.map(m => `
      <tr>
        <td><span class="badge info">${m.clave}</span></td>
        <td><strong>${m.nombre}</strong></td>
        <td><span class="badge ${m.activo ? 'activo' : 'inactivo'}">${m.activo ? 'Activa' : 'Inactiva'}</span></td>
        <td>
          <button class="btn btn-sm" onclick="editar(${m.id})">Editar</button>
          ${m.activo
            ? `<button class="btn btn-sm danger" onclick="desactivar(${m.id})">Desactivar</button>`
            : `<button class="btn btn-sm success" onclick="restaurar(${m.id})">Restaurar</button>`}
        </td>
      </tr>`).join('')
      : '<tr class="empty-row"><td colspan="4">Sin materias encontradas</td></tr>';
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = inputId.value;
    const body = { nombre: inputNom.value.trim(), clave: inputClv.value.trim() };
    try {
      if (id) {
        await SIGA.api(`/api/materias/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        SIGA.toast('Materia actualizada', 'ok');
      } else {
        await SIGA.api('/api/materias', { method: 'POST', body: JSON.stringify(body) });
        SIGA.toast('Materia creada', 'ok');
      }
      resetForm(); cargar();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  });

  window.editar = id => {
    const m = materias.find(x => x.id === id);
    if (!m) return;
    inputId.value = m.id; inputNom.value = m.nombre; inputClv.value = m.clave;
    formTitle.textContent = 'Editar materia'; btnGuard.textContent = 'Actualizar materia';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.desactivar = async id => {
    if (!confirm('¿Desactivar esta materia?')) return;
    try { await SIGA.api(`/api/materias/${id}`, { method: 'DELETE' }); SIGA.toast('Materia desactivada', 'ok'); cargar(); }
    catch (e) { SIGA.toast(e.message, 'error'); }
  };

  window.restaurar = async id => {
    try { await SIGA.api(`/api/materias/${id}/restaurar`, { method: 'PATCH' }); SIGA.toast('Materia restaurada', 'ok'); cargar(); }
    catch (e) { SIGA.toast(e.message, 'error'); }
  };

  function resetForm() {
    form.reset(); inputId.value = '';
    formTitle.textContent = 'Nueva materia'; btnGuard.textContent = 'Guardar materia';
  }

  btnCancel.addEventListener('click', resetForm);
  inputBusc.addEventListener('input', renderTabla);
  chkInact.addEventListener('change', cargar);
  cargar();
});
