/* =========================================================================
   APS APP — PORTAFOLIO DE SERVICIOS DE LA E.S.E. EN EL CATÁLOGO CUPS
   Archivo 15 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   La E.S.E. pidió que el buscador de acciones (ítems 114, 124 y 136a) ponga
   primero los servicios de su portafolio. cat.cups.en_portafolio los marca;
   api/buscar_cups.js los ordena primero y el formulario los señala. El resto
   del catálogo sigue disponible debajo.

   Mientras no se cargue el portafolio todos quedan en false y el orden es el
   de siempre. Para cargarlo:

     UPDATE cat.cups SET en_portafolio = true WHERE codigo IN ('890105', …);

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

ALTER TABLE cat.cups ADD COLUMN IF NOT EXISTS en_portafolio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cat.cups.en_portafolio IS
  'Servicio del portafolio de la E.S.E.: el buscador de acciones del plan lo muestra primero.';

CREATE INDEX IF NOT EXISTS ix_cups_portafolio ON cat.cups (en_portafolio) WHERE en_portafolio;

COMMIT;
