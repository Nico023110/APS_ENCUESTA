require('dotenv').config({ path: ['.env.local', '.env'] });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const copyFrom = require('pg-copy-streams').from;

async function loadCups() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Conectado a PostgreSQL para cargar CUPS...');

    await client.query('BEGIN;');
    
    // Extensions and functions
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS unaccent;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'espanol_sin_acentos') THEN
          CREATE TEXT SEARCH CONFIGURATION public.espanol_sin_acentos (COPY = spanish);
          ALTER TEXT SEARCH CONFIGURATION public.espanol_sin_acentos
            ALTER MAPPING FOR hword, hword_part, word
            WITH unaccent, spanish_stem;
        END IF;
      END $$;
      ALTER TABLE cat.cups
        ADD COLUMN IF NOT EXISTS busqueda tsvector
        GENERATED ALWAYS AS (
          to_tsvector('public.espanol_sin_acentos'::regconfig, coalesce(codigo,'') || ' ' || coalesce(nombre,''))
        ) STORED;
      CREATE TEMP TABLE cups_carga (
        codigo text, nombre text, tipo text, capitulo text, grupo text, subgrupo text,
        categoria text, codigo_jerarquico text, sexo_aplicable text, quirurgico boolean,
        habilitado boolean, actualizado_en timestamptz
      ) ON COMMIT DROP;
    `);

    console.log('Tabla temporal creada. Cargando CSV...');

    // Load CSV using COPY
    const csvPath = path.join(__dirname, 'bd', 'cups.csv');
    const stream = client.query(copyFrom("COPY cups_carga FROM STDIN WITH (FORMAT csv, HEADER true, NULL '', ENCODING 'UTF8')"));
    const fileStream = fs.createReadStream(csvPath);

    await new Promise((resolve, reject) => {
      fileStream.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', resolve);
      fileStream.pipe(stream);
    });

    console.log('CSV cargado en tabla temporal. Migrando a cat.cups...');

    // Finish 04_cups.sql
    await client.query(`
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

      UPDATE cat.cups c SET habilitado = false
       WHERE c.tipo = 'CUPS'
         AND NOT EXISTS (SELECT 1 FROM cups_carga t WHERE t.codigo = c.codigo);

      CREATE INDEX IF NOT EXISTS ix_cups_busqueda  ON cat.cups USING gin (busqueda);
      CREATE INDEX IF NOT EXISTS ix_cups_nombre_tg ON cat.cups USING gin (nombre gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS ix_cups_codigo_tg ON cat.cups USING gin (codigo gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS ix_cups_capitulo  ON cat.cups (capitulo);
      CREATE INDEX IF NOT EXISTS ix_cups_apto      ON cat.cups (apto_aps) WHERE apto_aps;

      CREATE OR REPLACE FUNCTION cat.buscar_cups(
        p_texto    text,
        p_limite   int     DEFAULT 20,
        p_sexo     text    DEFAULT NULL,
        p_solo_aps boolean DEFAULT false
      )
      RETURNS TABLE (codigo text, nombre text, capitulo text, tipo aps.tipo_procedimiento, relevancia real)
      LANGUAGE sql STABLE AS $func$
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
           AND (p_sexo IS NULL OR p_sexo = 'intersexual' OR c.sexo_aplicable IS NULL
                OR c.sexo_aplicable = 'Z'
                OR (p_sexo = 'mujer'  AND c.sexo_aplicable = 'F')
                OR (p_sexo = 'hombre' AND c.sexo_aplicable = 'M'))
           AND (c.busqueda @@ q.tsq
                OR c.codigo ILIKE q.txt || '%'
                OR unaccent(lower(c.nombre)) % q.txt)
         ORDER BY relevancia DESC, c.codigo
         LIMIT p_limite;
      $func$;
    `);

    await client.query('COMMIT;');
    console.log('✅ Catálogo CUPS cargado correctamente.');

    // Now execute 05_nocups.sql
    console.log('Ejecutando 05_nocups.sql...');
    const nocupsSql = fs.readFileSync(path.join(__dirname, 'bd', '05_nocups.sql'), 'utf8');
    await client.query(nocupsSql);
    console.log('✅ 05_nocups.sql ejecutado con éxito.');

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Error cargando CUPS:', err);
  } finally {
    await client.end();
  }
}

loadCups();
