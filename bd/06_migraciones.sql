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


/* -------------------------------------------------------------------------
   2026-09 — Acceso: usuarios, sesiones e intentos (RN-223.6, RN-224.3, RN-225)
   -------------------------------------------------------------------------
   Hasta aquí cualquiera con el enlace leía y escribía fichas. Estas tres
   tablas soportan el inicio de sesión por número de documento: la cuenta
   cuelga del funcionario (ítems 12-14), el rol es su perfil asistencial o
   «administrador», y la sesión vive en la base para poder revocarla.
   Mismo bloque que en 01_esquema.sql, en forma idempotente.
   ------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS aps.usuario (
  id                  bigserial PRIMARY KEY,
  funcionario_id      bigint NOT NULL UNIQUE REFERENCES aps.funcionario(id),
  documento           text NOT NULL UNIQUE,
  clave_hash          text NOT NULL,
  rol                 text NOT NULL,
  activo              boolean NOT NULL DEFAULT true,
  debe_cambiar_clave  boolean NOT NULL DEFAULT true,
  intentos_fallidos   int NOT NULL DEFAULT 0,
  bloqueado_hasta     timestamptz,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  creado_por          bigint REFERENCES aps.usuario(id),
  clave_cambiada_en   timestamptz,
  ultimo_acceso_en    timestamptz,
  CONSTRAINT usuario_rol_valido CHECK (rol IN ('administrador', 'maestro') OR cat.es_opcion('PERFIL_PROFESIONAL', rol)),
  CONSTRAINT usuario_documento_formato CHECK (documento ~ '^[A-Za-z0-9]{5,16}$')
);
COMMENT ON TABLE aps.usuario IS
  'Cuenta de acceso de un funcionario. RN-224.3: el alcance sobre las fichas se deriva del '
  'equipo del funcionario y del rol (roles.js).';

CREATE TABLE IF NOT EXISTS aps.sesion (
  id              text PRIMARY KEY,
  usuario_id      bigint NOT NULL REFERENCES aps.usuario(id) ON DELETE CASCADE,
  creada_en       timestamptz NOT NULL DEFAULT now(),
  expira_en       timestamptz NOT NULL,
  ultimo_uso_en   timestamptz NOT NULL DEFAULT now(),
  ip              text,
  agente          text,
  revocada_en     timestamptz,
  motivo_revocacion text
);
CREATE INDEX IF NOT EXISTS ix_sesion_usuario ON aps.sesion (usuario_id, revocada_en);

CREATE TABLE IF NOT EXISTS aps.intento_acceso (
  id          bigserial PRIMARY KEY,
  documento   text,
  usuario_id  bigint REFERENCES aps.usuario(id) ON DELETE SET NULL,
  exitoso     boolean NOT NULL,
  motivo      text,
  ip          text,
  agente      text,
  ocurrido_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_intento_acceso_ip ON aps.intento_acceso (ip, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_intento_acceso_documento ON aps.intento_acceso (documento, ocurrido_en DESC);

/* La auditoría es de sólo inserción (trg_solo_insercion) y desde ahora se
   escribe en cada guardado; con llave foránea a la ficha, ninguna ficha con
   auditoría podría borrarse jamás, ni siquiera una de prueba. El registro
   debe sobrevivir a la ficha: la columna queda como referencia sin FK. */
ALTER TABLE aud.evento DROP CONSTRAINT IF EXISTS evento_ficha_id_fkey;
ALTER TABLE aud.acceso_sensible DROP CONSTRAINT IF EXISTS acceso_sensible_ficha_id_fkey;
ALTER TABLE aud.acceso_sensible DROP CONSTRAINT IF EXISTS acceso_sensible_integrante_id_fkey;

/* Rol «maestro»: todos los permisos (captura + administración). */
ALTER TABLE aps.usuario DROP CONSTRAINT IF EXISTS usuario_rol_valido;
ALTER TABLE aps.usuario ADD CONSTRAINT usuario_rol_valido
  CHECK (rol IN ('administrador', 'maestro') OR cat.es_opcion('PERFIL_PROFESIONAL', rol));

COMMIT;
