---
version: 1
slug: "tableros-js"
primary_target: "tableros.js"
related_targets: ["index.html","styles.css","productividad.js","reporte.js","sesion.js"]
---

# Surface brief · Reportes (tableros de población, productividad y descargas)

Scope: the «Reportes» area of index.html — a left menu shared by three views: Tableros de población (principal; hogares in 3 pages; personas in 5 pages), Productividad (existing) and Descargas SI-APS y Excel (existing). Visitor mode: Operate.
Audience: coordinación del EBS (coordinadora y líderes de zona), administrador y maestro; mostly desktop, sometimes tablet; reviewing what the teams characterized, often in a meeting.
Job: read the characterized population of a period at a glance, narrow it by EBS, comuna or territorio, find the figures the care plan needs, and export them.
Constraints: DESIGN.md fixed (Soft Structuralism, Plus Jakarta Sans, Ladera blue as the only interactive accent, contour by shadow, the zero dims). Ids, menu texts and behavior the jsdom tests rely on for productividad and reporte. Aggregated counts only, never personal data. Category labels come from the instrument catalogs (catalogos.js), never rewritten. No map (user decision: location of homes is sensitive).
Chosen direction: pinned by the user's reference captures in img/ (SI-APS Power BI: Tablero principal, Tablero hogares 1-3, Componente personas 1-5). Their structure is kept — side menu, one filter row, headline tiles, chart panels, pages — and rendered in the app's own world. No roll.

## Direction contract

THESIS: The population read in layers — vivienda, hogar, familia, persona — where every panel answers one question of the care plan. Refuses the Power BI board it comes from: boxed panels with hard borders, labels piled on each other, two-slice donuts and rainbow categories.

OWN-WORLD: Silver canvas; a white side menu (shell 20) whose active item is the filled Ladera-blue pill of the app tabs; one filter row above everything it scopes; Inicio's population chain as the headline figures; white cards with shadow contour in a 12-column bento whose spans follow importance; 10 px bars in Ladera blue, square at the base and 4 px at the tip, figures written in ink; mirrored pyramids with men in Ladera blue and women in raspberry #d55181 (validated for colour-blind readers); meters instead of donuts; graded scales (Zarit, APGAR, family risk) in the semáforo colours with their words.

STORY: The coordinator opens Reportes and sees how many viviendas, hogares, familias and personas the period holds; picks her EBS or a comuna and every figure recomputes; moves through Hogares and Personas by pages; downloads the data or reads any panel as a table.

FIRST VIEWPORT: Desktop 1280-1440: side menu 232 px on the left. On the right, the title «Tablero principal» (27/800) with one line of description and «Descargar datos» (ghost) at the right; the filter row (period pills, desde/hasta, EBS, comuna, territorio, «Quitar filtros»); the four-level population chain full width; five priority-group tiles under it; then the curso-de-vida pyramid (span 7) beside viviendas por comuna (span 5). Signature interaction: bars grow from their base when data arrives, and while a filter refetches the previous figures stay on screen, dimmed, until the new ones replace them.

FORM: Pinned by the user's references (img/, nine SI-APS Power BI captures), adapted to the established world; not dealt by concept-seed; seed key: none. Build path: code-led (no image generation in this harness).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Memorable moment: the population chain recomputing under the filter row, with the pyramid's two blues-and-raspberry wings beside it.
Unresolved: none blocking. A per-viewer saved filter and a map of homes stay out of scope.
