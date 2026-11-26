# Agenda de red · versión para desarrollo

Interfaz de "Agenda de red" de la Plataforma de gestión y agendamiento de Red B2B, en HTML, CSS y JavaScript sin dependencias ni build.

Funciona con datos de ejemplo (mocks) hasta que se conecte al backend. Toda la comunicación con el backend pasa por un solo archivo, [js/api.js](js/api.js).

## Archivos

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de la página, diálogos y sprite de íconos |
| `css/app.css` | Estilos. Usa los tokens de `inelcom-design-system/tokens.css` |
| `js/api.js` | **Capa de servicios.** Única parte a conectar |
| `js/app.js` | Interfaz: tablas, detalle, validación, diálogos y selectores de fecha y hora. No llama al backend directamente |
| `js/mocks.js` | Implementación falsa de `Api`, en memoria. Simula las reglas del backend |
| `js/data.js` | Datos de ejemplo que usa `mocks.js` |

Para verla, sirve la carpeta con cualquier servidor estático (por ejemplo `python3 -m http.server`) y abre `index.html`.

## Cómo conectar el backend

1. En `js/api.js`, completa `CONFIG.baseUrl` y ajusta las rutas de cada función a las de la API real. Las rutas actuales son una propuesta.
2. Cambia `CONFIG.usarMocks` a `false`.
3. Quita `js/data.js` y `js/mocks.js` de `index.html`.

`pedir()` envía JSON y la cookie de sesión (`credentials: 'include'`). Si el backend usa token, agrégalo en `CONFIG.headers`. Ante una respuesta con error, lee `mensaje` del cuerpo y la interfaz lo muestra en un aviso.

Para probar sin backend con el rol Jefatura, cambia `rol` en `SESION` dentro de `js/mocks.js`.

## Servicios

| Función | Ruta propuesta | Recibe | Devuelve |
|---|---|---|---|
| `obtenerSesion()` | `GET /sesion` | — | `Sesion` |
| `obtenerCatalogos()` | `GET /catalogos` | — | `Catalogos` |
| `listarAgendas()` | `GET /agendas` | — | `Agenda[]` |
| `buscarProyectos(q)` | `GET /proyectos?q=` | texto (2+ caracteres) | `Proyecto[]` (GetBacklog, hasta 8) |
| `obtenerAccesos(proyectoId)` | `GET /proyectos/:id/accesos` | id de proyecto | `Acceso[]` (Base de Accesos) |
| `crearAgendas(datos)` | `POST /agendas` | `NuevaAgenda` | `Agenda[]` creadas |
| `actualizarAgenda(id, cambios)` | `PATCH /agendas/:id` | `CambiosAgenda` | `Agenda` actualizada |
| `eliminarAgenda(id)` | `DELETE /agendas/:id` | id | — |
| `enviarACentro(ids, alResultado)` | `POST /agendas/:id/envio` (una por agenda) | ids | `ResultadoEnvio[]` |
| `exportarAgendas(filas)` | (local) | filas planas `{ columna: valor }` | `Blob` CSV |

`enviarACentro` llama a `alResultado(r)` apenas cada agenda tiene respuesta, para mostrar el avance. Si el backend recibe el lote completo en una sola llamada, conserva esa firma y llama a `alResultado` por cada resultado.

`exportarAgendas` genera el CSV en el navegador. Si existe un endpoint que entrega el `.xlsx`, basta con que la función devuelva ese `Blob`.

## Modelo de datos

Fechas en ISO: `aaaa-mm-dd`. Horas en 24 h: `HH:MM`. Fecha y hora juntas: `aaaa-mm-ddTHH:MM`.

```ts
type Sesion = { id: string; nombre: string; rol: 'gestor' | 'jefatura' };

type Catalogos = {
  zonas: string[];                                   // ['ZONA 1', …]
  clusters: { codigo: string; diasHabiles: number }[]; // [{ codigo: 'C1', diasHabiles: 2 }, …]
};

type Proyecto = {
  id: string; codigo: string; razonSocial: string; segmento: string;
  tipo: string; topologia: string; agencia: string;
};

type Contacto = { nombre: string; telefono: string; correo: string };

type Acceso = {
  id: string; proyectoId: string; codigo: string;
  calle: string; numero: string; comuna: string; region: string;
  lat: string; lon: string; zona: string; contacto: Contacto;
};

type Agenda = {
  id: string;                                  // 'TR-1052'
  proyecto: Proyecto;
  acceso: { id: string; codigo: string; contacto: Contacto }; // contacto según la Base de Accesos
  contacto: Contacto;                          // contacto de esta agenda (puede diferir)
  ubicacion: { calle: string; numero: string; comuna: string; region: string; lat: string; lon: string };
  agenda: { fecha: string; inicio: string; fin: string };
  solicitud: string;                           // fecha de solicitud
  zona: string;
  cluster: string;
  comentario: string;
  historial: { fecha: string; usuario: string; campo: string; antes: string; despues: string }[];
  centro: {
    estado: 'pendiente' | 'enviado' | 'error';
    mensaje: string;                           // error del último envío
    fecha: string;                             // último envío ('' si nunca se envió)
    enAgenda: boolean;                         // ya existe en Agenda de Red del Centro de operaciones
  };
  modificado: { usuarioId: string; usuario: string; fecha: string };
  creadorId: string;
  creador: string;                             // nombre de quien la agendó
};

type NuevaAgenda = {
  proyectoId: string;
  accesoIds: string[];                         // se crea una agenda por acceso
  agenda: { fecha: string; inicio: string; fin: string };
  cluster: string;
  comentario: string;
};

type CambiosAgenda = {
  agenda: { fecha: string; inicio: string; fin: string };
  zona: string;
  cluster: string;
  comentario: string;
  contacto: Contacto;
};

type ResultadoEnvio = { id: string; centro: Agenda['centro'] | null; mensaje?: string };
```

`historial[].campo` usa estas claves: `fecha`, `inicio`, `fin`, `zona`, `cluster`, `comentario`, `c_nombre`, `c_telefono`, `c_correo`.

## Reglas que espera la interfaz del backend

`js/mocks.js` las implementa y sirve de referencia.

- **Crear:** cada agenda nueva entra como `pendiente`, con `solicitud` = hoy y con zona, ubicación y contacto copiados del acceso. El backend asigna el `id`.
- **Editar:** el backend agrega una entrada al `historial` por cada campo que cambió, actualiza `modificado` y, si algo cambió, deja `centro.estado` en `pendiente` (conserva `enAgenda`).
- **Envío automático:** cada 10 minutos según el reloj (:00, :10, :20…), el backend envía al Centro de operaciones las agendas `pendiente` y reintenta las `error`. La interfaz solo muestra la cuenta regresiva y vuelve a pedir `listarAgendas()` cada minuto. Si una agenda de la bandeja cambió de estado, muestra un aviso.
- **Enviar ahora:** adelanta ese envío, para todas las pendientes o para una sola.
- **Eliminar:** solo `jefatura`, y solo si `enAgenda` es `false`. La interfaz ya lo bloquea, pero el backend debe validarlo.
- **Fecha compromiso:** `solicitud` + `diasHabiles` del cluster, contando de lunes a viernes. Hoy no considera feriados; si deben contarse, conviene que el backend envíe la fecha calculada.

## Lógica de vistas (en la interfaz)

- **Bandeja "Agendar trabajos":** agendas del usuario no enviadas, más las enviadas hoy. También aparecen las de otros gestores que el usuario editó y quedaron por enviar.
- **Agendas enviadas › Mis agendas:** las del usuario enviadas en días anteriores.
- **Agendas enviadas › Todas:** las enviadas de todos los gestores, incluidas las de hoy. Se paginan de 10 en 10.
- Búsqueda, zona, rango de fechas, paginación y exportación se resuelven en el navegador sobre `listarAgendas()`. Si el volumen crece, `listarAgendas` puede recibir filtros y paginar en el servidor.

## Accesibilidad y formato

- Las fechas se muestran como `dd-mm-aaaa` y las horas en 24 h, con selectores propios. No dependen del navegador.
- Todo se puede usar con teclado. Los diálogos usan `<dialog>` nativo. Los errores de validación se anuncian con `aria-describedby` y `aria-invalid`.
- El fondo de página `#E8F2FA` (`--page-bg` en `css/app.css`) está fuera del design system a propósito.
