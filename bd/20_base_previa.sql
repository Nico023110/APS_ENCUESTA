/* =========================================================================
   APS APP — CARACTERIZACIONES PREVIAS A LA APP (BASE 2025 – 1.er SEM. 2026)
   Archivo 20 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ ES

   Antes de la app, los EBS caracterizaban con las plantillas «Caracterización
   general de la vivienda y su entorno». La E.S.E. unificó lo de 2025 y del
   primer semestre de 2026 en un Excel («BASE DE DATOS IDENTIFICACIONES (EBS)
   AÑO 2025 - PRIMER SEMESTRE 2026, MIGRAR APP»): una fila por persona.

   Se guarda aparte, en el esquema hist, para una sola cosa (decisión del
   2026-11-18): saber antes de la visita si una vivienda o una persona ya fue
   caracterizada, y no repetir el trabajo. Lo consulta el buscador
   «¿Ya fue caracterizada?» de Inicio (api/base_previa.js).

   QUÉ NO ES

   - No son fichas de la app: no entran al historial, al archivo plano (se
     reportaron con la herramienta anterior y son de otro instrumento) ni a
     los tableros.
   - Sólo se guarda lo que hace falta para reconocer la vivienda y decir
     cuándo, qué EBS y quién: ubicación, fechas, EBS, responsable, cuántas
     familias y personas, y los documentos. Ni nombres, ni fechas de
     nacimiento, ni datos de salud (Ley 1581: finalidad y minimización). El
     Excel original sigue siendo la fuente completa.

   La carga la hace bd/cargar_base_previa.js (ensayo por defecto). Volver a
   cargar el mismo archivo lo reemplaza: la huella SHA-256 lo identifica.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

CREATE SCHEMA IF NOT EXISTS hist;

COMMENT ON SCHEMA hist IS
  'Caracterizaciones hechas antes de la app, sólo para reconocer viviendas y personas ya caracterizadas. '
  'No son fichas: no van al historial, al archivo plano ni a los tableros.';

/* Cada archivo cargado. */
CREATE TABLE IF NOT EXISTS hist.carga (
  id          serial PRIMARY KEY,
  archivo     text NOT NULL,
  huella      text NOT NULL UNIQUE,              -- SHA-256 del archivo
  periodo     text NOT NULL,                     -- p. ej. «2025 – primer semestre de 2026»
  viviendas   int  NOT NULL,
  personas    int  NOT NULL,
  cargada_en  timestamptz NOT NULL DEFAULT now()
);

/* Una fila por vivienda («NUMERO UNICO DE VIVIENDA» de la herramienta anterior). */
CREATE TABLE IF NOT EXISTS hist.vivienda (
  id                    bigserial PRIMARY KEY,
  carga_id              int  NOT NULL REFERENCES hist.carga(id) ON DELETE CASCADE,
  numero_anterior       text NOT NULL,           -- número único de vivienda de la herramienta anterior
  territorio            text,
  microterritorio       text,
  division_territorial  text,                    -- corregimiento, vereda o barrio
  direccion             text,                    -- tal como se escribió
  clave_direccion       text,                    -- cruce.js claveDeDireccion; null si no se pudo leer
  latitud               numeric(9,6),            -- reconstruida (el Excel perdió el punto decimal)
  longitud              numeric(9,6),
  punto_referencia      text,
  primera_fecha         date,
  ultima_fecha          date,
  ebs_codigo            text,                    -- EBS031
  ebs_nombre            text,                    -- Comuna 1
  responsable           text,                    -- quien caracterizó (ítem 17.1 del instrumento 2025)
  perfil_responsable    text,
  familias              int  NOT NULL,
  personas              int  NOT NULL,
  UNIQUE (carga_id, numero_anterior),
  CONSTRAINT hist_vivienda_geo_par CHECK ((latitud IS NULL) = (longitud IS NULL))
);

CREATE INDEX IF NOT EXISTS ix_hist_vivienda_clave ON hist.vivienda (clave_direccion)
  WHERE clave_direccion IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_hist_vivienda_geo ON hist.vivienda (latitud, longitud)
  WHERE latitud IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_hist_vivienda_territorio ON hist.vivienda (territorio);
CREATE INDEX IF NOT EXISTS ix_hist_vivienda_ebs ON hist.vivienda (ebs_codigo);

/* Los documentos de quienes vivían ahí. Sin nombres: basta el número para
   reconocer a la persona que se tiene enfrente. */
CREATE TABLE IF NOT EXISTS hist.persona (
  vivienda_id  bigint NOT NULL REFERENCES hist.vivienda(id) ON DELETE CASCADE,
  tipo_id      text NOT NULL,                    -- CC, TI, RC… (el código antes del guion)
  numero_id    text NOT NULL,                    -- cruce.js documentoDeCruce
  PRIMARY KEY (vivienda_id, tipo_id, numero_id)
);

CREATE INDEX IF NOT EXISTS ix_hist_persona_numero ON hist.persona (numero_id);

COMMIT;
