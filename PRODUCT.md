# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Integrantes de los Equipos Básicos de Salud (EBS) de la Red de Salud de Ladera E.S.E. (Cali): enfermería, auxiliares, promotores y otros perfiles que visitan viviendas en los territorios de ladera y diligencian la ficha de caracterización poblacional SI-APS durante la visita. Usan principalmente tablet o celular en terreno —dentro de la vivienda o en la puerta, con luz de día y conexión intermitente— y en menor medida un computador para revisar o corregir fichas después.

Un segundo público, no confirmado como usuario directo, son los supervisores que revisan fichas, alertas y planes de cuidado desde el historial.

## Product Purpose

Encuesta APS captura la ficha de caracterización SI-APS (instrumento imprimible 2025 del Ministerio de Salud) por vivienda, familia e integrante; aplica las 160+ reglas de negocio del instrumento en el momento de la captura; deriva alertas clínicas y de entorno con prioridad (inmediata / prioritaria / regular) y el semáforo de riesgo familiar; y guarda cada ficha en la base de datos de la entidad, con cola local cuando no hay red. El éxito es una ficha completa, coherente y guardada al terminar la visita, con sus alertas convertidas en acciones del plan de cuidado.

## Positioning

La única herramienta que valida el instrumento SI-APS completo mientras se diligencia —en el dispositivo, sin red— con el mismo motor de reglas que corre el servidor, de modo que lo que el encuestador ve en la vivienda es exactamente lo que la base va a aceptar.

## Operating Context

- **Inicio de sesión** (`login.html`): acceso por número de documento y contraseña; en el primer ingreso se exige crear una contraseña propia. El rol es el perfil asistencial del ítem 14 o administrador; los ítems 10 y 12‑14 se firman desde la sesión. Tras 15 minutos sin actividad la aplicación se bloquea y pide la contraseña de nuevo (RN‑223.6). Ver `ROLES_Y_PERMISOS.md`.
- Vista **Inicio**: indicadores del territorio (fichas, hacinamiento, situaciones inminentes, territorios, planes pendientes) y accesos rápidos.
- Vista **Nueva Encuesta**: el instrumento completo en una sola página larga, en el orden impreso (secciones 1 a 6 y cierre), con bloques repetibles por familia e integrante, índice de secciones, navegador de pendientes al intentar guardar y validación en vivo campo a campo.
- Vista **Historial**: fichas locales y de la base, con estado de sincronización, estado del plan de cuidado, filtros, detalle y corrección.
- Flujo de trabajo real: consentimiento → situación inminente → vivienda → familias → integrantes → plan de cuidado (puede diferirse) → cierre → guardar. Una visita puede cerrarse como incompleta por causa externa.
- Sin conexión la ficha queda en el dispositivo y se sincroniza después («Sincronizar a la nube»).
- Corregir una ficha reusa el mismo formulario y reemplaza el registro; hoy sólo para fichas capturadas en el mismo dispositivo.

## Capabilities and Constraints

- Stack: HTML, CSS y JavaScript sin framework (scripts globales), servidor Node en desarrollo y funciones serverless en Vercel; PostgreSQL (Neon). Sin bundler: los estilos viven en `styles.css` y el marcado en `index.html`.
- Dependencias de interfaz ya cargadas por CDN: Phosphor Icons (`ph ph-*`), SweetAlert2 para avisos, Google Fonts.
- Terminología fija del instrumento: ficha, vivienda, hogar, familia, integrante, plan de cuidado, alerta, impedimento, RN-### (código de regla), EBS, UZPE, territorio y microterritorio, CUPS/NoCUPS.
- Los textos de los ítems, las etiquetas de catálogo y los mensajes de las reglas son parte del instrumento: no se reescriben con criterio de diseño.
- Ids y atributos `data-*` del formulario son contrato con `formulario.js`, `reglas.js`, `correccion.js` y las pruebas jsdom; un rediseño cambia clases y estilos, no ese contrato.
- Pruebas: `npm test` (jsdom) y `npm run test:bd` (contra la base) deben seguir pasando.
- Pendiente / no decidido: corrección de fichas desde otro dispositivo; paginación del historial.

## Brand Commitments

- Entidad: **Red de Salud de Ladera E.S.E.**; su logo (`logo ladera.jpg`, tres figuras entrelazadas en azul, rojo y verde con el nombre en azul) es la referencia obligatoria de identidad y de paleta. El usuario pidió que la interfaz se base en él y en sus colores, retirando el fondo de la imagen si hace falta.
- Nombre de la herramienta: **Encuesta APS** (se mantiene junto al logo de la entidad).
- Colores medidos del logo: azul `#0060a0`, rojo `#e02828`, verde `#009858`, sobre blanco.
- Voz: institucional, clara, en español de Colombia, sin anglicismos ni exclamaciones; los mensajes nombran el problema y la corrección.

## Evidence on Hand

- `logo ladera.jpg` (750×415, JPG con fondo blanco).
- `SI-APS - Poblacional instrumento identificación v2-imprimible 2025.pdf`: el instrumento oficial que la ficha reproduce.
- `lineamiento-equipos-basicos-territorios-atencion-primaria-salud-2026.pdf`: lineamiento de los EBS.
- `REGLAS_DE_NEGOCIO.md`: las reglas RN-001 a RN-226 con su justificación.
- No hay fotografías, testimonios, cifras de cobertura ni material de comunicación de la entidad: no se inventan.

## Product Principles

1. Lo que se ve en la vivienda es lo que acepta la base: una sola fuente de reglas, aplicada en vivo.
2. La ficha primero, el plan después: nada impide guardar lo que ya se capturó; lo pendiente se muestra, no se bloquea.
3. Cada aviso nombra el campo, el problema y la corrección, y lleva al campo.
4. Terreno ante todo: legible a plena luz, operable con el pulgar, tolerante a la falta de red.
5. El instrumento manda: orden, numeración y textos oficiales se respetan.

## Accessibility & Inclusion

Uso en exteriores y en viviendas con poca luz: contraste alto y objetivos táctiles amplios. Los textos de error y advertencia se diferencian por color y por texto, nunca sólo por color. Se respeta `prefers-reduced-motion`.
