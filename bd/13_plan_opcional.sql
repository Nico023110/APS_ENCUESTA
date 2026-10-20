/* =========================================================================
   APS APP — PLAN DE CUIDADO SIN CAMPOS OBLIGATORIOS
   Archivo 13 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   La E.S.E. pidió que nada del plan de cuidado sea obligatorio para guardar
   la ficha: se guarda con la caracterización y el plan se completa después
   con «Evolucionar plan» (RN-222, plan diferido). El motor de reglas ya
   advierte en lugar de bloquear; aquí la base deja de exigir lo que una fila
   a medias todavía no tiene, para guardarla tal como está y no perder lo
   que sí se escribió:

     acción        ejecutor, código CUPS/NoCUPS y tipo de respuesta pueden
                   faltar; una acción derivada puede no tener todavía la
                   institución de destino.
     seguimiento   responsable y acción concertada pueden faltar; el 1.º y el
                   2.º seguimiento pueden tener fecha sin estado (o al revés)
                   y un «No cumple» puede no tener aún su motivo.

   Lo que sí se conserva: el código, si está, sigue siendo llave foránea a
   cat.cups; el 2.º seguimiento, si hay dos fechas, es posterior al 1.º.
   Una acción cuenta como conducta (RN-220) sólo cuando tiene código.

   El disparador de fechas deja de rechazar un primer seguimiento anterior a
   la visita: el motor lo advierte en pantalla (RN-226.1) y, como lo demás
   del plan, se corrige al evolucionarlo.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

ALTER TABLE aps.plan_accion ALTER COLUMN ejecutor_id    DROP NOT NULL;
ALTER TABLE aps.plan_accion ALTER COLUMN codigo_accion  DROP NOT NULL;
ALTER TABLE aps.plan_accion ALTER COLUMN tipo_respuesta DROP NOT NULL;
ALTER TABLE aps.plan_accion DROP CONSTRAINT IF EXISTS accion_derivada_destino;

ALTER TABLE aps.plan_seguimiento ALTER COLUMN responsable_id    DROP NOT NULL;
ALTER TABLE aps.plan_seguimiento ALTER COLUMN accion_concertada DROP NOT NULL;
ALTER TABLE aps.plan_seguimiento DROP CONSTRAINT IF EXISTS seg1_completo;
ALTER TABLE aps.plan_seguimiento DROP CONSTRAINT IF EXISTS seg2_completo;
ALTER TABLE aps.plan_seguimiento DROP CONSTRAINT IF EXISTS seg1_nc_motivado;
ALTER TABLE aps.plan_seguimiento DROP CONSTRAINT IF EXISTS seg2_nc_motivado;
ALTER TABLE aps.plan_seguimiento DROP CONSTRAINT IF EXISTS seg2_posterior;
ALTER TABLE aps.plan_seguimiento ADD CONSTRAINT seg2_posterior
  CHECK (seg2_fecha IS NULL OR seg1_fecha IS NULL OR seg2_fecha > seg1_fecha);

COMMENT ON COLUMN aps.plan_accion.codigo_accion IS
  'Ítems 114 / 124 / 136a. Puede faltar mientras el plan está a medias (RN-222); '
  'la acción cuenta como conducta (RN-220) sólo cuando tiene código.';

/* RN-226.1 — Sólo se conserva la comprobación de la fecha de concertación,
   que pone el sistema; la del primer seguimiento se advierte en pantalla. */
CREATE OR REPLACE FUNCTION aps.trg_seguimiento_fechas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_fecha_ficha date;
BEGIN
  SELECT f.fecha_diligenciamiento INTO v_fecha_ficha
    FROM aps.plan_cuidado p JOIN aps.ficha f ON f.id = p.ficha_id
   WHERE p.id = NEW.plan_id;

  IF NEW.fecha_concertacion < v_fecha_ficha THEN
    RAISE EXCEPTION 'RN-016: la fecha de concertación (%) es anterior a la de diligenciamiento (%)',
      NEW.fecha_concertacion, v_fecha_ficha;
  END IF;
  RETURN NEW;
END $$;

COMMIT;
