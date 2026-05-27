const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

document.addEventListener('DOMContentLoaded', async () => {
  SIGA.renderSidebar('horarios');

  const form        = document.getElementById('horarioForm');
  const inputId     = document.getElementById('horarioId');
  const selGrupo    = document.getElementById('grupo_id');
  const selMateria  = document.getElementById('materia_id');
  const selDia      = document.getElementById('dia_semana');
  const inputInicio = document.getElementById('hora_inicio');
  const inputFin    = document.getElementById('hora_fin');
  const inputTol    = document.getElementById('tolerancia_min');
  const formTitle   = document.getElementById('formTitle');
  const btnGuard    = document.getElementById('btnGuardar');
  const btnCancel   = document.getElementById('btnCancelar');
  const filtroGrupo = document.getElementById('filtroGrupo');
  const filtroDia   = document.getElementById('filtroDia');
  const tbody       = document.getElementById('tablaHorarios');

  let horarios = [];

  // ── Poblar selects ───────────────────────────────────────────
  async function poblarSelects() {
    const [rg, rm] = await Promise.all([
      SIGA.api('/api/grupos'),
      SIGA.api('/api/materias'),
    ]);
    const opGrupos = rg.datos.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
    selGrupo.innerHTML   = '<option value="">— Selecciona —</option>' + opGrupos;
    filtroGrupo.innerHTML = '<option value="">Todos los grupos</option>' + opGrupos;
    selMateria.innerHTML  = '<option value="">— Selecciona —</option>' +
      rm.datos.map(m => `<option value="${m.id}">${m.nombre} (${m.clave})</option>`).join('');
  }

  // ── Cargar horarios ──────────────────────────────────────────
  async function cargar() {
    try {
      const params = new URLSearchParams();
      if (filtroGrupo.value) params.set('grupo_id', filtroGrupo.value);
      if (filtroDia.value)   params.set('dia_semana', filtroDia.value);
      const r = await SIGA.api('/api/horarios?' + params.toString());
      horarios = r.datos;
      renderTabla();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  }

  function renderTabla() {
    tbody.innerHTML = horarios.length ? horarios.map(h => `
      <tr>
        <td>${h.grupo}</td>
        <td><strong>${h.materia}</strong> <small style="color:#9ca3af">${h.clave}</small></td>
        <td><span class="dia-chip">${DIAS[h.dia_semana]}</span></td>
        <td>${h.hora_inicio.slice(0,5)}</td>
        <td>${h.hora_fin.slice(0,5)}</td>
        <td>${h.tolerancia_min} min</td>
        <td>
          <button class="btn btn-sm" onclick="editar(${h.id})">Editar</button>
          <button class="btn btn-sm danger" onclick="eliminar(${h.id})">Eliminar</button>
        </td>
      </tr>`).join('')
      : '<tr class="empty-row"><td colspan="7">Sin horarios registrados</td></tr>';
  }

  // ── Guardar ──────────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = inputId.value;
    const body = {
      grupo_id: +selGrupo.value, materia_id: +selMateria.value,
      dia_semana: +selDia.value, hora_inicio: inputInicio.value,
      hora_fin: inputFin.value, tolerancia_min: +inputTol.value,
    };
    if (!body.grupo_id || !body.materia_id) return SIGA.toast('Selecciona grupo y materia', 'warning');
    try {
      if (id) {
        await SIGA.api(`/api/horarios/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        SIGA.toast('Horario actualizado', 'ok');
      } else {
        await SIGA.api('/api/horarios', { method: 'POST', body: JSON.stringify(body) });
        SIGA.toast('Horario creado', 'ok');
      }
      resetForm(); cargar();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  });

  window.editar = id => {
    const h = horarios.find(x => x.id === id);
    if (!h) return;
    inputId.value = h.id;
    selGrupo.value   = h.grupo_id;
    selMateria.value = h.materia_id;
    selDia.value     = h.dia_semana;
    inputInicio.value = h.hora_inicio.slice(0,5);
    inputFin.value    = h.hora_fin.slice(0,5);
    inputTol.value    = h.tolerancia_min;
    formTitle.textContent = 'Editar horario';
    btnGuard.textContent  = 'Actualizar horario';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.eliminar = async id => {
    if (!confirm('¿Eliminar este horario? Se borrarán también las asistencias asociadas.')) return;
    try { await SIGA.api(`/api/horarios/${id}`, { method: 'DELETE' }); SIGA.toast('Horario eliminado', 'ok'); cargar(); }
    catch (e) { SIGA.toast(e.message, 'error'); }
  };

  function resetForm() {
    form.reset(); inputId.value = '';
    formTitle.textContent = 'Nuevo horario'; btnGuard.textContent = 'Guardar horario';
  }

  btnCancel.addEventListener('click', resetForm);
  filtroGrupo.addEventListener('change', cargar);
  filtroDia.addEventListener('change', cargar);

  await poblarSelects();
  cargar();
});
