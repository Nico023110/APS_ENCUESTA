/* =========================================================================
   APS APP — HOGAR AL QUE PERTENECE CADA FAMILIA
   Archivo 9 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   Una vivienda tiene uno o varios hogares (ítem 28) y un hogar puede reunir
   varias familias. Hasta ahora cada familia colgaba directamente de la
   vivienda y no había dónde decir que dos familias comparten hogar, así que
   cada familia se leía como un hogar.

   aps.familia_ficha.hogar_numero guarda a qué hogar de la vivienda pertenece
   la familia en esa visita: 1 al número del ítem 28. Es interno, como el
   NUV: el anexo técnico SI-APS no tiene un nivel de hogar, y el código de la
   familia (variable 124) sigue numerándose por vivienda, no por hogar.

   Las familias ya guardadas reciben un hogar cada una, en su orden de
   captura, que es como se leían hasta ahora.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS hogar_numero smallint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ff_hogar_numero_valido') THEN
    ALTER TABLE aps.familia_ficha
      ADD CONSTRAINT ff_hogar_numero_valido CHECK (hogar_numero >= 1);
  END IF;
END $$;

COMMENT ON COLUMN aps.familia_ficha.hogar_numero IS
  'Hogar de la vivienda al que pertenece la familia en esta visita (1 al ítem 28; RN-028). Varias familias pueden compartir hogar. Interno; no va en el archivo plano.';

WITH numeradas AS (
  SELECT ff.id,
         row_number() OVER (PARTITION BY ff.ficha_id ORDER BY fa.consecutivo, ff.id) AS n
    FROM aps.familia_ficha ff
    JOIN aps.familia fa ON fa.id = ff.familia_id
   WHERE ff.hogar_numero IS NULL
)
UPDATE aps.familia_ficha ff SET hogar_numero = numeradas.n
  FROM numeradas WHERE numeradas.id = ff.id;

COMMIT;
