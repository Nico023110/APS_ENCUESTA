/* =========================================================================
   APS APP — FECHA Y HORA DE DILIGENCIAMIENTO DE LA FICHA
   Archivo 11 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   El ítem 16 del instrumento es sólo una fecha (aps.ficha.fecha_diligenciamiento,
   tipo date) y así debe seguir: el archivo plano SISPRO la entrega como fecha.
   Para llevar un control más seguro de cuándo se diligenció cada ficha se
   guarda aparte el momento exacto, con hora:

     diligenciada_en  el instante en que quien diligencia guardó la ficha, tal
                      como lo fijó su dispositivo. Una visita tomada sin señal
                      se sincroniza horas o días después, y esa demora no
                      puede pasar por la hora de la visita.
     capturada_en     (ya existía) el instante en que el servidor recibió la
                      ficha. No lo controla el dispositivo, así que sirve de
                      contraste: si ambos difieren mucho, la ficha se
                      sincronizó tarde.

   Las fichas anteriores no tienen la hora del dispositivo: se completan con
   la del servidor, que es lo más cercano que se conserva.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

ALTER TABLE aps.ficha ADD COLUMN IF NOT EXISTS diligenciada_en timestamptz;

UPDATE aps.ficha SET diligenciada_en = capturada_en WHERE diligenciada_en IS NULL;

COMMENT ON COLUMN aps.ficha.diligenciada_en IS
  'Instante en que se diligenció la ficha, según el dispositivo. El ítem 16 conserva sólo la fecha.';
