/* =========================================================================
   APS APP — CÓDIGOS AUTOMÁTICOS DE VIVIENDA Y FAMILIA, Y NUV
   Archivo 8 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   Los ítems 25 (vivienda) y 26 (familia) ya no se digitan: los asigna el
   servidor al guardar la ficha, con la estructura del anexo técnico SI-APS
   (variables 123 y 124):

     vivienda   <territorio><microterritorio>H<4 dígitos>       T53MT03H0005
                el consecutivo H reinicia en 0001 en cada microterritorio
                (aps.hogar.consecutivo_sispro, creado en 07_anexo_sispro.sql)

     familia    <código de la vivienda>F<4 dígitos>              T53MT03H0005F0001
                el consecutivo F reinicia en 0001 en cada vivienda
                (aps.familia.consecutivo)

   El archivo plano antepone departamento, subregión y municipio (variables
   3 a 5); aquí se omiten porque son fijos en el despliegue y no hacen falta
   para que el código sea único.

   Además, cada vivienda recibe su NUV (número único de vivienda): un
   consecutivo global que no se reinicia nunca —ni por territorio ni por
   microterritorio— y que no se reporta en el archivo plano. Se muestra
   como NUV0001, NUV0002…

   Antes el ítem 25 se digitaba y era la llave del hogar: dos encuestadores
   podían escribir el mismo código para viviendas distintas, y las viviendas
   ya guardadas conservan los códigos digitados. Esta migración las pasa al
   formato automático y arrastra el cambio a las familias y a las llaves
   heredadas de los planes de cuidado (RN-112/121/122/131/132).

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

/* -------------------------------------------------------------------------
   1. NUV — número único de vivienda
   ------------------------------------------------------------------------- */
ALTER TABLE aps.hogar ADD COLUMN IF NOT EXISTS nuv bigint;

CREATE UNIQUE INDEX IF NOT EXISTS ux_hogar_nuv ON aps.hogar (nuv) WHERE nuv IS NOT NULL;

COMMENT ON COLUMN aps.hogar.nuv IS
  'Número único de vivienda: consecutivo global que no se reinicia. Interno; no va en el archivo plano.';

/* Las viviendas existentes lo reciben en orden de creación. */
WITH numeradas AS (
  SELECT h.id,
         coalesce((SELECT max(o.nuv) FROM aps.hogar o), 0)
         + row_number() OVER (ORDER BY h.creado_en, h.id) AS n
    FROM aps.hogar h
   WHERE h.nuv IS NULL
)
UPDATE aps.hogar h SET nuv = numeradas.n
  FROM numeradas WHERE numeradas.id = h.id;

/* -------------------------------------------------------------------------
   2. Consecutivo de la vivienda dentro del microterritorio
   -------------------------------------------------------------------------
   07_anexo_sispro.sql ya lo asigna; se repite aquí por si una vivienda quedó
   sin él (por ejemplo, si cambió de microterritorio y no alcanzó a recibir
   el nuevo). */
WITH numeradas AS (
  SELECT h.id,
         coalesce((SELECT max(o.consecutivo_sispro) FROM aps.hogar o
                    WHERE o.territorio_codigo = h.territorio_codigo
                      AND o.microterritorio_codigo = h.microterritorio_codigo), 0)
         + row_number() OVER (PARTITION BY h.territorio_codigo, h.microterritorio_codigo ORDER BY h.id) AS n
    FROM aps.hogar h
   WHERE h.consecutivo_sispro IS NULL
)
UPDATE aps.hogar h SET consecutivo_sispro = numeradas.n
  FROM numeradas WHERE numeradas.id = h.id;

/* -------------------------------------------------------------------------
   3. Códigos de vivienda y de familia en el formato automático
   -------------------------------------------------------------------------
   El orden importa por el disparador trg_plan_llaves_heredadas, que exige
   que las llaves del plan coincidan con la vivienda y la familia: primero se
   recodifican la vivienda y la familia, y después cada plan en una sola
   sentencia que cambia sus dos llaves a la vez. */
UPDATE aps.hogar
   SET codigo = territorio_codigo || microterritorio_codigo || 'H' || lpad(consecutivo_sispro::text, 4, '0')
 WHERE codigo IS DISTINCT FROM
       territorio_codigo || microterritorio_codigo || 'H' || lpad(consecutivo_sispro::text, 4, '0');

UPDATE aps.familia fa
   SET codigo = h.codigo || 'F' || lpad(fa.consecutivo::text, 4, '0')
  FROM aps.hogar h
 WHERE h.id = fa.hogar_id
   AND fa.codigo IS DISTINCT FROM h.codigo || 'F' || lpad(fa.consecutivo::text, 4, '0');

UPDATE aps.plan_cuidado p
   SET codigo_vivienda = destino.vivienda,
       codigo_familia  = CASE WHEN p.familia_ficha_id IS NULL THEN p.codigo_familia ELSE destino.familia END
  FROM (
    SELECT p2.id,
           h.codigo  AS vivienda,
           fa.codigo AS familia
      FROM aps.plan_cuidado p2
      JOIN aps.ficha f            ON f.id = p2.ficha_id
      JOIN aps.hogar h            ON h.id = f.hogar_id
      LEFT JOIN aps.familia_ficha ff ON ff.id = p2.familia_ficha_id
      LEFT JOIN aps.familia fa       ON fa.id = ff.familia_id
  ) AS destino
 WHERE destino.id = p.id
   AND (p.codigo_vivienda IS DISTINCT FROM destino.vivienda
        OR (p.familia_ficha_id IS NOT NULL AND p.codigo_familia IS DISTINCT FROM destino.familia));

/* Ítem 26 de la ficha: el código de su primera familia. */
UPDATE aps.ficha f
   SET referencia_familia = primera.codigo
  FROM (
    SELECT DISTINCT ON (ff.ficha_id) ff.ficha_id, fa.codigo
      FROM aps.familia_ficha ff
      JOIN aps.familia fa ON fa.id = ff.familia_id
     ORDER BY ff.ficha_id, fa.consecutivo, ff.id
  ) AS primera
 WHERE primera.ficha_id = f.id
   AND f.referencia_familia IS DISTINCT FROM primera.codigo;

COMMIT;
