/* Genera 02_catalogos_seed.sql a partir de catalogos.js (fuente única de verdad).

   Las rutas se resuelven desde la ubicación de este archivo. Antes estaban
   fijas en C:/APS_ENCUESTA y en el directorio temporal de otro usuario, de
   modo que el generador leía y escribía en una copia distinta del proyecto:
   editar catalogos.js aquí y regenerar no cambiaba nada, en silencio. */
'use strict';
const fs = require('fs');
const nodePath = require('path');
const os = require('os');

const RAIZ = nodePath.join(__dirname, '..');
const ORIGEN = nodePath.join(RAIZ, 'catalogos.js');
const DESTINO = nodePath.join(__dirname, '02_catalogos_seed.sql');

let src = fs.readFileSync(ORIGEN, 'utf8');

/* catalogos.js se carga al navegador con <script>, no exporta nada. Se le
   añade un module.exports al vuelo para poder leerlo desde node. */
const nombres = [...src.matchAll(/^const (CAT_[A-Z0-9_]+)\s*=/gm)].map(m => m[1]);
const wrapped = src + '\nmodule.exports = {' + nombres.map(n => n + ':' + n).join(',') + '};\n';
const tmp = nodePath.join(fs.mkdtempSync(nodePath.join(os.tmpdir(), 'aps-seed-')), '_cat.js');
fs.writeFileSync(tmp, wrapped);
const C = require(tmp);

/* Mapa CAT_X -> {dominio, item, regla, multiple}. Sólo listas simples;
   los catálogos estructurados se siembran aparte. */
const DOM = {
  CAT_AREA_UBICACION:            ['AREA_UBICACION', 6, 'RN-006', false],
  CAT_TIPO_ID_RESPONSABLE:       ['TIPO_ID_RESPONSABLE', 12, 'RN-012', false],
  CAT_PERFIL_PROFESIONAL:        ['PERFIL_PROFESIONAL', 14, 'RN-014', false],
  CAT_ENTORNO:                   ['ENTORNO', 17, 'RN-017', false],
  CAT_SI_NO:                     ['SI_NO', null, 'RN-001', false],
  CAT_SI_NO_NA:                  ['SI_NO_NA', null, 'RN-037', false],
  CAT_SITUACION_INMINENTE:       ['SITUACION_INMINENTE', 2, 'RN-002', false],
  CAT_ESTRATO:                   ['ESTRATO', 27, 'RN-027', false],
  CAT_TIPO_VIVIENDA:             ['TIPO_VIVIENDA', 34, 'RN-034', false],
  CAT_MATERIAL_TECHO:            ['MATERIAL_TECHO', 35, 'RN-035', false],
  CAT_RIESGOS_ACCIDENTE:         ['RIESGOS_ACCIDENTE', 36, 'RN-036', true],
  CAT_FACTORES_CONTAMINACION:    ['FACTORES_CONTAMINACION', 38, 'RN-038', true],
  CAT_ANIMALES:                  ['ANIMALES', 40, 'RN-040', true],
  CAT_FUENTE_AGUA:               ['FUENTE_AGUA', 46, 'RN-046', false],
  CAT_DISPOSICION_EXCRETAS:      ['DISPOSICION_EXCRETAS', 47, 'RN-047', false],
  CAT_AGUAS_RESIDUALES:          ['AGUAS_RESIDUALES', 48, 'RN-048', false],
  CAT_RESIDUOS_SOLIDOS:          ['RESIDUOS_SOLIDOS', 49, 'RN-049', false],
  CAT_TIPO_FAMILIA:              ['TIPO_FAMILIA', 50, 'RN-050', false],
  CAT_ZARIT:                     ['ZARIT', 53, 'RN-053', false],
  CAT_SITUACIONES_RIESGO_FAMILIAR:['SITUACIONES_RIESGO_FAMILIAR', 54, 'RN-054', true],
  CAT_PRACTICAS_VINCULO:         ['PRACTICAS_VINCULO', 55, 'RN-055', true],
  CAT_REDES_APOYO:               ['REDES_APOYO', 56, 'RN-056', false],
  CAT_PRACTICAS_CUIDADO_HOGAR:   ['PRACTICAS_CUIDADO_HOGAR', 57, 'RN-057', true],
  CAT_TIPO_ID_INTEGRANTE:        ['TIPO_ID_INTEGRANTE', 62, 'RN-062', false],
  CAT_SEXO:                      ['SEXO', 66, 'RN-066', false],
  CAT_GENERO:                    ['GENERO', 67, 'RN-067', false],
  CAT_AUTOIDENTIFICACION_GENERO: ['AUTOIDENTIFICACION_GENERO', 68, 'RN-068', false],
  CAT_ORIENTACION_SEXUAL:        ['ORIENTACION_SEXUAL', 69, 'RN-069', false],
  CAT_ROL_FAMILIAR:              ['ROL_FAMILIAR', 72, 'RN-072', false],
  CAT_NIVEL_EDUCATIVO:           ['NIVEL_EDUCATIVO', 74, 'RN-074', false],
  CAT_REGIMEN_AFILIACION:        ['REGIMEN_AFILIACION', 75, 'RN-075', false],
  CAT_SUJETO_ESPECIAL_PROTECCION:['SUJETO_ESPECIAL_PROTECCION', 77, 'RN-077', true],
  CAT_MODALIDAD_VIOLENCIA:       ['MODALIDAD_VIOLENCIA', 78, 'RN-078', true],
  CAT_PERTENENCIA_ETNICA:        ['PERTENENCIA_ETNICA', 79, 'RN-079', false],
  CAT_SABERES_ANCESTRALES:       ['SABERES_ANCESTRALES', 81, 'RN-081', true],
  CAT_DISCAPACIDAD:              ['DISCAPACIDAD', 82, 'RN-082', true],
  CAT_PRACTICAS_CUIDADO:         ['PRACTICAS_CUIDADO', 86, 'RN-086', true],
  CAT_ATENCIONES_RPMS:           ['ATENCIONES_RPMS', 87, 'RN-087', true],
  CAT_ATENCIONES_MATERNO:        ['ATENCIONES_MATERNO', 88, 'RN-088', true],
  CAT_BARRERAS_ACCESO:           ['BARRERAS_ACCESO', 89, 'RN-089', true],
  CAT_CONOCIMIENTO_DERECHO:      ['CONOCIMIENTO_DERECHO', 90, 'RN-090', true],
  CAT_CLASIFICACION_ANTROPOMETRICA:['CLASIFICACION_ANTROPOMETRICA', 96, 'RN-096', false],
  CAT_SIGNOS_DESNUTRICION:       ['SIGNOS_DESNUTRICION', 97, 'RN-097', true],
  CAT_CLASIFICACION_TENSION:     ['CLASIFICACION_TENSION', 99, 'RN-099', false],
  CAT_ENFERMEDADES_NO_TRANSMISIBLES:['ENFERMEDADES_NO_TRANSMISIBLES', 100, 'RN-100', true],
  CAT_CONDICIONES_TRANSMISIBLES: ['CONDICIONES_TRANSMISIBLES', 101, 'RN-101', true],
  CAT_ZONA_ENDEMICA:             ['ZONA_ENDEMICA', 102, 'RN-102', true],
  CAT_MOTIVO_NO_TRATAMIENTO:     ['MOTIVO_NO_TRATAMIENTO', 104, 'RN-104', true],
  CAT_RIESGOS_SALUD_MENTAL_JOVEN:['RIESGOS_SALUD_MENTAL_JOVEN', 105, 'RN-105', true],
  CAT_SINTOMATOLOGIA_DEPRESIVA:  ['SINTOMATOLOGIA_DEPRESIVA', 106, 'RN-106', true],
  CAT_IDEACION_SUICIDA:          ['IDEACION_SUICIDA', 107, 'RN-107', false],
  CAT_TIPO_RESPUESTA:            ['TIPO_RESPUESTA', 115, 'RN-115', false],
  CAT_ESTADO_SEGUIMIENTO:        ['ESTADO_SEGUIMIENTO', 118, 'RN-226', false],
  CAT_TIPO_ID_EJECUTOR:          ['TIPO_ID_EJECUTOR', 113, 'RN-113', false]
};

const q = s => s === null || s === undefined ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";

/* cat.parametro.valor es jsonb: una cadena suelta como 'UZPE006' no es JSON
   válido y el seed falla al aplicarse. Debe ir como '"UZPE006"'. */
const qJson = v => q(JSON.stringify(v));
const EXCL = new Set(['ninguno','ninguna','no_aplica','sin_discapacidad','no']);

let out = [];
out.push(`/* =========================================================================
   APS APP — SEED DE CATÁLOGOS
   GENERADO desde catalogos.js. No editar a mano: regenerar con bd/gen_seed.js.
   Archivo 2 de 3 — Datos de catálogo
   ========================================================================= */

BEGIN;

/* --- Parámetros de configuración (RN-003, RN-016, RN-022/023, RN-200) --- */
INSERT INTO cat.parametro (clave, valor, descripcion) VALUES
  ('departamento_fijo',  '{"codigo":"76","nombre":"Valle del Cauca"}', 'RN-003. Departamento fijado por despliegue.'),
  ('municipio_fijo',     '{"codigo":"76001","nombre":"Santiago de Cali"}', 'RN-005. Municipio fijado por despliegue.'),
  ('recuadro_municipal', '{"latMin":3.24,"latMax":3.56,"lonMin":-76.78,"lonMax":-76.40}', 'RN-022/023. Advierte sin bloquear fuera de rango.'),
  ('dias_maximos_ficha', '30', 'RN-016. Antigüedad máxima de la fecha de diligenciamiento.'),
  ('plazo_dias_prioridad','{"inmediata":2,"prioritaria":3,"regular":30}', 'RN-200/RN-226. Plazo máximo de respuesta por nivel.'),
  ('uzpe_predeterminada', ${qJson(C.UZPE_PREDETERMINADA || 'UZPE006')}, 'Valor prediligenciado del ítem 4.')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now();

/* --- DIVIPOLA (RN-003, RN-005) ----------------------------------------- */
INSERT INTO cat.departamento (codigo, nombre) VALUES (${q(C.CAT_DEPARTAMENTO.codigo)}, ${q(C.CAT_DEPARTAMENTO.nombre)})
  ON CONFLICT (codigo) DO NOTHING;
INSERT INTO cat.municipio (codigo, departamento_codigo, nombre)
  VALUES (${q(C.CAT_MUNICIPIO.codigo)}, ${q(C.CAT_DEPARTAMENTO.codigo)}, ${q(C.CAT_MUNICIPIO.nombre)})
  ON CONFLICT (codigo) DO NOTHING;

/* --- País (RN-065) ------------------------------------------------------ */`);

// Países
if (Array.isArray(C.CAT_NACIONALIDAD)) {
  const vals = C.CAT_NACIONALIDAD.map(o => `  (${q(o.valor || o.codigo)}, ${q(o.etiqueta || o.nombre)})`).join(',\n');
  out.push(`INSERT INTO cat.pais (codigo, nombre) VALUES\n${vals}\nON CONFLICT (codigo) DO NOTHING;\n`);
}

/* UZPE — se siembran exactamente las marcadas `vigente` en catalogos.js, que son
   las mismas que el formulario ofrece. Mantener las dos listas sincronizadas a
   mano fue lo que produjo la reescritura silenciosa del ítem 4: el formulario
   ofrecía diez y la base aceptaba una. */
const UZPE_ACTIVA = C.UZPE_PREDETERMINADA || 'UZPE006';
if (Array.isArray(C.CAT_UZPE)) {
  const vigentes = C.CAT_UZPE.filter(o => o.vigente);
  if (vigentes.length === 0) throw new Error('Ninguna UZPE marcada como vigente en CAT_UZPE.');

  const activa = vigentes.find(o => (o.valor || o.codigo) === UZPE_ACTIVA);
  if (!activa) {
    throw new Error('UZPE_PREDETERMINADA (' + UZPE_ACTIVA + ') no está entre las vigentes de CAT_UZPE.');
  }

  const uv = vigentes.map(o =>
    `  (${q(o.valor || o.codigo)}, ${q(C.CAT_MUNICIPIO.codigo)}, ${q(o.etiqueta || o.nombre)}, true)`
  ).join(',\n');

  out.push(`/* --- UZPE (RN-004) ------------------------------------------------------
   ${vigentes.length} UZPE vigente(s). Para habilitar otra, márquela \`vigente: true\`
   en CAT_UZPE (catalogos.js) con su denominación oficial y regenere este archivo.
   El formulario lee la misma lista, así que ambos lados no pueden divergir.   */
INSERT INTO cat.uzpe (codigo, municipio_codigo, nombre, vigente) VALUES
${uv}
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = true;\n`);
}

/* Catálogos oficiales externos (EAPB, CIUO, prestadores).
   No son dominios de cat.opcion sino tablas propias, así que se emiten
   aparte. Salen de catalogos.js para que el <select> del formulario y la
   llave foránea de la base ofrezcan exactamente lo mismo. */
if (Array.isArray(C.CAT_EAPB)) {
  const ev = C.CAT_EAPB.map(o =>
    `  (${q(o.valor)}, ${q(o.etiqueta)}, ${q(o.regimen || null)}, true)`
  ).join(',\n');
  out.push(`/* --- EAPB (ítem 76, RN-076) ---------------------------------------------
   ${C.CAT_EAPB.length} entidades. CONTENIDO PROVISIONAL: verificar contra el
   Registro Especial de EAPB del MSPS antes de cualquier despliegue.        */
INSERT INTO cat.eapb (codigo, nombre, regimen, vigente) VALUES
${ev}
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, regimen = EXCLUDED.regimen, vigente = true;\n`);
}

if (Array.isArray(C.CAT_OCUPACION_CIUO)) {
  const ov = C.CAT_OCUPACION_CIUO.map(o =>
    `  (${q(o.valor)}, ${q(o.etiqueta)}, ${q(o.riesgo || null)})`
  ).join(',\n');
  out.push(`/* --- Ocupaciones CIUO (ítem 73, RN-073) ---------------------------------
   ${C.CAT_OCUPACION_CIUO.length} ocupaciones. CONTENIDO PROVISIONAL: es una
   muestra de CIUO-08 A.C., no el catálogo del DANE. Cuando llegue completo
   conviene cargarlo como los CUPS (\\copy) y no desde este archivo.          */
INSERT INTO cat.ocupacion_ciuo (codigo, nombre, riesgo_ocupacional) VALUES
${ov}
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, riesgo_ocupacional = EXCLUDED.riesgo_ocupacional;\n`);
}

if (Array.isArray(C.CAT_PRESTADOR)) {
  const pv = C.CAT_PRESTADOR.map(o =>
    `  (${q(o.valor)}, ${q(o.etiqueta)}, true)`
  ).join(',\n');
  out.push(`/* --- Prestadores primarios (ítem 11, RN-011) ----------------------------
   ${C.CAT_PRESTADOR.length} prestadores de la red pública de Cali. Los códigos
   llevan prefijo PROV- a propósito: el REPS usa otro formato y no deben
   confundirse con códigos de habilitación reales.                          */
INSERT INTO cat.prestador (codigo, nombre, vigente) VALUES
${pv}
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, vigente = true;\n`);
}

/* Territorios y microterritorios — Anexo A de las reglas.
   RN-007: un territorio es rural cuando sus microterritorios llevan comuna
   "Rural". La bandera se deriva del propio catálogo, no se digita aparte. */
if (C.CAT_TERRITORIOS) {
  const terrs = Object.keys(C.CAT_TERRITORIOS);
  const esRural = t => C.CAT_TERRITORIOS[t].every(m => String(m.comuna).toLowerCase() === 'rural');
  const tv = terrs.map(t =>
    `  (${q(t)}, ${q(t)}, ${q(UZPE_ACTIVA)}, ${esRural(t)})`).join(',\n');
  const nRur = terrs.filter(esRural).length;
  out.push(`/* --- Territorios y microterritorios (RN-007, RN-008, Anexo A) -----------
   ${terrs.length} territorios: ${nRur} rurales, ${terrs.length - nRur} urbanos.
   El instrumento no asigna nombre propio al territorio: su código lo identifica. */
INSERT INTO cat.territorio (codigo, nombre, uzpe_codigo, es_rural) VALUES\n${tv}
ON CONFLICT (codigo) DO UPDATE
  SET es_rural = EXCLUDED.es_rural, uzpe_codigo = EXCLUDED.uzpe_codigo;\n`);
  const mv = [];
  terrs.forEach(t => C.CAT_TERRITORIOS[t].forEach(m =>
    mv.push(`  (${q(t)}, ${q(m.codigo)}, ${q(m.nombre)}, ${q(m.comuna)})`)));
  out.push(`INSERT INTO cat.microterritorio (territorio_codigo, codigo, nombre, comuna) VALUES\n${mv.join(',\n')}\nON CONFLICT (territorio_codigo, codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre, comuna = EXCLUDED.comuna;\n`);
}

// Dominios y opciones
const domRows = [], opRows = [];
for (const [k, meta] of Object.entries(DOM)) {
  const lista = C[k];
  if (!Array.isArray(lista)) { console.error('AUSENTE: ' + k); continue; }
  const [dom, item, regla, mult] = meta;
  domRows.push(`  (${q(dom)}, ${q(dom.toLowerCase().replace(/_/g, ' '))}, ${item === null ? 'NULL' : item}, ${q(regla)}, ${mult})`);
  lista.forEach((o, i) => {
    const val = o.valor !== undefined ? o.valor : o.codigo;
    const et = o.etiqueta !== undefined ? o.etiqueta : o.nombre;
    const excl = EXCL.has(val) && val !== 'no';
    const otro = val === 'otro' || val === 'otra' || val === 'otros';
    const extra = {};
    for (const [kk, vv] of Object.entries(o)) if (!['valor','etiqueta','codigo','nombre'].includes(kk)) extra[kk] = vv;
    const md = Object.keys(extra).length ? q(JSON.stringify(extra)) + '::jsonb' : 'NULL';
    opRows.push(`  (${q(dom)}, ${q(val)}, ${q(et)}, ${i + 1}, ${excl}, ${otro}, ${md})`);
  });
}
out.push(`/* --- Dominios de listas cerradas ---------------------------------------- */
INSERT INTO cat.dominio (codigo, nombre, item, regla, multiple) VALUES\n${domRows.join(',\n')}\nON CONFLICT (codigo) DO NOTHING;\n`);
out.push(`/* --- Opciones ----------------------------------------------------------- */
INSERT INTO cat.opcion (dominio_codigo, codigo, etiqueta, orden, es_excluyente, exige_texto, metadata) VALUES\n${opRows.join(',\n')}\nON CONFLICT (dominio_codigo, codigo) DO UPDATE
  SET etiqueta = EXCLUDED.etiqueta, orden = EXCLUDED.orden,
      es_excluyente = EXCLUDED.es_excluyente, exige_texto = EXCLUDED.exige_texto;\n`);

// Dominio TIPO_BARRERA (RN-210), no existe en catalogos.js
out.push(`/* --- Tipificación de barreras de acceso (RN-210) ------------------------- */
INSERT INTO cat.dominio (codigo, nombre, item, regla, multiple) VALUES
  ('TIPO_BARRERA', 'tipo de barrera de acceso', NULL, 'RN-210', false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cat.opcion (dominio_codigo, codigo, etiqueta, orden, metadata) VALUES
  ('TIPO_BARRERA','administrativa','Administrativa — gestión ante EAPB',1,'{"prioridad":"prioritaria"}'),
  ('TIPO_BARRERA','geografica','Geográfica — extramural o telesalud',2,'{"prioridad":"regular"}'),
  ('TIPO_BARRERA','informacion','De información — educación en salud',3,'{"prioridad":"regular"}'),
  ('TIPO_BARRERA','cultural','Cultural o de trato — enfoque diferencial',4,'{"prioridad":"regular"}'),
  ('TIPO_BARRERA','cuidador','Del cuidador o dependencia — atención domiciliaria',5,'{"prioridad":"prioritaria"}'),
  ('TIPO_BARRERA','aseguramiento','De aseguramiento — conforme a RN-209',6,'{"prioridad":"prioritaria"}')
ON CONFLICT (dominio_codigo, codigo) DO NOTHING;

COMMIT;
`);

fs.writeFileSync(DESTINO, out.join('\n'));
fs.rmSync(nodePath.dirname(tmp), { recursive: true, force: true });

const uzpeVigentes = (C.CAT_UZPE || []).filter(o => o.vigente).length;
console.log('OK — dominios: ' + domRows.length +
  ', opciones: ' + opRows.length +
  ', UZPE vigentes: ' + uzpeVigentes);
console.log('     escrito en ' + DESTINO);
