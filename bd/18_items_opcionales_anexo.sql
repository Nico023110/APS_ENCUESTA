/* =========================================================================
   APS APP — ÍTEMS QUE EL ANEXO TÉCNICO NO EXIGE
   Archivo 18 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   El anexo técnico SI-APS (APS124CCFP, versión 7) marca «Requerido: NO» en
   tres ítems del instrumento que la base exigía. La aplicación los deja
   opcionales (2026-10-30) y la base los recibe vacíos:

     ítem 37   criaderos o reservorios de vectores (variable 84 del tipo 2):
               aps.vivienda.vectores deja de ser NOT NULL.
     ítem 76   EAPB (variable 21 del tipo 3): un integrante afiliado puede
               quedar sin EAPB. El no afiliado sigue sin poder tenerla
               (RN-209.2).
     ítem 80   pueblo o comunidad étnica (variable 25 del tipo 3): ya no se
               exige cuando hay pertenencia étnica.

   La vista de riesgo de la vivienda cuenta el ítem 37 sólo si la respuesta
   es «Sí»; vacío no suma. Esa vista la define 07_anexo_sispro.sql, que se
   genera con bd/gen_anexo.js y se vuelve a aplicar en cada migración.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

ALTER TABLE aps.vivienda ALTER COLUMN vectores DROP NOT NULL;

ALTER TABLE aps.integrante DROP CONSTRAINT IF EXISTS int_eapb_condicionada;
ALTER TABLE aps.integrante ADD CONSTRAINT int_eapb_condicionada
  CHECK (regimen_afiliacion <> 'no_afiliado' OR eapb_codigo IS NULL);

ALTER TABLE aps.integrante DROP CONSTRAINT IF EXISTS int_pueblo_etnico_condicionado;

COMMENT ON COLUMN aps.vivienda.vectores IS
  'Ítem 37, dominio SI_NO_NA. Opcional: el anexo SI-APS no la exige (variable 84 del registro tipo 2).';

COMMIT;
