const DIAS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const POR_PAGE  = 30;

document.addEventListener('DOMContentLoaded', async () => {
  SIGA.renderSidebar('asistencias');

  // ── Elementos principales ────────────────────────────────────
  const filtroGrupo  = document.getElementById('filtroGrupo');
  const filtroAlumno = document.getElementById('filtroAlumno');
  const filtroTipo   = document.getElementById('filtroTipo');
  const filtroFI     = document.getElementById('filtroFechaInicio');
  const filtroFF     = document.getElementById('filtroFechaFin');
  const btnBuscar    = document.getElementById('btnBuscar');
  const btnLimpiar   = document.getElementById('btnLimpiar');
  const btnNuevo     = document.getElementById('btnNuevo');
  const tbody        = document.getElementById('tablaAsistencias');
  const totalLabel   = document.getElementById('totalLabel');
  const btnAnt       = document.getElementById('btnAnterior');
  const btnSig       = document.getElementById('btnSiguiente');
  const paginaInfo   = document.getElementById('paginaInfo');

  // ── Elementos modal ──────────────────────────────────────────
  const modal        = document.getElementById('modalAsistencia');
  const modalTitle   = document.getElementById('modalTitle');
  const modalClose   = document.getElementById('modalClose');
  const modalCancelar= document.getElementById('modalCancelar');
  const form         = document.getElementById('asistenciaForm');
  const asistenciaId = document.getElementById('asistenciaId');
  const mGrupo       = document.getElementById('m_grupo_id');
  const mAlumno      = document.getElementById('m_alumno_id');
  const mHorario     = document.getElementById('m_horario_id');
  const mFecha       = document.getElementById('m_fecha');
  const mTipo        = document.getElementById('m_tipo');
  const mHoraEnt     = document.getElementById('m_hora_entrada');
  const mNota        = document.getElementById('m_nota');

  let todas = []; let pagina = 0;

  // ── Poblar filtros ───────────────────────────────────────────
  const rg = await SIGA.api('/api/grupos');
  const grupoOpts = rg.datos.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
  filtroGrupo.innerHTML += grupoOpts;
  mGrupo.innerHTML = '<option value="">— Grupo —</option>' + grupoOpts;

  filtroGrupo.addEventListener('change', async () => {
    filtroAlumno.innerHTML = '<option value="">Todos</option>';
    if (!filtroGrupo.value) return;
    const ra = await SIGA.api(`/api/grupos/${filtroGrupo.value}/alumnos`);
    filtroAlumno.innerHTML = '<option value="">Todos</option>' +
      ra.datos.map(a => `<option value="${a.id}">${a.apellido_pat} ${a.nombre}</option>`).join('');
  });

  mGrupo.addEventListener('change', async () => {
    mAlumno.innerHTML  = '<option value="">— Alumno —</option>';
    mHorario.innerHTML = '<option value="">— Horario —</option>';
    if (!mGrupo.value) return;
    const [ra, rh] = await Promise.all([
      SIGA.api(`/api/grupos/${mGrupo.value}/alumnos`),
      SIGA.api(`/api/grupos/${mGrupo.value}/horarios`),
    ]);
    mAlumno.innerHTML  = '<option value="">— Alumno —</option>' +
      ra.datos.map(a => `<option value="${a.id}">${a.apellido_pat} ${a.nombre}</option>`).join('');
    mHorario.innerHTML = '<option value="">— Horario —</option>' +
      rh.datos.map(h => `<option value="${h.id}">${DIAS_FULL[h.dia_semana]} ${h.hora_inicio.slice(0,5)} — ${h.materia}</option>`).join('');
  });

  // ── Buscar ───────────────────────────────────────────────────
  async function buscar() {
    try {
      const p = new URLSearchParams();
      if (filtroGrupo.value)  p.set('grupo_id',    filtroGrupo.value);
      if (filtroAlumno.value) p.set('alumno_id',   filtroAlumno.value);
      if (filtroTipo.value)   p.set('tipo',        filtroTipo.value);
      if (filtroFI.value)     p.set('fecha_inicio',filtroFI.value);
      if (filtroFF.value)     p.set('fecha_fin',   filtroFF.value);
      const r = await SIGA.api('/api/asistencias?' + p.toString());
      todas = r.datos; pagina = 0;
      renderTabla();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  }

  function renderTabla() {
    const inicio = pagina * POR_PAGE;
    const pagData = todas.slice(inicio, inicio + POR_PAGE);
    totalLabel.textContent = `(${todas.length} registros)`;
    const totalPags = Math.ceil(todas.length / POR_PAGE) || 1;
    paginaInfo.textContent = `Página ${pagina+1} de ${totalPags}`;
    btnAnt.disabled = pagina === 0;
    btnSig.disabled = pagina >= totalPags - 1;

    tbody.innerHTML = pagData.length ? pagData.map(a => `
      <tr>
        <td>${a.fecha}</td>
        <td>${a.alumno}<br><small style="color:#9ca3af">${a.matricula}</small></td>
        <td>${a.grupo}</td>
        <td>${a.materia}</td>
        <td><span class="badge ${a.tipo}">${a.tipo}</span></td>
        <td>${a.hora_entrada ? a.hora_entrada.slice(0,5) : '<span style="color:#6b7280">—</span>'}</td>
        <td><span class="badge ${a.registrado_por==='sensor'?'ok':'info'}">${a.registrado_por}</span></td>
        <td>
          <button class="btn btn-sm" onclick="editarA(${a.id})">Editar</button>
          <button class="btn btn-sm danger" onclick="eliminarA(${a.id})">Eliminar</button>
        </td>
      </tr>`).join('')
      : '<tr class="empty-row"><td colspan="8">Sin registros</td></tr>';
  }

  btnAnt.addEventListener('click', () => { pagina--; renderTabla(); });
  btnSig.addEventListener('click', () => { pagina++; renderTabla(); });
  btnBuscar.addEventListener('click', buscar);
  btnLimpiar.addEventListener('click', () => {
    filtroGrupo.value=''; filtroAlumno.innerHTML='<option value="">Todos</option>';
    filtroTipo.value=''; filtroFI.value=''; filtroFF.value='';
    buscar();
  });

  // ── Modal: nuevo ─────────────────────────────────────────────
  btnNuevo.addEventListener('click', () => {
    asistenciaId.value='';
    form.reset();
    modalTitle.textContent = 'Registro manual';
    mFecha.valueAsDate = new Date();
    modal.classList.remove('hidden');
  });
  const cerrarModal = () => modal.classList.add('hidden');
  modalClose.addEventListener('click', cerrarModal);
  modalCancelar.addEventListener('click', cerrarModal);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });

  // ── Modal: editar ─────────────────────────────────────────────
  window.editarA = async id => {
    try {
      const r = await SIGA.api(`/api/asistencias/${id}`);
      const a = r.datos;
      asistenciaId.value = a.id;
      // Pre-cargar grupo → alumnos → horarios
      mGrupo.value = '';
      // Buscar grupo del alumno
      const rg2 = await SIGA.api('/api/grupos');
      const grupoAlumno = rg2.datos; // se cargan en el evento change
      mGrupo.innerHTML = '<option value="">— Grupo —</option>' + grupoAlumno.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
      // Cargar grupo correcto
      const ra2 = await SIGA.api('/api/grupos');
      // Encontrar grupo del alumno
      const grupoId = a.grupo ? ra2.datos.find(g => g.nombre === a.grupo)?.id : null;
      if (grupoId) {
        mGrupo.value = grupoId;
        const [ra3, rh3] = await Promise.all([
          SIGA.api(`/api/grupos/${grupoId}/alumnos`),
          SIGA.api(`/api/grupos/${grupoId}/horarios`),
        ]);
        mAlumno.innerHTML = '<option value="">— Alumno —</option>' +
          ra3.datos.map(al => `<option value="${al.id}">${al.apellido_pat} ${al.nombre}</option>`).join('');
        mHorario.innerHTML = '<option value="">— Horario —</option>' +
          rh3.datos.map(h => `<option value="${h.id}">${DIAS_FULL[h.dia_semana]} ${h.hora_inicio.slice(0,5)} — ${h.materia}</option>`).join('');
      }
      mAlumno.value    = a.alumno_id;
      mHorario.value   = a.horario_id;
      mFecha.value     = a.fecha;
      mTipo.value      = a.tipo;
      mHoraEnt.value   = a.hora_entrada ? a.hora_entrada.slice(0,5) : '';
      mNota.value      = a.nota || '';
      modalTitle.textContent = 'Editar asistencia';
      modal.classList.remove('hidden');
    } catch (e) { SIGA.toast(e.message, 'error'); }
  };

  // ── Guardar modal ────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = asistenciaId.value;
    try {
      if (id) {
        await SIGA.api(`/api/asistencias/${id}`, { method: 'PUT',
          body: JSON.stringify({ tipo: mTipo.value, hora_entrada: mHoraEnt.value || null, nota: mNota.value || null }) });
        SIGA.toast('Asistencia actualizada', 'ok');
      } else {
        await SIGA.api('/api/asistencias', { method: 'POST', body: JSON.stringify({
          alumno_id: +mAlumno.value, horario_id: +mHorario.value,
          fecha: mFecha.value, tipo: mTipo.value,
          hora_entrada: mHoraEnt.value || null, nota: mNota.value || null,
        }) });
        SIGA.toast('Asistencia registrada', 'ok');
      }
      cerrarModal(); buscar();
    } catch (e) { SIGA.toast(e.message, 'error'); }
  });

  // ── Eliminar ─────────────────────────────────────────────────
  window.eliminarA = async id => {
    if (!confirm('¿Eliminar este registro de asistencia?')) return;
    try { await SIGA.api(`/api/asistencias/${id}`, { method: 'DELETE' }); SIGA.toast('Registro eliminado', 'ok'); buscar(); }
    catch (e) { SIGA.toast(e.message, 'error'); }
  };

  // ── Fecha por defecto: hoy ───────────────────────────────────
  const hoy = new Date().toISOString().slice(0, 10);
  filtroFI.value = hoy;
  filtroFF.value = hoy;
  buscar();
});
