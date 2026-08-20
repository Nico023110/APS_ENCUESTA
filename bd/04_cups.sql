/* =========================================================================
   APS APP — CARGA DEL CATÁLOGO CUPS
   GENERADO desde TablaReferencia_CUPS.xlsx. No editar a mano:
   regenerar con  node bd/gen_cups.js
   Archivo 4 de 4 — Datos de referencia

   10024 procedimientos oficiales del Ministerio de Salud.
   Soporta los ítems 114, 124 y 136a del Plan de Cuidado (RN-114/124/136a).
   ========================================================================= */

BEGIN;

/* Búsqueda por texto insensible a mayúsculas, tildes y sufijos.
   Un encuestador escribe "vacunacion antirrabica" y debe encontrar
   "VACUNACIÓN ANTIRRÁBICA": sin unaccent no la encuentra. */
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

/* Configuración de texto propia: español con tildes normalizadas.
   Debe ser una configuración nombrada y no una llamada a unaccent() suelta,
   porque to_tsvector(regconfig, text) sólo es IMMUTABLE —y por tanto
   indexable en columna generada— cuando la configuración es constante. */
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'espanol_sin_acentos') THEN
    CREATE TEXT SEARCH CONFIGURATION public.espanol_sin_acentos (COPY = spanish);
    ALTER TEXT SEARCH CONFIGURATION public.espanol_sin_acentos
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, spanish_stem;
  END IF;
END $$;

/* La columna de búsqueda se añade aquí y no en 01_esquema.sql porque depende
   de la configuración de texto que se acaba de crear. */
ALTER TABLE cat.cups
  ADD COLUMN IF NOT EXISTS busqueda tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.espanol_sin_acentos'::regconfig, coalesce(codigo,'') || ' ' || coalesce(nombre,''))
  ) STORED;

/* Carga por tabla temporal y no con TRUNCATE + \copy directo.
   Dos razones, ambas de pérdida de datos:
     1. cat.cups es referenciada por aps.plan_accion. Un TRUNCATE ... CASCADE
        borraría en silencio todas las acciones del Plan de Cuidado ya
        registradas — información clínica, no catálogo.
     2. apto_aps, ambito y los códigos NoCUPS son marcas locales que no vienen
        del Ministerio; una recarga no debe perderlas. */
CREATE TEMP TABLE cups_carga (
  codigo text, nombre text, tipo text, capitulo text, grupo text, subgrupo text,
  categoria text, codigo_jerarquico text, sexo_aplicable text, quirurgico boolean,
  habilitado boolean, actualizado_en timestamptz
) ON COMMIT DROP;

\copy cups_carga FROM 'cups.csv' WITH (FORMAT csv, HEADER true, NULL '', ENCODING 'UTF8')

INSERT INTO cat.cups (codigo, nombre, tipo, capitulo, grupo, subgrupo, categoria,
                      codigo_jerarquico, sexo_aplicable, quirurgico, habilitado, actualizado_en)
SELECT codigo, nombre, tipo::aps.tipo_procedimiento,
       nullif(capitulo, ''), nullif(grupo, ''), nullif(subgrupo, ''),
       nullif(categoria, ''), nullif(codigo_jerarquico, ''), nullif(sexo_aplicable, ''),
       quirurgico, habilitado, actualizado_en
  FROM cups_carga
ON CONFLICT (codigo) DO UPDATE SET
  nombre            = EXCLUDED.nombre,
  capitulo          = EXCLUDED.capitulo,
  grupo             = EXCLUDED.grupo,
  subgrupo          = EXCLUDED.subgrupo,
  categoria         = EXCLUDED.categoria,
  codigo_jerarquico = EXCLUDED.codigo_jerarquico,
  sexo_aplicable    = EXCLUDED.sexo_aplicable,
  quirurgico        = EXCLUDED.quirurgico,
  habilitado        = EXCLUDED.habilitado,
  actualizado_en    = EXCLUDED.actualizado_en;
  -- apto_aps y ambito se conservan deliberadamente.

/* Un código retirado por el Ministerio se marca deshabilitado, nunca se borra:
   puede estar referenciado por acciones históricas del Plan de Cuidado. */
UPDATE cat.cups c SET habilitado = false
 WHERE c.tipo = 'CUPS'
   AND NOT EXISTS (SELECT 1 FROM cups_carga t WHERE t.codigo = c.codigo);

/* --- Índices de búsqueda y selección ------------------------------------ */
CREATE INDEX IF NOT EXISTS ix_cups_busqueda  ON cat.cups USING gin (busqueda);
CREATE INDEX IF NOT EXISTS ix_cups_nombre_tg ON cat.cups USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_cups_codigo_tg ON cat.cups USING gin (codigo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_cups_capitulo  ON cat.cups (capitulo);
CREATE INDEX IF NOT EXISTS ix_cups_apto      ON cat.cups (apto_aps) WHERE apto_aps;

/* --- Función de búsqueda para el selector del Plan de Cuidado ------------
   Combina coincidencia de prefijo de código, ranking full-text y similitud
   trigram, en ese orden de confianza. El encuestador suele escribir tres o
   cuatro palabras sueltas; el trigram cubre los errores de digitación que el
   full-text no perdona. */
CREATE OR REPLACE FUNCTION cat.buscar_cups(
  p_texto    text,
  p_limite   int     DEFAULT 20,
  p_sexo     text    DEFAULT NULL,   -- 'hombre' | 'mujer' | 'intersexual'
  p_solo_aps boolean DEFAULT false
)
RETURNS TABLE (codigo text, nombre text, capitulo text, tipo aps.tipo_procedimiento, relevancia real)
LANGUAGE sql STABLE AS $$
  WITH consulta AS (
    SELECT plainto_tsquery('public.espanol_sin_acentos'::regconfig, p_texto) AS tsq,
           unaccent(lower(btrim(p_texto)))                                   AS txt
  )
  SELECT c.codigo, c.nombre, c.capitulo, c.tipo,
         GREATEST(
           CASE WHEN c.codigo ILIKE q.txt || '%' THEN 1.0 ELSE 0 END,
           ts_rank(c.busqueda, q.tsq),
           similarity(unaccent(lower(c.nombre)), q.txt)
         )::real AS relevancia
    FROM cat.cups c CROSS JOIN consulta q
   WHERE c.habilitado
     AND (NOT p_solo_aps OR c.apto_aps)
     -- RN-087: en personas intersexuales se habilitan los códigos de ambos
     -- sexos y la decisión la toma el profesional según el órgano presente.
     AND (p_sexo IS NULL OR p_sexo = 'intersexual' OR c.sexo_aplicable IS NULL
          OR c.sexo_aplicable = 'Z'
          OR (p_sexo = 'mujer'  AND c.sexo_aplicable = 'F')
          OR (p_sexo = 'hombre' AND c.sexo_aplicable = 'M'))
     AND (c.busqueda @@ q.tsq
          OR c.codigo ILIKE q.txt || '%'
          OR unaccent(lower(c.nombre)) % q.txt)
   ORDER BY relevancia DESC, c.codigo
   LIMIT p_limite;
$$;
COMMENT ON FUNCTION cat.buscar_cups IS
  'Selector de acciones del Plan de Cuidado (ítems 114, 124, 136a). '
  'Ejemplo: SELECT * FROM cat.buscar_cups(''vacunacion antirrabica'');';

COMMIT;

/* =========================================================================
   PENDIENTE — marcar el subconjunto apto para captura en campo

   Los 10024 códigos son el catálogo oficial completo, que incluye
   procedimientos de alta complejidad sin sentido en una visita domiciliaria.
   Mientras cat.cups.apto_aps esté en false para todos, buscar_cups(...) con
   p_solo_aps => true no devuelve nada, y el selector debe operar sobre el
   catálogo completo.

   Cuando la Secretaría defina la lista, se marca así:

     UPDATE cat.cups SET apto_aps = true WHERE codigo IN ('890201', '993501', ...);

   Los NoCUPS de salud ambiental y gestión (RN-114, RN-220) se insertan aparte:

     INSERT INTO cat.cups (codigo, nombre, tipo, apto_aps, ambito) VALUES
       ('NC-AMB-01', 'Canalización a vacunación antirrábica animal', 'NoCUPS', true, 'vivienda'),
       ('NC-GES-01', 'Gestión de afiliación al SGSSS',               'NoCUPS', true, 'persona');
   ========================================================================= */
