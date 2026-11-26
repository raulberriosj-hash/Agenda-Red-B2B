/* ==========================================================================
   Mocks de servicios
   Misma firma que Api (api.js) y datos de data.js, guardados en memoria.
   Simulan también las reglas del backend que la interfaz espera:
   historial de cambios, vuelta a Pendiente al editar, IDs nuevos y el envío
   automático cada 10 minutos. Se activan con CONFIG.usarMocks en api.js.
   ========================================================================== */
window.Mocks = (function () {
  const SESION = { id: 'U1', nombre: 'Camila Rojas', rol: 'gestor' }; // rol: 'gestor' | 'jefatura'
  const INTERVALO_MIN = 10;
  const ERRORES = [
    'Tiempo de espera agotado al conectar con Agenda de Red.',
    'Agenda de Red rechazó el horario: fuera de la ventana del sitio.',
    'El acceso no tiene código de sitio asociado en Agenda de Red.',
    'Sesión del RPA expirada. Reintenta la carga.'
  ];

  const espera = ms => new Promise(r => setTimeout(r, ms));
  const copia = o => JSON.parse(JSON.stringify(o));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad2 = n => String(n).padStart(2, '0');
  function ahora() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  const tramo = () => { const d = new Date(); return Math.floor((d.getHours() * 60 + d.getMinutes()) / INTERVALO_MIN); };

  const agendas = copia(DATOS.AGENDAS);
  const buscar = id => {
    const t = agendas.find(x => x.id === id);
    if (!t) throw new Error(`No existe la agenda ${id}.`);
    return t;
  };
  let ultimoTramo = tramo();

  function resultadoRPA(t, tasaError) {
    const ok = Math.random() > tasaError;
    t.centro = ok
      ? { estado: 'enviado', mensaje: '', fecha: ahora(), enAgenda: true }
      : { estado: 'error', mensaje: ERRORES[Math.floor(Math.random() * ERRORES.length)], fecha: ahora(), enAgenda: t.centro.enAgenda };
    return { id: t.id, centro: copia(t.centro) };
  }

  // El backend real hace este envío por su cuenta; el mock lo hace al listar
  function envioAutomatico() {
    const t = tramo();
    if (t === ultimoTramo) return;
    ultimoTramo = t;
    agendas.filter(a => a.centro.estado === 'pendiente' || a.centro.estado === 'error')
      .forEach(a => resultadoRPA(a, 0.2));
  }

  async function obtenerSesion() {
    await espera(150);
    return copia(SESION);
  }

  async function obtenerCatalogos() {
    await espera(150);
    return copia(DATOS.CATALOGOS);
  }

  async function listarAgendas() {
    await espera(600);
    envioAutomatico();
    return copia(agendas);
  }

  async function buscarProyectos(q) {
    await espera(350);
    const n = norm(q);
    return copia(DATOS.PROYECTOS.filter(p => norm(`${p.codigo} ${p.razonSocial} ${p.segmento}`).includes(n)).slice(0, 8));
  }

  async function obtenerAccesos(proyectoId) {
    await espera(550);
    return copia(DATOS.ACCESOS.filter(a => a.proyectoId === proyectoId));
  }

  async function crearAgendas(datos) {
    await espera(400);
    let n = Math.max(...agendas.map(t => Number(t.id.split('-')[1])));
    const creadas = datos.accesoIds.map(aid => {
      const ac = DATOS.ACCESOS.find(a => a.id === aid);
      return DATOS.nuevaAgenda(`TR-${++n}`, ac, {
        agenda: copia(datos.agenda),
        solicitud: ahora().slice(0, 10),
        cluster: datos.cluster,
        comentario: datos.comentario,
        modificado: { usuarioId: SESION.id, usuario: SESION.nombre, fecha: ahora() },
        creadorId: SESION.id,
        creador: SESION.nombre
      });
    });
    agendas.push(...creadas);
    return copia(creadas);
  }

  async function actualizarAgenda(id, cambios) {
    await espera(300);
    const t = buscar(id), fecha = ahora();
    const pares = [
      ['fecha', t.agenda.fecha, cambios.agenda.fecha], ['inicio', t.agenda.inicio, cambios.agenda.inicio],
      ['fin', t.agenda.fin, cambios.agenda.fin], ['zona', t.zona, cambios.zona], ['cluster', t.cluster, cambios.cluster],
      ['comentario', t.comentario, cambios.comentario],
      ['c_nombre', t.contacto.nombre, cambios.contacto.nombre], ['c_telefono', t.contacto.telefono, cambios.contacto.telefono],
      ['c_correo', t.contacto.correo, cambios.contacto.correo]
    ].filter(([, antes, despues]) => (antes || '') !== (despues || ''));
    t.historial.push(...pares.map(([campo, antes, despues]) => ({ fecha, usuario: SESION.nombre, campo, antes: antes || '', despues: despues || '' })));
    Object.assign(t, copia(cambios), { modificado: { usuarioId: SESION.id, usuario: SESION.nombre, fecha } });
    if (pares.length && t.centro.estado !== 'pendiente') t.centro = Object.assign({}, t.centro, { estado: 'pendiente', mensaje: '' });
    return copia(t);
  }

  async function eliminarAgenda(id) {
    await espera(300);
    const t = buscar(id);
    if (SESION.rol !== 'jefatura') throw new Error('Solo Jefatura puede eliminar agendas.');
    if (t.centro.enAgenda) throw new Error('La agenda ya está cargada en Agenda de Red.');
    agendas.splice(agendas.indexOf(t), 1);
    return null;
  }

  // Responde agenda por agenda con latencia variable; ~30 % de error en el primer intento
  async function enviarACentro(ids, alResultado) {
    let acumulado = 0;
    return Promise.all(ids.map(id => {
      acumulado += 500 + Math.random() * 900;
      return espera(acumulado).then(() => {
        const t = buscar(id);
        const r = resultadoRPA(t, t.centro.estado === 'error' ? 0.15 : 0.3);
        alResultado(r);
        return r;
      });
    }));
  }

  return { obtenerSesion, obtenerCatalogos, listarAgendas, buscarProyectos, obtenerAccesos, crearAgendas, actualizarAgenda, eliminarAgenda, enviarACentro };
})();
