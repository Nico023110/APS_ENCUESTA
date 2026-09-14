---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface brief · index.html (Inicio, Nueva Encuesta, Historial)

Scope: the whole single-page app shell and its three views. Visitor mode: Operate.
Audience: EBS field staff on tablet/phone inside homes and at doorsteps (daylight, intermittent network); supervisors on desktop reviewing.
Job: capture a full SI-APS ficha during the visit, see alerts and pending plan, save; review and correct later.
Constraints: instrument order, item texts, ids and data-* contract, jsdom tests, Phosphor icons, SweetAlert2. Brand pinned by the user: Red de Salud de Ladera E.S.E. logo and its palette; tool name "Encuesta APS".
Chosen direction (user pick, over the roll's assignment): Cinta institucional.

## Direction contract

THESIS: One institutional blue carries every structure; the logo's tri-color ribbon appears exactly once, as a fine thread under the header, and its three heads become the favicon. Refuses the health-admin default of a dark gradient header and a teal-plus-blue palette, and refuses "three colors everywhere".

OWN-WORLD: White header on a cool blue-tinted ground (#f4f7fb); Ladera blue #0060a0 for structure, actions, selection and section bands; navy #13294b text; blue-tinted hairlines and shadows; green and red only as semantic states (registered/success, danger/immediate), amber for pending/warnings. Nunito (rounded, akin to the logotype) as the single family, tabular numerals for data. Radii rule: inputs 8, buttons 10, cards 16, chips pill. Motion 150–220 ms, strong ease-out, press scale .97; one authored moment: the tab indicator slides between views.

STORY: The encuestador recognizes the entity at once (logo, white, blue), trusts the form as the official instrument (numbered blue bands), always knows where they are (segmented tabs, section index), and sees state by color-plus-text.

FIRST VIEWPORT (Inicio, tablet): white header with logo left, "Encuesta APS" wordmark and subtitle, segmented tabs right; tri-color thread; a left-aligned greeting with the team's territory framing; five indicator tiles in a 3+2 rhythm; three quick actions with "Nueva encuesta" as the primary (blue) action, findable without scrolling.

FORM: Candidate 1 of my ordered list ("Cinta institucional"), taken by the user as the pick over assigned candidate 6 ("Cintas del logo como guía"). Seed key cfaae174 (degraded roll: no challengers, no quality-bar boards).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Memorable moment: the ribbon thread under the header and the three-dot favicon, both derived from the logo.
Unresolved: none blocking; correction from other devices remains out of scope.
