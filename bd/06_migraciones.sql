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
   2026-09 — Ítem 7: territorios T01–T110 sin microterritorios inventados
   -------------------------------------------------------------------------
   Una corrección anterior amplió el catálogo de 37 a 110 territorios (la
   observación del equipo EBS: "va del T01 hasta el T110") pero rellenó los
   73 territorios nuevos con cuatro microterritorios ficticios (MT01–MT04,
   sin nombre) y los marcó es_rural = false por defecto. Ningún dato respalda
   ese relleno, y el false por defecto podía rechazar con un 500 a un EBS que
   marcara "Área rural" en uno de esos territorios, aunque el motor de reglas
   del navegador sólo lo hubiera dejado como advertencia.

   Este bloque:
     1. Permite es_rural = NULL ("no documentado") en vez de un booleano
        inventado, y lo aplica a los 73 territorios sin microterritorio real.
     2. Borra los microterritorios ficticios (los que no tienen nombre): el
        territorio queda en el catálogo, sin microterritorios que elegir
        hasta que llegue el Anexo A completo. No hay hogares que los usaran.
     3. Permite que aps.hogar.microterritorio_codigo quede NULL para esos
        territorios: la clave foránea compuesta no se evalúa cuando alguna
        de sus columnas es NULL, así que la vivienda igual queda ligada a su
        territorio, y el ítem 9 (texto libre, siempre obligatorio) lleva el
        detalle de la micro-localización en ese caso.
     4. Reemplaza el disparador de RN-007 para que sólo bloquee cuando
        es_rural está documentado (IS TRUE / IS FALSE), nunca sobre un
        territorio con es_rural NULL.

   catalogos.js, reglas.js (RN-008) y app.js ya tratan así un territorio sin
   microterritorios documentados; este bloque pone la base de datos al día.
   ------------------------------------------------------------------------- */

ALTER TABLE cat.territorio ALTER COLUMN es_rural DROP NOT NULL;
ALTER TABLE cat.territorio ALTER COLUMN es_rural DROP DEFAULT;

UPDATE cat.territorio t
   SET es_rural = NULL
 WHERE NOT EXISTS (
   SELECT 1 FROM cat.microterritorio m
    WHERE m.territorio_codigo = t.codigo AND m.nombre IS NOT NULL
 );

DELETE FROM cat.microterritorio WHERE nombre IS NULL;

ALTER TABLE aps.hogar ALTER COLUMN microterritorio_codigo DROP NOT NULL;

CREATE OR REPLACE FUNCTION aps.trg_hogar_territorio_area() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_es_rural boolean;
BEGIN
  SELECT es_rural INTO v_es_rural FROM cat.territorio WHERE codigo = NEW.territorio_codigo;

  IF v_es_rural IS TRUE AND NEW.area_ubicacion NOT IN ('rural', 'centro_poblado') THEN
    RAISE EXCEPTION 'RN-007: el territorio % es rural y no admite el área de ubicación "%".',
      NEW.territorio_codigo, NEW.area_ubicacion;
  END IF;

  IF v_es_rural IS FALSE AND NEW.area_ubicacion = 'rural' THEN
    RAISE EXCEPTION 'RN-007: el territorio % es urbano y no admite el área "Área rural".',
      NEW.territorio_codigo;
  END IF;

  -- RN-008: la comuna es un derivado de sólo lectura del microterritorio.
  -- Sin microterritorio documentado (NEW.microterritorio_codigo IS NULL) la
  -- búsqueda no encuentra fila y la comuna queda en NULL, correctamente.
  SELECT comuna INTO NEW.comuna
    FROM cat.microterritorio
   WHERE territorio_codigo = NEW.territorio_codigo AND codigo = NEW.microterritorio_codigo;

  RETURN NEW;
END $$;

COMMIT;
