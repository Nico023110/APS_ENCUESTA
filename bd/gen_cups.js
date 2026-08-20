/* =========================================================================
   Genera cups.csv y 04_cups.sql desde TablaReferencia_CUPS.xlsx (MSPS).
   Uso: node bd/gen_cups.js
   Lee el .xlsx directamente (es un ZIP con XML) sin dependencias externas.
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const XLSX = path.join(RAIZ, 'TablaReferencia_CUPS.xlsx');
const SALIDA_CSV = path.join(__dirname, 'cups.csv');
const SALIDA_SQL = path.join(__dirname, '04_cups.sql');

if (!fs.existsSync(XLSX)) {
  console.error('No se encontró ' + XLSX);
  process.exit(1);
}

/* --- 1. Descomprimir el xlsx a un directorio temporal ------------------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cups-'));
try {
  // ZipFile en lugar de Expand-Archive: éste último rechaza cualquier
  // extensión que no sea .zip, y un .xlsx es un zip con otro nombre.
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
    `[System.IO.Compression.ZipFile]::ExtractToDirectory('${XLSX}', '${tmp}')`],
    { stdio: 'pipe' });
} catch (e) {
  console.error('No se pudo descomprimir el xlsx: ' + e.message);
  process.exit(1);
}

/* --- 2. Parsear sharedStrings y la hoja --------------------------------- */
const P = '(?:x:)?';   // el archivo del MSPS usa el prefijo de namespace x:

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
          .replace(/&amp;/g, '&');
}

const ss = [];
const ssXml = fs.readFileSync(path.join(tmp, 'xl/sharedStrings.xml'), 'utf8');
for (const m of ssXml.matchAll(new RegExp(`<${P}si>([\\s\\S]*?)</${P}si>`, 'g'))) {
  let txt = '';
  for (const t of m[1].matchAll(new RegExp(`<${P}t[^>]*>([\\s\\S]*?)</${P}t>`, 'g'))) txt += t[1];
  ss.push(decode(txt));
}

const hoja = fs.readFileSync(path.join(tmp, 'xl/worksheets/sheet1.xml'), 'utf8');
const filas = [];
const reRow = new RegExp(`<${P}row[^>]*>([\\s\\S]*?)</${P}row>`, 'g');
const reCel = new RegExp(`<${P}c r="([A-Z]+)\\d+"([^>]*)(?:/>|>([\\s\\S]*?)</${P}c>)`, 'g');
const reVal = new RegExp(`<${P}v>([\\s\\S]*?)</${P}v>`);
for (const row of hoja.matchAll(reRow)) {
  const celdas = {};
  for (const c of row[1].matchAll(reCel)) {
    const v = (c[3] || '').match(reVal);
    if (!v) continue;
    celdas[c[1]] = /t="s"/.test(c[2]) ? ss[+v[1]] : decode(v[1]);
  }
  filas.push(celdas);
}
fs.rmSync(tmp, { recursive: true, force: true });

/* --- 3. Mapear columnas -------------------------------------------------
   A Tabla · B Codigo · C Nombre · D Descripcion(capítulo) · E Habilitado
   I Extra_I:Cobertura(sexo) · M Extra_V(código jerárquico)
   O Extra_VII(categoría) · P Extra_VIII(subgrupo) · Q Extra_IX(grupo)
   R Extra_X(quirúrgico) · U Fecha_Actualizacion
   El resto de columnas son constantes en toda la fuente y no aportan.      */

const datos = filas.slice(1).filter(r => r.B && r.C);
const vistos = new Set();
const registros = [];
let duplicados = 0, sinSexo = 0;

for (const r of datos) {
  const codigo = String(r.B).trim();
  if (vistos.has(codigo)) { duplicados++; continue; }
  vistos.add(codigo);

  // '#N/D' aparece en la fuente donde el sexo no está determinado.
  let sexo = (r.I || '').trim().toUpperCase();
  if (!['Z', 'F', 'M'].includes(sexo)) { sexo = ''; sinSexo++; }

  let fecha = (r.U || '').trim();          // "2026-04-29 12:54:39 PM"
  if (fecha) {
    const m = fecha.match(/^(\d{4}-\d{2}-\d{2}) (\d{1,2}):(\d{2}):(\d{2}) ?(AM|PM)?$/i);
    if (m) {
      let h = +m[2];
      if (/PM/i.test(m[5] || '') && h < 12) h += 12;
      if (/AM/i.test(m[5] || '') && h === 12) h = 0;
      fecha = `${m[1]} ${String(h).padStart(2, '0')}:${m[3]}:${m[4]}`;
    }
  }

  registros.push([
    codigo,
    String(r.C).trim(),
    'CUPS',
    (r.D || '').trim(),
    (r.Q || '').trim(),
    (r.P || '').trim(),
    (r.O || '').trim(),
    (r.M || '').trim(),
    sexo,
    (r.R || '').trim().toUpperCase() === 'SI' ? 'true' : 'false',
    (r.E || '').trim().toUpperCase() === 'SI' ? 'true' : 'false',
    fecha
  ]);
}

/* --- 4. Escribir el CSV ------------------------------------------------- */
const esc = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const cabecera = ['codigo','nombre','tipo','capitulo','grupo','subgrupo','categoria',
                  'codigo_jerarquico','sexo_aplicable','quirurgico','habilitado','actualizado_en'];
const csv = [cabecera.join(',')]
  .concat(registros.map(f => f.map(esc).join(',')))
  .join('\r\n') + '\r\n';
fs.writeFileSync(SALIDA_CSV, '﻿' + csv, 'utf8');

/* --- 5. Escribir el cargador SQL ---------------------------------------- */
const sql = `/* =========================================================================
   APS APP — CARGA DEL CATÁLOGO CUPS
   GENERADO desde TablaReferencia_CUPS.xlsx. No editar a mano:
   regenerar con  node bd/gen_cups.js
   Archivo 4 de 4 — Datos de referencia

   ${registros.length} procedimientos oficiales del Ministerio de Salud.
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

/* Carga por tabla temporal y no con TRUNCATE + \\copy directo.
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

\\copy cups_carga FROM 'cups.csv' WITH (FORMAT csv, HEADER true, NULL '', ENCODING 'UTF8')

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

   Los ${registros.length} códigos son el catálogo oficial completo, que incluye
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
`;

fs.writeFileSync(SALIDA_SQL, sql, 'utf8');

console.log('CUPS cargados:      ' + registros.length);
console.log('duplicados omitidos:' + duplicados);
console.log('sin sexo definido:  ' + sinSexo);
console.log('escrito: bd/cups.csv y bd/04_cups.sql');
