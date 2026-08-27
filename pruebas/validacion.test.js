/* =========================================================================
   Coherencia entre las tres capas que nombran los mismos campos.
   -------------------------------------------------------------------------
       node pruebas/validacion.test.js

   POR QUÉ EXISTE

   `api/_validacion.js` comprueba cada campo contra su dominio de catálogo
   buscándolo por nombre en el objeto que llega. Si el nombre no coincide con
   el que emite el formulario, la comprobación no falla: encuentra `undefined`,
   lo trata como campo vacío y pasa. La validación queda desactivada sin que
   nada lo indique.

   Es exactamente lo que ocurrió al escribirla: se usó `eapbCodigo` y
   `ocupacionCodigo` mientras el formulario emite `eapb` y `ocupacion`, y
   `discapacidades` en vez de `discapacidad`. Los tres pasaban en verde.

   Esta prueba no necesita base de datos.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK   ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : ''));
  }
}

/* ---------------------------------------------------------
   1. Nombres que emite el formulario
   --------------------------------------------------------- */

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

function nombresBajo(prefijo) {
  const patron = new RegExp(
    '(?:name|data-name)="' + prefijo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([a-zA-Z0-9]+)"',
    'g'
  );
  const encontrados = new Set();
  let m;
  while ((m = patron.exec(html)) !== null) encontrados.add(m[1]);
  return encontrados;
}

/* Varios grupos de la ficha no llevan `name` en el HTML: se lo pone app.js al
   construirlos desde el catálogo (llenarSelect, llenarGrupoRadio,
   llenarGrupoCasillas). Sin leerlos, campos reales parecen inexistentes. */
const appJs = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');

function nombresDesdeApp() {
  const encontrados = new Set();

  /* llenarGrupoRadio('idContenedor', 'nombreCampo', CAT_X) */
  const grupo = /llenar(?:GrupoRadio|GrupoCasillas)\('[^']+',\s*'([a-zA-Z0-9]+)'/g;
  let m;
  while ((m = grupo.exec(appJs)) !== null) encontrados.add(m[1]);

  /* llenarSelect('idQueTambienEsElNombre', CAT_X) */
  const select = /llenarSelect\('([a-zA-Z0-9]+)'/g;
  while ((m = select.exec(appJs)) !== null) encontrados.add(m[1]);

  return encontrados;
}

const campoFicha = new Set([...nombresBajo(''), ...nombresDesdeApp()]);
const campoFamilia = nombresBajo('familias[0].');
const campoIntegrante = nombresBajo('familias[0].integrantes[0].');

/* ---------------------------------------------------------
   2. Nombres que espera la validación
   --------------------------------------------------------- */

const fuenteValidacion = fs.readFileSync(path.join(RAIZ, 'api', '_validacion.js'), 'utf8');

function listaDeclarada(nombreConstante) {
  const patron = new RegExp('const ' + nombreConstante + ' = \\[([\\s\\S]*?)\\n\\];');
  const bloque = patron.exec(fuenteValidacion);
  if (!bloque) return null;

  const campos = [];
  const par = /\['([a-zA-Z0-9]+)',\s*'([A-Z0-9_]+)'\]/g;
  let m;
  while ((m = par.exec(bloque[1])) !== null) campos.push({ campo: m[1], dominio: m[2] });
  return campos;
}

/* ---------------------------------------------------------
   3. Comprobaciones
   --------------------------------------------------------- */

console.log('\n=== 1. El formulario se pudo leer ===');
verificar('index.html expone campos de ficha', campoFicha.size > 20, campoFicha.size + ' campos');
verificar('index.html expone campos de familia', campoFamilia.size > 5, campoFamilia.size + ' campos');
verificar('index.html expone campos de integrante', campoIntegrante.size > 30, campoIntegrante.size + ' campos');

console.log('\n=== 2. Cada campo validado existe en el formulario ===');

const grupos = [
  ['OPCIONES_FICHA', campoFicha, 'ficha'],
  ['OPCIONES_LISTA_VIVIENDA', campoFicha, 'ficha'],
  ['OPCIONES_FAMILIA', campoFamilia, 'familia'],
  ['OPCIONES_LISTA_FAMILIA', campoFamilia, 'familia'],
  ['OPCIONES_INTEGRANTE', campoIntegrante, 'integrante'],
  ['OPCIONES_LISTA_INTEGRANTE', campoIntegrante, 'integrante']
];

grupos.forEach(function (grupo) {
  const declarados = listaDeclarada(grupo[0]);

  if (declarados === null) {
    verificar(grupo[0] + ' se pudo leer', false, 'no se encontró la constante');
    return;
  }

  const huerfanos = declarados
    .map(function (d) { return d.campo; })
    .filter(function (campo) { return !grupo[1].has(campo); });

  verificar(
    grupo[0] + ' (' + declarados.length + ' campos) coincide con el formulario',
    huerfanos.length === 0,
    huerfanos.length > 0 ? 'sin equivalente en index.html: ' + huerfanos.join(', ') : ''
  );
});

console.log('\n=== 3. Los dominios existen en catalogos.js ===');

/* Los dominios de la validación deben existir también como catálogo del
   formulario, porque son los mismos que siembra gen_seed.js. */
const seed = fs.readFileSync(path.join(RAIZ, 'bd', '02_catalogos_seed.sql'), 'utf8');
const dominiosSembrados = new Set();
/* El código de la opción puede ir en mayúsculas —los tipos de documento son
   'CC', 'TI', 'RC'—, así que el patrón no puede exigir minúsculas. */
const patronDominio = /\('([A-Z][A-Z0-9_]{2,})',\s*'[A-Za-z0-9_]+',/g;
let d;
while ((d = patronDominio.exec(seed)) !== null) dominiosSembrados.add(d[1]);

grupos.forEach(function (grupo) {
  const declarados = listaDeclarada(grupo[0]);
  if (declarados === null) return;

  const ausentes = declarados
    .map(function (x) { return x.dominio; })
    .filter(function (dom) { return !dominiosSembrados.has(dom); });

  verificar(
    grupo[0] + ': todos los dominios están sembrados',
    ausentes.length === 0,
    ausentes.length > 0 ? 'no sembrados: ' + Array.from(new Set(ausentes)).join(', ') : ''
  );
});

console.log('\n=== 4. Campos que la base exige NOT NULL y el motor no vigila ===');

/* El bloque de saneamiento (ítems 39-49) es NOT NULL en aps.vivienda pero
   `seccionesPresentes` de reglas.js lo trata como opcional. La validación
   debe cubrir el hueco; si alguien retira esa comprobación, esto avisa. */
[
  'actividadEconomica', 'carnetAntirrabico', 'fuenteAgua',
  'disposicionExcretas', 'aguasResiduales', 'residuosSolidos'
].forEach(function (campo) {
  verificar(
    'la validación exige ' + campo,
    fuenteValidacion.indexOf("'" + campo + "'") !== -1
  );
});

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas === 0 ? 0 : 1);
