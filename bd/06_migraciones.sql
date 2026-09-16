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


/* -------------------------------------------------------------------------
   2026-09 — Ítem 65.1: país cuando la nacionalidad es «Otra»
   -------------------------------------------------------------------------
   La lista de nacionalidades se redujo a Colombia, Venezuela y Otra; con
   «Otra» el encuestador escribe el país. cat.pais conserva sus códigos: 'OT'
   sigue siendo la llave y el nombre va aquí, para el seguimiento a población
   extranjera sin volver a cerrar la lista.
   ------------------------------------------------------------------------- */

ALTER TABLE aps.persona
  ADD COLUMN IF NOT EXISTS nacionalidad_otra text;

COMMENT ON COLUMN aps.persona.nacionalidad_otra IS
  'Ítem 65.1. País escrito por el encuestador cuando nacionalidad = ''OT'' (Otra).';


/* -------------------------------------------------------------------------
   2026-09 — Revierte la migración "territorios T01-T110 sin microterritorios
   inventados fuera del Anexo A" (commit 1e62d0e), pedido explícito para
   volver al estado anterior en la base ya migrada.
   -------------------------------------------------------------------------
   Deja cat.territorio.es_rural y aps.hogar.microterritorio_codigo como en
   01_esquema.sql (NOT NULL) y repone los 292 microterritorios MT01-MT04 sin
   nombre en los 73 territorios sin Anexo A (T01-T47, T85-T110).
   ------------------------------------------------------------------------- */

UPDATE cat.territorio SET es_rural = false WHERE es_rural IS NULL;

ALTER TABLE cat.territorio ALTER COLUMN es_rural SET DEFAULT false;
ALTER TABLE cat.territorio ALTER COLUMN es_rural SET NOT NULL;

ALTER TABLE aps.hogar ALTER COLUMN microterritorio_codigo SET NOT NULL;

INSERT INTO cat.microterritorio (territorio_codigo, codigo, nombre, comuna)
SELECT t.codigo, mt.codigo, NULL, NULL
  FROM cat.territorio t
 CROSS JOIN (VALUES ('MT01'), ('MT02'), ('MT03'), ('MT04')) AS mt(codigo)
 WHERE t.codigo IN (
   'T01','T02','T03','T04','T05','T06','T07','T08','T09','T10',
   'T11','T12','T13','T14','T15','T16','T17','T18','T19','T20',
   'T21','T22','T23','T24','T25','T26','T27','T28','T29','T30',
   'T31','T32','T33','T34','T35','T36','T37','T38','T39','T40',
   'T41','T42','T43','T44','T45','T46','T47',
   'T85','T86','T87','T88','T89','T90','T91','T92','T93','T94',
   'T95','T96','T97','T98','T99','T100','T101','T102','T103','T104',
   'T105','T106','T107','T108','T109','T110'
 )
ON CONFLICT (territorio_codigo, codigo) DO NOTHING;

CREATE OR REPLACE FUNCTION aps.trg_hogar_territorio_area() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_es_rural boolean;
BEGIN
  SELECT es_rural INTO v_es_rural FROM cat.territorio WHERE codigo = NEW.territorio_codigo;

  IF v_es_rural AND NEW.area_ubicacion NOT IN ('rural', 'centro_poblado') THEN
    RAISE EXCEPTION 'RN-007: el territorio % es rural y no admite el área de ubicación "%".',
      NEW.territorio_codigo, NEW.area_ubicacion;
  END IF;

  IF NOT v_es_rural AND NEW.area_ubicacion = 'rural' THEN
    RAISE EXCEPTION 'RN-007: el territorio % es urbano y no admite el área "Área rural".',
      NEW.territorio_codigo;
  END IF;

  -- RN-008: la comuna es un derivado de sólo lectura del microterritorio.
  SELECT comuna INTO NEW.comuna
    FROM cat.microterritorio
   WHERE territorio_codigo = NEW.territorio_codigo AND codigo = NEW.microterritorio_codigo;

  RETURN NEW;
END $$;

COMMIT;
