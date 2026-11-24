/* ==========================================================================
   AGENDA DE RED B2B · Lógica del prototipo
   Secciones:
     1. Utilidades y fechas      7. Tabla y estados de la tabla
     2. Catálogos de estado      8. Próximo envío automático
     3. Estado de la app         9. Detalle en acordeón
     4. Avisos (toasts)         10. Nuevo trabajo
     5. Validación              11. Envío al Centro de operaciones
     6. Indicadores globales    12. Rol, eliminación y exportación
                                13. Sidebar, filtros, eventos e inicio
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Utilidades y fechas
     ------------------------------------------------------------------------ */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ESC[ch]);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, uno, varios) => n === 1 ? uno : varios;

  const HOY = DATOS.hoyISO;
  const USUARIO = 'Camila Rojas';
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
  function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); }
  const aMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  function duracion(inicio, fin) {
    const m = aMin(fin) - aMin(inicio);
    if (m <= 0) return '';
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
  }
  function fmtFecha(iso) { const d = parseISO(iso); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; }
  function difDias(iso) { return Math.round((parseISO(iso) - parseISO(HOY)) / 86400000); }
  function relativo(iso) { const n = difDias(iso); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : ''; }
  function fmtMarca(dt) {
    if (!dt) return '—';
    const [f, h] = dt.split('T');
    return `${relativo(f) || fmtFecha(f)}, ${h}`;
  }
  function horaActual() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function ahora() { return `${HOY}T${horaActual()}`; }
  function icon(n, cls) { return `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`; }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  const proyecto = id => DATOS.PROYECTOS.find(p => p.id === id);
  const acceso = id => DATOS.ACCESOS.find(a => a.id === id);
  const byId = id => state.trabajos.find(t => t.id === id);

  /* ------------------------------------------------------------------------
     2. Catálogos de estado (dos dimensiones separadas)
     ------------------------------------------------------------------------ */
  const ESTADOS = {
    borrador:     { label: 'Borrador',     icon: 'circle-dashed' },
    validado:     { label: 'Validado',     icon: 'shield-check' },
    agendado:     { label: 'Agendado',     icon: 'calendar-check' },
    en_ejecucion: { label: 'En ejecución', icon: 'activity' },
    pospuesto:    { label: 'Pospuesto',    icon: 'clock' },
    cancelado:    { label: 'Cancelado',    icon: 'circle-x' },
    ejecutado:    { label: 'Ejecutado',    icon: 'circle-check' }
  };
  const ORDEN = Object.keys(ESTADOS);
  // Envío al Centro de operaciones. 'en_cola' no se guarda: se deriva de
  // 'sin_enviar' cuando el trabajo saldrá en el próximo envío automático.
  const CENTRO = {
    en_cola:    { label: 'En cola',        icon: 'hourglass' },
    sin_enviar: { label: 'Sin enviar',     icon: 'upload' },
    en_proceso: { label: 'Enviando',       icon: 'loader' },
    cargado:    { label: 'Cargado',        icon: 'check' },
    error:      { label: 'Error de carga', icon: 'alert-triangle' }
  };
  const CARGABLES = ['validado', 'agendado', 'pospuesto'];
  // Entra al envío: validado, agendado o pospuesto que no esté cargado ni enviándose (los errores se reintentan)
  const esCargable = t => CARGABLES.includes(t.estado) && !['cargado', 'en_proceso'].includes(t.centro.estado);
  const estadoCentro = t => t.centro.estado === 'sin_enviar' && esCargable(t) ? 'en_cola' : t.centro.estado;
  function motivoExclusion(t) {
    if (t.centro.estado === 'en_proceso') return 'Ya hay un envío en curso.';
    if (t.centro.estado === 'cargado') return 'Ya está cargado en el Centro de operaciones.';
    if (t.estado === 'borrador') return 'Es un borrador. Valídalo para que entre al envío.';
    if (t.estado === 'en_ejecucion') return 'El trabajo está en ejecución.';
    if (t.estado === 'cancelado') return 'El trabajo está cancelado.';
    if (t.estado === 'ejecutado') return 'El trabajo ya se ejecutó.';
    return 'No se puede enviar.';
  }

  function badgeEstado(e) {
    return `<span class="badge badge--${e}">${icon(ESTADOS[e].icon)}${ESTADOS[e].label}</span>`;
  }
  // s: clave de CENTRO · label: texto alternativo · msg: detalle del último envío (tooltip)
  function centroHTML(s, label, msg) {
    const title = msg ? ` title="${esc(msg)}"` : '';
    return `<span class="centro centro--${s}"${title}>${icon(CENTRO[s].icon, s === 'en_proceso' ? 'spin' : '')}${label || CENTRO[s].label}</span>`;
  }
  const centroDe = t => centroHTML(estadoCentro(t), '', t.centro.mensaje);

  /* ------------------------------------------------------------------------
     3. Estado de la app
     ------------------------------------------------------------------------ */
  const state = {
    trabajos: [],
    visibles: [],
    cargando: true,
    error: false,
    filtros: { q: '', estado: '', centro: '', zona: '', desde: '', hasta: '', rango: '' },
    rol: 'gestor',               // 'gestor' | 'jefatura' (simulado)
    historialAbierto: new Set(), // ids con el historial desplegado
    abierto: null
  };
  const simular = new URLSearchParams(location.search).get('simular');

  /* ------------------------------------------------------------------------
     4. Avisos (toasts)
     ------------------------------------------------------------------------ */
  function toast(msg, tipo) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = icon(tipo === 'error' ? 'alert-triangle' : tipo === 'info' ? 'alert-circle' : 'circle-check') + `<span>${esc(msg)}</span>`;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 4500);
  }

  /* ------------------------------------------------------------------------
     5. Validación (compartida por el detalle y el formulario nuevo)
     modo 'completo': obligatorios + formato + consistencia
     modo 'borrador': solo formato y consistencia de lo que esté escrito
     ------------------------------------------------------------------------ */
  const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function telefonoValido(v) {
    const d = v.replace(/\D/g, '');
    return (d.length === 11 && d.startsWith('56')) || (d.length === 9 && /^[29]/.test(d));
  }
  const OBLIGATORIOS = {
    c_nombre: 'Ingresa el nombre del contacto.',
    c_telefono: 'Ingresa un teléfono de contacto.',
    a_fecha: 'Elige la fecha del trabajo.',
    a_inicio: 'Indica la hora de inicio.',
    a_fin: 'Indica la hora de término.',
    a_zona: 'Elige la zona.',
    a_cluster: 'Elige el cluster.'
  };

  function validar(d, modo) {
    const e = {};
    const val = k => String(d[k] == null ? '' : d[k]).trim();

    if (modo === 'completo') {
      Object.keys(OBLIGATORIOS).forEach(k => { if (k in d && !val(k)) e[k] = OBLIGATORIOS[k]; });
    }
    // Formatos
    if (val('c_telefono') && !telefonoValido(val('c_telefono'))) e.c_telefono = 'Usa 9 dígitos (ej. 939412174) o +56 9 3941 2174.';
    if (val('c_correo') && !RE_CORREO.test(val('c_correo'))) e.c_correo = 'Revisa el correo (ej. nombre@empresa.cl).';
    // Consistencia
    const final = ['ejecutado', 'cancelado', 'en_ejecucion'].includes(d.estado);
    if (val('a_fecha') && !final && val('a_fecha') < HOY) e.a_fecha = 'La fecha ya pasó. Elige hoy o una fecha futura.';
    if (val('a_inicio') && val('a_fin') && val('a_fin') <= val('a_inicio')) e.a_fin = 'El término debe ser posterior al inicio.';
    if (!final && val('a_fecha') === HOY && val('a_inicio') && val('a_inicio') < horaActual() && !d._original_inicio_hoy) {
      e.a_inicio = 'Esa hora ya pasó hoy. Elige una hora posterior.';
    }
    if (d.estado === 'ejecutado' && val('a_fecha') > HOY) e.estado = 'Un trabajo ejecutado no puede tener fecha futura.';
    if (d.estado === 'en_ejecucion' && val('a_fecha') && val('a_fecha') !== HOY) e.estado = 'Un trabajo en ejecución debe tener fecha de hoy.';
    return e;
  }

  function leer(form) {
    const d = {};
    new FormData(form).forEach((v, k) => { if (k !== 'accesos') d[k] = v; });
    return d;
  }
  const serializar = form => JSON.stringify(Array.from(new FormData(form)));

  function mostrarErrores(form, errores, solo) {
    $$('.field[data-field]', form).forEach(f => {
      const k = f.dataset.field;
      if (solo && !solo.has(k)) return;
      const msg = errores[k];
      const p = $('.field__error', f);
      const ctrl = k === 'proyecto' ? $('#cb-input') : form.elements[k];
      if (msg) {
        p.innerHTML = icon('alert-circle') + `<span>${esc(msg)}</span>`;
        p.hidden = false;
        f.dataset.invalid = '';
      } else {
        p.hidden = true;
        p.innerHTML = '';
        delete f.dataset.invalid;
      }
      if (ctrl instanceof Element) ctrl.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
  }
  function enfocarPrimerError(form) {
    const f = $('.field[data-invalid]', form);
    if (!f) return;
    const ctrl = $$('input, select, textarea', f).find(el => el.offsetParent !== null);
    if (ctrl) ctrl.focus();
  }

  function campo(o) {
    const id = `${o.idp}-${o.k}`;
    const desc = [o.hint ? id + '-hint' : '', id + '-err', o.origen !== undefined ? id + '-nota' : ''].filter(Boolean).join(' ');
    const req = o.req ? ' <span class="req" aria-hidden="true">*</span>' : '';
    const aria = `aria-describedby="${desc}"${o.req ? ' aria-required="true"' : ''}`;
    let ctrl;
    if (o.tipo === 'select') {
      ctrl = `<select id="${id}" name="${o.k}" class="input" ${aria}>` +
        (o.placeholder ? `<option value="">${esc(o.placeholder)}</option>` : '') +
        o.opciones.map(([v, l]) => `<option value="${esc(v)}"${v === o.valor ? ' selected' : ''}>${esc(l)}</option>`).join('') +
        `</select>`;
      ctrl = `<div class="select">${ctrl}${icon('chevron-down')}</div>`;
    } else if (o.tipo === 'textarea') {
      ctrl = `<textarea id="${id}" name="${o.k}" class="input" rows="${o.rows || 2}" ${aria}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}>${esc(o.valor)}</textarea>`;
    } else {
      ctrl = `<input id="${id}" name="${o.k}" type="${o.tipo || 'text'}" class="input" value="${esc(o.valor)}" ${aria} ${o.attrs || ''}>`;
    }
    return `<div class="field${o.span ? ' field--' + o.span : ''}" data-field="${o.k}">
      <label for="${id}">${esc(o.label)}${req}</label>${ctrl}
      ${o.hint ? `<p class="field__hint" id="${id}-hint">${esc(o.hint)}</p>` : ''}
      <p class="field__error" id="${id}-err" hidden></p>
      ${o.origen !== undefined ? `<p class="field__note" id="${id}-nota" data-origen="${esc(o.origen)}" hidden></p>` : ''}</div>`;
  }
  const OPC_REGIONES = DATOS.REGIONES.map(x => [x, x]);
  const OPC_ZONAS = DATOS.ZONAS.map(x => [x, x]);
  const OPC_CLUSTERS = DATOS.CLUSTERS.map(x => [x, x]);
  const OPC_ESTADOS = ORDEN.map(k => [k, ESTADOS[k].label]);

  /* ------------------------------------------------------------------------
     6. Indicadores globales (no dependen de los filtros)
     ------------------------------------------------------------------------ */
  function renderKPIs() {
    const box = $('#kpis');
    if (state.cargando) {
      box.innerHTML = Array.from({ length: 4 }, () => `<div class="kpi" aria-hidden="true"><span class="kpi__icon" style="background:var(--background-tertiary)"></span><span><span class="sk" style="width:60%"></span><span class="sk" style="width:30%;height:20px"></span><span class="sk" style="width:80%"></span></span></div>`).join('');
      return;
    }
    const T = state.trabajos;
    const cuenta = e => T.filter(t => t.estado === e).length;
    const enEj = T.filter(t => t.estado === 'en_ejecucion');
    const items = [
      { k: 'registrados', filtro: '', ic: 'clipboard-list', label: 'Trabajos registrados', value: T.length },
      { k: 'agendados', filtro: 'agendado', ic: 'calendar-check', label: 'Agendados', value: cuenta('agendado') },
      { k: 'ejecucion', filtro: 'en_ejecucion', ic: 'activity', label: 'En ejecución', value: enEj.length },
      { k: 'finalizados', filtro: 'ejecutado', ic: 'flag', label: 'Finalizados', value: cuenta('ejecutado') }
    ];
    box.innerHTML = items.map(i => `<button type="button" class="kpi kpi--${i.k}" data-filtro="${i.filtro}" aria-pressed="${state.filtros.estado === i.filtro}">
        <span class="kpi__icon">${icon(i.ic)}</span>
        <span class="kpi__label">${i.label}</span>
        <span class="kpi__value">${i.value}</span>
      </button>`).join('');
  }

  /* --- Accesos rápidos por fecha --------------------------------------- */
  const MANANA = addDays(HOY, 1);
  const LUNES = addDays(HOY, -((parseISO(HOY).getDay() + 6) % 7));
  const DOMINGO = addDays(LUNES, 6);
  const PENDIENTES = ['borrador', 'validado', 'agendado', 'pospuesto'];
  const esAtrasado = t => t.agenda.fecha < HOY && PENDIENTES.includes(t.estado);
  const RANGOS = [
    { k: 'atrasados', label: 'Atrasados', ic: 'alert-triangle', test: esAtrasado },
    { k: 'hoy', label: 'Hoy', ic: 'calendar', test: t => t.agenda.fecha === HOY },
    { k: 'manana', label: 'Mañana', ic: 'calendar-plus', test: t => t.agenda.fecha === MANANA },
    { k: 'semana', label: 'Esta semana', ic: 'calendar-range', test: t => t.agenda.fecha >= LUNES && t.agenda.fecha <= DOMINGO },
    { k: '', label: 'Todos', ic: 'list', test: () => true }
  ];
  const enRango = (t, k) => RANGOS.find(r => r.k === k).test(t);

  function renderRangos() {
    const box = $('#rangos');
    if (state.cargando || state.error) { box.innerHTML = ''; return; }
    const base = visibles(true); // respeta búsqueda, estado, carga y fechas; no el rango
    box.innerHTML = RANGOS.map(r => {
      const n = base.filter(r.test).length;
      const alerta = r.k === 'atrasados' && n > 0;
      return `<button type="button" class="rango${alerta ? ' rango--alerta' : ''}" data-rango="${r.k}" aria-pressed="${state.filtros.rango === r.k}">
        ${icon(r.ic)}<span>${r.label}</span><span class="rango__n">${n}</span></button>`;
    }).join('');
  }

  /* ------------------------------------------------------------------------
     7. Tabla y estados de la tabla (carga, vacío, sin resultados, error)
     ------------------------------------------------------------------------ */
  const tbody = $('#tbody');
  const filaEl = id => tbody.querySelector(`tr.row[data-id="${id}"]`);

  function visibles(sinRango) {
    const f = state.filtros;
    const q = norm(f.q.trim());
    return state.trabajos.filter(t => {
      if (!sinRango && f.rango && !enRango(t, f.rango)) return false;
      if (f.estado && t.estado !== f.estado) return false;
      // "En cola" muestra todo lo que sale en el próximo envío, incluidos los errores que se reintentan
      if (f.centro && (f.centro === 'en_cola' ? !esCargable(t) : estadoCentro(t) !== f.centro)) return false;
      if (f.zona && t.zona !== f.zona) return false;
      if (f.desde && t.agenda.fecha < f.desde) return false;
      if (f.hasta && t.agenda.fecha > f.hasta) return false;
      if (q) {
        const p = proyecto(t.proyectoId), a = acceso(t.accesoId);
        const texto = norm([t.id, p.codigo, p.razonSocial, p.segmento, p.tipo, a.codigo, t.ubicacion.calle, t.ubicacion.comuna, t.zona, t.contacto.nombre].join(' '));
        if (!texto.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (a.agenda.fecha + a.agenda.inicio).localeCompare(b.agenda.fecha + b.agenda.inicio));
  }

  // Hoja de calendario + horario: la fecha es el dato principal de cada fila
  function fechaHTML(t) {
    const d = parseISO(t.agenda.fecha), dif = difDias(t.agenda.fecha);
    const hoja = dif === 0 ? ' hoja--hoy' : dif < 0 ? ' hoja--pasada' : '';
    const sub = esAtrasado(t)
      ? `<span class="meta meta--alerta">Atrasado</span>`
      : `<span class="meta">${dif === 0 ? 'Hoy · ' : dif === 1 ? 'Mañana · ' : ''}${duracion(t.agenda.inicio, t.agenda.fin)}</span>`;
    return `<div class="fecha">
      <span class="hoja${hoja}" aria-hidden="true"><span class="hoja__dia">${DIAS[d.getDay()]}</span><span class="hoja__num">${d.getDate()}</span><span class="hoja__mes">${MESES[d.getMonth()]}</span></span>
      <div class="cell-2"><span class="sr-only">${fmtFecha(t.agenda.fecha)}</span><span class="horario">${icon('clock')}${t.agenda.inicio}–${t.agenda.fin}</span>${sub}</div>
    </div>`;
  }

  function filaHTML(t) {
    const p = proyecto(t.proyectoId), a = acceso(t.accesoId);
    const open = state.abierto === t.id;
    const dir = `${t.ubicacion.calle} ${t.ubicacion.numero}`;
    return `<tr class="row${open ? ' is-open' : ''}" data-id="${t.id}">
      <td class="c-exp"><button type="button" class="icon-btn exp" aria-expanded="${open}" aria-controls="det-${t.id}" aria-label="Detalle de ${t.id}">${icon('chevron-right')}</button></td>
      <td>${fechaHTML(t)}</td>
      <td><div class="cell-2"><span class="cell-codigo" title="${esc(p.codigo)}">${esc(p.codigo)}</span><span class="meta">${esc(p.tipo)} · ${esc(p.segmento)}</span></div></td>
      <td title="${esc(dir)}">${esc(a.codigo)}</td>
      <td class="cell-cliente" title="${esc(p.razonSocial)}"><span>${esc(p.razonSocial)}</span></td>
      <td><div class="cell-2"><span title="${esc(t.ubicacion.comuna)}">${icon('map-pin', 'ic-inline')}${esc(t.ubicacion.comuna)}</span><span class="meta">${esc(t.zona)}</span></div></td>
      <td>${badgeEstado(t.estado)}</td>
      <td>${centroDe(t)}</td>
    </tr>`;
  }

  function filaSkeleton(i) {
    const w = [60, 80, 70, 90, 55, 75, 65, 85];
    const cel = (a, b) => `<td><span class="sk" style="width:${a}%"></span>${b ? `<span class="sk" style="width:${b}%"></span>` : ''}</td>`;
    return `<tr aria-hidden="true"><td></td>
      <td><div class="fecha"><span class="hoja hoja--sk"></span><span style="flex:1"><span class="sk" style="width:80%"></span><span class="sk" style="width:50%"></span></span></div></td>
      ${cel(w[i % 8], 90)}${cel(w[(i + 3) % 8], 50)}${cel(w[(i + 5) % 8])}${cel(60, 40)}${cel(70)}${cel(60)}</tr>`;
  }

  function filaEstado(tipo) {
    const E = {
      error: { cls: 'state--error', ic: 'alert-triangle', t: 'No pudimos cargar los trabajos',
        p: 'Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, avisa a soporte.',
        b: `<button type="button" class="btn btn--secondary" data-action="reintentar">${icon('refresh')}Reintentar</button>` },
      vacio: { cls: '', ic: 'inbox', t: 'Aún no hay trabajos registrados',
        p: 'Crea el primer trabajo a partir de un proyecto de GetBacklog y sus accesos.',
        b: `<button type="button" class="btn btn--primary" data-action="nuevo">${icon('plus')}Nuevo trabajo</button>` },
      sin: { cls: '', ic: 'search', t: 'Ningún trabajo coincide con los filtros',
        p: 'Prueba con otra búsqueda o amplía el rango de fechas.',
        b: `<button type="button" class="btn btn--secondary" data-action="limpiar">Limpiar filtros</button>` }
    }[tipo];
    return `<tr class="state-row"><td colspan="8"><div class="state ${E.cls}">
      <span class="state__icon">${icon(E.ic)}</span>
      <h2 class="body-base-bold">${E.t}</h2><p>${E.p}</p>${E.b}</div></td></tr>`;
  }

  function renderTabla() {
    // El detalle abierto se conserva (con sus cambios) si la fila sigue visible
    const det = state.abierto ? document.getElementById('det-' + state.abierto) : null;
    if (det) det.remove();
    $('.table').setAttribute('aria-busy', String(state.cargando));

    if (state.cargando) {
      tbody.innerHTML = Array.from({ length: 9 }, (_, i) => filaSkeleton(i)).join('');
      state.visibles = [];
    } else if (state.error) {
      tbody.innerHTML = filaEstado('error');
      state.visibles = [];
    } else if (!state.trabajos.length) {
      tbody.innerHTML = filaEstado('vacio');
      state.visibles = [];
    } else {
      state.visibles = visibles();
      tbody.innerHTML = state.visibles.length ? state.visibles.map(filaHTML).join('') : filaEstado('sin');
    }

    if (state.abierto) {
      const row = filaEl(state.abierto);
      if (row) row.after(det || crearDetalle(byId(state.abierto)));
      else state.abierto = null;
    }
    renderPie();
  }

  function renderPie() {
    const foot = $('#table-foot');
    if (state.cargando) { foot.textContent = 'Cargando trabajos…'; return; }
    if (state.error) { foot.textContent = ''; return; }
    foot.innerHTML = `<span>Mostrando <strong>${state.visibles.length}</strong> de ${state.trabajos.length} trabajos · ordenados por fecha</span>
      <span>Proyectos: GetBacklog · Accesos: Base de Accesos</span>`;
  }

  function refrescarFila(id) {
    const old = filaEl(id);
    if (!old) return;
    const tmp = document.createElement('tbody');
    tmp.innerHTML = filaHTML(byId(id));
    old.replaceWith(tmp.firstElementChild);
  }

  function renderTodo() {
    renderKPIs();
    renderTabla();
    renderRangos();
    renderEnvio();
  }

  /* ------------------------------------------------------------------------
     8. Próximo envío automático
     El sistema envía la cola todos los días a la hora de corte. La cola son
     los trabajos validados, agendados o pospuestos aún no cargados (no
     depende de los filtros de la tabla).
     ------------------------------------------------------------------------ */
  const HORA_CORTE = '08:00';
  const corteTxt = HORA_CORTE.replace(/^0/, '');
  const enCola = () => state.trabajos.filter(esCargable);
  const borradoresPendientes = () => state.trabajos.filter(t => t.estado === 'borrador' && t.centro.estado === 'sin_enviar');
  // Antes de la hora de corte el próximo envío es hoy; después, mañana
  const proximoEnvio = () => `${horaActual() < HORA_CORTE ? 'hoy' : 'mañana'} ${corteTxt}`;

  function renderEnvio() {
    const box = $('#envio');
    if (state.cargando || state.error) { box.hidden = true; return; }
    box.hidden = false;
    const n = enCola().length;
    $('#envio-text').innerHTML = `Próximo envío: <strong>${proximoEnvio()}</strong> · ` + (n
      ? `<button type="button" class="btn-link" data-action="ver-cola">${n} ${plural(n, 'trabajo listo', 'trabajos listos')}</button>`
      : 'no hay trabajos en cola');
    $('#btn-enviar').disabled = !n && !borradoresPendientes().length;
  }

  /* ------------------------------------------------------------------------
     9. Detalle en acordeón (editable)
     ------------------------------------------------------------------------ */
  const tocados = new WeakMap(); // form → Set de campos tocados

  function avisoCentro(t) {
    if (t.centro.estado === 'error') {
      const reintento = esCargable(t) ? ` Se reintentará en el próximo envío (${proximoEnvio()}), o envíalo ahora.` : '';
      return `<div class="alert alert--error" role="alert">${icon('alert-triangle')}<div><strong>No se pudo cargar en el Centro de operaciones.</strong> ${esc(t.centro.mensaje)} Corrige los datos si corresponde.${reintento}</div></div>`;
    }
    if (t.centro.estado === 'sin_enviar' && t.centro.mensaje) {
      const cuando = esCargable(t) ? ` Se actualizará en Agenda de Red en el próximo envío (${proximoEnvio()}).` : '';
      return `<div class="alert alert--warning">${icon('alert-circle')}<div><strong>Hay cambios sin enviar.</strong> Este trabajo cambió después del último envío.${cuando}</div></div>`;
    }
    return '';
  }
  function metaCentro(t) {
    const s = estadoCentro(t);
    const extra = s === 'en_cola' ? `sale ${proximoEnvio()}`
      : t.centro.fecha && s !== 'en_proceso' ? fmtMarca(t.centro.fecha) : '';
    return `Centro de operaciones: ${centroDe(t)}${extra ? ` <span>· ${extra}</span>` : ''}`;
  }
  // Envío manual de un trabajo desde su detalle (solo si entraría a la cola)
  function enviarUnoHTML(t) {
    if (t.centro.estado === 'en_proceso') return `<button type="button" class="btn btn--secondary" disabled>${icon('loader', 'spin')}Enviando…</button>`;
    return esCargable(t) ? `<button type="button" class="btn btn--secondary" data-action="enviar-uno">${icon('send')}Enviar ahora</button>` : '';
  }

  function crearDetalle(t) {
    const tmp = document.createElement('tbody');
    tmp.innerHTML = detalleHTML(t);
    const tr = tmp.firstElementChild;
    const form = $('form', tr);
    form.dataset.orig = serializar(form);
    tocados.set(form, new Set());
    actualizarNotasContacto(form);
    return tr;
  }

  // Valores de solo lectura: vacío = SIN DATO; coordenadas con coma decimal
  const dato = v => v ? esc(v) : '<span class="sin-dato">SIN DATO</span>';
  const coordTxt = v => Number(v || 0).toFixed(6).replace('.', ',');

  function detalleHTML(t) {
    const p = proyecto(t.proyectoId), a = acceso(t.accesoId), idp = 'd-' + t.id;
    return `<tr class="detail-row" id="det-${t.id}"><td colspan="8">
    <form class="detail" data-id="${t.id}" novalidate aria-label="Detalle de ${t.id}">
      <div class="detail__panel" tabindex="-1">
        <div data-slot="aviso">${avisoCentro(t)}</div>
        <div class="detail__grid">
          <fieldset class="detail__section">
            <legend>${icon('info')}Información general</legend>
            <dl class="dl dl--2">
              <div class="dl__full"><dt>Proyecto</dt><dd>${esc(p.codigo)}</dd></div>
              <div class="dl__full"><dt>Razón social</dt><dd>${esc(p.razonSocial)}</dd></div>
              <div><dt>Acceso</dt><dd>${esc(a.codigo)}</dd></div>
              <div><dt>Segmento</dt><dd>${esc(p.segmento)}</dd></div>
              <div><dt>Tipo de trabajo</dt><dd>${esc(p.tipo)}</dd></div>
              <div><dt>Topología</dt><dd>${esc(p.topologia)}</dd></div>
              <div><dt>Agencia</dt><dd>${dato(p.agencia === 'SIN DATO' ? '' : p.agencia)}</dd></div>
            </dl>
          </fieldset>
          <fieldset class="detail__section">
            <legend>${icon('user')}Contacto</legend>
            <p class="field__hint">Viene de la Base de Accesos. Si lo cambias, el cambio queda solo en este trabajo.</p>
            ${campo({ idp, k: 'c_nombre', label: 'Nombre de contacto', valor: t.contacto.nombre, req: true, origen: a.contacto.nombre, attrs: 'autocomplete="off"' })}
            ${campo({ idp, k: 'c_telefono', label: 'Teléfono', tipo: 'tel', valor: t.contacto.telefono, req: true, origen: a.contacto.telefono, attrs: 'placeholder="939412174" inputmode="tel"' })}
            ${campo({ idp, k: 'c_correo', label: 'Correo', tipo: 'email', valor: t.contacto.correo, origen: a.contacto.correo, attrs: 'placeholder="nombre@empresa.cl"' })}
          </fieldset>
          <fieldset class="detail__section">
            <legend>${icon('map-pin')}Ubicación</legend>
            <dl class="dl dl--2">
              <div><dt>Comuna</dt><dd>${dato(t.ubicacion.comuna)}</dd></div>
              <div><dt>Región</dt><dd>${dato(t.ubicacion.region)}</dd></div>
              <div><dt>Calle</dt><dd>${dato(t.ubicacion.calle)}</dd></div>
              <div><dt>Número de calle</dt><dd>${dato(t.ubicacion.numero)}</dd></div>
              <div><dt>Latitud</dt><dd>${coordTxt(t.ubicacion.lat)}</dd></div>
              <div><dt>Longitud</dt><dd>${coordTxt(t.ubicacion.lon)}</dd></div>
            </dl>
          </fieldset>
          <fieldset class="detail__section">
            <legend>${icon('calendar-clock')}Agendamiento</legend>
            ${campo({ idp, k: 'a_fecha', label: 'Fecha', tipo: 'date', valor: t.agenda.fecha, req: true })}
            <div class="row-2">
              ${campo({ idp, k: 'a_inicio', label: 'Hora inicio', tipo: 'time', valor: t.agenda.inicio, req: true })}
              ${campo({ idp, k: 'a_fin', label: 'Hora fin', tipo: 'time', valor: t.agenda.fin, req: true })}
            </div>
            ${campo({ idp, k: 'estado', label: 'Estado', tipo: 'select', opciones: OPC_ESTADOS, valor: t.estado, req: true })}
            <div class="row-2">
              ${campo({ idp, k: 'a_zona', label: 'Zona', tipo: 'select', opciones: OPC_ZONAS, valor: t.zona, req: true })}
              ${campo({ idp, k: 'a_cluster', label: 'Cluster', tipo: 'select', opciones: OPC_CLUSTERS, valor: t.cluster, req: true })}
            </div>
            ${campo({ idp, k: 'comentario', label: 'Comentario', tipo: 'textarea', valor: t.comentario, placeholder: 'Indicaciones para el equipo en terreno, motivo de postergación, etc.' })}
          </fieldset>
        </div>
        <div class="detail__foot">
          <div class="detail__meta">
            <span>Última modificación: <strong>${esc(t.modificado.usuario)}</strong> · ${fmtMarca(t.modificado.fecha)}</span>
            <button type="button" class="btn-link" data-action="historial" aria-expanded="${state.historialAbierto.has(t.id)}" aria-controls="hist-${t.id}">
              ${icon('history')}Ver historial (${(t.historial || []).length})</button>
            <span data-slot="centro">${metaCentro(t)}</span>
          </div>
          <div class="detail__actions">
            <button type="button" class="btn btn--danger-ghost solo-jefatura" data-action="eliminar">${icon('trash')}Eliminar</button>
            <span class="detail__sep solo-jefatura" aria-hidden="true"></span>
            <span class="dirty-note" data-slot="dirty" hidden>${icon('alert-circle')}Cambios sin guardar</span>
            <button type="button" class="btn btn--ghost" data-action="descartar" disabled>Descartar</button>
            <span data-slot="enviar">${enviarUnoHTML(t)}</span>
            <button type="submit" class="btn btn--primary" data-action="guardar" disabled>Guardar cambios</button>
          </div>
        </div>
        ${historialHTML(t)}
      </div>
    </form></td></tr>`;
  }

  /* --- Historial de cambios -------------------------------------------- */
  const CAMPOS = {
    fecha: 'Fecha', inicio: 'Hora inicio', fin: 'Hora fin', estado: 'Estado', zona: 'Zona', cluster: 'Cluster',
    comentario: 'Comentario', c_nombre: 'Nombre de contacto', c_telefono: 'Teléfono', c_correo: 'Correo'
  };
  function valorHist(campo, v) {
    if (!v) return '<span class="sin-dato">vacío</span>';
    if (campo === 'fecha') return esc(fmtFecha(v));
    if (campo === 'estado') return esc(ESTADOS[v] ? ESTADOS[v].label : v);
    return esc(v);
  }
  function historialHTML(t) {
    const items = (t.historial || []).slice().reverse(); // lo más reciente primero
    const filas = items.map(c => {
      const [f, hora] = c.fecha.split('T');
      return `<tr><td>${fmtFecha(f)}, ${hora}</td><td>${esc(c.usuario)}</td><td>${esc(CAMPOS[c.campo] || c.campo)}</td>
        <td><span class="hist__cambio"><span class="hist__antes" title="${esc(c.antes)}">${valorHist(c.campo, c.antes)}</span>${icon('arrow-right')}<span class="hist__despues" title="${esc(c.despues)}">${valorHist(c.campo, c.despues)}</span></span></td></tr>`;
    }).join('');
    return `<section class="historial" id="hist-${t.id}" aria-label="Historial de cambios de ${t.id}"${state.historialAbierto.has(t.id) ? '' : ' hidden'}>
      <h3 class="historial__title">${icon('history')}Historial de cambios</h3>
      ${items.length ? `<table class="hist"><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Campo</th><th>Valor anterior → nuevo</th></tr></thead><tbody>${filas}</tbody></table>`
        : '<p class="text-tertiary">Aún no hay cambios registrados para este trabajo.</p>'}
    </section>`;
  }
  // Registra cada campo que cambió, con la misma fecha y usuario
  function registrarCambios(t, pares) {
    const fecha = ahora();
    const nuevos = pares.filter(([, antes, despues]) => (antes || '') !== (despues || ''))
      .map(([campo, antes, despues]) => ({ fecha, usuario: USUARIO, campo, antes: antes || '', despues: despues || '' }));
    t.historial = (t.historial || []).concat(nuevos);
    return nuevos.length;
  }

  /* --- Contacto: aviso cuando difiere de la Base de Accesos ------------ */
  function actualizarNotasContacto(form) {
    $$('.field__note[data-origen]', form).forEach(n => {
      const input = n.closest('.field').querySelector('input');
      const origen = n.dataset.origen;
      const distinto = input.value.trim() !== origen;
      n.hidden = !distinto;
      n.innerHTML = distinto ? `${icon('alert-circle')}<span>Distinto de la Base de Accesos (${origen ? esc(origen) : 'vacío'}).</span>` : '';
    });
  }

  function refrescarSlotsDetalle(id) {
    const det = document.getElementById('det-' + id);
    if (!det) return;
    const t = byId(id);
    $('[data-slot="centro"]', det).innerHTML = metaCentro(t);
    $('[data-slot="aviso"]', det).innerHTML = avisoCentro(t);
    $('[data-slot="enviar"]', det).innerHTML = enviarUnoHTML(t);
  }

  function abrirDetalle(id) {
    const row = filaEl(id);
    if (!row) return;
    state.abierto = id;
    row.classList.add('is-open');
    $('.exp', row).setAttribute('aria-expanded', 'true');
    const det = crearDetalle(byId(id));
    row.after(det);
    // Desplaza lo justo para ver el detalle sin perder la fila bajo el encabezado fijo
    const sc = $('#main');
    const sr = sc.getBoundingClientRect(), dr = det.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const sobra = dr.bottom - sr.bottom;
    if (sobra > 0) sc.scrollBy({ top: Math.min(sobra + 12, rr.top - sr.top - 40), behavior: 'smooth' });
  }

  function cerrarDetalle() {
    const id = state.abierto;
    if (!id) return true;
    const det = document.getElementById('det-' + id);
    const form = det && $('form', det);
    if (form && form.dataset.dirty === '1' && !confirm(`Tienes cambios sin guardar en ${id}. ¿Quieres descartarlos?`)) return false;
    if (det) det.remove();
    state.abierto = null;
    const row = filaEl(id);
    if (row) {
      row.classList.remove('is-open');
      $('.exp', row).setAttribute('aria-expanded', 'false');
    }
    return true;
  }

  function toggleDetalle(id) {
    if (state.abierto === id) { cerrarDetalle(); return; }
    if (!cerrarDetalle()) return;
    abrirDetalle(id);
  }

  function modoDe(d) { return d.estado === 'borrador' ? 'borrador' : 'completo'; }

  function actualizarDirty(form) {
    const dirty = serializar(form) !== form.dataset.orig;
    form.dataset.dirty = dirty ? '1' : '0';
    $('[data-slot="dirty"]', form).hidden = !dirty;
    $('[data-action="descartar"]', form).disabled = !dirty;
    $('[data-action="guardar"]', form).disabled = !dirty;
  }

  function validarEnVivo(form) {
    const d = leer(form);
    const t = byId(form.dataset.id);
    if (t && t.agenda.fecha === d.a_fecha && t.agenda.inicio === d.a_inicio) d._original_inicio_hoy = true;
    const errs = validar(d, modoDe(d));
    mostrarErrores(form, errs, form.dataset.enviado ? null : tocados.get(form));
    return errs;
  }

  function guardarDetalle(form) {
    form.dataset.enviado = '1';
    const errs = validarEnVivo(form);
    const n = Object.keys(errs).length;
    if (n) {
      enfocarPrimerError(form);
      toast(`Revisa ${n} ${plural(n, 'campo', 'campos')} antes de guardar.`, 'error');
      return;
    }
    const id = form.dataset.id, t = byId(id), d = leer(form);
    const contacto = { nombre: d.c_nombre.trim(), telefono: d.c_telefono.trim(), correo: d.c_correo.trim() };
    registrarCambios(t, [
      ['fecha', t.agenda.fecha, d.a_fecha], ['inicio', t.agenda.inicio, d.a_inicio], ['fin', t.agenda.fin, d.a_fin],
      ['estado', t.estado, d.estado], ['zona', t.zona, d.a_zona], ['cluster', t.cluster, d.a_cluster],
      ['comentario', t.comentario, d.comentario.trim()],
      ['c_nombre', t.contacto.nombre, contacto.nombre], ['c_telefono', t.contacto.telefono, contacto.telefono], ['c_correo', t.contacto.correo, contacto.correo]
    ]);
    Object.assign(t, {
      contacto,
      agenda: { fecha: d.a_fecha, inicio: d.a_inicio, fin: d.a_fin },
      estado: d.estado,
      zona: d.a_zona,
      cluster: d.a_cluster,
      comentario: d.comentario.trim(),
      modificado: { usuario: USUARIO, fecha: ahora() }
    });
    // Un trabajo ya cargado que cambia vuelve a la cola del próximo envío
    if (t.centro.estado === 'cargado') t.centro = { estado: 'sin_enviar', mensaje: 'Modificado después del último envío.', fecha: t.centro.fecha };
    else if (t.centro.estado === 'error') t.centro = { estado: 'sin_enviar', mensaje: '', fecha: t.centro.fecha };

    refrescarFila(id);
    const nuevoDet = crearDetalle(t);
    document.getElementById('det-' + id).replaceWith(nuevoDet);
    $('.detail__panel', nuevoDet).focus({ preventScroll: true });
    renderEnvio();
    renderKPIs();
    toast(esCargable(t) ? `${id} actualizado. Sale en el próximo envío (${proximoEnvio()}).` : `${id} actualizado.`);
  }

  /* ------------------------------------------------------------------------
     10. Nuevo trabajo (GetBacklog + Base de Accesos)
     ------------------------------------------------------------------------ */
  const dlgNuevo = $('#dlg-nuevo');
  const formNuevo = $('#form-nuevo');
  const cbInput = $('#cb-input'), cbList = $('#cb-list');
  const nuevo = { proyecto: null, accesos: [], token: 0, opciones: [], activo: -1, enviado: false, tocados: new Set() };

  function abrirNuevo() {
    formNuevo.reset();
    Object.assign(nuevo, { proyecto: null, accesos: [], opciones: [], activo: -1, enviado: false, tocados: new Set(), modo: null });
    $('#nuevo-campos').innerHTML = [
      campo({ idp: 'n', k: 'a_fecha', label: 'Fecha', tipo: 'date', valor: '', req: true, attrs: `min="${HOY}"` }),
      campo({ idp: 'n', k: 'a_inicio', label: 'Hora inicio', tipo: 'time', valor: '', req: true }),
      campo({ idp: 'n', k: 'a_fin', label: 'Hora fin', tipo: 'time', valor: '', req: true }),
      campo({ idp: 'n', k: 'comentario', label: 'Comentario', tipo: 'textarea', valor: '', span: 'span4', placeholder: 'Indicaciones para el equipo en terreno (opcional)' })
    ].join('');
    mostrarProyectoBuscador();
    pintarAccesos('vacio');
    mostrarErrores(formNuevo, {});
    dlgNuevo.showModal();
    cbInput.focus();
  }

  function marcar(texto, q) {
    const i = norm(texto).indexOf(norm(q));
    if (!q || i < 0) return esc(texto);
    return esc(texto.slice(0, i)) + '<mark>' + esc(texto.slice(i, i + q.length)) + '</mark>' + esc(texto.slice(i + q.length));
  }
  function cerrarLista() {
    cbList.hidden = true;
    cbInput.setAttribute('aria-expanded', 'false');
    cbInput.removeAttribute('aria-activedescendant');
  }
  function pintarLista(modo, q) {
    cbList.hidden = false;
    cbInput.setAttribute('aria-expanded', 'true');
    if (modo === 'cargando') {
      cbList.innerHTML = `<li class="listbox__info">${icon('loader', 'spin')}Buscando en GetBacklog…</li>`;
      cbInput.removeAttribute('aria-activedescendant');
      return;
    }
    const ops = nuevo.opciones;
    if (!ops.length) {
      cbList.innerHTML = `<li class="listbox__info">Sin proyectos para “${esc(q)}”. Revisa el código o la razón social.</li>`;
      $('#cb-status').textContent = 'Sin resultados';
      cbInput.removeAttribute('aria-activedescendant');
      return;
    }
    cbList.innerHTML = ops.map((p, i) => `<li role="option" id="cb-opt-${i}" data-i="${i}" aria-selected="${i === nuevo.activo}">
      <span class="body-small-bold">${marcar(p.codigo, q)}</span><span>${marcar(p.razonSocial, q)}</span><span class="meta">${esc(p.tipo)} · ${marcar(p.segmento, q)} · ${esc(p.topologia)}</span></li>`).join('');
    $('#cb-status').textContent = `${ops.length} ${plural(ops.length, 'proyecto encontrado', 'proyectos encontrados')}`;
    moverActivo(nuevo.activo);
  }
  function moverActivo(i) {
    nuevo.activo = i;
    $$('[role="option"]', cbList).forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    const li = $('#cb-opt-' + i);
    if (li) { cbInput.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
  }
  const buscar = debounce(async () => {
    const q = cbInput.value.trim();
    if (q.length < 2) { cerrarLista(); return; }
    const token = ++nuevo.token;
    pintarLista('cargando');
    const res = await Mocks.buscarProyectos(q);
    if (token !== nuevo.token) return; // llegó una búsqueda más nueva
    nuevo.opciones = res;
    nuevo.activo = res.length ? 0 : -1;
    pintarLista('ok', q);
  }, 250);

  function mostrarProyectoBuscador() {
    $('#cb-wrap').hidden = false;
    $('#cb-selected').hidden = true;
    cbInput.value = '';
    cerrarLista();
  }
  function elegirProyecto(p) {
    nuevo.proyecto = p;
    cerrarLista();
    $('#cb-wrap').hidden = true;
    const sel = $('#cb-selected');
    sel.hidden = false;
    sel.innerHTML = `${icon('building')}<div class="cell-2"><span class="body-small-bold">${esc(p.codigo)} · ${esc(p.razonSocial)}</span><span class="meta">${esc(p.tipo)} · ${esc(p.segmento)} · ${esc(p.topologia)} · ${esc(p.agencia)}</span></div>
      <button type="button" class="btn btn--ghost btn--sm" data-action="cambiar-proyecto" aria-label="Cambiar proyecto ${esc(p.codigo)}">Cambiar</button>`;
    mostrarErrores(formNuevo, {}, new Set(['proyecto']));
    $('[data-action="cambiar-proyecto"]', sel).focus();
    cargarAccesos(p.id);
  }

  function pintarAccesos(modo) {
    const box = $('#accesos-list');
    if (modo === 'vacio') {
      box.innerHTML = '<p class="accesos__empty text-tertiary">Elige un proyecto para ver sus accesos.</p>';
    } else if (modo === 'cargando') {
      box.innerHTML = Array.from({ length: 2 }, () => `<div class="acc acc--sk" aria-hidden="true"><span class="sk" style="width:16px;height:16px"></span><span><span class="sk" style="width:60%"></span><span class="sk" style="width:85%"></span></span></div>`).join('') +
        '<span class="sr-only" role="status">Cargando accesos desde la Base de Accesos</span>';
    } else if (!nuevo.accesos.length) {
      box.innerHTML = '<p class="accesos__empty text-tertiary">Este proyecto no tiene accesos en la Base de Accesos.</p>';
    } else {
      box.innerHTML = nuevo.accesos.map(a => {
        const activos = state.trabajos.filter(t => t.accesoId === a.id && !['cancelado', 'ejecutado'].includes(t.estado)).length;
        return `<label class="acc"><input type="checkbox" name="accesos" value="${a.id}"${nuevo.accesos.length === 1 ? ' checked' : ''}>
          <span class="acc__body"><span class="body-small-bold">Acceso ${esc(a.codigo)}</span>
          <span class="meta">${esc(a.calle)} ${esc(a.numero)}, ${esc(a.comuna)} · ${esc(a.zona)} · ${esc(a.cluster)}</span>
          ${activos ? `<span class="tag">Ya tiene ${activos} ${plural(activos, 'trabajo abierto', 'trabajos abiertos')}</span>` : ''}</span></label>`;
      }).join('');
    }
  }
  async function cargarAccesos(pid) {
    nuevo.accesos = [];
    pintarAccesos('cargando');
    const res = await Mocks.obtenerAccesos(pid);
    if (!nuevo.proyecto || nuevo.proyecto.id !== pid) return;
    nuevo.accesos = res;
    pintarAccesos('ok');
  }

  function validarNuevo(modo) {
    const d = leer(formNuevo);
    const errs = validar(d, modo);
    if (!nuevo.proyecto) errs.proyecto = 'Busca y elige un proyecto.';
    else if (!$$('input[name="accesos"]:checked', formNuevo).length) errs.accesos = 'Selecciona al menos un acceso.';
    return errs;
  }
  function crearTrabajos(modo) {
    const d = leer(formNuevo);
    const ids = $$('input[name="accesos"]:checked', formNuevo).map(i => i.value);
    let n = Math.max(1045, ...state.trabajos.map(t => Number(t.id.split('-')[1])));
    const estado = modo === 'borrador' ? 'borrador' : 'validado';
    const creados = ids.map(aid => {
      const a = nuevo.accesos.find(x => x.id === aid);
      n++;
      return {
        id: `TR-${n}`, proyectoId: nuevo.proyecto.id, accesoId: aid,
        contacto: Object.assign({}, a.contacto),
        ubicacion: { calle: a.calle, numero: a.numero, comuna: a.comuna, region: a.region, lat: a.lat, lon: a.lon },
        agenda: { fecha: d.a_fecha, inicio: d.a_inicio, fin: d.a_fin },
        estado, zona: a.zona, cluster: a.cluster,
        comentario: d.comentario.trim(),
        centro: { estado: 'sin_enviar', mensaje: '', fecha: '' },
        modificado: { usuario: USUARIO, fecha: ahora() }
      };
    });
    state.trabajos.push(...creados);
    dlgNuevo.close();
    renderTodo();
    const filas = creados.map(t => filaEl(t.id)).filter(Boolean);
    filas.forEach(r => r.classList.add('is-new'));
    if (filas[0]) filas[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    const txt = `${creados.length} ${plural(creados.length, 'trabajo creado', 'trabajos creados')} como ${ESTADOS[estado].label.toLowerCase()}`;
    const cola = estado === 'validado' ? ` Saldrán en el próximo envío (${proximoEnvio()}).` : '';
    toast((filas.length < creados.length ? `${txt}. Algunos no se ven con los filtros actuales.` : `${txt}.`) + cola);
  }

  /* ------------------------------------------------------------------------
     11. Envío al Centro de operaciones (RPA simulado)
     Automático: el sistema envía la cola cada día a la hora de corte.
     Manual: "Enviar ahora" adelanta el envío de toda la cola (con revisión
     previa) o de un solo trabajo desde su detalle.
     fases del diálogo: revision → enviando → resultado (→ enviando, al reintentar)
     ------------------------------------------------------------------------ */
  const dlgCarga = $('#dlg-carga');
  const carga = { fase: 'revision', lista: [], excluidos: [], res: {}, lote: [], hechos: 0 };

  // Si el detalle abierto tiene cambios sin guardar, se pide guardarlos antes de enviar
  function hayCambiosSinGuardar() {
    const det = state.abierto && document.getElementById('det-' + state.abierto);
    const form = det && $('form', det);
    if (!form || form.dataset.dirty !== '1') return false;
    toast(`Guarda o descarta los cambios de ${state.abierto} antes de enviar.`, 'error');
    $('[data-action="guardar"]', form).focus();
    return true;
  }

  function abrirCarga() {
    if (hayCambiosSinGuardar()) return;
    const lista = enCola(), borradores = borradoresPendientes();
    if (!lista.length && !borradores.length) { toast('No hay trabajos en cola para enviar.', 'info'); return; }
    Object.assign(carga, { fase: 'revision', lista, excluidos: borradores, res: {}, lote: [], hechos: 0 });
    pintarCarga();
    dlgCarga.showModal();
    const btn = $('#carga-foot .btn--primary');
    if (btn) btn.focus();
  }

  function resHTML(t) {
    const r = carga.res[t.id];
    if (carga.fase === 'revision') {
      return centroHTML('en_cola') + (t.centro.estado === 'error' ? `<p class="meta">Falló el envío anterior.</p>`
        : t.centro.mensaje ? `<p class="meta">Actualiza un trabajo ya cargado.</p>` : '');
    }
    if (!r) return carga.lote.includes(t) ? centroHTML('en_proceso', 'Enviando…') : centroDe(t);
    return r.ok ? centroHTML('cargado')
      : centroHTML('error', 'Error') + `<p class="res-msg">${esc(r.mensaje)}</p>`;
  }

  function tablaCarga() {
    return `<table class="carga-list"><thead><tr><th class="col-id">ID</th><th>Proyecto · Acceso</th><th class="col-f">Fecha</th><th class="col-res">Resultado</th></tr></thead><tbody>` +
      carga.lista.map(t => {
        const p = proyecto(t.proyectoId), a = acceso(t.accesoId);
        return `<tr id="cg-${t.id}"><td class="cell-id">${t.id}</td>
          <td><div class="cell-2"><span>${esc(p.codigo)} · Acceso ${esc(a.codigo)}</span><span class="meta">${esc(p.razonSocial)}</span></div></td>
          <td><div class="cell-2"><span>${fmtFecha(t.agenda.fecha)}</span><span class="meta">${t.agenda.inicio}–${t.agenda.fin}</span></div></td>
          <td data-res>${resHTML(t)}</td></tr>`;
      }).join('') + '</tbody></table>';
  }
  // Borradores: no entran a la cola hasta validarlos (se puede hacer aquí mismo)
  function excluidosHTML(abierto) {
    if (!carga.excluidos.length) return '';
    const m = carga.excluidos.length;
    return `<details class="excluded"${abierto ? ' open' : ''}><summary>${m} ${plural(m, 'borrador no se enviará', 'borradores no se enviarán')}</summary><ul>` +
      carga.excluidos.map(t => `<li id="ex-${t.id}"><span class="cell-id">${t.id}</span><span>${badgeEstado(t.estado)}</span>
        <span class="excluded__motivo text-tertiary">${motivoExclusion(t)}</span>
        ${t.estado === 'borrador' ? `<button type="button" class="btn btn--secondary btn--sm" data-action="validar-borrador" data-id="${t.id}">${icon('shield-check')}Validar y agregar</button>` : ''}</li>`).join('') +
      '</ul></details>';
  }

  function pintarCarga() {
    const body = $('#carga-body'), foot = $('#carga-foot');
    const n = carga.lista.length;
    $$('[data-close]', dlgCarga).forEach(b => { b.disabled = carga.fase === 'enviando'; });

    if (carga.fase === 'revision') {
      body.innerHTML = n
        ? `<p>Se adelanta el envío de las ${corteTxt}: <strong>${n} ${plural(n, 'trabajo', 'trabajos')}</strong> en cola. El RPA genera el Excel consolidado y lo carga en Agenda de Red.</p>${tablaCarga()}${excluidosHTML(false)}`
        : `<div class="alert alert--warning">${icon('alert-circle')}<div><strong>No hay trabajos en cola.</strong> Solo se envían trabajos validados, agendados o pospuestos que aún no estén cargados. Valida un borrador para agregarlo.</div></div>${excluidosHTML(true)}`;
      foot.innerHTML = `<p class="body-xsmall text-tertiary">Si no lo envías ahora, sale solo ${proximoEnvio()}.</p>
        <div class="dialog__actions">${n
          ? `<button type="button" class="btn btn--ghost" data-close>Cancelar</button><button type="button" class="btn btn--primary" data-action="enviar">${icon('send')}Enviar ${n} ahora</button>`
          : `<button type="button" class="btn btn--primary" data-close>Entendido</button>`}</div>`;
      return;
    }

    if (carga.fase === 'enviando') {
      const total = carga.lote.length;
      body.innerHTML = `<div class="progress" role="status" aria-live="polite">
          <div class="body-small-bold" id="prog-text">Enviando ${carga.hechos} de ${total}…</div>
          <div class="progress__track" role="progressbar" aria-labelledby="prog-text" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${carga.hechos}"><div class="progress__fill" style="width:${(carga.hechos / total) * 100}%"></div></div>
        </div>${tablaCarga()}`;
      foot.innerHTML = `<p class="body-xsmall text-tertiary">No cierres esta ventana mientras el RPA trabaja.</p>
        <div class="dialog__actions"><button type="button" class="btn btn--primary" disabled>${icon('loader', 'spin')}Enviando…</button></div>`;
      return;
    }

    const ok = carga.lista.filter(t => carga.res[t.id] && carga.res[t.id].ok).length;
    const err = carga.lista.filter(t => carga.res[t.id] && !carga.res[t.id].ok).length;
    const aviso = err
      ? `<div class="alert alert--warning">${icon('alert-triangle')}<div><strong>${err} ${plural(err, 'trabajo no se cargó', 'trabajos no se cargaron')}.</strong> Puedes reintentar ahora o dejarlos para el próximo envío (${proximoEnvio()}).</div></div>`
      : `<div class="alert alert--success">${icon('circle-check')}<div><strong>Envío completo.</strong> ${plural(ok, 'El trabajo quedó cargado', `Los ${ok} trabajos quedaron cargados`)} en Agenda de Red.</div></div>`;
    body.innerHTML = `<div class="summary">
        <div class="summary__item"><div class="summary__n">${ok}</div><div class="centro centro--cargado">${icon('check')}${plural(ok, 'Cargado', 'Cargados')}</div></div>
        <div class="summary__item"><div class="summary__n">${err}</div><div class="centro centro--error">${icon('alert-triangle')}Con error</div></div>
      </div>${aviso}${tablaCarga()}${excluidosHTML(false)}`;
    foot.innerHTML = `<p class="body-xsmall text-tertiary">Resultado del RPA · ${fmtMarca(ahora())}</p>
      <div class="dialog__actions">${err
        ? `<button type="button" class="btn btn--secondary" data-close>Cerrar</button><button type="button" class="btn btn--primary" data-action="reintentar-carga">${icon('refresh')}Reintentar ${err} ${plural(err, 'fallido', 'fallidos')}</button>`
        : `<button type="button" class="btn btn--primary" data-close>Listo</button>`}</div>`;
  }

  // Marca el lote como "enviando", llama al RPA y aplica cada resultado
  async function enviarLote(lote, reintento, alResultado) {
    lote.forEach(t => {
      t.centro = Object.assign({}, t.centro, { estado: 'en_proceso' });
      refrescarFila(t.id);
      refrescarSlotsDetalle(t.id);
    });
    renderEnvio();
    const res = await Mocks.enviarACentro(lote.map(t => ({ id: t.id })), r => {
      const t = byId(r.id);
      if (!t) return; // eliminado mientras se enviaba
      t.centro = r.ok ? { estado: 'cargado', mensaje: '', fecha: ahora() } : { estado: 'error', mensaje: r.mensaje, fecha: ahora() };
      refrescarFila(t.id);
      refrescarSlotsDetalle(t.id);
      if (alResultado) alResultado(r, t);
    }, { reintento });
    renderEnvio();
    return res;
  }

  async function enviarCarga(lote, reintento) {
    Object.assign(carga, { fase: 'enviando', lote, hechos: 0 });
    lote.forEach(t => { delete carga.res[t.id]; });
    pintarCarga();

    await enviarLote(lote, reintento, (r, t) => {
      carga.res[r.id] = r;
      carga.hechos++;
      const cell = $(`#cg-${r.id} [data-res]`);
      if (cell) cell.innerHTML = resHTML(t);
      const total = lote.length;
      $('#prog-text').textContent = `Enviando ${carga.hechos} de ${total}…`;
      $('.progress__fill').style.width = `${(carga.hechos / total) * 100}%`;
      $('.progress__track').setAttribute('aria-valuenow', carga.hechos);
    });

    carga.fase = 'resultado';
    pintarCarga();
    const btn = $('#carga-foot .btn--primary');
    if (btn) btn.focus();
    const err = lote.filter(t => !carga.res[t.id].ok).length;
    toast(err ? `Envío terminado con ${err} ${plural(err, 'error', 'errores')}.` : 'Envío al Centro de operaciones completado.', err ? 'error' : 'success');
  }

  // "Enviar ahora" desde el detalle: un solo trabajo, sin diálogo
  async function enviarUno(id) {
    if (hayCambiosSinGuardar()) return;
    const t = byId(id);
    if (!t || !esCargable(t)) return;
    const det = document.getElementById('det-' + id);
    if (det) $('.detail__panel', det).focus({ preventScroll: true }); // el botón se reemplaza mientras envía
    const [r] = await enviarLote([t], t.centro.estado === 'error');
    toast(r.ok ? `${id} quedó cargado en el Centro de operaciones.` : `${id} no se pudo cargar: ${r.mensaje}`, r.ok ? 'success' : 'error');
  }

  /* ------------------------------------------------------------------------
     12. Rol, eliminación y exportación
     ------------------------------------------------------------------------ */
  /* --- Rol simulado: una clase en <body> muestra u oculta acciones --- */
  function setRol(rol, avisar) {
    state.rol = rol;
    document.body.classList.toggle('rol-jefatura', rol === 'jefatura');
    $('#rol').value = rol;
    try { localStorage.setItem('agenda-rol', rol); } catch (e) { /* sin almacenamiento */ }
    if (avisar) toast(rol === 'jefatura' ? 'Rol Jefatura: puedes eliminar trabajos desde su detalle.' : 'Rol Gestor de proyectos.', 'info');
  }
  $('#rol').addEventListener('change', e => setRol(e.target.value, true));

  /* --- Eliminar (solo Jefatura): confirmación o bloqueo explicado --- */
  const dlgEliminar = $('#dlg-eliminar');
  function abrirEliminar(id) {
    if (state.rol !== 'jefatura') return;
    const t = byId(id), p = proyecto(t.proyectoId), a = acceso(t.accesoId);
    const resumen = `<dl class="dl dl--2 resumen">
        <div class="dl__full"><dt>Proyecto</dt><dd>${esc(p.codigo)} · ${esc(p.razonSocial)}</dd></div>
        <div><dt>Acceso</dt><dd>${esc(a.codigo)}</dd></div>
        <div><dt>Fecha</dt><dd>${fmtFecha(t.agenda.fecha)}, ${t.agenda.inicio}–${t.agenda.fin}</dd></div>
        <div><dt>Estado</dt><dd>${badgeEstado(t.estado)}</dd></div>
        <div><dt>Centro de operaciones</dt><dd>${centroDe(t)}</dd></div>
      </dl>`;
    const bloqueado = ['cargado', 'en_proceso'].includes(t.centro.estado);
    $('#dlg-eliminar-title').textContent = bloqueado ? `No se puede eliminar ${id}` : `¿Eliminar ${id}?`;
    if (bloqueado) {
      const motivo = t.centro.estado === 'en_proceso'
        ? 'Hay un envío al Centro de operaciones en curso para este trabajo. Espera el resultado antes de cualquier cambio.'
        : 'Este trabajo ya está cargado en Agenda de Red del Centro de operaciones. Si lo eliminas aquí, seguiría agendado allá sin registro en la plataforma.';
      $('#dlg-eliminar-body').innerHTML = `<div class="alert alert--warning">${icon('lock')}<div><strong>${motivo}</strong>${t.centro.estado === 'cargado' ? ' Para darlo de baja, cámbialo a Cancelado: saldrá en el próximo envío.' : ''}</div></div>${resumen}`;
      $('#dlg-eliminar-foot').innerHTML = `<div class="dialog__actions"><button type="button" class="btn btn--primary" data-close>Entendido</button></div>`;
    } else {
      $('#dlg-eliminar-body').innerHTML = `<p>El trabajo desaparece de la plataforma junto con su historial. Esta acción no se puede deshacer.</p>
        ${resumen}
        <p class="body-xsmall text-tertiary">${t.centro.estado === 'error' ? 'Su último envío al Centro de operaciones falló, así que no hay nada que dar de baja en Agenda de Red.' : 'Aún no se ha enviado al Centro de operaciones, así que no hay nada que dar de baja en Agenda de Red.'}</p>`;
      $('#dlg-eliminar-foot').innerHTML = `<div class="dialog__actions">
          <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
          <button type="button" class="btn btn--danger" data-action="confirmar-eliminar" data-id="${id}">${icon('trash')}Eliminar trabajo</button></div>`;
    }
    dlgEliminar.showModal();
    $('#dlg-eliminar-foot [data-close]').focus(); // el foco inicial es la opción segura
  }
  dlgEliminar.addEventListener('click', e => {
    const b = e.target.closest('[data-action="confirmar-eliminar"]');
    if (!b) return;
    const id = b.dataset.id;
    state.trabajos = state.trabajos.filter(t => t.id !== id);
    state.historialAbierto.delete(id);
    if (state.abierto === id) {
      const det = document.getElementById('det-' + id);
      if (det) det.remove();
      state.abierto = null;
    }
    dlgEliminar.close();
    renderTodo();
    toast(`${id} eliminado.`);
  });

  /* --- Exportar la vista filtrada a Excel --- */
  async function exportar() {
    const lista = state.visibles;
    if (!lista.length) { toast('No hay trabajos para exportar con los filtros actuales.', 'info'); return; }
    const btn = $('#btn-exportar');
    btn.disabled = true;
    btn.innerHTML = `${icon('loader', 'spin')}<span>Exportando…</span>`;
    const filas = lista.map(t => {
      const p = proyecto(t.proyectoId), a = acceso(t.accesoId);
      return {
        'ID': t.id, 'Proyecto': p.codigo, 'Razón social': p.razonSocial, 'Segmento': p.segmento,
        'Tipo de trabajo': p.tipo, 'Topología': p.topologia, 'Agencia': p.agencia, 'Acceso': a.codigo,
        'Calle': t.ubicacion.calle, 'Número': t.ubicacion.numero, 'Comuna': t.ubicacion.comuna, 'Región': t.ubicacion.region,
        'Latitud': t.ubicacion.lat, 'Longitud': t.ubicacion.lon, 'Zona': t.zona, 'Cluster': t.cluster,
        'Fecha': t.agenda.fecha, 'Hora inicio': t.agenda.inicio, 'Hora fin': t.agenda.fin,
        'Estado': ESTADOS[t.estado].label, 'Centro de operaciones': CENTRO[estadoCentro(t)].label, 'Mensaje Centro de operaciones': t.centro.mensaje,
        'Contacto': t.contacto.nombre, 'Teléfono': t.contacto.telefono, 'Correo': t.contacto.correo, 'Comentario': t.comentario
      };
    });
    const blob = await Mocks.exportarTrabajos(filas);
    const nombre = `trabajos-programados-${HOY}.csv`;
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    btn.disabled = false;
    btn.innerHTML = `${icon('download')}<span>Exportar</span>`;
    toast(`Exportaste ${lista.length} ${plural(lista.length, 'trabajo', 'trabajos')} a ${nombre}.`);
  }
  $('#btn-exportar').addEventListener('click', exportar);

  /* ------------------------------------------------------------------------
     13. Sidebar, filtros, eventos e inicio
     ------------------------------------------------------------------------ */
  /* --- Sidebar --- */
  function setSidebar(contraido) {
    document.body.classList.toggle('sb-collapsed', contraido);
    const b = $('#sidebar-toggle');
    b.setAttribute('aria-expanded', String(!contraido));
    b.setAttribute('aria-label', contraido ? 'Expandir menú' : 'Contraer menú');
    $$('.sidenav__link').forEach(a => { a.title = contraido ? $('.sidenav__label', a).textContent : ''; });
    try { localStorage.setItem('agenda-sb', contraido ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
  }
  $('#sidebar-toggle').addEventListener('click', () => setSidebar(!document.body.classList.contains('sb-collapsed')));
  document.addEventListener('click', e => {
    const soon = e.target.closest('[data-soon]');
    if (!soon) return;
    e.preventDefault();
    toast('Esta sección no forma parte de este prototipo.', 'info');
  });

  /* --- Filtros --- */
  const formFiltros = $('#filtros');
  function aplicarFiltros() {
    const f = formFiltros.elements;
    Object.assign(state.filtros, { q: f.q.value, estado: f.estado.value, centro: f.centro.value, zona: f.zona.value, desde: f.desde.value, hasta: f.hasta.value });
    f.hasta.min = f.desde.value || '';
    f.desde.max = f.hasta.value || '';
    $('#btn-limpiar').hidden = !Object.values(state.filtros).some(Boolean);
    renderTodo();
  }
  function limpiarFiltros() {
    formFiltros.reset();
    state.filtros.rango = '';
    aplicarFiltros();
    $('#f-q').focus();
  }
  $('#f-q').addEventListener('input', debounce(aplicarFiltros, 200));
  ['f-estado', 'f-centro', 'f-zona'].forEach(id => $('#' + id).addEventListener('change', aplicarFiltros));
  // Elegir fechas a mano reemplaza el acceso rápido
  ['f-desde', 'f-hasta'].forEach(id => $('#' + id).addEventListener('change', () => { state.filtros.rango = ''; aplicarFiltros(); }));
  // Un acceso rápido reemplaza el rango de fechas escrito a mano
  $('#rangos').addEventListener('click', e => {
    const b = e.target.closest('.rango');
    if (!b) return;
    state.filtros.rango = b.dataset.rango;
    formFiltros.elements.desde.value = '';
    formFiltros.elements.hasta.value = '';
    aplicarFiltros();
    const nb = $(`.rango[data-rango="${b.dataset.rango}"]`);
    if (nb) nb.focus();
  });
  $('#btn-limpiar').addEventListener('click', limpiarFiltros);

  /* --- Indicadores: filtran la tabla por estado --- */
  $('#kpis').addEventListener('click', e => {
    const k = e.target.closest('.kpi[data-filtro]');
    if (!k) return;
    formFiltros.elements.estado.value = k.dataset.filtro;
    aplicarFiltros();
    const kpi = $(`.kpi[data-filtro="${k.dataset.filtro}"]`);
    if (kpi) kpi.focus();
  });

  /* --- Tabla: clics, casillas y formularios de detalle --- */
  tbody.addEventListener('click', e => {
    const accion = e.target.closest('[data-action]');
    if (accion) {
      const a = accion.dataset.action;
      if (a === 'reintentar') cargarListado();
      if (a === 'nuevo') abrirNuevo();
      if (a === 'limpiar') limpiarFiltros();
      if (a === 'historial') {
        const id = accion.closest('form').dataset.id;
        const panel = document.getElementById('hist-' + id);
        const abrir = panel.hidden;
        panel.hidden = !abrir;
        accion.setAttribute('aria-expanded', String(abrir));
        if (abrir) state.historialAbierto.add(id); else state.historialAbierto.delete(id);
      }
      if (a === 'eliminar') abrirEliminar(accion.closest('form').dataset.id);
      if (a === 'enviar-uno') enviarUno(accion.closest('form').dataset.id);
      if (a === 'descartar') {
        const form = accion.closest('form');
        form.reset();
        actualizarNotasContacto(form);
        delete form.dataset.enviado;
        tocados.set(form, new Set());
        mostrarErrores(form, {});
        actualizarDirty(form);
      }
      return;
    }
    const exp = e.target.closest('.exp');
    if (exp) { toggleDetalle(exp.closest('tr').dataset.id); return; }
    const row = e.target.closest('tr.row');
    if (row && !e.target.closest('input, button, a, select, textarea, label')) toggleDetalle(row.dataset.id);
  });
  ['input', 'change'].forEach(tipo => tbody.addEventListener(tipo, e => {
    const form = e.target.closest('form.detail');
    if (!form) return;
    if (/^c_/.test(e.target.name)) actualizarNotasContacto(form);
    actualizarDirty(form);
    validarEnVivo(form);
  }));
  tbody.addEventListener('focusout', e => {
    const form = e.target.closest('form.detail');
    if (!form || !e.target.name) return;
    tocados.get(form).add(e.target.name);
    if (e.target.name === 'a_inicio') tocados.get(form).add('a_fin');
    validarEnVivo(form);
  });
  tbody.addEventListener('submit', e => {
    const form = e.target.closest('form.detail');
    if (!form) return;
    e.preventDefault();
    guardarDetalle(form);
  });

  /* --- Botones de página y barra de próximo envío --- */
  $('#btn-nuevo').addEventListener('click', abrirNuevo);
  $('#btn-enviar').addEventListener('click', abrirCarga);
  // "N trabajos listos" filtra la tabla por la cola
  $('#envio').addEventListener('click', e => {
    if (!e.target.closest('[data-action="ver-cola"]')) return;
    formFiltros.reset();
    formFiltros.elements.centro.value = 'en_cola';
    state.filtros.rango = '';
    aplicarFiltros();
  });
  // La hora de corte avanza con el reloj: "hoy 8:00" pasa a "mañana 8:00"
  setInterval(renderEnvio, 60000);

  /* --- Diálogo nuevo trabajo --- */
  cbInput.addEventListener('input', () => {
    if (cbInput.value.trim().length >= 2) pintarLista('cargando');
    else cerrarLista();
    buscar();
  });
  cbInput.addEventListener('keydown', e => {
    const abierta = !cbList.hidden;
    const n = nuevo.opciones.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!abierta) buscar(); else if (n) moverActivo((nuevo.activo + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (abierta && n) moverActivo((nuevo.activo - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (abierta && nuevo.activo >= 0 && nuevo.opciones[nuevo.activo]) elegirProyecto(nuevo.opciones[nuevo.activo]);
    } else if (e.key === 'Escape' && abierta) {
      e.preventDefault(); // cierra la lista, no el diálogo
      cerrarLista();
    }
  });
  cbInput.addEventListener('blur', () => setTimeout(cerrarLista, 150));
  cbList.addEventListener('mousedown', e => e.preventDefault());
  cbList.addEventListener('click', e => {
    const li = e.target.closest('[role="option"]');
    if (li) elegirProyecto(nuevo.opciones[Number(li.dataset.i)]);
  });

  formNuevo.addEventListener('click', e => {
    if (e.target.closest('[data-action="cambiar-proyecto"]')) {
      nuevo.proyecto = null;
      nuevo.accesos = [];
      pintarAccesos('vacio');
      mostrarProyectoBuscador();
      cbInput.focus();
    }
  });
  formNuevo.addEventListener('change', e => {
    if (e.target.name === 'accesos') {
      if (nuevo.enviado) mostrarErrores(formNuevo, validarNuevo(nuevo.modo || 'completo'), new Set(['accesos']));
    }
  });
  formNuevo.addEventListener('keydown', e => {
    // Enter en un campo no envía el formulario (evita guardar un borrador sin querer)
    if (e.key === 'Enter' && e.target.matches('input:not([type="checkbox"])') && e.target !== cbInput) e.preventDefault();
  });
  function validarNuevoEnVivo() {
    mostrarErrores(formNuevo, validarNuevo(nuevo.modo || 'completo'), nuevo.enviado ? null : nuevo.tocados);
  }
  formNuevo.addEventListener('focusout', e => {
    if (!e.target.name || e.target.name === 'accesos') return;
    nuevo.tocados.add(e.target.name);
    if (e.target.name === 'a_inicio') nuevo.tocados.add('a_fin');
    validarNuevoEnVivo();
  });
  formNuevo.addEventListener('input', e => {
    if (e.target === cbInput || !e.target.name) return;
    if (nuevo.enviado || nuevo.tocados.has(e.target.name)) validarNuevoEnVivo();
  });
  formNuevo.addEventListener('submit', e => {
    e.preventDefault();
    const modo = e.submitter && e.submitter.value === 'borrador' ? 'borrador' : 'completo';
    nuevo.modo = modo;
    nuevo.enviado = true;
    const errs = validarNuevo(modo);
    mostrarErrores(formNuevo, errs);
    if (Object.keys(errs).length) { enfocarPrimerError(formNuevo); return; }
    crearTrabajos(modo === 'borrador' ? 'borrador' : 'crear');
  });

  /* --- Diálogos: cierre --- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-close]');
    if (b && !b.disabled) b.closest('dialog').close();
  });
  dlgCarga.addEventListener('cancel', e => { if (carga.fase === 'enviando') e.preventDefault(); });
  dlgCarga.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'enviar') enviarCarga(carga.lista.slice(), false);
    if (a.dataset.action === 'reintentar-carga') enviarCarga(carga.lista.filter(t => carga.res[t.id] && !carga.res[t.id].ok), true);
    if (a.dataset.action === 'validar-borrador') validarBorrador(a.dataset.id);
  });

  // Pasa un borrador a Validado si su agendamiento está completo y vigente
  function validarBorrador(id) {
    const t = byId(id);
    const errs = validar({
      a_fecha: t.agenda.fecha, a_inicio: t.agenda.inicio, a_fin: t.agenda.fin,
      a_zona: t.zona, a_cluster: t.cluster, estado: 'validado', _original_inicio_hoy: true,
      c_nombre: t.contacto.nombre, c_telefono: t.contacto.telefono, c_correo: t.contacto.correo
    }, 'completo');
    const msgs = Object.values(errs);
    if (msgs.length) {
      const li = document.getElementById('ex-' + id);
      $('.excluded__motivo', li).innerHTML = `<span class="res-msg">${esc(msgs[0])} Corrígelo en el detalle del trabajo.</span>`;
      return;
    }
    registrarCambios(t, [['estado', t.estado, 'validado']]);
    t.estado = 'validado';
    t.modificado = { usuario: USUARIO, fecha: ahora() };
    carga.excluidos = carga.excluidos.filter(x => x.id !== id);
    carga.lista.push(t);
    refrescarFila(id);
    if (state.abierto === id) {
      document.getElementById('det-' + id).replaceWith(crearDetalle(t));
    }
    renderKPIs();
    renderEnvio();
    pintarCarga();
    toast(`${id} pasó a Validado y se agregó al envío.`);
    const btn = $('#carga-foot .btn--primary');
    if (btn) btn.focus();
  }

  /* --- Inicio --- */
  function cargarListado() {
    state.cargando = true;
    state.error = false;
    renderTodo();
    Mocks.listarTrabajos(simular)
      .then(d => { state.trabajos = d; })
      .catch(() => { state.error = true; })
      .finally(() => { state.cargando = false; renderTodo(); });
  }

  const dl = document.createElement('datalist');
  dl.id = 'dl-comunas';
  dl.innerHTML = DATOS.COMUNAS.map(c => `<option value="${esc(c)}">`).join('');
  document.body.append(dl);

  $('#f-zona').insertAdjacentHTML('beforeend', DATOS.ZONAS.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join(''));

  let contraido = false, rolGuardado = 'gestor';
  try {
    contraido = localStorage.getItem('agenda-sb') === '1';
    if (localStorage.getItem('agenda-rol') === 'jefatura') rolGuardado = 'jefatura';
  } catch (e) { /* sin almacenamiento */ }
  setSidebar(contraido);
  setRol(rolGuardado, false);
  cargarListado();
})();
