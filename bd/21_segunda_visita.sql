/* =========================================================================
   APS APP — SEGUNDA VISITA PARA COMPLETAR INTEGRANTES (CF002, CF003…)
   Archivo 21 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA (decisión del 2026-11-19, por instrucción de los EBS)

   Una ficha puede subir y reportarse con integrantes por caracterizar: si el
   ítem 51 declara 5 personas y en la visita estaban 2, va al archivo plano de
   su mes con esas 2 (la variable 110 cuenta los registros tipo 3, así que es
   coherente). Cuando se vuelve a la vivienda a caracterizar a quienes
   faltaban («Completar integrantes» del historial), eso es una SEGUNDA VISITA
   de la misma ficha:

     - el CF (código de la ficha, pregunta 19 de la ficha técnica, que cuenta
       las visitas) sube en todas las familias de la vivienda: CF002, CF003…;
     - la visita tiene su propia fecha y su propio responsable;
     - el archivo plano del mes de esa visita lleva la ficha completa otra
       vez —todas sus familias y todas sus personas— con la fecha y el
       responsable de la segunda visita;
     - el archivo del mes de la primera visita lleva sólo a quienes se
       caracterizaron en ella: no cambia aunque se genere después.

   La visita 1 es la ficha misma (aps.ficha: su fecha y su responsable, que
   no cambian una vez sincronizada, trg_ficha_inalterable). Las siguientes
   viven en aps.visita_ficha, y cada integrante dice en qué visita se
   caracterizó (aps.integrante.visita_numero; los que ya estaban, la 1).

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

CREATE TABLE IF NOT EXISTS aps.visita_ficha (
  id               bigserial PRIMARY KEY,
  ficha_id         bigint NOT NULL REFERENCES aps.ficha(id) ON DELETE CASCADE,
  numero           int    NOT NULL,                       -- 2, 3…: la 1 es la ficha
  fecha            date   NOT NULL,                       -- día de la visita (hora de Colombia)
  diligenciada_en  timestamptz,                           -- instante en el dispositivo
  responsable_id   bigint NOT NULL REFERENCES aps.funcionario(id),
  motivo           text   NOT NULL DEFAULT 'completar_integrantes',
  integrantes      int    NOT NULL DEFAULT 0,             -- personas caracterizadas en esta visita
  registrada_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ficha_id, numero),
  CONSTRAINT visita_ficha_numero CHECK (numero >= 2),
  CONSTRAINT visita_ficha_motivo CHECK (motivo IN ('completar_integrantes'))
);

CREATE INDEX IF NOT EXISTS ix_visita_ficha_fecha ON aps.visita_ficha (fecha);

COMMENT ON TABLE aps.visita_ficha IS
  'Visitas de una ficha después de la primera (la ficha misma): hoy, la de completar integrantes. Cada una sube el '
  'CF de todas las familias y va al archivo plano de su mes con la ficha completa.';

ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS visita_numero int NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integrante_visita_numero') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT integrante_visita_numero CHECK (visita_numero >= 1);
  END IF;
END $$;

COMMENT ON COLUMN aps.integrante.visita_numero IS
  'En qué visita de la ficha se caracterizó: 1 la ficha, 2 en adelante aps.visita_ficha. El archivo plano de una '
  'visita lleva a los integrantes hasta ella.';

COMMIT;
