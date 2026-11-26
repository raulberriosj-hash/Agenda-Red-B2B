/* ==========================================================================
   Capa de servicios
   Único punto de conexión con el backend. app.js solo llama a Api.*; cada
   función devuelve una Promise. El contrato de datos está en README.md.

   Para conectar:
   1. Completa CONFIG.baseUrl y ajusta las rutas de cada función.
   2. Cambia CONFIG.usarMocks a false.
   3. Quita data.js y mocks.js de index.html.
   ========================================================================== */
window.Api = (function () {
  const CONFIG = {
    usarMocks: true,
    baseUrl: '/api',
    headers: { 'Content-Type': 'application/json' }
  };

  async function pedir(metodo, ruta, cuerpo) {
    const res = await fetch(CONFIG.baseUrl + ruta, {
      method: metodo,
      headers: CONFIG.headers,
      credentials: 'include',
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    if (!res.ok) {
      const detalle = await res.json().catch(() => ({}));
      throw new Error(detalle.mensaje || `Error ${res.status} en ${metodo} ${ruta}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // CSV con BOM UTF-8 y separador ';' (Excel en español lo abre directo)
  function aCSV(filas) {
    const columnas = filas.length ? Object.keys(filas[0]) : [];
    const celda = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const csv = [columnas.map(celda).join(';')]
      .concat(filas.map(f => columnas.map(c => celda(f[c])).join(';')))
      .join('\r\n');
    return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  }

  const servicios = {
    /** @returns {Promise<Sesion>} usuario conectado */
    obtenerSesion: () => pedir('GET', '/sesion'),

    /** @returns {Promise<Catalogos>} zonas y clusters */
    obtenerCatalogos: () => pedir('GET', '/catalogos'),

    /** @returns {Promise<Agenda[]>} agendas de la bandeja y enviadas, de todos los gestores */
    listarAgendas: () => pedir('GET', '/agendas'),

    /** GetBacklog. @returns {Promise<Proyecto[]>} hasta 8 coincidencias por código, razón social o segmento */
    buscarProyectos: q => pedir('GET', `/proyectos?q=${encodeURIComponent(q)}`),

    /** Base de Accesos. @returns {Promise<Acceso[]>} */
    obtenerAccesos: proyectoId => pedir('GET', `/proyectos/${encodeURIComponent(proyectoId)}/accesos`),

    /** @param {NuevaAgenda} datos @returns {Promise<Agenda[]>} una agenda por acceso */
    crearAgendas: datos => pedir('POST', '/agendas', datos),

    /** @param {CambiosAgenda} cambios @returns {Promise<Agenda>} la agenda actualizada */
    actualizarAgenda: (id, cambios) => pedir('PATCH', `/agendas/${encodeURIComponent(id)}`, cambios),

    /** Solo Jefatura. */
    eliminarAgenda: id => pedir('DELETE', `/agendas/${encodeURIComponent(id)}`),

    /**
     * Envío al Centro de operaciones (RPA). Llama a alResultado por cada
     * agenda apenas tiene su resultado, para mostrar el progreso.
     * @param {string[]} ids
     * @param {(r: ResultadoEnvio) => void} alResultado
     * @returns {Promise<ResultadoEnvio[]>}
     */
    async enviarACentro(ids, alResultado) {
      const resultados = [];
      for (const id of ids) {
        let r;
        try {
          r = await pedir('POST', `/agendas/${encodeURIComponent(id)}/envio`);
        } catch (e) {
          r = { id, centro: null, mensaje: e.message };
        }
        resultados.push(r);
        alResultado(r);
      }
      return resultados;
    },

    /** @returns {Promise<Blob>} archivo para descargar */
    exportarAgendas: async filas => aCSV(filas)
  };

  return CONFIG.usarMocks && window.Mocks ? Object.assign({}, servicios, window.Mocks) : servicios;
})();
