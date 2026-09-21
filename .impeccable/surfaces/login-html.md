---
version: 1
slug: "login-html"
primary_target: "login.html"
related_targets: ["login.js"]
---

# Surface brief · login.html (Inicio de sesión, cambio de contraseña en primer ingreso)

Scope: the authentication surface served before index.html, plus the inactivity lock overlay that index.html shows after idle (same visual grammar, lives in index.html). Visitor mode: Operate.
Audience: EBS field staff (médicos, enfermeros, auxiliares, psicólogos, promotores) on tablet/phone at the start of the day or after the device locked; administrators on desktop.
Job: enter document number and password, get into the app in seconds; on first login, create a personal password; after idle, re-enter the password without losing the ficha in progress.
Constraints: DESIGN.md is fixed (Soft Structuralism, Plus Jakarta Sans, ink scale, Ladera blue only for what is touched, tri-color thread appears exactly once and belongs to the app header, so this surface does not repeat it). No self-service password reset (administrator resets). Errors never reveal whether the document exists. Copy in Colombian institutional Spanish, no exclamations.
Chosen direction (user pick from the dealt hand): Puerta lateral.

## Direction contract

THESIS: The entry is a doorway with two sides: the institution on the left, the person on the right. Refuses the category default of a lone centered card floating on nothing, and refuses the blue split-panel that turns the brand color into wallpaper.

OWN-WORLD (revised by the user's pinned reference): Silver canvas; a deep blue leaf (brand-600 → brand-800) with organic masses in the same blue carrying the institution; the incumbent restraint on blue as accent is set aside for this surface by explicit user direction. Original text follows for the record: left panel in ink-100 with the entity logo at 96px, the display wordmark "Encuesta APS" at 38/800/-0.03em, an eyebrow "Red de Salud de Ladera E.S.E.", one sentence about working without signal, and the three logo heads as a 6px dot row (the favicon motif, not the ribbon). Right: one white shell card (radius 20, sh-1 + hair) holding an ink-50 core (radius 14) with the two fields, the core turning white while a field has focus; the institutional side sits one step darker (ink-150) so the doorway split reads at 1440; the primary action is the .btn-cta pill with its circular icon island; the field labels are 13/500; the document field uses the mono face because it is a number dictated and cross-checked (DESIGN.md: monospaced = code). Error and lock states are said with color and text, never color alone.

STORY: The encuestador recognizes the entity, understands this is the same tool they capture with, types the document they already know by heart, and is inside in one press. On first login the same card turns into "Cree su contraseña" with the three requirements listed and ticked as they are met. After idle, the app dims behind a small version of the same card asking only for the password.

FIRST VIEWPORT (desktop 1440): user-pinned reference (mirrored): one floating composition centered on the ink-50 canvas, max 920px. Behind and left, a deep blue leaf (brand-600 → brand-800, radius 20, tinted ambient shadow) with two soft organic masses in the same blue (one lit, one shaded) and a third small lit mass under the card; on it, the entity logo on a white plate (core 14), the display wordmark in white, one short sentence in brand-100, and the foot (three white dots at stepped opacity + entity). In front and right, the white card (radius 20, sh-3) overlapping the blue leaf by 64px (the leaf is 420×560, the card 440 wide) and vertically centered on it: centered title, subtitle, ink-50 core with the two fields (leading icon + blue hairline accent), a "Recordar mi documento · ¿Olvidó su contraseña?" row, and a centered "Ingresar" pill with icon island. Mobile 390: the leaves stack; the blue leaf becomes a short header band with the logo plate and wordmark, and the card overlaps it from below by 28px.

FORM: Candidate 5 of my ordered list ("Puerta lateral"), assigned as lead by the roll and locked by the user. Seed key 3efb8164 (degraded roll: no challengers, no quality-bar boards).

Signature interaction: the card's core lights from ink-50 to white when a field focuses (the same "field turns on" rule as the instrument), and the CTA's icon island advances 2px on hover/press. Password strength requirements tick in place, no modal.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Memorable moment: the doorway split with the three heads as dots at the foot of the institutional panel.
Unresolved: password reset by email (out of scope; administrator resets).
