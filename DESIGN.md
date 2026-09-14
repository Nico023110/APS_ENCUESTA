---
name: Encuesta APS · Red de Salud de Ladera E.S.E.
description: Interfaz institucional en blanco y azul Ladera; verde y rojo del logo sólo como estados.
colors:
  primary: "#0060a0"
  primary-dark: "#004a7c"
  primary-deep: "#13294b"
  primary-light: "#e4eff8"
  primary-mid: "#c7dcee"
  ladera-verde: "#009858"
  ladera-rojo: "#e02828"
  danger: "#d42323"
  danger-text: "#a51818"
  danger-light: "#fde8e8"
  warning: "#d97706"
  warning-text: "#8a4b06"
  warning-light: "#fdf1dc"
  success: "#009858"
  success-text: "#056d41"
  success-light: "#dff4e9"
  neutral-bg: "#f4f7fb"
  neutral-panel: "#eef3f8"
  neutral-card: "#ffffff"
  neutral-border: "#d9e3ee"
  neutral-border-strong: "#b9cadb"
  text-primary: "#13294b"
  text-secondary: "#55667f"
typography:
  display:
    fontFamily: "Nunito, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Nunito, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  banner:
    fontFamily: "Nunito, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "0.005em"
  body:
    fontFamily: "Nunito, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Nunito, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  chip:
    fontFamily: "Nunito, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
  code:
    fontFamily: "ui-monospace, Consolas, Courier New, monospace"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "8px"
  btn: "10px"
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-card}"
    rounded: "{rounded.btn}"
    padding: "11px 22px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-ghost:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.btn}"
    padding: "11px 22px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.neutral-card}"
    rounded: "{rounded.btn}"
    padding: "11px 22px"
  card:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.lg}"
    padding: "22px 24px"
  section-banner:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-card}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  chip-rule:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  badge-pending:
    backgroundColor: "{colors.warning-light}"
    textColor: "{colors.warning-text}"
    rounded: "{rounded.full}"
    padding: "5px 12px"
  tabs-indicator:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-card}"
    rounded: "{rounded.full}"
    padding: "9px 18px"
---

# Design System: Encuesta APS · Red de Salud de Ladera E.S.E.

## Overview

Herramienta de captura en terreno (tablet y celular, luz de día) para los Equipos Básicos de Salud de la Red de Salud de Ladera E.S.E. Modo Operate: la interfaz desaparece detrás del instrumento SI-APS. La identidad viene del logo de la entidad: un solo azul institucional lleva toda la estructura; el verde y el rojo del logo aparecen únicamente como estados; la cinta tricolor del logo se usa una sola vez, como hilo bajo la cabecera, y sus tres cabezas son el favicon. Dirección elegida por el usuario: «Cinta institucional» (clave de semilla cfaae174, tirada degradada sin desafiantes).

## Colors

### Primary
- **Azul Ladera `#0060a0`**: bandas de sección, indicador de pestañas, botón principal, enlaces del índice, selección de opciones, anillo de foco. Es el color medido del logo.
- **Azul oscuro `#004a7c`**: hover de lo azul.
- **Navy `#13294b`**: texto principal, títulos, banda de cierre, chip «Persona» y chip «Cierre».
- **Tintes `#e4eff8` / `#c7dcee`**: fondo de opciones seleccionadas, chips de regla, avisos informativos, bordes de tarjetas destacadas.

### Secondary (estados; nunca decoración)
- **Verde Ladera `#009858`** (texto `#056d41`, fondo `#dff4e9`): registrado, en la base, sin riesgo.
- **Rojo `#d42323`** (texto `#a51818`, fondo `#fde8e8`): errores de captura, alertas INMEDIATAS, eliminar. Es el rojo del logo, ligeramente oscurecido para contraste.
- **Ámbar `#d97706`** (texto `#8a4b06`, fondo `#fdf1dc`): pendiente (plan de cuidado, sincronización), advertencias, corrección en curso. No está en el logo; existe porque el instrumento necesita un tercer estado que no sea error.

### Neutral
- Lienzo `#f4f7fb`, paneles `#eef3f8`, tarjetas `#ffffff`, bordes `#d9e3ee` (fuertes `#b9cadb`), texto secundario `#55667f`. Todos los grises están teñidos del azul; no se mezclan con grises cálidos.

### Named Rules
- **Un solo acento.** Lo interactivo es azul. Verde, rojo y ámbar significan algo; si un elemento no es un estado, no los lleva.
- **Cinta tricolor una vez.** Sólo en `.app-header::after` (verde · rojo · azul) y en el favicon. No se repite en bandas, bordes ni fondos.
- **Contraste en terreno.** Texto sobre tintes usa la variante `-text` (≥ 4.5:1); los tonos base sólo van sobre blanco o como fondo de texto blanco.

## Typography

Una sola familia: **Nunito** (Google Fonts, 400/600/700/800), elegida por sus terminales redondeadas, afines al logotipo. Escala fija en px, razón ~1.2, apropiada para una interfaz de producto densa.

### Hierarchy
- Display (título de vista): 30px / 800 / -0.02em, navy.
- Título de tarjeta (h2): 18px / 800, navy; chip de regla a la derecha.
- Banda de sección: 14.5px / 800, blanco sobre azul.
- Subtítulo de subpanel: 13.5px / 800, azul oscuro, en oración (no mayúsculas).
- Cuerpo: 15px / 400; etiquetas de campo 13.5px / 600; ayudas 12.5–13px, secundario.
- Chips y píldoras: 11–12px / 700.
- Números de tablas e indicadores: `font-variant-numeric: tabular-nums`.
- Monoespaciada (`ui-monospace, Consolas`) sólo para códigos: dirección canónica, llaves heredadas del plan y códigos CUPS/NoCUPS. Nunca como disfraz «técnico».

### Named Rules
- Mayúsculas sólo en chips y en las etiquetas `data-label` de las tarjetas del historial; nunca en títulos ni en texto corrido.
- Énfasis con peso, no con otra familia ni con degradados de texto.

## Layout

- Contenedor de 1180px centrado; padding 32/40px en escritorio, 20/12px en móvil.
- Cabecera pegajosa de 74px en blanco: logo, divisor, nombre y subtítulo a la izquierda; control segmentado a la derecha. En móvil se apila en dos filas y el subtítulo se acorta.
- El formulario es una sola página larga en el orden del instrumento; el índice de secciones queda pegajoso bajo la cabecera (`top: header + 14px`); las anclas compensan con `scroll-margin-top`.
- Indicadores de Inicio: 5 columnas en escritorio; en anchos medios la primera teja ocupa la fila y las cuatro restantes van de a dos; una columna bajo 420px.
- Historial: rejilla de tarjetas `minmax(300px, 1fr)`; la tabla semántica se pinta como tarjetas con `data-label`.

## Elevation & Depth

Dos niveles, siempre con desplazamiento y desenfoque, en negro a baja opacidad:
- `--shadow-soft`: `0 1px 2px rgba(0,0,0,.05), 0 4px 14px rgba(0,0,0,.05)` para tarjetas y tejas.
- `--shadow-medium`: `0 2px 6px rgba(0,0,0,.07), 0 12px 32px rgba(0,0,0,.11)` para el índice pegajoso, la barra de pendientes y el hover de tarjetas del historial.
- Superficies azules (bandas, botón principal, indicador de pestañas) llevan sombra neutra y un brillo interior de 1px.

### Named Rules
- Sin halos de color ni sombras planas de desplazamiento cero.
- Sin bordes laterales gruesos de color: el énfasis de un aviso es su fondo teñido más un borde de 1px en la misma familia; la prioridad de una alerta la dice un punto de 6px y la píldora de texto.

## Shapes

- Inputs y selects: 8px. Botones: 10px. Tarjetas, bloques, bandas de sección y avisos: 12–16px. Chips, píldoras de opción, control segmentado e indicador: pastilla completa.
- Los bloques repetibles (familia, integrante, plan) son `<details>` con cabecera en panel claro y esquinas heredadas de la tarjeta; sin `overflow: hidden`, para que el desplegable del buscador CUPS pueda salir del bloque.

## Components

### Buttons
- Primario azul con texto blanco; hover azul oscuro y elevación de 1px; `:active` escala 0.97 en 140 ms.
- Fantasma: blanco con borde fuerte, texto azul oscuro; hover fondo tinte azul.
- Peligro: rojo con texto blanco. Deshabilitado: opacidad 0.45 sin sombra.
- El botón de acción rápida «Nueva Encuesta» es el único lleno de azul en Inicio: es a lo que se viene.

### Chips
- Chip de regla (`RN-###`): tinte azul, texto azul oscuro, pastilla.
- Chips de bloque («Familia», «Integrante», «Persona»): azul o navy con texto blanco.
- Distintivos del historial: verde «Registrado» / «En la base», ámbar «Pendiente», rojo para hacinamiento.

### Cards / Containers
- Tarjeta: blanco, borde 1px, radio 16, sombra suave, padding 22/24. Las tarjetas anidadas dentro de un bloque son secciones planas separadas por una regla superior, no tarjetas dentro de tarjetas.
- Avisos (información, plan diferido, corrección, sensible, crítico): fondo teñido + borde 1px en la familia del estado, radio 10, padding 12–14px.

### Inputs / Fields
- Etiqueta encima (13.5px/600), control debajo, ayuda opcional debajo. Borde fuerte, hover azul, foco: borde azul + anillo `0 0 0 3px rgba(0,96,160,.18)`.
- Píldoras de opción única y múltiple: borde, hover tinte azul, seleccionada tinte azul + texto navy en negrita (`:has(:checked)`).
- Error: borde y anillo rojos, mensaje `RN-###: …` en rojo oscuro bajo el campo. Advertencia: lo mismo en ámbar. Ambos aparecen en vivo al confirmar el dato.

### Navigation
- Control segmentado de tres vistas en un panel claro; un solo indicador azul se desliza hasta la pestaña activa (280 ms, ease-out fuerte). En móvil quedan sólo los iconos.
- Índice «IR A» del formulario: chips de tinte azul; «Cierre» en navy.
- Barra de pendientes: fija al pie, borde rojo claro (verde cuando no queda nada), Anterior/Siguiente/Ir a guardar.

### Cinta tricolor (signature)
- `.app-header::after`: 3px de alto, tres segmentos iguales verde `#009858` · rojo `#e02828` · azul `#0060a0`, pegada al borde inferior de la cabecera. Favicon: tres círculos con los mismos colores sobre blanco redondeado.

## Do's and Don'ts

### Do:
- Usar el azul para todo lo que se toca y el navy para lo que se lee.
- Nombrar el estado con texto además de color (Registrado / Pendiente / RN-###).
- Mantener las superficies del navegador teñidas: selección, caret, foco y scrollbar del azul.
- Respetar `prefers-reduced-motion`: las vistas dejan de animarse y el indicador salta.

### Don't:
- No volver al degradado oscuro en la cabecera ni al teal del tema anterior.
- No usar el verde o el rojo del logo como decoración, ni repetir la cinta tricolor.
- No poner bordes laterales gruesos de color, sombras de color ni texto en degradado.
- No introducir una segunda familia tipográfica ni mayúsculas en títulos.
- No abrir modales para avisos que no exigen decisión (la bienvenida se retiró).
