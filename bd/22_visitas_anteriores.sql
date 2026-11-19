/* =========================================================================
   APS APP — FAMILIAS YA CARACTERIZADAS ANTES: SEGUNDA VISITA (CF002…)
   Archivo 22 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA (decisión del 2026-11-19)

   Si alguna persona de una familia ya se había caracterizado —en la base
   anterior a la app (hist, 2025 – primer semestre de 2026) o en otra ficha
   de la app de una fecha anterior—, la ficha nueva es una visita más a esa
   familia, no la primera:

     - aps.familia_ficha.visitas_anteriores: cuántas caracterizaciones tuvo
       la familia antes de esta ficha (distintas viviendas anteriores o
       fichas anteriores donde aparece alguna de sus personas);
     - el CF de la familia es CF + (visitas_anteriores + la visita de esta
       ficha): CF002 si se caracterizó una vez antes; y la visita que completa
       integrantes (21_segunda_visita.sql) lo sube uno más;
     - aps.familia_antecedente: con qué caracterización se relaciona, para
       verlo en el detalle de la ficha. Sin llave hacia hist: recargar la base
       anterior cambia sus ids; se guarda lo que la identifica.

   Los datos vigentes son los de la app; lo anterior queda como antecedente.
   No cambia el archivo plano: el CF no se reporta y la ficha va en su mes.

   Lo calcula el servidor al guardar una ficha (api/_antecedentes.js) y, para
   las que ya estaban, bd/marcar_antecedentes.js.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS visitas_anteriores int NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'familia_ficha_visitas_anteriores') THEN
    ALTER TABLE aps.familia_ficha ADD CONSTRAINT familia_ficha_visitas_anteriores CHECK (visitas_anteriores >= 0);
  END IF;
END $$;

COMMENT ON COLUMN aps.familia_ficha.visitas_anteriores IS
  'Caracterizaciones de esta familia antes de la ficha (base anterior u otras fichas de la app): el CF parte de ellas.';

CREATE TABLE IF NOT EXISTS aps.familia_antecedente (
  id                  bigserial PRIMARY KEY,
  familia_ficha_id    bigint NOT NULL REFERENCES aps.familia_ficha(id) ON DELETE CASCADE,
  origen              text   NOT NULL,                 -- base_previa | app
  referencia          text   NOT NULL,                 -- número de vivienda anterior o código de ficha
  ficha_id            bigint REFERENCES aps.ficha(id) ON DELETE SET NULL,  -- si es de la app
  fecha               date,
  ebs                 text,
  territorio          text,
  personas_coinciden  int    NOT NULL,
  registrado_en       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_ficha_id, origen, referencia),
  CONSTRAINT familia_antecedente_origen CHECK (origen IN ('base_previa', 'app')),
  CONSTRAINT familia_antecedente_personas CHECK (personas_coinciden >= 1)
);

COMMENT ON TABLE aps.familia_antecedente IS
  'Caracterizaciones anteriores de las personas de una familia: en la base anterior a la app o en otra ficha.';

COMMIT;
