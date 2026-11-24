# Inelcom Design System

Sistema de diseño de Inelcom para productos internos y de operación (intranet, ARES, plataformas de compras y dashboards de red). Llevado desde Figma (archivo *Design System inelcom*): 124 variables, 51 estilos de color, 12 estilos tipográficos y 1 sombra. Todos los valores son los exactos del export.

## Principios

- **Neutro primero, cyan con intención.** La UI vive sobre neutros fríos; el cyan corporativo marca la acción principal, el foco y la identidad, no decora.
- **Semántico antes que primitivo.** En producto se usan los tokens `background-*`, `text-*`, `border-*`, `icon-*` e `interactive-*`; las escalas (`neutral-500`, `corporate-700`…) son la materia prima.
- **Una sola elevación.** Existe una sombra (`shadow`); la jerarquía se construye con fondos y bordes.
- **Grilla de 4px.** Todo espaciado sale de `space-*` (múltiplos de 4, más `space-half` de 2px).

## Color

Siete escalas primitivas:

| Escala | Rol | Paso clave |
|---|---|---|
| `neutral-0…950` | Superficies, texto, bordes, íconos | `neutral-800` texto principal |
| `corporate-50…950` | Marca Inelcom (cyan) | `corporate-500` #00BFD6 |
| `support-50…950` | Violeta de apoyo: secundaria e info | `support-500` #6C63FF |
| `blue-support-50…900` | Azul de apoyo (sin 800 ni 950 en Figma) | `blue-support-500` |
| `success` / `warning` / `error` | Estados | paso 500 en bordes, 700 en texto |

Capas semánticas (todas alias de las escalas):

- **Fondos:** `background-primary` (blanco) para página y tarjetas, `background-secondary`/`tertiary`/`quaternary` para agrupar, `background-inverse` para barras oscuras y tooltips, `background-brand*` para bloques de marca y `background-success|warning|error|info` para alertas.
- **Texto:** `text-primary` títulos y cuerpo, `text-secondary` etiquetas, `text-tertiary` metadatos, `text-brand` enlaces, `text-success|warning|error|info` mensajes de estado sobre su fondo homónimo.
- **Bordes:** `border-default` en tarjetas y tablas, `border-strong` en controles, `border-focus` para el anillo de foco, `border-error|success|info|warning` en validación.
- **Interactivo:** `interactive-primary` (cyan), `-secondary` (violeta), `-danger`, `-success`, cada uno con estado hover y active/pressed.
- **Íconos:** `icon-*`, aplicados con `currentColor` en el SVG.

## Tipografía

Una familia: **Inter** (Google Fonts, se carga aparte). Doce estilos:

| Estilo | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `heading-h1` | 48px / 1.2, -0.02em | 700 | Título de página |
| `heading-h2` | 36px / 1.2, -0.015em | 700 | Título de sección |
| `heading-h3` | 24px / 1.33, -0.01em | 700 | Título de tarjeta |
| `heading-h4` | 20px / 1.4 | 700 | Bloque pequeño |
| `body-base` (+`-bold`) | 16px / 1.5 | 400 / 700 | Párrafo |
| `body-small` (+`-bold`) | 14px / 1.43 | 400 / 700 | Tablas, formularios, UI densa |
| `body-xsmall` (+`-bold`) | 12px / 1.33 | 400 / 700 | Metadatos, badges |
| `body-caption` (+`-bold`) | 10px / 1.3 | 400 / 700 | Notas mínimas, con moderación |

Los estilos conservan sus valores de Figma y no siempre coinciden con la escala base (`font-size-*`, `font-weight-*`, `line-height-*`, `letter-spacing-*`), que también se incluye.

## Espaciado, radios y sombra

- **Espaciado:** `space-half` 2 · `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-8` 32 · `space-10` 40 · `space-12` 48 · `space-16` 64 · `space-20` 80 · `space-24` 96. Padding estándar de tarjeta: `space-4`; separación entre secciones: `space-8`.
- **Radios:** `radius-xs` 2 · `radius-sm` 4 (inputs) · `radius-md` 8 (botones, tarjetas) · `radius-lg` 16 (modales) · `radius-xl` 32 · `radius-pill`.
- **Sombra:** `shadow` = `0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)` para dropdowns, popovers y tarjetas flotantes.

## Accesibilidad

Contrastes medidos sobre blanco (`background-primary`):

- Cumplen AA (≥4.5:1): `text-primary` 13.6, `text-secondary` 9.4, `text-brand` 6.8, `text-warning` 5.7, y los demás `text-*` de estado (paso 700).
- **`text-brand` ahora es `corporate-800`** (6.3:1 sobre `background-tertiary`, 5.6:1 sobre `background-quaternary`). En Figma apunta a `corporate-700`, que bajaba a 4.0–4.5:1 sobre fondos grises: actualizar la variable allá también.
- **`text-tertiary` ahora es `neutral-600`** (6.9:1 sobre blanco, 6.4:1 sobre `background-tertiary`). En Figma apunta a `neutral-500`, que daba 3.6–3.9:1: hay que actualizar la variable allá también.
- **Texto blanco sobre `interactive-primary` (#00BFD6) da 2.2:1** y no cumple. En botones primarios usar texto `neutral-900`/`neutral-950`, o el fondo `corporate-700` con texto blanco.
- **`icon-brand` (corporate-500) da 2.2:1** sobre blanco: bajo el mínimo de 3:1 para íconos informativos.
- **`border-focus` (corporate-400) da 1.6:1** sobre blanco: el anillo de foco necesita un segundo trazo o mayor grosor para ser visible.
- Los estados nunca dependen solo del color: acompañar con ícono o texto.

## Logo

Dos versiones en el grupo **Logos**: el logotipo horizontal (`inelcom-logo-horizontal.svg`) para fondos claros, y el isotipo sobre fondo oscuro (`inelcom-isotipo-fondo-oscuro.svg`) para avatares, favicons y superficies oscuras. Se usan tal cual, sin recolorear; margen mínimo `space-4`.

## Pendiente

Faltan los componentes y el set de íconos; se pueden agregar exportando desde Figma (SVG y capturas o código de componentes).
