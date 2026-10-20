/* =========================================================================
   APS APP — CÓDIGO DE LA FICHA POR FAMILIA (CF001, CF002…)
   Archivo 14 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   La ficha técnica del Ministerio (manual del formulario de identificación
   de necesidades, pregunta 19 «Código de la ficha») numera las visitas de
   cada familia: «Cada vez que se visite una familia, se debe iniciar un
   consecutivo de visitas a esa familia e ir incrementándolo en uno por cada
   nueva visita» — CF001, CF002, CF003…, y la siguiente familia vuelve a
   empezar en CF001.

   Aquí una ficha es la visita a la vivienda y puede caracterizar varias
   familias, así que el CF vive en aps.familia_ficha: la caracterización de
   esa familia en esa visita. Lo asigna el servidor al guardar
   (guardar_encuesta.js) y no cambia al corregir la ficha. El código interno
   de la ficha (ítem 15, aps.ficha.codigo) sigue siendo la llave: el CF se
   repite entre familias y no sirve para distinguir fichas.

   Las caracterizaciones ya guardadas reciben su CF en el orden en que se
   diligenciaron.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS codigo_cf text;

COMMENT ON COLUMN aps.familia_ficha.codigo_cf IS
  'Código de la ficha de la ficha técnica (pregunta 19): CF + consecutivo de 3 dígitos de las visitas a '
  'esta familia. Lo asigna el servidor; no se reporta en APS124CCFP v7.';

WITH numeradas AS (
  SELECT ff.id,
         row_number() OVER (PARTITION BY ff.familia_id
                            ORDER BY coalesce(f.diligenciada_en, f.capturada_en), ff.id) AS n
    FROM aps.familia_ficha ff
    JOIN aps.ficha f ON f.id = ff.ficha_id
)
UPDATE aps.familia_ficha ff
   SET codigo_cf = 'CF' || lpad(numeradas.n::text, 3, '0')
  FROM numeradas
 WHERE numeradas.id = ff.id
   AND ff.codigo_cf IS NULL;

COMMIT;
