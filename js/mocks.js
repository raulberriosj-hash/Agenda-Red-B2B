/* ==========================================================================
   MOCKS DE SERVICIOS
   Cada función devuelve una Promise, como lo haría la API real. Para conectar
   el prototipo a los servicios reales basta con reemplazar este archivo.
   - listarTrabajos  → backend de la plataforma
   - buscarProyectos → API GetBacklog
   - obtenerAccesos  → Base de Accesos
   - enviarACentro   → RPA que carga en Agenda de Red del Centro de operaciones
   - exportarTrabajos → exportación a Excel de la vista filtrada
   ========================================================================== */
window.Mocks = (function () {
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const copia = o => JSON.parse(JSON.stringify(o));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let fallosListado = 0;

  /* --- Listado inicial de trabajos ---------------------------------------
     Escenarios para revisar estados: ?simular=error  |  ?simular=vacio      */
  async function listarTrabajos(simular) {
    await espera(700);
    if (simular === 'error' && fallosListado === 0) {
      fallosListado++;
      throw new Error('No pudimos conectar con el servidor.');
    }
    if (simular === 'vacio') return [];
    return copia(DATOS.TRABAJOS);
  }

  /* --- GetBacklog: búsqueda por código, nombre o cliente ------------------ */
  async function buscarProyectos(q) {
    await espera(350);
    const n = norm(q);
    return copia(DATOS.PROYECTOS.filter(p => norm(p.codigo + ' ' + p.razonSocial + ' ' + p.segmento).includes(n)).slice(0, 8));
  }

  /* --- Base de Accesos: accesos de un proyecto --------------------------- */
  async function obtenerAccesos(proyectoId) {
    await espera(550);
    return copia(DATOS.ACCESOS.filter(a => a.proyectoId === proyectoId));
  }

  /* --- RPA: carga en Agenda de Red ---------------------------------------
     Responde registro a registro con latencia variable y ~30 % de errores
     en el primer intento (15 % en reintentos).                              */
  const ERRORES = [
    'Tiempo de espera agotado al conectar con Agenda de Red.',
    'Agenda de Red rechazó el horario: fuera de la ventana del sitio.',
    'El acceso no tiene código de sitio asociado en Agenda de Red.',
    'Sesión del RPA expirada. Reintenta la carga.'
  ];
  async function enviarACentro(trabajos, alResultado, { reintento = false } = {}) {
    const tasa = reintento ? 0.15 : 0.3;
    let acumulado = 0;
    const tareas = trabajos.map(tr => {
      acumulado += 500 + Math.random() * 900;
      const demora = acumulado;
      return espera(demora).then(() => {
        const ok = Math.random() > tasa;
        const res = ok
          ? { id: tr.id, ok: true }
          : { id: tr.id, ok: false, mensaje: ERRORES[Math.floor(Math.random() * ERRORES.length)] };
        alResultado(res);
        return res;
      });
    });
    return Promise.all(tareas);
  }

  /* --- Exportación a Excel ---------------------------------------------
     Recibe filas planas { columna: valor } y devuelve un CSV que Excel abre
     directo (BOM UTF-8 y separador ';', como Excel en español). En
     producción lo reemplaza el endpoint que genera el .xlsx.                */
  async function exportarTrabajos(filas) {
    await espera(450);
    const columnas = filas.length ? Object.keys(filas[0]) : [];
    const celda = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const csv = [columnas.map(celda).join(';')]
      .concat(filas.map(f => columnas.map(c => celda(f[c])).join(';')))
      .join('\r\n');
    return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  }

  return { listarTrabajos, buscarProyectos, obtenerAccesos, enviarACentro, exportarTrabajos };
})();
