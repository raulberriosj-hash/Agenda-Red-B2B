/* ==========================================================================
   AGENDA DE RED B2B · Lógica del prototipo
   La página tiene dos tablas con la misma fila y el mismo detalle:
   - Agendar trabajos: bandeja del día (pendientes, con error y enviadas hoy)
   - Agendas enviadas: enviadas en días anteriores (el "historial")
   Secciones:
     1. Utilidades y fechas      8. Envío automático cada 10 minutos
     2. Estados del Centro       9. Detalle en acordeón
     3. Estado de la app        10. Nueva agenda
     4. Avisos (toasts)         11. Enviar ahora (RPA)
     5. Validación              12. Rol, eliminación y exportación
     6. Indicadores globales    13. Selectores de fecha y hora (24 h)
     7. Bandeja e historial     14. Sidebar, filtros, eventos e inicio
   Escenarios por URL: ?simular=error | ?simular=vacio | ?simular=corte
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
  const pad2 = n => String(n).padStart(2, '0');
  function horaActual() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  /* --- Formatos de los campos: fecha dd-mm-aaaa y hora HH:MM (24 h) ---- */
  const fechaTxt = iso => iso ? iso.split('-').reverse().join('-') : '';
  // '3-12-2026', '03/12/26', '3-12' o '03122026' → '2026-12-03' · '' si está vacío · null si no es una fecha
  function fechaISO(txt) {
    const v = String(txt || '').trim();
    if (!v) return '';
    const m = v.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/) || v.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (!m) return null;
    const d = Number(m[1]), mes = Number(m[2]);
    let y = m[3] ? Number(m[3]) : parseISO(HOY).getFullYear();
    if (y < 100) y += 2000;
    const f = new Date(y, mes - 1, d);
    return f.getMonth() === mes - 1 && f.getDate() === d ? isoOf(f) : null;
  }
  // '9' → '09:00' · '930' → '09:30' · '9:30' → '09:30' · null si no es una hora de 00:00 a 23:59
  function horaNorm(txt) {
    const v = String(txt || '').trim();
    if (!v) return '';
    const m = v.match(/^(\d{1,2})(?::?(\d{2}))?$/);
    if (!m || Number(m[1]) > 23 || Number(m[2] || 0) > 59) return null;
    return pad2(m[1]) + ':' + pad2(m[2] || 0);
  }
  function ahora() { return `${HOY}T${horaActual()}`; }
  function icon(n, cls) { return `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`; }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* --- Fecha compromiso: solicitud + días hábiles según cluster ---------
     Días hábiles = lunes a viernes (el prototipo no considera feriados).    */
  const DIAS_COMPROMISO = { C1: 2, C2: 4 };
  function sumarHabiles(iso, n) {
    const d = parseISO(iso);
    let k = 0;
    while (k < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) k++;
    }
    return isoOf(d);
  }
  const fechaCompromiso = (solicitud, cluster) => DIAS_COMPROMISO[cluster] ? sumarHabiles(solicitud, DIAS_COMPROMISO[cluster]) : '';
  function compromisoHTML(solicitud, cluster) {
    const n = DIAS_COMPROMISO[cluster];
    if (!n) return `${icon('flag')}<span>Elige el cluster para calcular la fecha compromiso.</span>`;
    return `${icon('flag')}<span>Fecha compromiso: <strong>${fmtFecha(fechaCompromiso(solicitud, cluster))}</strong> · solicitud ${fmtFecha(solicitud)} + ${n} días hábiles (${cluster})</span>`;
  }

  const proyecto = id => DATOS.PROYECTOS.find(p => p.id === id);
  const acceso = id => DATOS.ACCESOS.find(a => a.id === id);
  const byId = id => state.trabajos.find(t => t.id === id);

  /* ------------------------------------------------------------------------
     2. Estados del Centro de operaciones (únicos estados de una agenda)
     'en_proceso' es transitorio: solo existe mientras el RPA responde.
     ------------------------------------------------------------------------ */
  const CENTRO = {
    pendiente:  { label: 'Pendiente de envío', icon: 'hourglass' },
    en_proceso: { label: 'Enviando',           icon: 'loader' },
    enviado:    { label: 'Enviado',            icon: 'check' },
    error:      { label: 'Error de carga',     icon: 'alert-triangle' }
  };
  // Sale en el próximo envío: pendientes y con error (se reintentan)
  const porEnviar = t => t.centro.estado === 'pendiente' || t.centro.estado === 'error';
  // En la bandeja: todo lo no enviado, más lo enviado desde el último cambio de día
  const enBandeja = t => t.centro.estado !== 'enviado' || t.centro.fecha >= state.corte;
  // La bandeja es de cada gestor: sus agendas, más las de otros que editó y quedaron por enviar
  const esMia = t => t.creador === USUARIO;
  const enMiBandeja = t => enBandeja(t) && (esMia(t) || (t.centro.estado !== 'enviado' && t.modificado.usuario === USUARIO));
  // Agendas enviadas · "Mis agendas": las mías de días anteriores ·
  // "Todas": las de todos, incluidas las enviadas hoy (menos las que están en mi bandeja)
  function enEnviadas(t) {
    if (enMiBandeja(t)) return false;
    return state.filtros.quien === 'mias' ? esMia(t) && !enBandeja(t) : t.centro.estado === 'enviado' || !enBandeja(t);
  }

  // s: clave de CENTRO · label: texto alternativo · msg: detalle del último envío (tooltip)
  function centroHTML(s, label, msg) {
    const title = msg ? ` title="${esc(msg)}"` : '';
    return `<span class="centro centro--${s}"${title}>${icon(CENTRO[s].icon, s === 'en_proceso' ? 'spin' : '')}${label || CENTRO[s].label}</span>`;
  }
  const centroDe = t => centroHTML(t.centro.estado, '', t.centro.mensaje);

  /* ------------------------------------------------------------------------
     3. Estado de la app
     ------------------------------------------------------------------------ */
  const state = {
    trabajos: [],
    bandeja: [],
    historial: [],               // agendas del historial que pasan los filtros (todas las páginas)
    pagina: 1,                   // página visible del historial
    cargando: true,
    error: false,
    filtros: { quien: 'mias', q: '', zona: '', desde: '', hasta: '' }, // quien: 'mias' | 'todas'
    rol: 'gestor',               // 'gestor' | 'jefatura' (simulado)
    historialAbierto: new Set(), // ids con el historial de cambios desplegado
    abierto: null,               // id con el detalle abierto (en cualquiera de las dos tablas)
    corte: `${HOY}T00:00`,       // último cambio de día de la bandeja
    enviando: false              // hay un envío al Centro de operaciones en curso
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
     5. Validación (compartida por el detalle y la nueva agenda)
     Todos los obligatorios + formato + consistencia. La fecha pasada solo se
     rechaza si cambió: una agenda antigua se puede editar sin reagendarla.
     ------------------------------------------------------------------------ */
  const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  const FECHAS = ['a_fecha', 'desde', 'hasta'], HORAS_CAMPOS = ['a_inicio', 'a_fin'];
  function telefonoValido(v) {
    const d = v.replace(/\D/g, '');
    return (d.length === 11 && d.startsWith('56')) || (d.length === 9 && /^[29]/.test(d));
  }
  const OBLIGATORIOS = {
    c_nombre: 'Ingresa el nombre del contacto.',
    c_telefono: 'Ingresa un teléfono de contacto.',
    a_fecha: 'Elige la fecha de la agenda.',
    a_inicio: 'Indica la hora de inicio.',
    a_fin: 'Indica la hora de término.',
    a_zona: 'Elige la zona.',
    a_cluster: 'Elige el cluster (C1 o C2).'
  };

  // orig: { fecha, inicio } guardados (null en una agenda nueva)
  function validar(d, orig) {
    const e = {};
    const val = k => String(d[k] == null ? '' : d[k]).trim();

    Object.keys(OBLIGATORIOS).forEach(k => { if (k in d && !val(k)) e[k] = OBLIGATORIOS[k]; });
    // Formatos
    if (val('c_telefono') && !telefonoValido(val('c_telefono'))) e.c_telefono = 'Usa 9 dígitos (ej. 939412174) o +56 9 3941 2174.';
    if (val('c_correo') && !RE_CORREO.test(val('c_correo'))) e.c_correo = 'Revisa el correo (ej. nombre@empresa.cl).';
    if (val('a_cluster') && !DIAS_COMPROMISO[val('a_cluster')]) e.a_cluster = 'Elige C1 o C2.';
    const fechaOk = val('a_fecha') && val('a_fecha') !== 'invalida';
    if (val('a_fecha') === 'invalida') e.a_fecha = 'Usa el formato dd-mm-aaaa (ej. 03-12-2026).';
    HORAS_CAMPOS.forEach(k => { if (val(k) && !RE_HORA.test(val(k))) e[k] = 'Usa el formato de 24 horas (ej. 09:30 o 18:00).'; });
    const horasOk = RE_HORA.test(val('a_inicio')) && RE_HORA.test(val('a_fin'));
    // Consistencia
    const cambioFecha = !orig || val('a_fecha') !== orig.fecha;
    const cambioInicio = !orig || cambioFecha || val('a_inicio') !== orig.inicio;
    if (fechaOk && cambioFecha && val('a_fecha') < HOY) e.a_fecha = 'La fecha ya pasó. Elige hoy o una fecha futura.';
    if (horasOk && val('a_fin') <= val('a_inicio')) e.a_fin = 'El término debe ser posterior al inicio.';
    if (cambioInicio && val('a_fecha') === HOY && RE_HORA.test(val('a_inicio')) && val('a_inicio') < horaActual()) {
      e.a_inicio = 'Esa hora ya pasó hoy. Elige una hora posterior.';
    }
    return e;
  }

  // Fechas a ISO ('invalida' si no se entiende) y horas completas a HH:MM
  function leer(form) {
    const d = {};
    new FormData(form).forEach((v, k) => {
      if (k === 'accesos') return;
      if (FECHAS.includes(k)) { const iso = fechaISO(v); d[k] = iso === null ? 'invalida' : iso; }
      else if (HORAS_CAMPOS.includes(k)) d[k] = horaNorm(v) || v.trim();
      else d[k] = v;
    });
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
    } else if (o.tipo === 'fecha' || o.tipo === 'hora') {
      // Selector propio (sección 13): calendario o lista de horas de 24 h
      const fecha = o.tipo === 'fecha';
      ctrl = `<div class="picker"><input id="${id}" name="${o.k}" type="text" class="input picker__input" value="${esc(fecha ? fechaTxt(o.valor) : o.valor)}"
        placeholder="${fecha ? 'dd-mm-aaaa' : 'HH:MM'}" maxlength="${fecha ? 10 : 5}" inputmode="numeric" autocomplete="off"
        data-picker="${o.tipo}" aria-haspopup="dialog" aria-expanded="false" ${aria} ${o.attrs || ''}>
        <button type="button" class="picker__btn" tabindex="-1" aria-hidden="true">${icon(fecha ? 'calendar' : 'clock')}</button></div>`;
    } else {
      ctrl = `<input id="${id}" name="${o.k}" type="${o.tipo || 'text'}" class="input" value="${esc(o.valor)}" ${aria} ${o.attrs || ''}>`;
    }
    return `<div class="field${o.span ? ' field--' + o.span : ''}" data-field="${o.k}">
      <label for="${id}">${esc(o.label)}${req}</label>${ctrl}
      ${o.hint ? `<p class="field__hint" id="${id}-hint">${esc(o.hint)}</p>` : ''}
      <p class="field__error" id="${id}-err" hidden></p>
      ${o.origen !== undefined ? `<p class="field__note" id="${id}-nota" data-origen="${esc(o.origen)}" hidden></p>` : ''}</div>`;
  }
  const OPC_ZONAS = DATOS.ZONAS.map(x => [x, x]);
  const OPC_CLUSTERS = DATOS.CLUSTERS.map(x => [x, x]); // el plazo se muestra en la fecha compromiso

  /* ------------------------------------------------------------------------
     6. Indicadores globales: uno por estado del Centro de operaciones
     ------------------------------------------------------------------------ */
  function renderKPIs() {
    const box = $('#kpis');
    if (state.cargando) {
      box.innerHTML = Array.from({ length: 3 }, () => `<div class="kpi" aria-hidden="true"><span class="kpi__icon" style="background:var(--background-tertiary)"></span><span><span class="sk" style="width:60%"></span><span class="sk" style="width:30%;height:20px"></span></span></div>`).join('');
      return;
    }
    const mias = state.trabajos.filter(t => esMia(t) || enMiBandeja(t)); // acompañan a mi bandeja
    const cuenta = (...e) => mias.filter(t => e.includes(t.centro.estado)).length;
    const items = [
      { k: 'pendientes', ic: 'hourglass', label: 'Pendientes de envío', value: cuenta('pendiente', 'en_proceso') },
      { k: 'enviados', ic: 'circle-check', label: 'Enviados hoy', value: mias.filter(t => t.centro.estado === 'enviado' && t.centro.fecha >= `${HOY}T00:00`).length },
      { k: 'errores', ic: 'alert-triangle', label: 'Error de carga', value: cuenta('error') }
    ];
    box.innerHTML = items.map(i => `<div class="kpi kpi--${i.k}">
        <span class="kpi__icon">${icon(i.ic)}</span>
        <span class="kpi__label">${i.label}</span>
        <span class="kpi__value">${i.value}</span>
      </div>`).join('');
  }

  /* ------------------------------------------------------------------------
     7. Bandeja e historial (misma fila, mismo detalle)
     ------------------------------------------------------------------------ */
  const tbodyB = $('#tbody-bandeja'), tbodyH = $('#tbody-historial');
  const filaEl = id => document.querySelector(`tr.row[data-id="${id}"]`);
  const llave = t => t.agenda.fecha + t.agenda.inicio;
  // Bandeja: primero lo que requiere atención (error, pendiente), luego lo enviado hoy
  const PRIORIDAD = { error: 0, pendiente: 1, en_proceso: 2, enviado: 3 };

  function bandeja() {
    return state.trabajos.filter(enMiBandeja)
      .sort((a, b) => PRIORIDAD[a.centro.estado] - PRIORIDAD[b.centro.estado] || llave(a).localeCompare(llave(b)));
  }
  function historialVisible() {
    const f = state.filtros;
    const q = norm(f.q.trim());
    return state.trabajos.filter(t => {
      if (!enEnviadas(t)) return false;
      if (f.zona && t.zona !== f.zona) return false;
      if (f.desde && t.agenda.fecha < f.desde) return false;
      if (f.hasta && t.agenda.fecha > f.hasta) return false;
      if (q) {
        const p = proyecto(t.proyectoId), a = acceso(t.accesoId);
        const texto = norm([t.id, p.codigo, p.razonSocial, p.segmento, p.tipo, a.codigo, t.ubicacion.calle, t.ubicacion.comuna, t.zona, t.cluster, t.contacto.nombre, t.creador].join(' '));
        if (!texto.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.centro.fecha.localeCompare(a.centro.fecha) || llave(b).localeCompare(llave(a))); // último envío primero
  }
  const totalHistorial = () => state.trabajos.filter(enEnviadas).length;

  // Mini calendario (celeste: por enviar · gris: enviada) + fecha y horario escritos
  function fechaHTML(t) {
    const d = parseISO(t.agenda.fecha), dif = difDias(t.agenda.fecha);
    const hoja = t.centro.estado === 'enviado' ? 'hoja--enviada' : 'hoja--pendiente';
    const cuando = dif === 0 ? 'Hoy · ' : dif === 1 ? 'Mañana · ' : '';
    return `<div class="fecha">
      <span class="hoja ${hoja}" aria-hidden="true"><span class="hoja__dia">${DIAS[d.getDay()]}</span><span class="hoja__num">${d.getDate()}</span><span class="hoja__mes">${MESES[d.getMonth()]}</span></span>
      <div class="cell-2"><span class="fecha__txt">${fmtFecha(t.agenda.fecha)} · ${t.agenda.inicio}–${t.agenda.fin}</span>
        <span class="meta">${cuando}${duracion(t.agenda.inicio, t.agenda.fin)}</span></div>
    </div>`;
  }

  function filaHTML(t) {
    const p = proyecto(t.proyectoId), a = acceso(t.accesoId);
    const open = state.abierto === t.id;
    const dir = `${t.ubicacion.calle} ${t.ubicacion.numero}`;
    const comp = fechaCompromiso(t.solicitud, t.cluster);
    return `<tr class="row${open ? ' is-open' : ''}" data-id="${t.id}">
      <td class="c-exp"><button type="button" class="icon-btn exp" aria-expanded="${open}" aria-controls="det-${t.id}" aria-label="Detalle de ${t.id}">${icon('chevron-right')}</button></td>
      <td>${fechaHTML(t)}</td>
      <td><div class="cell-2"><span class="cell-codigo" title="${esc(p.codigo)}">${esc(p.codigo)}</span><span class="meta">${esc(p.tipo)} · ${esc(p.segmento)}</span></div></td>
      <td title="${esc(dir)}">${esc(a.codigo)}</td>
      <td class="cell-cliente" title="${esc(p.razonSocial)}"><span>${esc(p.razonSocial)}</span></td>
      <td><div class="cell-2"><span title="${esc(t.ubicacion.comuna)}">${icon('map-pin', 'ic-inline')}${esc(t.ubicacion.comuna)}</span><span class="meta">${esc(t.zona)}</span></div></td>
      <td><div class="cell-2"><span>${comp ? fmtFecha(comp) : '—'}</span><span class="meta">${esc(t.cluster)} · ${DIAS_COMPROMISO[t.cluster] || 0} hábiles</span></div></td>
      <td><div class="cell-2">${centroDe(t)}${t.centro.fecha && t.centro.estado !== 'pendiente' && t.centro.estado !== 'en_proceso'
        ? `<span class="meta">${fmtMarca(t.centro.fecha)}</span>` : ''}</div></td>
    </tr>`;
  }

  function filaSkeleton(i) {
    const w = [60, 80, 70, 90, 55, 75, 65, 85];
    const cel = (a, b) => `<td><span class="sk" style="width:${a}%"></span>${b ? `<span class="sk" style="width:${b}%"></span>` : ''}</td>`;
    return `<tr aria-hidden="true"><td></td>
      <td><div class="fecha"><span class="hoja hoja--sk"></span><span style="flex:1"><span class="sk" style="width:80%"></span><span class="sk" style="width:50%"></span></span></div></td>
      ${cel(w[i % 8], 90)}${cel(w[(i + 3) % 8], 50)}${cel(w[(i + 5) % 8])}${cel(60, 40)}${cel(70, 50)}${cel(60)}</tr>`;
  }

  function filaEstado(tipo) {
    const E = {
      error: { cls: 'state--error', ic: 'alert-triangle', t: 'No pudimos cargar las agendas',
        p: 'Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, avisa a soporte.',
        b: `<button type="button" class="btn btn--secondary" data-action="reintentar">${icon('refresh')}Reintentar</button>` },
      bandeja: { cls: 'state--compacto', ic: 'inbox', t: 'La bandeja de hoy está vacía',
        p: 'Agenda un trabajo a partir de un proyecto y sus accesos.',
        b: `<button type="button" class="btn btn--primary" data-action="nuevo">${icon('plus')}Agendar nuevo trabajo</button>` },
      historial: { cls: '', ic: 'history', t: 'Aún no hay agendas enviadas',
        p: 'Las agendas enviadas pasan aquí al cambiar el día.', b: '' },
      sin: { cls: '', ic: 'search', t: 'Ninguna agenda coincide con los filtros',
        p: 'Prueba con otra búsqueda o amplía el rango de fechas.',
        b: `<button type="button" class="btn btn--secondary" data-action="limpiar">Limpiar filtros</button>` }
    }[tipo];
    return `<tr class="state-row${E.cls ? ' ' + E.cls : ''}"><td colspan="8"><div class="state ${E.cls}">
      <span class="state__icon">${icon(E.ic)}</span>
      <h2 class="body-base-bold">${E.t}</h2><p>${E.p}</p>${E.b}</div></td></tr>`;
  }

  function renderTablas() {
    // El detalle abierto se conserva (con sus cambios) si la fila sigue visible en alguna tabla
    const det = state.abierto ? document.getElementById('det-' + state.abierto) : null;
    if (det) det.remove();
    $$('.table').forEach(t => t.setAttribute('aria-busy', String(state.cargando)));

    if (state.cargando) {
      tbodyB.innerHTML = Array.from({ length: 4 }, (_, i) => filaSkeleton(i)).join('');
      tbodyH.innerHTML = Array.from({ length: 5 }, (_, i) => filaSkeleton(i + 4)).join('');
      state.bandeja = state.historial = [];
    } else if (state.error) {
      tbodyB.innerHTML = filaEstado('error');
      tbodyH.innerHTML = '';
      state.bandeja = state.historial = [];
    } else {
      state.bandeja = bandeja();
      state.historial = historialVisible();
      state.pagina = Math.min(state.pagina, totalPaginas());
      tbodyB.innerHTML = state.bandeja.length ? state.bandeja.map(filaHTML).join('') : filaEstado('bandeja');
      tbodyH.innerHTML = state.historial.length ? paginaActual().map(filaHTML).join('')
        : filaEstado(totalHistorial() ? 'sin' : 'historial');
    }

    if (state.abierto) {
      const row = filaEl(state.abierto);
      if (row) row.after(det || crearDetalle(byId(state.abierto)));
      else state.abierto = null;
    }
    renderPies();
  }

  function renderPies() {
    const fh = $('#foot-historial');
    $('#bandeja-sub').textContent = `Bandeja de hoy · ${fmtFecha(HOY)}`;
    renderPaginador();
    if (state.cargando || state.error) { fh.textContent = ''; return; }
    const n = state.historial.length, desde = (state.pagina - 1) * POR_PAGINA;
    const filtrado = n < totalHistorial() ? ` (filtradas de ${totalHistorial()})` : '';
    fh.innerHTML = n
      ? `Mostrando <strong>${desde + 1}–${Math.min(desde + POR_PAGINA, n)}</strong> de ${n} ${plural(n, 'agenda', 'agendas')}${filtrado} · último envío primero`
      : '';
  }

  /* --- Paginación del historial (10 por página) --- */
  const POR_PAGINA = 10;
  const totalPaginas = () => Math.max(1, Math.ceil(state.historial.length / POR_PAGINA));
  const paginaActual = () => state.historial.slice((state.pagina - 1) * POR_PAGINA, state.pagina * POR_PAGINA);

  // Primera, última y vecinas de la actual; el resto se resume con "…"
  function paginasVisibles(actual, total) {
    const lista = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - actual) <= 1) lista.push(i);
      else if (lista[lista.length - 1] !== '…') lista.push('…');
    }
    return lista;
  }

  function renderPaginador() {
    const nav = $('#pager'), total = totalPaginas(), p = state.pagina;
    nav.hidden = state.cargando || state.error || total < 2;
    if (nav.hidden) { nav.innerHTML = ''; return; }
    const flecha = (destino, ic, label, off) =>
      `<button type="button" class="pager__btn" data-pagina="${destino}" aria-label="${label}"${off ? ' disabled' : ''}>${icon(ic)}</button>`;
    nav.innerHTML = flecha(p - 1, 'chevron-left', 'Página anterior', p === 1) +
      paginasVisibles(p, total).map(i => i === '…'
        ? '<span class="pager__gap" aria-hidden="true">…</span>'
        : `<button type="button" class="pager__btn" data-pagina="${i}" aria-label="Página ${i}"${i === p ? ' aria-current="page"' : ''}>${i}</button>`).join('') +
      flecha(p + 1, 'chevron-right', 'Página siguiente', p === total);
  }

  // label: el aria-label del botón usado, para devolverle el foco tras repintar
  function irAPagina(n, label) {
    if (n < 1 || n > totalPaginas() || n === state.pagina) return;
    state.pagina = n;
    renderTablas();
    $('#tabla-historial').closest('.table-card').scrollIntoView({ block: 'start', behavior: 'smooth' });
    const mismo = $(`#pager [aria-label="${label}"]`);
    const btn = mismo && !mismo.disabled ? mismo : $('#pager [aria-current]');
    if (btn) btn.focus({ preventScroll: true });
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
    renderTablas();
    renderEnvio();
  }

  /* ------------------------------------------------------------------------
     8. Envío automático cada 10 minutos
     A cada múltiplo de 10 min del reloj el sistema envía al Centro de
     operaciones las agendas pendientes y reintenta las que tienen error.
     ------------------------------------------------------------------------ */
  const INTERVALO_MIN = 10;
  const cola = () => state.trabajos.filter(t => enMiBandeja(t) && porEnviar(t));
  function segundosParaEnvio() {
    const d = new Date();
    return INTERVALO_MIN * 60 - ((d.getMinutes() % INTERVALO_MIN) * 60 + d.getSeconds());
  }
  const minutosParaEnvio = () => Math.max(1, Math.ceil(segundosParaEnvio() / 60));
  const proximoEnvio = () => `en ${minutosParaEnvio()} min`;
  const tramo = () => { const d = new Date(); return Math.floor((d.getHours() * 60 + d.getMinutes()) / INTERVALO_MIN); };

  function renderEnvio() {
    const txt = $('#envio-text'), btn = $('#btn-enviar');
    if (state.cargando || state.error) { txt.textContent = ''; btn.disabled = true; return; }
    const C = cola(), n = C.length, err = C.filter(t => t.centro.estado === 'error').length;
    if (state.enviando) {
      txt.innerHTML = `${icon('loader', 'spin')}<span>Enviando al Centro de operaciones…</span>`;
    } else {
      txt.innerHTML = `<span>Próximo envío <strong>${proximoEnvio()}</strong> · ${n
        ? `${n} ${plural(n, 'pendiente', 'pendientes')}${err ? ` (${err} con error)` : ''}`
        : 'sin pendientes'}</span>`;
    }
    btn.disabled = !n || state.enviando;
  }

  let ultimoTramo = tramo();
  function tick() {
    const t = tramo();
    if (t !== ultimoTramo) { ultimoTramo = t; envioAutomatico(); }
    renderEnvio();
  }

  async function envioAutomatico() {
    if (state.cargando || state.error || state.enviando || dlgCarga.open) return;
    const lote = cola();
    if (!lote.length) return;
    const res = await enviarLote(lote, false);
    const ok = res.filter(r => r.ok).length, err = res.length - ok;
    toast(`Envío automático: ${ok} ${plural(ok, 'agenda enviada', 'agendas enviadas')}${err ? `, ${err} con error` : ''}.`, err ? 'error' : 'success');
  }

  /* ------------------------------------------------------------------------
     9. Detalle en acordeón (editable)
     ------------------------------------------------------------------------ */
  const tocados = new WeakMap(); // form → Set de campos tocados

  function avisoCentro(t) {
    if (t.centro.estado === 'error') {
      return `<div class="alert alert--error" role="alert">${icon('alert-triangle')}<div><strong>No se pudo cargar en el Centro de operaciones.</strong> ${esc(t.centro.mensaje)}</div></div>`;
    }
    if (t.centro.estado === 'pendiente' && t.centro.enAgenda) {
      return `<div class="alert alert--warning">${icon('alert-circle')}<div><strong>Cambios sin enviar.</strong> Esta agenda cambió después de su último envío al Centro de operaciones.</div></div>`;
    }
    return '';
  }
  function metaCentro(t) {
    const s = t.centro.estado;
    const extra = t.centro.fecha && s !== 'pendiente' && s !== 'en_proceso' ? fmtMarca(t.centro.fecha) : '';
    return `Centro de operaciones: ${centroDe(t)}${extra ? ` <span>· ${extra}</span>` : ''}`;
  }
  // Envío manual de una agenda desde su detalle
  function enviarUnoHTML(t) {
    if (t.centro.estado === 'en_proceso') return `<button type="button" class="btn btn--secondary" disabled>${icon('loader', 'spin')}Enviando…</button>`;
    return porEnviar(t) ? `<button type="button" class="btn btn--secondary" data-action="enviar-uno">${icon('send')}Enviar ahora</button>` : '';
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
              <div><dt>ID de agenda</dt><dd class="dd-id">${esc(t.id)}</dd></div>
              <div><dt>Fecha de solicitud</dt><dd>${fmtFecha(t.solicitud)}</dd></div>
              <div class="dl__full"><dt>Proyecto</dt><dd>${esc(p.codigo)}</dd></div>
              <div class="dl__full"><dt>Razón social</dt><dd>${esc(p.razonSocial)}</dd></div>
              <div><dt>Acceso</dt><dd>${esc(a.codigo)}</dd></div>
              <div><dt>Segmento</dt><dd>${esc(p.segmento)}</dd></div>
              <div><dt>Tipo de trabajo</dt><dd>${esc(p.tipo)}</dd></div>
              <div><dt>Topología</dt><dd>${esc(p.topologia)}</dd></div>
              <div><dt>Agencia</dt><dd>${dato(p.agencia === 'SIN DATO' ? '' : p.agencia)}</dd></div>
              <div><dt>Agendada por</dt><dd>${esc(t.creador)}</dd></div>
            </dl>
          </fieldset>
          <fieldset class="detail__section">
            <legend>${icon('user')}Contacto</legend>
            <p class="field__hint">Viene de la Base de Accesos. Si lo cambias, el cambio queda solo en esta agenda.</p>
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
            ${campo({ idp, k: 'a_fecha', label: 'Fecha', tipo: 'fecha', valor: t.agenda.fecha, req: true, attrs: `data-min="${HOY}"` })}
            <div class="row-2">
              ${campo({ idp, k: 'a_inicio', label: 'Hora inicio', tipo: 'hora', valor: t.agenda.inicio, req: true })}
              ${campo({ idp, k: 'a_fin', label: 'Hora fin', tipo: 'hora', valor: t.agenda.fin, req: true })}
            </div>
            <div class="row-2">
              ${campo({ idp, k: 'a_zona', label: 'Zona', tipo: 'select', opciones: OPC_ZONAS, valor: t.zona, req: true })}
              ${campo({ idp, k: 'a_cluster', label: 'Cluster', tipo: 'select', opciones: OPC_CLUSTERS, valor: t.cluster, req: true, placeholder: 'Elige' })}
            </div>
            <p class="compromiso" data-slot="compromiso">${compromisoHTML(t.solicitud, t.cluster)}</p>
            ${campo({ idp, k: 'comentario', label: 'Comentario', tipo: 'textarea', valor: t.comentario, placeholder: 'Indicaciones para el equipo en terreno, motivo de cambio de fecha, etc.' })}
          </fieldset>
        </div>
        <div class="detail__foot">
          <div class="detail__meta">
            <span>Última modificación: <strong>${esc(t.modificado.usuario)}</strong> · ${fmtMarca(t.modificado.fecha)}</span>
            <button type="button" class="btn-link" data-action="historial" aria-expanded="${state.historialAbierto.has(t.id)}" aria-controls="hist-${t.id}">
              ${icon('history')}Ver cambios (${(t.historial || []).length})</button>
            <span data-slot="centro">${metaCentro(t)}</span>
          </div>
          <div class="detail__actions">
            <button type="button" class="btn btn--danger-ghost solo-jefatura" data-action="eliminar">${icon('trash')}Eliminar</button>
            <span class="detail__sep solo-jefatura" aria-hidden="true"></span>
            <span class="dirty-note" data-slot="dirty" hidden>${icon('alert-circle')}Cambios sin guardar</span>
            <button type="button" class="btn btn--ghost" data-action="descartar" disabled>Descartar cambios</button>
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
    fecha: 'Fecha', inicio: 'Hora inicio', fin: 'Hora fin', zona: 'Zona', cluster: 'Cluster',
    comentario: 'Comentario', c_nombre: 'Nombre de contacto', c_telefono: 'Teléfono', c_correo: 'Correo'
  };
  function valorHist(campo, v) {
    if (!v) return '<span class="sin-dato">vacío</span>';
    if (campo === 'fecha') return esc(fmtFecha(v));
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
        : '<p class="text-tertiary">Aún no hay cambios registrados para esta agenda.</p>'}
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

  function actualizarDirty(form) {
    const dirty = serializar(form) !== form.dataset.orig;
    form.dataset.dirty = dirty ? '1' : '0';
    $('[data-slot="dirty"]', form).hidden = !dirty;
    $('[data-action="descartar"]', form).disabled = !dirty;
    $('[data-action="guardar"]', form).disabled = !dirty;
  }

  function validarEnVivo(form) {
    const t = byId(form.dataset.id);
    const errs = validar(leer(form), { fecha: t.agenda.fecha, inicio: t.agenda.inicio });
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
    const estabaEnHistorial = !enMiBandeja(t); // viene de Agendas enviadas (mía de otro día o de otro gestor)
    const contacto = { nombre: d.c_nombre.trim(), telefono: d.c_telefono.trim(), correo: d.c_correo.trim() };
    const cambios = registrarCambios(t, [
      ['fecha', t.agenda.fecha, d.a_fecha], ['inicio', t.agenda.inicio, d.a_inicio], ['fin', t.agenda.fin, d.a_fin],
      ['zona', t.zona, d.a_zona], ['cluster', t.cluster, d.a_cluster],
      ['comentario', t.comentario, d.comentario.trim()],
      ['c_nombre', t.contacto.nombre, contacto.nombre], ['c_telefono', t.contacto.telefono, contacto.telefono], ['c_correo', t.contacto.correo, contacto.correo]
    ]);
    Object.assign(t, {
      contacto,
      agenda: { fecha: d.a_fecha, inicio: d.a_inicio, fin: d.a_fin },
      zona: d.a_zona,
      cluster: d.a_cluster,
      comentario: d.comentario.trim(),
      modificado: { usuario: USUARIO, fecha: ahora() }
    });
    // Una agenda enviada (o con error) que cambia vuelve a Pendiente y entra a la bandeja
    if (cambios && t.centro.estado !== 'pendiente') {
      t.centro = Object.assign({}, t.centro, { estado: 'pendiente', mensaje: '' });
    }

    // Se rehace el detalle; si la agenda pasó del historial a la bandeja, la fila cambia de tabla
    document.getElementById('det-' + id).remove();
    renderTodo();
    const det = document.getElementById('det-' + id);
    if (det) {
      $('.detail__panel', det).focus({ preventScroll: true });
      if (estabaEnHistorial) filaEl(id).scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    toast(estabaEnHistorial ? `${id} actualizada. Volvió a la bandeja como Pendiente de envío.` : `${id} actualizada.`);
  }

  /* ------------------------------------------------------------------------
     10. Nueva agenda (GetBacklog + Base de Accesos)
     Toda agenda creada entra a la bandeja como Pendiente de envío.
     ------------------------------------------------------------------------ */
  const dlgNuevo = $('#dlg-nuevo');
  const formNuevo = $('#form-nuevo');
  const cbInput = $('#cb-input'), cbList = $('#cb-list');
  const nuevo = { proyecto: null, accesos: [], token: 0, opciones: [], activo: -1, enviado: false, tocados: new Set() };

  function abrirNuevo() {
    formNuevo.reset();
    Object.assign(nuevo, { proyecto: null, accesos: [], opciones: [], activo: -1, enviado: false, tocados: new Set() });
    $('#nuevo-campos').innerHTML = [
      campo({ idp: 'n', k: 'a_fecha', label: 'Fecha', tipo: 'fecha', valor: '', req: true, attrs: `data-min="${HOY}"` }),
      campo({ idp: 'n', k: 'a_inicio', label: 'Hora inicio', tipo: 'hora', valor: '', req: true }),
      campo({ idp: 'n', k: 'a_fin', label: 'Hora fin', tipo: 'hora', valor: '', req: true }),
      campo({ idp: 'n', k: 'a_cluster', label: 'Cluster', tipo: 'select', opciones: OPC_CLUSTERS, valor: '', req: true, placeholder: 'Elige el cluster' }),
      `<p class="compromiso field--span2" id="n-compromiso">${compromisoHTML(HOY, '')}</p>`,
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
        const vigentes = agendasVigentes(a.id);
        return `<label class="acc"><input type="checkbox" name="accesos" value="${a.id}"${nuevo.accesos.length === 1 ? ' checked' : ''}>
          <span class="acc__body"><span class="body-small-bold">Acceso ${esc(a.codigo)}</span>
          <span class="meta">${esc(a.calle)} ${esc(a.numero)}, ${esc(a.comuna)} · ${esc(a.zona)}</span>
          ${vigentes.length ? `<span class="tag tag--aviso">${icon('alert-circle')}<span>${avisoDuplicado(vigentes)}</span></span>` : ''}</span></label>`;
      }).join('');
    }
    actualizarBotonCrear();
  }
  // Agendas del acceso que siguen vigentes: por enviar, o agendadas para hoy o después
  const agendasVigentes = aid => state.trabajos
    .filter(t => t.accesoId === aid && (porEnviar(t) || t.agenda.fecha >= HOY))
    .sort((a, b) => llave(a).localeCompare(llave(b)));
  function avisoDuplicado(lista) {
    const t = lista[0], cuando = `${fmtFecha(t.agenda.fecha)} ${t.agenda.inicio}`;
    return lista.length === 1
      ? `Ya tiene una agenda el ${cuando} (${t.id}, ${CENTRO[t.centro.estado].label})`
      : `Ya tiene ${lista.length} agendas vigentes; la próxima, el ${cuando}`;
  }
  // "Crear agenda" o "Crear N agendas", según los accesos marcados
  function actualizarBotonCrear() {
    const n = $$('input[name="accesos"]:checked', formNuevo).length;
    $('#btn-crear').textContent = n > 1 ? `Crear ${n} agendas` : 'Crear agenda';
  }
  async function cargarAccesos(pid) {
    nuevo.accesos = [];
    pintarAccesos('cargando');
    const res = await Mocks.obtenerAccesos(pid);
    if (!nuevo.proyecto || nuevo.proyecto.id !== pid) return;
    nuevo.accesos = res;
    pintarAccesos('ok');
  }

  function validarNuevo() {
    const errs = validar(leer(formNuevo), null);
    if (!nuevo.proyecto) errs.proyecto = 'Busca y elige un proyecto.';
    else if (!$$('input[name="accesos"]:checked', formNuevo).length) errs.accesos = 'Selecciona al menos un acceso.';
    return errs;
  }
  function crearAgendas() {
    const d = leer(formNuevo);
    const ids = $$('input[name="accesos"]:checked', formNuevo).map(i => i.value);
    let n = Math.max(1051, ...state.trabajos.map(t => Number(t.id.split('-')[1])));
    const creadas = ids.map(aid => {
      const a = nuevo.accesos.find(x => x.id === aid);
      n++;
      return {
        id: `TR-${n}`, proyectoId: nuevo.proyecto.id, accesoId: aid,
        contacto: Object.assign({}, a.contacto),
        ubicacion: { calle: a.calle, numero: a.numero, comuna: a.comuna, region: a.region, lat: a.lat, lon: a.lon },
        agenda: { fecha: d.a_fecha, inicio: d.a_inicio, fin: d.a_fin },
        solicitud: HOY,
        zona: a.zona, cluster: d.a_cluster,
        comentario: d.comentario.trim(),
        historial: [],
        centro: { estado: 'pendiente', mensaje: '', fecha: '', enAgenda: false },
        modificado: { usuario: USUARIO, fecha: ahora() },
        creador: USUARIO
      };
    });
    state.trabajos.push(...creadas);
    dlgNuevo.close();
    renderTodo();
    const filas = creadas.map(t => filaEl(t.id)).filter(Boolean);
    filas.forEach(r => r.classList.add('is-new'));
    if (filas[0]) filas[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast(`${creadas.length} ${plural(creadas.length, 'agenda creada', 'agendas creadas')} en la bandeja.`);
  }

  /* ------------------------------------------------------------------------
     11. Enviar ahora al Centro de operaciones (RPA simulado)
     Adelanta el envío automático: toda la cola (con revisión previa) o una
     sola agenda desde su detalle.
     fases del diálogo: revision → enviando → resultado (→ enviando, al reintentar)
     ------------------------------------------------------------------------ */
  const dlgCarga = $('#dlg-carga');
  const carga = { fase: 'revision', lista: [], res: {}, lote: [], hechos: 0 };

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
    if (state.enviando) { toast('Ya hay un envío en curso.', 'info'); return; }
    if (hayCambiosSinGuardar()) return;
    const lista = cola();
    if (!lista.length) { toast('No hay agendas pendientes de envío.', 'info'); return; }
    Object.assign(carga, { fase: 'revision', lista, res: {}, lote: [], hechos: 0 });
    pintarCarga();
    dlgCarga.showModal();
    const btn = $('#carga-foot .btn--primary');
    if (btn) btn.focus();
  }

  // Lista de agendas del envío; en el resultado solo van las fallidas, con su mensaje
  function tablaCarga(lista, conMensaje) {
    return `<table class="carga-list"><thead><tr><th class="col-id">ID</th><th>Proyecto · Acceso</th><th class="col-f">Fecha</th></tr></thead><tbody>` +
      lista.map(t => {
        const p = proyecto(t.proyectoId), a = acceso(t.accesoId), r = carga.res[t.id];
        return `<tr><td class="cell-id">${t.id}</td>
          <td><div class="cell-2"><span>${esc(p.codigo)} · Acceso ${esc(a.codigo)}</span><span class="meta">${esc(p.razonSocial)}</span>
            ${conMensaje && r ? `<span class="res-msg">${icon('alert-triangle')}${esc(r.mensaje)}</span>` : ''}</div></td>
          <td><div class="cell-2"><span>${fmtFecha(t.agenda.fecha)}</span><span class="meta">${t.agenda.inicio}–${t.agenda.fin}</span></div></td></tr>`;
      }).join('') + '</tbody></table>';
  }

  function pintarCarga() {
    const body = $('#carga-body'), foot = $('#carga-foot');
    const n = carga.lista.length;
    $$('[data-close]', dlgCarga).forEach(b => { b.disabled = carga.fase === 'enviando'; });

    if (carga.fase === 'revision') {
      body.innerHTML = `<p>Se ${plural(n, 'enviará', 'enviarán')} <strong>${n} ${plural(n, 'agenda', 'agendas')}</strong> al Centro de operaciones.</p>${tablaCarga(carga.lista)}`;
      foot.innerHTML = `<div class="dialog__actions"><button type="button" class="btn btn--ghost" data-close>Cancelar</button><button type="button" class="btn btn--primary" data-action="enviar">${icon('send')}Enviar ${n} ahora</button></div>`;
      return;
    }

    if (carga.fase === 'enviando') {
      const total = carga.lote.length;
      body.innerHTML = `<div class="progress" role="status" aria-live="polite">
          <div class="body-small-bold" id="prog-text">Enviando ${carga.hechos} de ${total}…</div>
          <div class="progress__track" role="progressbar" aria-labelledby="prog-text" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${carga.hechos}"><div class="progress__fill" style="width:${(carga.hechos / total) * 100}%"></div></div>
        </div>${tablaCarga(carga.lote)}`;
      foot.innerHTML = `<p class="body-xsmall text-tertiary">No cierres esta ventana.</p>
        <div class="dialog__actions"><button type="button" class="btn btn--primary" disabled>${icon('loader', 'spin')}Enviando…</button></div>`;
      return;
    }

    const ok = carga.lista.filter(t => carga.res[t.id] && carga.res[t.id].ok).length;
    const fallidas = carga.lista.filter(t => carga.res[t.id] && !carga.res[t.id].ok), err = fallidas.length;
    body.innerHTML = `<div class="summary">
        <div class="summary__item"><div class="summary__n">${ok}</div><div class="centro centro--enviado">${icon('check')}${plural(ok, 'Enviada', 'Enviadas')}</div></div>
        <div class="summary__item"><div class="summary__n">${err}</div><div class="centro centro--error">${icon('alert-triangle')}Con error</div></div>
      </div>${err ? `<div class="carga-err"><h3 class="body-small-bold">No se ${plural(err, 'cargó; queda', 'cargaron; quedan')} en la bandeja con Error de carga</h3>${tablaCarga(fallidas, true)}</div>` : ''}`;
    foot.innerHTML = `<div class="dialog__actions">${err
        ? `<button type="button" class="btn btn--secondary" data-close>Cerrar</button><button type="button" class="btn btn--primary" data-action="reintentar-carga">${icon('refresh')}Reintentar ${err} ${plural(err, 'fallida', 'fallidas')}</button>`
        : `<button type="button" class="btn btn--primary" data-close>Listo</button>`}</div>`;
  }

  // Marca el lote como "enviando", llama al RPA y aplica cada resultado
  async function enviarLote(lote, reintento, alResultado) {
    state.enviando = true;
    lote.forEach(t => {
      t.centro = Object.assign({}, t.centro, { estado: 'en_proceso' });
      refrescarFila(t.id);
      refrescarSlotsDetalle(t.id);
    });
    renderEnvio();
    const res = await Mocks.enviarACentro(lote.map(t => ({ id: t.id })), r => {
      const t = byId(r.id);
      if (!t) return; // eliminada mientras se enviaba
      t.centro = r.ok
        ? { estado: 'enviado', mensaje: '', fecha: ahora(), enAgenda: true }
        : { estado: 'error', mensaje: r.mensaje, fecha: ahora(), enAgenda: t.centro.enAgenda };
      refrescarFila(t.id);
      refrescarSlotsDetalle(t.id);
      if (alResultado) alResultado(r, t);
    }, { reintento });
    state.enviando = false;
    renderTodo(); // reordena la bandeja y actualiza indicadores
    return res;
  }

  async function enviarCarga(lote, reintento) {
    Object.assign(carga, { fase: 'enviando', lote, hechos: 0 });
    lote.forEach(t => { delete carga.res[t.id]; });
    pintarCarga();

    await enviarLote(lote, reintento, r => {
      carga.res[r.id] = r;
      carga.hechos++;
      const total = lote.length;
      $('#prog-text').textContent = `Enviando ${carga.hechos} de ${total}…`;
      $('.progress__fill').style.width = `${(carga.hechos / total) * 100}%`;
      $('.progress__track').setAttribute('aria-valuenow', carga.hechos);
    });

    carga.fase = 'resultado';
    pintarCarga();
    const btn = $('#carga-foot .btn--primary');
    if (btn) btn.focus(); // el resultado queda en el diálogo: sin aviso aparte
  }

  // "Enviar ahora" desde el detalle: una sola agenda, sin diálogo
  async function enviarUno(id) {
    if (state.enviando) { toast('Ya hay un envío en curso.', 'info'); return; }
    if (hayCambiosSinGuardar()) return;
    const t = byId(id);
    if (!t || !porEnviar(t)) return;
    const [r] = await enviarLote([t], t.centro.estado === 'error');
    const det = document.getElementById('det-' + id);
    if (det) $('.detail__panel', det).focus({ preventScroll: true }); // el botón desapareció
    toast(r.ok ? `${id} enviada.` : `${id} no se pudo cargar: ${r.mensaje}`, r.ok ? 'success' : 'error');
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
    if (avisar) toast(rol === 'jefatura' ? 'Rol Jefatura: puedes eliminar agendas desde su detalle.' : 'Rol Gestor de proyectos.', 'info');
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
        <div class="dl__full"><dt>Centro de operaciones</dt><dd>${centroDe(t)}</dd></div>
      </dl>`;
    // Bloqueada si ya existe en Agenda de Red o si se está enviando
    const bloqueado = t.centro.estado === 'en_proceso' || t.centro.enAgenda;
    $('#dlg-eliminar-title').textContent = bloqueado ? `No se puede eliminar ${id}` : `¿Eliminar ${id}?`;
    if (bloqueado) {
      const motivo = t.centro.estado === 'en_proceso'
        ? 'Hay un envío al Centro de operaciones en curso para esta agenda. Espera el resultado antes de cualquier cambio.'
        : 'Esta agenda ya está cargada en Agenda de Red del Centro de operaciones. Si la eliminas aquí, seguiría agendada allá sin registro en la plataforma.';
      $('#dlg-eliminar-body').innerHTML = `<div class="alert alert--warning">${icon('lock')}<div><strong>${motivo}</strong>${t.centro.enAgenda && t.centro.estado !== 'en_proceso' ? ' Para anularla, coordina la baja con el Centro de operaciones.' : ''}</div></div>${resumen}`;
      $('#dlg-eliminar-foot').innerHTML = `<div class="dialog__actions"><button type="button" class="btn btn--primary" data-close>Entendido</button></div>`;
    } else {
      $('#dlg-eliminar-body').innerHTML = `<p>La agenda desaparece de la plataforma junto con su historial de cambios. Esta acción no se puede deshacer.</p>
        ${resumen}
        <p class="body-xsmall text-tertiary">${t.centro.estado === 'error' ? 'Su último envío falló, así que no hay nada que dar de baja en Agenda de Red.' : 'Aún no se ha enviado al Centro de operaciones, así que no hay nada que dar de baja en Agenda de Red.'}</p>`;
      $('#dlg-eliminar-foot').innerHTML = `<div class="dialog__actions">
          <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
          <button type="button" class="btn btn--danger" data-action="confirmar-eliminar" data-id="${id}">${icon('trash')}Eliminar agenda</button></div>`;
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
    toast(`${id} eliminada.`);
  });

  /* --- Exportar el historial filtrado a Excel --- */
  async function exportar() {
    const lista = state.historial;
    if (!lista.length) { toast('No hay agendas para exportar con los filtros actuales.', 'info'); return; }
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
        'Fecha de solicitud': t.solicitud, 'Fecha compromiso': fechaCompromiso(t.solicitud, t.cluster),
        'Fecha': t.agenda.fecha, 'Hora inicio': t.agenda.inicio, 'Hora fin': t.agenda.fin,
        'Centro de operaciones': CENTRO[t.centro.estado].label, 'Último envío': t.centro.fecha.replace('T', ' '),
        'Mensaje Centro de operaciones': t.centro.mensaje,
        'Contacto': t.contacto.nombre, 'Teléfono': t.contacto.telefono, 'Correo': t.contacto.correo, 'Comentario': t.comentario
      };
    });
    const blob = await Mocks.exportarTrabajos(filas);
    const nombre = `agendas-enviadas-${HOY}.csv`;
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    btn.disabled = false;
    btn.innerHTML = `${icon('download')}<span>Exportar</span>`;
    toast(`Exportaste ${lista.length} ${plural(lista.length, 'agenda', 'agendas')} a ${nombre}.`);
  }
  $('#btn-exportar').addEventListener('click', exportar);

  /* ------------------------------------------------------------------------
     13. Selectores de fecha y hora (24 h)
     Campos de texto con calendario y lista de horas propios, para que el
     formato sea el mismo en todo el sistema (dd-mm-aaaa y HH:MM en 24 h) sin
     depender del navegador. Se puede escribir a mano o elegir en el selector.
     Teclado: ↓ abre el selector · flechas recorren · Enter elige · Esc cierra.
     ------------------------------------------------------------------------ */
  const pick = { input: null, pop: null, tipo: '', mes: null, activo: null };
  const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const HORAS = Array.from({ length: 24 }, (_, i) => pad2(i));
  const MINUTOS = Array.from({ length: 12 }, (_, i) => pad2(i * 5));
  const fmtLargo = iso => { const d = parseISO(iso); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`; };
  const disparar = el => ['input', 'change'].forEach(tipo => el.dispatchEvent(new Event(tipo, { bubbles: true })));

  function abrirPicker(input, conTeclado) {
    if (pick.input === input) { if (conTeclado) enfocarPicker(); return; }
    cerrarPicker();
    const pop = document.createElement('div');
    pop.className = `pop pop--${input.dataset.picker}`;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', input.dataset.picker === 'fecha' ? 'Elegir fecha' : 'Elegir hora');
    Object.assign(pick, { input, pop, tipo: input.dataset.picker, activo: null });
    // Dentro de un diálogo modal el selector va en el mismo diálogo (capa superior)
    (input.closest('dialog') || document.body).append(pop);
    input.setAttribute('aria-expanded', 'true');
    pop.addEventListener('mousedown', e => e.preventDefault()); // con el mouse, el foco sigue en el campo
    pop.addEventListener('click', clicPicker);
    pop.addEventListener('keydown', teclaPicker);
    if (pick.tipo === 'fecha') {
      const iso = fechaISO(input.value) || (input.dataset.min > HOY ? input.dataset.min : HOY);
      const d = parseISO(iso);
      pick.mes = new Date(d.getFullYear(), d.getMonth(), 1);
      pick.activo = iso;
      pintarCalendario();
    } else {
      pintarHoras();
    }
    posicionarPicker();
    if (conTeclado) enfocarPicker();
  }

  function cerrarPicker(enfocar) {
    if (!pick.pop) return;
    const input = pick.input;
    pick.pop.remove();
    input.setAttribute('aria-expanded', 'false');
    Object.assign(pick, { input: null, pop: null, activo: null });
    if (enfocar && input.isConnected) input.focus();
  }

  function enfocarPicker() {
    if (!pick.pop) return;
    const el = pick.tipo === 'fecha' ? $('.cal__dia[tabindex="0"]', pick.pop) : $('.hora__op[tabindex="0"]', pick.pop);
    if (el) el.focus();
  }

  // Bajo el campo; si no cabe, sobre él. El selector es fijo: sigue al campo al desplazar
  function posicionarPicker() {
    if (!pick.pop) return;
    if (!pick.input.isConnected) { cerrarPicker(); return; }
    const r = pick.input.closest('.picker').getBoundingClientRect(), p = pick.pop;
    const alto = p.offsetHeight, ancho = p.offsetWidth;
    const arriba = innerHeight - r.bottom < alto + 8 && r.top > alto + 8;
    p.style.top = `${arriba ? r.top - alto - 4 : r.bottom + 4}px`;
    p.style.left = `${Math.max(8, Math.min(r.left, innerWidth - ancho - 8))}px`;
  }

  /* --- Calendario --- */
  function pintarCalendario() {
    if (!pick.pop) return;
    const input = pick.input, sel = fechaISO(input.value);
    const min = input.dataset.min || '', max = input.dataset.max || '';
    const y = pick.mes.getFullYear(), mo = pick.mes.getMonth();
    const lunes = new Date(y, mo, 1 - ((pick.mes.getDay() + 6) % 7)); // la semana parte el lunes
    let filas = '';
    for (let w = 0; w < 6; w++) {
      filas += '<tr>';
      for (let k = 0; k < 7; k++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + w * 7 + k);
        const iso = isoOf(d), off = (min && iso < min) || (max && iso > max);
        filas += `<td><button type="button" class="cal__dia${d.getMonth() !== mo ? ' is-fuera' : ''}" data-iso="${iso}" tabindex="${iso === pick.activo ? 0 : -1}"` +
          `${iso === sel ? ' aria-selected="true"' : ''}${iso === HOY ? ' aria-current="date"' : ''}${off ? ' disabled' : ''} aria-label="${fmtLargo(iso)}">${d.getDate()}</button></td>`;
      }
      filas += '</tr>';
    }
    const hoyOff = (min && HOY < min) || (max && HOY > max);
    pick.pop.innerHTML = `<div class="cal__head">
        <button type="button" class="icon-btn" data-cal="-1" aria-label="Mes anterior">${icon('chevron-left')}</button>
        <span class="cal__mes" aria-live="polite">${MESES_LARGO[mo]} ${y}</span>
        <button type="button" class="icon-btn" data-cal="1" aria-label="Mes siguiente">${icon('chevron-right')}</button>
      </div>
      <table class="cal__grid" role="grid" aria-label="${MESES_LARGO[mo]} ${y}">
        <thead><tr>${['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map((x, i) => `<th scope="col" abbr="${DIAS_LARGO[(i + 1) % 7]}">${x}</th>`).join('')}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="cal__foot"><button type="button" class="btn btn--ghost btn--sm" data-cal="hoy"${hoyOff ? ' disabled' : ''}>Hoy</button></div>`;
    // Si el día activo no está en la grilla (cambio de mes con las flechas del encabezado), el primero del mes
    if (!$('.cal__dia[tabindex="0"]', pick.pop)) {
      const primero = $$('.cal__dia:not(.is-fuera):not([disabled])', pick.pop)[0];
      if (primero) { primero.tabIndex = 0; pick.activo = primero.dataset.iso; }
    }
  }

  function moverMes(n) {
    pick.mes = new Date(pick.mes.getFullYear(), pick.mes.getMonth() + n, 1);
    pick.activo = null;
    pintarCalendario();
  }

  function elegirFecha(iso) {
    const input = pick.input;
    input.value = fechaTxt(iso);
    disparar(input);
    cerrarPicker(true);
  }

  /* --- Horas: dos columnas, hora (00–23) y minutos (de 5 en 5) --- */
  function pintarHoras() {
    const [h, m] = (horaNorm(pick.input.value) || '').split(':');
    const col = (k, label, vals, actual, defecto) => `<div class="hora__col">
        <span class="hora__lbl" id="pk-${k}">${label}</span>
        <div class="hora__list" role="listbox" aria-labelledby="pk-${k}" data-col="${k}">${vals.map(v =>
          `<button type="button" role="option" class="hora__op" data-${k}="${v}" aria-selected="${v === actual}" tabindex="${v === (vals.includes(actual) ? actual : defecto) ? 0 : -1}">${v}</button>`).join('')}</div>
      </div>`;
    pick.pop.innerHTML = `<div class="hora__cols">${col('h', 'Hora', HORAS, h, '09')}${col('m', 'Min', MINUTOS, m, '00')}</div>`;
    // Cada lista muestra centrada la opción elegida (o la sugerida)
    $$('.hora__list', pick.pop).forEach(list => {
      const op = $('[tabindex="0"]', list);
      if (op) list.scrollTop = op.offsetTop - list.clientHeight / 2 + op.offsetHeight / 2;
    });
  }

  function elegirHora(h, m, cerrar) {
    const input = pick.input;
    const [h0, m0] = (horaNorm(input.value) || '').split(':');
    input.value = `${h || h0 || '09'}:${m || m0 || '00'}`;
    disparar(input);
    if (cerrar) { cerrarPicker(true); return; }
    // Marca la elección sin repintar, para no mover el desplazamiento de las listas
    $$('.hora__op', pick.pop).forEach(op => {
      const v = op.dataset.h || op.dataset.m, actual = op.dataset.h ? input.value.slice(0, 2) : input.value.slice(3);
      op.setAttribute('aria-selected', String(v === actual));
    });
  }

  /* --- Eventos del selector --- */
  function clicPicker(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.cal === 'hoy') elegirFecha(HOY);
    else if (b.dataset.cal) {
      const conFoco = pick.pop.contains(document.activeElement);
      moverMes(Number(b.dataset.cal));
      if (conFoco) $(`[data-cal="${b.dataset.cal}"]`, pick.pop).focus();
    }
    else if (b.dataset.iso) elegirFecha(b.dataset.iso);
    else if (b.dataset.h) elegirHora(b.dataset.h, '', false);
    else if (b.dataset.m) elegirHora('', b.dataset.m, true);
  }

  function teclaPicker(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarPicker(true); return; }
    const t = e.target;
    if (t.classList.contains('cal__dia')) {
      const saltos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      const d = parseISO(t.dataset.iso);
      if (e.key in saltos) d.setDate(d.getDate() + saltos[e.key]);
      else if (e.key === 'Home') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      else if (e.key === 'End') d.setDate(d.getDate() + (7 - d.getDay()) % 7);
      else if (e.key === 'PageUp' || e.key === 'PageDown') d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1));
      else return;
      e.preventDefault();
      pick.activo = isoOf(d);
      pick.mes = new Date(d.getFullYear(), d.getMonth(), 1);
      pintarCalendario();
      enfocarPicker();
    } else if (t.classList.contains('hora__op')) {
      const list = t.parentElement, ops = $$('.hora__op', list), i = ops.indexOf(t);
      let dest = null;
      if (e.key === 'ArrowDown') dest = ops[Math.min(i + 1, ops.length - 1)];
      else if (e.key === 'ArrowUp') dest = ops[Math.max(i - 1, 0)];
      else if (e.key === 'Home') dest = ops[0];
      else if (e.key === 'End') dest = ops[ops.length - 1];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const otra = $(`.hora__list[data-col="${list.dataset.col === 'h' ? 'm' : 'h'}"]`, pick.pop);
        dest = $('[tabindex="0"]', otra);
      } else return;
      e.preventDefault();
      if (dest.parentElement === list) { ops.forEach(o => { o.tabIndex = -1; }); dest.tabIndex = 0; }
      dest.focus();
      dest.scrollIntoView({ block: 'nearest' });
    }
  }

  // Al salir del campo: completa el formato (9 → 09:00 · 3-12 → 03-12-2026)
  function normalizarCampo(input) {
    const v = input.value.trim();
    if (!v) return;
    const n = input.dataset.picker === 'fecha' ? fechaISO(v) : horaNorm(v);
    const txt = n ? (input.dataset.picker === 'fecha' ? fechaTxt(n) : n) : null;
    if (txt && txt !== input.value) { input.value = txt; disparar(input); }
  }

  document.addEventListener('click', e => {
    const input = e.target.closest('.picker__input');
    if (input) abrirPicker(input, false);
  });
  document.addEventListener('mousedown', e => {
    const btn = e.target.closest('.picker__btn');
    if (btn) {
      e.preventDefault(); // el ícono no se lleva el foco
      const input = $('.picker__input', btn.parentElement);
      if (pick.input === input) cerrarPicker(true);
      else { input.focus(); abrirPicker(input, false); }
      return;
    }
    if (pick.pop && !pick.pop.contains(e.target) && e.target !== pick.input) cerrarPicker();
  });
  document.addEventListener('keydown', e => {
    const input = e.target.closest && e.target.closest('.picker__input');
    if (!input) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); abrirPicker(input, true); }
    else if (e.key === 'Escape' && pick.input === input) { e.preventDefault(); e.stopPropagation(); cerrarPicker(); }
  });
  document.addEventListener('input', e => {
    const input = e.target.closest && e.target.closest('.picker__input');
    if (!input || !e.isTrusted) return;
    // Solo los caracteres del formato
    const limpio = input.value.replace(input.dataset.picker === 'fecha' ? /[^\d\-/.]/g : /[^\d:]/g, '');
    if (limpio !== input.value) input.value = limpio;
    // Con el selector abierto, lo escrito se refleja en él
    if (pick.input !== input) return;
    if (pick.tipo === 'fecha') {
      const iso = fechaISO(input.value);
      if (iso) { const d = parseISO(iso); pick.mes = new Date(d.getFullYear(), d.getMonth(), 1); pick.activo = iso; pintarCalendario(); }
    } else if (horaNorm(input.value)) pintarHoras();
  });
  document.addEventListener('focusout', e => {
    const input = e.target.closest && e.target.closest('.picker__input');
    const destino = e.relatedTarget;
    // Se cierra si el foco quedó fuera del campo y del selector. Se revisa después del
    // evento: al repintar el calendario, el día enfocado se reemplaza por uno nuevo.
    if (pick.pop) setTimeout(() => {
      const a = document.activeElement;
      if (pick.pop && a !== pick.input && !pick.pop.contains(a)) cerrarPicker();
    });
    if (input && !(destino && destino.closest('.pop'))) normalizarCampo(input);
  }, true); // en captura: el formato se completa antes de validar
  document.addEventListener('scroll', posicionarPicker, true);
  window.addEventListener('resize', posicionarPicker);
  $$('dialog').forEach(d => d.addEventListener('close', () => cerrarPicker()));

  /* ------------------------------------------------------------------------
     14. Sidebar, filtros, eventos e inicio
     ------------------------------------------------------------------------ */
  /* --- Tooltip de info: Esc lo oculta sin quitar el foco --- */
  document.addEventListener('keydown', e => {
    const tip = e.key === 'Escape' && e.target.closest && e.target.closest('.info-tip');
    if (tip) tip.classList.add('info-tip--oculto');
  });
  document.addEventListener('mouseout', e => {
    const tip = e.target.closest && e.target.closest('.info-tip');
    if (tip && !tip.contains(e.relatedTarget)) tip.classList.remove('info-tip--oculto');
  });
  document.addEventListener('focusout', e => {
    const tip = e.target.closest && e.target.closest('.info-tip');
    if (tip) tip.classList.remove('info-tip--oculto');
  });

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

  /* --- Filtros del historial --- */
  const formFiltros = $('#filtros');
  function aplicarFiltros() {
    const f = formFiltros.elements;
    // Una fecha mal escrita no filtra: se marca en rojo hasta corregirla
    const fecha = el => { const iso = fechaISO(el.value); el.setAttribute('aria-invalid', String(iso === null)); return iso || ''; };
    const desde = fecha(f.desde), hasta = fecha(f.hasta);
    Object.assign(state.filtros, { quien: f.quien.value, q: f.q.value, zona: f.zona.value, desde, hasta });
    f.hasta.dataset.min = desde;
    f.desde.dataset.max = hasta;
    // "Ver" no es un filtro que se limpie: Limpiar deja la vista elegida
    $('#btn-limpiar').hidden = ![state.filtros.q, state.filtros.zona, desde, hasta].some(Boolean);
    state.pagina = 1;
    renderTablas();
  }
  function limpiarFiltros() {
    const quien = state.filtros.quien;
    formFiltros.reset();
    formFiltros.elements.quien.value = quien;
    aplicarFiltros();
    $('#f-q').focus();
  }
  $('#f-q').addEventListener('input', debounce(aplicarFiltros, 200));
  ['f-zona', 'f-desde', 'f-hasta', 'f-quien-mias', 'f-quien-todas'].forEach(id => $('#' + id).addEventListener('change', aplicarFiltros));
  $('#btn-limpiar').addEventListener('click', limpiarFiltros);
  $('#pager').addEventListener('click', e => {
    const b = e.target.closest('[data-pagina]');
    if (b && !b.disabled) irAPagina(Number(b.dataset.pagina), b.getAttribute('aria-label'));
  });

  /* --- Tablas: clics y formularios de detalle (bandeja e historial) --- */
  [tbodyB, tbodyH].forEach(tb => {
    tb.addEventListener('click', e => {
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
          $('[data-slot="compromiso"]', form).innerHTML = compromisoHTML(byId(form.dataset.id).solicitud, form.elements.a_cluster.value);
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
    ['input', 'change'].forEach(tipo => tb.addEventListener(tipo, e => {
      const form = e.target.closest('form.detail');
      if (!form) return;
      if (/^c_/.test(e.target.name)) actualizarNotasContacto(form);
      if (e.target.name === 'a_cluster') $('[data-slot="compromiso"]', form).innerHTML = compromisoHTML(byId(form.dataset.id).solicitud, e.target.value);
      actualizarDirty(form);
      validarEnVivo(form);
    }));
    tb.addEventListener('focusout', e => {
      const form = e.target.closest('form.detail');
      if (!form || !e.target.name || (e.relatedTarget && e.relatedTarget.closest('.pop'))) return;
      tocados.get(form).add(e.target.name);
      if (e.target.name === 'a_inicio') tocados.get(form).add('a_fin');
      validarEnVivo(form);
    });
    tb.addEventListener('submit', e => {
      const form = e.target.closest('form.detail');
      if (!form) return;
      e.preventDefault();
      guardarDetalle(form);
    });
  });

  /* --- Botones de la bandeja --- */
  $('#btn-nuevo').addEventListener('click', abrirNuevo);
  $('#btn-enviar').addEventListener('click', abrirCarga);

  /* --- Diálogo nueva agenda --- */
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
    if (e.target.name === 'accesos') actualizarBotonCrear();
    if (e.target.name === 'accesos' && nuevo.enviado) mostrarErrores(formNuevo, validarNuevo(), new Set(['accesos']));
    if (e.target.name === 'a_cluster') $('#n-compromiso').innerHTML = compromisoHTML(HOY, e.target.value);
  });
  formNuevo.addEventListener('keydown', e => {
    // Enter en un campo no envía el formulario
    if (e.key === 'Enter' && e.target.matches('input:not([type="checkbox"])') && e.target !== cbInput) e.preventDefault();
  });
  function validarNuevoEnVivo() {
    mostrarErrores(formNuevo, validarNuevo(), nuevo.enviado ? null : nuevo.tocados);
  }
  formNuevo.addEventListener('focusout', e => {
    if (!e.target.name || e.target.name === 'accesos' || (e.relatedTarget && e.relatedTarget.closest('.pop'))) return;
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
    nuevo.enviado = true;
    const errs = validarNuevo();
    mostrarErrores(formNuevo, errs);
    if (Object.keys(errs).length) { enfocarPrimerError(formNuevo); return; }
    crearAgendas();
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
  });

  /* --- Inicio --- */
  function cargarListado() {
    state.cargando = true;
    state.error = false;
    renderTodo();
    Mocks.listarTrabajos(simular)
      .then(d => {
        state.trabajos = d;
        // ?simular=corte: simula el cambio de día (lo enviado hoy pasa al historial)
        if (simular === 'corte') {
          const pasan = d.filter(t => t.centro.estado === 'enviado' && enBandeja(t)).length;
          state.corte = ahora();
          setTimeout(() => toast(`Simulación de cambio de día: ${pasan} ${plural(pasan, 'agenda pasó', 'agendas pasaron')} a Agendas enviadas.`, 'info'), 300);
        }
      })
      .catch(() => { state.error = true; })
      .finally(() => { state.cargando = false; renderTodo(); });
  }

  $('#f-zona').insertAdjacentHTML('beforeend', DATOS.ZONAS.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join(''));

  let contraido = false, rolGuardado = 'gestor';
  try {
    contraido = localStorage.getItem('agenda-sb') === '1';
    if (localStorage.getItem('agenda-rol') === 'jefatura') rolGuardado = 'jefatura';
  } catch (e) { /* sin almacenamiento */ }
  setSidebar(contraido);
  setRol(rolGuardado, false);
  cargarListado();
  setInterval(tick, 15000); // cuenta regresiva y envío automático
})();
