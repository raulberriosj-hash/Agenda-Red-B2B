/* ==========================================================================
   DATOS SIMULADOS
   Proyectos (lo que devolvería GetBacklog), accesos (Base de Accesos) y
   18 trabajos de ejemplo (algunos con historial de cambios). Las fechas son relativas a hoy para que el
   prototipo siempre tenga trabajos pasados, de hoy y futuros.
   Los campos de sistema (razón social, calle, comuna, región) van en
   mayúsculas, como llegan desde las plataformas de origen.
   ========================================================================== */
(function () {
  /* --- Fechas relativas ------------------------------------------------- */
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fecha(offset) {
    const d = new Date(hoy);
    d.setDate(d.getDate() + offset);
    return iso(d);
  }
  function marca(offset, hora) {
    return fecha(offset) + 'T' + hora;
  }

  /* --- Catálogos -------------------------------------------------------- */
  const REGIONES = [
    'XV REGION', 'I REGION', 'II REGION', 'III REGION', 'IV REGION', 'V REGION', 'XIII REGION',
    'VI REGION', 'VII REGION', 'XVI REGION', 'VIII REGION', 'IX REGION', 'XIV REGION', 'X REGION',
    'XI REGION', 'XII REGION'
  ];
  const ZONAS = ['ZONA 1', 'ZONA 2', 'ZONA 3', 'ZONA 4', 'ZONA 5', 'ZONA 6', 'ZONA 7', 'ZONA 8'];
  const CLUSTERS = ['C1', 'C2', 'C3', 'C4'];
  const COMUNAS = [
    'ANTOFAGASTA', 'CERRILLOS', 'CHILLAN', 'CONCEPCION', 'IQUIQUE', 'LA FLORIDA', 'LA SERENA', 'LAS CONDES',
    'MAIPU', 'ÑUÑOA', 'PROVIDENCIA', 'PUDAHUEL', 'PUERTO MONTT', 'PUNTA ARENAS', 'RANCAGUA',
    'SANTIAGO', 'TALCA', 'TEMUCO', 'VALDIVIA', 'VIÑA DEL MAR', 'VITACURA'
  ];

  /* --- Proyectos (GetBacklog) -------------------------------------------
     Información general: código, razón social, segmento, tipo de trabajo,
     topología y agencia.                                                    */
  function p(id, codigo, razonSocial, segmento, tipo, topologia, agencia) {
    return { id, codigo, razonSocial, segmento, tipo, topologia, agencia };
  }
  const PROYECTOS = [
    p('P1', 'CHI-004741272-2', 'SOC PRO AYUDA DEL NIÑO LISIADO', 'B2B - Mayorista', 'HAB', 'P2P', 'SIN DATO'),
    p('P2', 'CHI-004752118-1', 'FARMACIAS DEL VALLE S.A.', 'B2B - Corporaciones', 'HAB', 'P2P', 'AGENCIA SANTIAGO CENTRO'),
    p('P3', 'CHI-004760935-4', 'TRANSPORTES CORDILLERA SPA', 'B2B - Empresas', 'UPGRADE', 'MPLS', 'AGENCIA ANTOFAGASTA'),
    p('P4', 'CHI-004768201-0', 'CLINICA SAN RAFAEL', 'B2B - Mayorista', 'HAB', 'MPLS', 'AGENCIA LAS CONDES'),
    p('P5', 'CHI-004771456-3', 'CONSTRUCTORA ANDES SUR S.A.', 'B2B - Empresas', 'TRASLADO', 'P2P', 'AGENCIA CONCEPCION'),
    p('P6', 'CHI-004779020-7', 'VIÑA SANTA MARTA LTDA.', 'B2B - Pyme', 'BAJA', 'P2P', 'SIN DATO'),
    p('P7', 'CHI-004783377-5', 'UNIVERSIDAD DEL PACIFICO', 'B2B - Corporaciones', 'HAB', 'SD-WAN', 'AGENCIA RANCAGUA'),
    p('P8', 'CHI-004790642-9', 'RETAIL AUSTRAL SPA', 'B2B - Mayorista', 'HAB', 'MPLS', 'AGENCIA PUNTA ARENAS'),
    p('P9', 'CHI-004795510-2', 'BANCO REGIONAL DEL SUR', 'B2B - Corporaciones', 'UPGRADE', 'MPLS', 'AGENCIA VALDIVIA')
  ];

  /* --- Accesos (Base de Accesos) ----------------------------------------
     Ubicación, zona y cluster por defecto, y contacto en sitio.            */
  function c(nombre, telefono, correo) { return { nombre, telefono, correo }; }
  function a(id, proyectoId, codigo, calle, numero, comuna, region, lat, lon, zona, cluster, contacto) {
    return { id, proyectoId, codigo, calle, numero, comuna, region, lat, lon, zona, cluster, contacto };
  }
  const ACCESOS = [
    a('A01', 'P1', '208481', 'AV. ARGENTINA', '1157', 'CHILLAN', 'VIII REGION', '0.000000', '0.000000', 'ZONA 7', 'C1', c('Gustavo Saldias', '939412174', 'cliente@cliente.cl')),
    a('A11', 'P2', '208512', 'AV. PROVIDENCIA', '2133', 'PROVIDENCIA', 'XIII REGION', '-33.421300', '-70.610700', 'ZONA 1', 'C2', c('Daniela Muñoz', '981234471', 'dmunoz@farmaciasdelvalle.cl')),
    a('A12', 'P2', '208513', 'AV. IRARRAZAVAL', '3450', 'ÑUÑOA', 'XIII REGION', '-33.454700', '-70.594600', 'ZONA 1', 'C2', c('Felipe Araya', '973452290', 'faraya@farmaciasdelvalle.cl')),
    a('A13', 'P2', '208514', 'AV. LIBERTAD', '1120', 'VIÑA DEL MAR', 'V REGION', '-33.015300', '-71.550000', 'ZONA 3', 'C1', c('Carolina Vega', '966120384', 'cvega@farmaciasdelvalle.cl')),
    a('A21', 'P3', '209870', 'CAMINO LO BOZA', '120', 'PUDAHUEL', 'XIII REGION', '-33.408900', '-70.765000', 'ZONA 2', 'C3', c('Rodrigo Saavedra', '990215537', 'rsaavedra@tcordillera.cl')),
    a('A22', 'P3', '209871', 'AV. GRECIA', '1890', 'ANTOFAGASTA', 'II REGION', '-23.660000', '-70.398000', 'ZONA 5', 'C1', c('Marcela Tapia', '954801176', 'mtapia@tcordillera.cl')),
    a('A23', 'P3', '209872', 'RUTA 5 SUR KM 1020', 'S/N', 'PUERTO MONTT', 'X REGION', '-41.469300', '-72.942400', 'ZONA 8', 'C2', c('Jorge Oyarzún', '', 'joyarzun@tcordillera.cl')),
    a('A31', 'P4', '210455', 'AV. VITACURA', '5950', 'VITACURA', 'XIII REGION', '-33.390000', '-70.573000', 'ZONA 1', 'C1', c('Andrés Fuenzalida', '227548800', 'soporte.ti@clinicasanrafael.cl')),
    a('A32', 'P4', '210456', 'AV. VICUÑA MACKENNA', '7110', 'LA FLORIDA', 'XIII REGION', '-33.522000', '-70.598000', 'ZONA 2', 'C2', c('Paula Riquelme', '988773012', 'priquelme@clinicasanrafael.cl')),
    a('A41', 'P5', '211390', "O'HIGGINS", '940', 'CONCEPCION', 'VIII REGION', '-36.827000', '-73.050000', 'ZONA 7', 'C1', c('Héctor Sandoval', '977106645', 'hsandoval@andessur.cl')),
    a('A42', 'P5', '211391', 'AV. ALEMANIA', '0671', 'TEMUCO', 'IX REGION', '-38.736000', '-72.610000', 'ZONA 7', 'C3', c('Valentina Catrileo', '962349981', 'vcatrileo@andessur.cl')),
    a('A43', 'P5', '211392', 'AV. FRANCISCO DE AGUIRRE', '0350', 'LA SERENA', 'IV REGION', '-29.905000', '-71.256000', 'ZONA 4', 'C1', c('Ignacio Rivera', '991562207', 'irivera@andessur.cl')),
    a('A51', 'P6', '212020', 'CAMINO A SAN CLEMENTE KM 8', 'S/N', 'TALCA', 'VII REGION', '-35.430000', '-71.580000', 'ZONA 6', 'C2', c('Cristián Lagos', '955673340', 'clagos@vinasantamarta.cl')),
    a('A52', 'P6', '212021', 'AV. APOQUINDO', '4700', 'LAS CONDES', 'XIII REGION', '-33.410000', '-70.578000', 'ZONA 1', 'C1', c('Fernanda Ortiz', '983407712', 'fortiz@vinasantamarta.cl')),
    a('A61', 'P7', '213102', "AV. LIBERTADOR BERNARDO O'HIGGINS", '1840', 'SANTIAGO', 'XIII REGION', '-33.447000', '-70.665000', 'ZONA 1', 'C3', c('Tomás Bravo', '970214458', 'tbravo@upacifico.cl')),
    a('A62', 'P7', '213103', 'AV. EINSTEIN', '0570', 'RANCAGUA', 'VI REGION', '-34.170000', '-70.740000', 'ZONA 6', 'C1', c('Javiera Pino', '966501893', 'jpino@upacifico.cl')),
    a('A71', 'P8', '214460', 'AV. AMERICO VESPUCIO', '1501', 'CERRILLOS', 'XIII REGION', '-33.517000', '-70.718000', 'ZONA 2', 'C1', c('Sebastián Molina', '993126604', 'smolina@retailaustral.cl')),
    a('A72', 'P8', '214461', 'AV. FREI', '01110', 'PUNTA ARENAS', 'XII REGION', '-53.130000', '-70.900000', 'ZONA 8', 'C4', c('Constanza Barría', '977892215', 'cbarria@retailaustral.cl')),
    a('A73', 'P8', '214462', 'AV. HEROES DE LA CONCEPCION', '2555', 'IQUIQUE', 'I REGION', '-20.240000', '-70.140000', 'ZONA 5', 'C2', c('Matías Castillo', '951238890', 'mcastillo@retailaustral.cl')),
    a('A81', 'P9', '214930', 'HUERFANOS', '1160', 'SANTIAGO', 'XIII REGION', '-33.439000', '-70.653000', 'ZONA 1', 'C1', c('Patricio Henríquez', '223904100', 'phenriquez@bancoregionalsur.cl')),
    a('A82', 'P9', '214931', 'ARAUCO', '255', 'VALDIVIA', 'XIV REGION', '-39.814000', '-73.245000', 'ZONA 8', 'C3', c('Lorena Schmidt', '', ''))
  ];

  /* --- Trabajos --------------------------------------------------------- */
  // t(id, acceso, díasDesdeHoy, inicio, fin, estado, cargaCentro, mensajeCentro, extra)
  function t(id, accesoId, offset, inicio, fin, estado, centroEstado, centroMensaje, extra) {
    const ac = ACCESOS.find(x => x.id === accesoId);
    const base = {
      id,
      proyectoId: ac.proyectoId,
      accesoId,
      contacto: Object.assign({}, ac.contacto),
      ubicacion: { calle: ac.calle, numero: ac.numero, comuna: ac.comuna, region: ac.region, lat: ac.lat, lon: ac.lon },
      agenda: { fecha: fecha(offset), inicio, fin },
      estado,
      zona: ac.zona,
      cluster: ac.cluster,
      comentario: '',
      historial: [], // { fecha, usuario, campo, antes, despues }
      centro: { estado: centroEstado, mensaje: centroMensaje || '', fecha: centroEstado === 'sin_enviar' ? '' : marca(Math.min(offset, 0) - 1, '08:00') },
      modificado: { usuario: 'Camila Rojas', fecha: marca(-1, '16:45') }
    };
    return Object.assign(base, extra || {});
  }

  function h(fecha, usuario, campo, antes, despues) { return { fecha, usuario, campo, antes, despues }; }

  const TRABAJOS = [
    t('TR-1031', 'A11', -6, '09:00', '13:00', 'ejecutado', 'cargado', '', {
      comentario: 'Instalación de CPE y prueba de enlace 1 Gbps.',
      modificado: { usuario: 'Matías Fuentes', fecha: marca(-6, '13:40') }
    }),
    t('TR-1032', 'A12', 2, '09:00', '13:00', 'agendado', 'cargado', '', {
      comentario: 'Instalación de CPE y prueba de enlace 1 Gbps.',
      // Contacto editado en la plataforma: distinto del de la Base de Accesos
      contacto: { nombre: 'Ana Lagos', telefono: '973452290', correo: 'alagos@farmaciasdelvalle.cl' },
      historial: [
        h(marca(-1, '16:45'), 'Camila Rojas', 'c_nombre', 'Felipe Araya', 'Ana Lagos'),
        h(marca(-1, '16:45'), 'Camila Rojas', 'c_correo', 'faraya@farmaciasdelvalle.cl', 'alagos@farmaciasdelvalle.cl')
      ]
    }),
    t('TR-1033', 'A13', 3, '14:00', '18:00', 'validado', 'sin_enviar', '', {
      comentario: 'Requiere permiso de administración del edificio.',
      modificado: { usuario: 'Camila Rojas', fecha: marca(0, '09:12') },
      historial: [
        h(marca(0, '09:12'), 'Camila Rojas', 'inicio', '09:00', '14:00'),
        h(marca(0, '09:12'), 'Camila Rojas', 'fin', '13:00', '18:00')
      ]
    }),
    t('TR-1034', 'A21', 1, '10:00', '12:00', 'agendado', 'error',
      'El acceso no tiene código de sitio asociado en Agenda de Red.', {
      comentario: 'Factibilidad para segundo enlace.'
    }),
    t('TR-1035', 'A22', 5, '08:30', '12:30', 'pospuesto', 'sin_enviar', 'Modificado después de la última carga.', {
      comentario: 'Cliente sin acceso a la sala de comunicaciones hasta nuevo aviso.',
      modificado: { usuario: 'Javier Paredes', fecha: marca(0, '08:05') },
      historial: [
        h(marca(-3, '10:20'), 'Camila Rojas', 'fecha', fecha(2), fecha(5)),
        h(marca(0, '08:05'), 'Javier Paredes', 'estado', 'agendado', 'pospuesto'),
        h(marca(0, '08:05'), 'Javier Paredes', 'comentario', '', 'Cliente sin acceso a la sala de comunicaciones hasta nuevo aviso.')
      ]
    }),
    t('TR-1036', 'A23', 9, '09:00', '13:00', 'borrador', 'sin_enviar', '', {
      comentario: 'Falta confirmar teléfono del contacto en sitio.'
    }),
    t('TR-1037', 'A31', 0, '21:00', '23:30', 'agendado', 'cargado', '', {
      comentario: 'Ventana nocturna aprobada por el cliente.'
    }),
    t('TR-1038', 'A32', 4, '21:00', '23:30', 'agendado', 'error',
      'Tiempo de espera agotado al conectar con Agenda de Red.'),
    t('TR-1039', 'A41', -2, '09:00', '13:00', 'ejecutado', 'cargado', '', {
      modificado: { usuario: 'Javier Paredes', fecha: marca(-2, '14:10') }
    }),
    t('TR-1040', 'A42', 7, '09:00', '13:00', 'pospuesto', 'sin_enviar', 'Modificado después de la última carga.', {
      comentario: 'Reagendado a pedido del cliente por cierre de oficina.',
      historial: [
        h(marca(-1, '16:45'), 'Camila Rojas', 'fecha', fecha(3), fecha(7)),
        h(marca(-1, '16:45'), 'Camila Rojas', 'estado', 'agendado', 'pospuesto')
      ]
    }),
    t('TR-1041', 'A43', 0, '09:00', '13:00', 'en_ejecucion', 'cargado', '', {
      comentario: 'Cuadrilla en sitio desde las 08:50.',
      modificado: { usuario: 'Javier Paredes', fecha: marca(0, '08:52') },
      historial: [
        h(marca(0, '08:52'), 'Javier Paredes', 'estado', 'agendado', 'en_ejecucion')
      ]
    }),
    t('TR-1042', 'A51', -1, '15:00', '17:00', 'cancelado', 'sin_enviar', '', {
      comentario: 'El cliente mantiene el servicio actual. Baja cancelada.'
    }),
    t('TR-1043', 'A61', 0, '14:00', '18:00', 'en_ejecucion', 'cargado', '', {
      comentario: 'Site survey para puntos de acceso Wi-Fi.',
      modificado: { usuario: 'Camila Rojas', fecha: marca(0, '14:05') }
    }),
    t('TR-1044', 'A72', 12, '10:00', '13:00', 'agendado', 'error',
      'La comuna no coincide con la dirección registrada en el Centro de operaciones.'),
    t('TR-1045', 'A82', 3, '09:00', '11:00', 'borrador', 'sin_enviar', ''),
    t('TR-1046', 'A62', 8, '10:00', '12:00', 'validado', 'sin_enviar', ''),
    t('TR-1047', 'A01', 2, '10:00', '23:59', 'agendado', 'cargado', '', {
      comentario: 'habilitacion centro Teleton',
      historial: [
        h(marca(-2, '11:30'), 'Matías Fuentes', 'zona', 'ZONA 6', 'ZONA 7'),
        h(marca(-2, '11:30'), 'Matías Fuentes', 'comentario', '', 'habilitacion centro Teleton')
      ]
    }),
    t('TR-1048', 'A52', -1, '10:00', '12:00', 'agendado', 'cargado', '', {
      comentario: 'La cuadrilla no reportó el cierre del trabajo.'
    })
  ];

  window.DATOS = { PROYECTOS, ACCESOS, TRABAJOS, REGIONES, ZONAS, CLUSTERS, COMUNAS, hoyISO: fecha(0) };
})();
