/* =========================================================================
   Genera 07_anexo_sispro.sql a partir de anexo.js
   -------------------------------------------------------------------------
       node bd/gen_anexo.js

   Las variables que añade el anexo técnico SI-APS se declaran en anexo.js.
   Este generador escribe la estructura que las guarda:

     - respuesta única, texto, entero o fecha → una columna en la tabla del
       nivel (aps.vivienda, aps.familia_ficha, aps.integrante, aps.ficha o
       aps.hogar), con su CHECK de dominio, largo o rango;
     - selección múltiple → una tabla puente por pregunta, con una fila por
       opción marcada, igual que las del instrumento impreso.

   Todo con IF NOT EXISTS: el archivo corre igual sobre una base nueva que
   sobre la de producción, que ya tiene fichas. Encabeza el archivo la parte
   que no sale de la declaración —ítems del instrumento que el anexo cambió
   de forma, el identificador oficial del hogar, los parámetros del reporte—.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(__dirname, '07_anexo_sispro.sql');

const contexto = vm.createContext({});
['catalogos_sispro.js', 'catalogos.js', 'anexo.js'].forEach(function (archivo) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
});
const A = function (expresion) { return vm.runInContext(expresion, contexto); };

const PREGUNTAS = A('PREGUNTAS_ANEXO');
const tabla = function (p) { return A('tablaDePregunta')(p); };
const columna = function (p) { return A('columnaDePregunta')(p); };
const dominio = function (p) { return A('dominioDePregunta')(p); };
const puente = function (p) { return A('tablaPuenteDePregunta')(p); };
const padre = function (p) { return A('columnaPadreDePregunta')(p); };
const referenciaPadre = function (p) { return A('PUENTE_POR_TABLA')[tabla(p)].referencia; };
const codigo = function (p) { return A('codigoDePregunta')(p); };

const q = function (texto) { return "'" + String(texto).replace(/'/g, "''") + "'"; };

/* Nombre corto y estable para una restricción: PostgreSQL corta a 63. */
function nombreRestriccion(prefijo, p) {
  return (prefijo + '_' + columna(p)).slice(0, 60);
}

function tipoSql(p) {
  if (p.tipo === 'entero') return 'int';
  if (p.tipo === 'fecha') return 'date';
  return 'text';
}

function condicionCheck(p) {
  const col = columna(p);
  if (p.tipo === 'unica') return 'cat.es_opcion(' + q(dominio(p)) + ', ' + col + ')';
  if (p.tipo === 'entero') {
    const partes = [];
    if (p.min !== undefined) partes.push(col + ' >= ' + p.min);
    if (p.max !== undefined) partes.push(col + ' <= ' + p.max);
    return partes.length ? partes.join(' AND ') : null;
  }
  if (p.tipo === 'texto') return "char_length(" + col + ") <= " + (p.max || 200) + " AND position('|' in " + col + ") = 0";
  return null;
}

function agregarRestriccion(tablaSql, nombre, condicion) {
  return 'DO $$ BEGIN\n' +
    '  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ' + q(nombre) + ') THEN\n' +
    '    ALTER TABLE ' + tablaSql + ' ADD CONSTRAINT ' + nombre + ' CHECK (' + condicion + ');\n' +
    '  END IF;\n' +
    'END $$;';
}

const salida = [];

salida.push(`/* =========================================================================
   APS APP — Variables del anexo técnico SI-APS (reporte APS124CCFP)
   -------------------------------------------------------------------------
   GENERADO por bd/gen_anexo.js desde anexo.js. No editar a mano.
   Idempotente: se aplica con \`npm run bd:migrar\` sobre la base existente y
   con \`npm run bd:crear\` sobre una nueva.
   ========================================================================= */

BEGIN;

/* =========================================================================
   1. ÍTEMS DEL INSTRUMENTO QUE EL ANEXO CAMBIÓ DE FORMA
   -------------------------------------------------------------------------
   La situación inminente (ítem 2, variable 23) y los ítems 46 a 49
   (variables 53, 58, 59 y 62) pasan de respuesta única a selección múltiple.
   Cada uno gana su tabla puente; la columna de siempre se conserva con la
   opción principal —la primera marcada— para no romper lo que ya la lee
   (listados, la vista de riesgo anterior, consultas de análisis).
   ========================================================================= */

CREATE TABLE IF NOT EXISTS aps.ficha_situacion_inminente (
  ficha_id bigint NOT NULL REFERENCES aps.ficha(id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT fsi_codigo_valido CHECK (cat.es_opcion('SITUACION_INMINENTE', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_fuente_agua (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vfa_codigo_valido CHECK (cat.es_opcion('FUENTE_AGUA', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_disposicion_excretas (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vde_codigo_valido CHECK (cat.es_opcion('DISPOSICION_EXCRETAS', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_aguas_residuales (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT var_codigo_valido CHECK (cat.es_opcion('AGUAS_RESIDUALES', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_residuos_solidos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vrs_codigo_valido CHECK (cat.es_opcion('RESIDUOS_SOLIDOS', codigo))
);

/* Las fichas guardadas antes del anexo tienen su respuesta en la columna: pasa
   a ser la primera fila de su puente. */
INSERT INTO aps.ficha_situacion_inminente (ficha_id, codigo)
  SELECT id, situacion_inminente FROM aps.ficha WHERE situacion_inminente IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_fuente_agua (ficha_id, codigo)
  SELECT ficha_id, fuente_agua FROM aps.vivienda WHERE fuente_agua IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_disposicion_excretas (ficha_id, codigo)
  SELECT ficha_id, disposicion_excretas FROM aps.vivienda WHERE disposicion_excretas IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_aguas_residuales (ficha_id, codigo)
  SELECT ficha_id, aguas_residuales FROM aps.vivienda WHERE aguas_residuales IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_residuos_solidos (ficha_id, codigo)
  SELECT ficha_id, residuos_solidos FROM aps.vivienda WHERE residuos_solidos IS NOT NULL
  ON CONFLICT DO NOTHING;

/* Ítem 77: «Víctima de violencia de género e intrafamiliar» no existe en el
   anexo; la opción que abre la modalidad de la violencia es la 10, «Víctima
   de violencia interpersonal». */
INSERT INTO aps.integrante_sujeto_proteccion (integrante_id, codigo)
  SELECT integrante_id, 'victima_violencia_interpersonal'
    FROM aps.integrante_sujeto_proteccion WHERE codigo = 'victima_violencia_genero'
  ON CONFLICT DO NOTHING;
DELETE FROM aps.integrante_sujeto_proteccion WHERE codigo = 'victima_violencia_genero';

/* =========================================================================
   2. IDENTIFICADORES OFICIALES DEL REPORTE (variables 123 y 124)
   -------------------------------------------------------------------------
   El anexo arma el número de la vivienda con departamento, subregión,
   municipio, territorio y microterritorio, más «H» y un consecutivo de cuatro
   dígitos que REINICIA POR MICROTERRITORIO; el de la familia le suma «F» y
   el consecutivo dentro del hogar (aps.familia.consecutivo, que ya existe).
   El consecutivo del hogar se asigna una vez y no cambia: la misma vivienda
   tiene que llegar con el mismo número a cada reporte semanal.
   ========================================================================= */

ALTER TABLE aps.hogar ADD COLUMN IF NOT EXISTS consecutivo_sispro int;

CREATE UNIQUE INDEX IF NOT EXISTS ux_hogar_consecutivo_sispro
  ON aps.hogar (territorio_codigo, microterritorio_codigo, consecutivo_sispro)
  WHERE consecutivo_sispro IS NOT NULL;

/* Los hogares que ya existen reciben su consecutivo en orden de creación. */
WITH numerados AS (
  SELECT h.id,
         coalesce((SELECT max(o.consecutivo_sispro) FROM aps.hogar o
                    WHERE o.territorio_codigo = h.territorio_codigo
                      AND o.microterritorio_codigo = h.microterritorio_codigo), 0)
         + row_number() OVER (PARTITION BY h.territorio_codigo, h.microterritorio_codigo ORDER BY h.id) AS n
    FROM aps.hogar h
   WHERE h.consecutivo_sispro IS NULL
)
UPDATE aps.hogar h SET consecutivo_sispro = numerados.n
  FROM numerados WHERE numerados.id = h.id;

/* Parámetros del reporte. La subregión (variable 4) la asigna la Secretaría
   en el componente de gestión técnica de SI-APS: tres dígitos que el anexo
   no permite deducir. Mientras falte, el archivo plano la señala. */
INSERT INTO cat.parametro (clave, valor, descripcion) VALUES
  ('entidad_reportante', '{"tipo":"NI","numero":"805027289","nombre":"Red de Salud de Ladera E.S.E."}',
   'Anexo SI-APS, registro tipo 1 y nombre del archivo: tipo y número (NIT sin dígito de verificación) de la entidad que reporta.'),
  ('subregion_sispro', 'null',
   'Anexo SI-APS, variable 4: código de subregión (3 dígitos) parametrizado en SI-APS para el distrito. Sin él, las variables 4, 123 y 124 quedan incompletas.'),
  ('nit_prestador_primario', '"805027289"',
   'Anexo SI-APS, variable 26: NIT sin dígito de verificación del prestador primario u organismo de adscripción del EBS.')
ON CONFLICT (clave) DO NOTHING;

/* =========================================================================
   3. RN-211 CON LAS LISTAS
   -------------------------------------------------------------------------
   La vista contaba un hallazgo por la opción única de cada ítem. Ahora basta
   con que UNA de las opciones marcadas sea de riesgo; las fichas antiguas sin
   puente siguen contando por su columna.
   ========================================================================= */

CREATE OR REPLACE FUNCTION aps.alguna_marca(p_dominio text, p_codigos text[], p_bandera text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(bool_or(aps.marca(p_dominio, c, p_bandera)), false)
    FROM unnest(p_codigos) AS c;
$$;

CREATE OR REPLACE VIEW aps.v_riesgo_vivienda AS
SELECT v.ficha_id,
       v.hacinamiento,
       v.hacinamiento_critico,
       (v.hacinamiento)::int                                                          -- RN-033
     + aps.alguna_marca('FUENTE_AGUA', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_fuente_agua x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.fuente_agua]), 'noSegura')::int                                       -- RN-046
     + aps.alguna_marca('DISPOSICION_EXCRETAS', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_disposicion_excretas x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.disposicion_excretas]), 'critica')::int                               -- RN-047
     + aps.alguna_marca('AGUAS_RESIDUALES', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_aguas_residuales x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.aguas_residuales]), 'critica')::int                                   -- RN-048
     + aps.alguna_marca('RESIDUOS_SOLIDOS', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_residuos_solidos x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.residuos_solidos]), 'critica')::int                                   -- RN-049
     + (v.vectores = 'si')::int                                                        -- RN-037
     + (v.material_techo IN ('desechos','palma_paja','fibrocemento_con_asbesto','fibrocemento_asbesto'))::int -- RN-035
     + (v.perros_vacunados < v.perros
        OR v.gatos_vacunados < v.gatos
        OR v.carnet_antirrabico = 'no')::int                                           -- RN-042/044/045
     + (v.elementos_para_dormir < v.personas_en_vivienda / 2.0)::int                   -- RN-031
       AS hallazgos
  FROM aps.vivienda v;

/* =========================================================================
   4. VARIABLES NUEVAS DEL ANEXO (generado de anexo.js)
   ========================================================================= */
`);

const porTabla = {};
PREGUNTAS.forEach(function (p) {
  const t = tabla(p);
  (porTabla[t] = porTabla[t] || []).push(p);
});

let columnas = 0;
let puentes = 0;

Object.keys(porTabla).forEach(function (t) {
  const tablaSql = 'aps.' + t;
  salida.push('/* --- ' + tablaSql + ' ' + '-'.repeat(Math.max(3, 66 - tablaSql.length)) + ' */');

  porTabla[t].forEach(function (p) {
    const titulo = '-- ' + codigo(p) + ' · ' + p.etiqueta;

    if (p.tipo === 'multiple') {
      puentes++;
      const nombreTabla = puente(p);
      const corto = nombreTabla.replace(/^aps\./, '');
      salida.push(titulo);
      salida.push('CREATE TABLE IF NOT EXISTS ' + nombreTabla + ' (\n' +
        '  ' + padre(p) + ' bigint NOT NULL REFERENCES ' + referenciaPadre(p) + ' ON DELETE CASCADE,\n' +
        '  codigo ' + ' '.repeat(Math.max(1, padre(p).length - 6)) + 'text   NOT NULL,\n' +
        '  PRIMARY KEY (' + padre(p) + ', codigo),\n' +
        '  CONSTRAINT ' + (corto + '_valido').slice(0, 60) + ' CHECK (cat.es_opcion(' + q(dominio(p)) + ', codigo))\n' +
        ');');
      salida.push('COMMENT ON TABLE ' + nombreTabla + ' IS ' + q('Anexo SI-APS ' + codigo(p) + ': ' + p.etiqueta) + ';\n');
      return;
    }

    columnas++;
    salida.push(titulo);
    salida.push('ALTER TABLE ' + tablaSql + ' ADD COLUMN IF NOT EXISTS ' + columna(p) + ' ' + tipoSql(p) + ';');
    const check = condicionCheck(p);
    if (check) salida.push(agregarRestriccion(tablaSql, nombreRestriccion('ax_' + t.slice(0, 4), p), check));
    salida.push('COMMENT ON COLUMN ' + tablaSql + '.' + columna(p) + ' IS ' + q('Anexo SI-APS ' + codigo(p) + ': ' + p.etiqueta) + ';\n');
  });
});

salida.push('COMMIT;\n');

fs.writeFileSync(DESTINO, salida.join('\n'));
console.log('OK — ' + columnas + ' columnas y ' + puentes + ' tablas puente de ' + PREGUNTAS.length + ' variables');
console.log('     escrito en ' + DESTINO);
