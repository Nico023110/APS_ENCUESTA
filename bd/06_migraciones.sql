/* =========================================================================
   APS APP — MIGRACIONES SOBRE BASES YA CREADAS
   Archivo 6 de 6 — cambios de estructura posteriores a 01_esquema.sql
   =========================================================================

   POR QUÉ EXISTE ESTE ARCHIVO

   `01_esquema.sql` crea la estructura desde cero: sus CREATE TABLE no llevan
   IF NOT EXISTS, así que sobre una base que ya existe falla en la primera
   sentencia. La única forma de aplicar un cambio de estructura era
   `npm run bd:recrear`, que borra la base entera —inaceptable en cuanto hay
   fichas capturadas—.

   Aquí van los cambios posteriores, siempre en forma idempotente, de modo que
   una base nueva y una base en producción terminen idénticas:

     - Una base recién creada ya trae todo lo de 01_esquema.sql, así que cada
       sentencia de este archivo no encuentra nada que hacer y no hace nada.
     - Una base anterior recibe sólo lo que le falta.

   Correr dos veces seguidas tiene que dar el mismo resultado que correrlo una:
   es la condición para poder dejarlo en la lista de scripts.

   Uso:   npm run bd:migrar        (sólo este archivo, sobre la base viva)
          npm run bd:crear         (lo aplica al final de los cinco anteriores)
   ========================================================================= */

BEGIN;

/* -------------------------------------------------------------------------
   2026-08 — Ítems 114 / 124 / 136a: el procedimiento, en palabras
   -------------------------------------------------------------------------
   El instrumento captura la acción como código CUPS o NoCUPS, y así debe
   seguir: de ese código dependen la llave foránea a cat.cups y el cruce
   alerta ↔ acción que exige RN-220. Pero la codificación es cerrada y el
   profesional necesitaba poder dejar escrito qué hizo realmente. Se agrega
   una columna de texto al lado del código, como complemento.
   ------------------------------------------------------------------------- */

ALTER TABLE aps.plan_accion
  ADD COLUMN IF NOT EXISTS procedimiento_realizado text;

COMMENT ON COLUMN aps.plan_accion.procedimiento_realizado IS
  'Ítems 114 / 124 / 136a. El código CUPS/NoCUPS nombra el procedimiento dentro de una '
  'codificación cerrada; esta columna deja al profesional describir en sus palabras lo que '
  'efectivamente hizo. Es complemento, no reemplazo: el código sigue siendo obligatorio '
  'porque de él dependen la llave foránea a cat.cups y el cruce alerta ↔ acción de RN-220.';

COMMIT;
