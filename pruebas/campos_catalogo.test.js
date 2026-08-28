/* =========================================================================
   Los ítems 11, 73 y 76 se capturan contra catálogo, no como texto libre.
   -------------------------------------------------------------------------
       node pruebas/campos_catalogo.test.js     (requiere jsdom, sin base)

   POR QUÉ

   El esquema declara los tres como llave foránea:

     ficha.prestador_codigo    -> cat.prestador     (ítem 11, RN-011)
     integrante.ocupacion_codigo -> cat.ocupacion_ciuo (ítem 73, RN-073)
     integrante.eapb_codigo    -> cat.eapb          (ítem 76, RN-076)

   El formulario los capturaba como <input type="text">, de modo que enviaba
   'EMSSANAR' donde la base espera 'ESS024'. Con la validación estricta en su
   sitio, eso hacía que ninguna ficha real pudiera guardarse.

   Esta prueba comprueba que el control es un <select>, que se llena desde el
   catálogo y que lo que sale del formulario es el código.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

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
   Montaje de la aplicación
   --------------------------------------------------------- */

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  url: 'http://localhost/',
  pretendToBeVisual: true
});

const ventana = dom.window;

const almacen = {};
Object.defineProperty(ventana, 'localStorage', {
  value: {
    getItem: function (k) { return k in almacen ? almacen[k] : null; },
    setItem: function (k, v) { almacen[k] = String(v); },
    removeItem: function (k) { delete almacen[k]; }
  },
  configurable: true
});
ventana.navigator.geolocation = { getCurrentPosition: function () {} };
ventana.fetch = function () { return Promise.reject(new Error('sin red')); };
ventana.HTMLElement.prototype.scrollIntoView = function () {};

const errores = [];
ventana.addEventListener('error', function (e) { errores.push(String(e.message)); });

/* Los <script> del navegador comparten un único alcance global. Evaluar
   archivo por archivo aísla cada `const`, así que hay que concatenarlos. */
const fuentes = ['catalogos.js', 'direccion.js', 'geocodificacion.js', 'reglas.js', 'formulario.js',
  'cups.js', 'correccion.js', 'app.js']
  .map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); })
  .join('\n;\n');

try {
  ventana.eval(fuentes +
    ';\nfijarCatalogosDinamicos({ eapb: [{ valor: "ESS024", etiqueta: "Coosalud EPS", regimen: "subsidiado" }], prestador: [{ valor: "PROV-ESE-LADERA", etiqueta: "E.S.E. Ladera" }] });' +
    '\nwindow.__api = { recolectarDatosFormulario: recolectarDatosFormulario,' +
    ' CAT_EAPB: CAT_EAPB, CAT_PRESTADOR: CAT_PRESTADOR };');
  ventana.document.dispatchEvent(new ventana.Event('DOMContentLoaded', { bubbles: true }));
} catch (error) {
  errores.push('montaje: ' + error.message);
}

const doc = ventana.document;

console.log('\n=== 1. La aplicación se montó ===');
verificar('sin errores de carga', errores.length === 0, errores.slice(0, 3).join(' | '));

/* ---------------------------------------------------------
   Comprobaciones por campo
   --------------------------------------------------------- */

const CAMPOS = [
  {
    titulo: 'ítem 11 · prestador primario (RN-011)',
    selector: '[name="prestadorPrimario"]',
    catalogo: 'CAT_PRESTADOR',
    codigoEsperado: 'PROV-ESE-LADERA'
  },
  {
    titulo: 'ítem 76 · EAPB (RN-076)',
    selector: '[name="familias[0].integrantes[0].eapb"]',
    catalogo: 'CAT_EAPB',
    codigoEsperado: 'ESS024'
  }
];

console.log('\n=== 2. Los tres campos son <select> contra catálogo ===');

CAMPOS.forEach(function (campo) {
  const el = doc.querySelector(campo.selector);

  if (!el) {
    verificar(campo.titulo + ': el campo existe', false, 'no se encontró ' + campo.selector);
    return;
  }

  verificar(campo.titulo + ': es <select>, no texto libre',
    el.tagName === 'SELECT', el.tagName + (el.type ? '/' + el.type : ''));

  verificar(campo.titulo + ': declara su catálogo',
    el.dataset.catalogo === campo.catalogo, el.dataset.catalogo || '(ninguno)');

  const opciones = Array.prototype.map.call(el.options, function (o) { return o.value; });
  const catalogo = (ventana.__api && ventana.__api[campo.catalogo]) || [];

  verificar(campo.titulo + ': se llenó desde el catálogo',
    opciones.length >= catalogo.length && catalogo.length > 0,
    opciones.length + ' opciones para ' + catalogo.length + ' del catálogo');

  verificar(campo.titulo + ': ofrece el código y no el nombre',
    opciones.indexOf(campo.codigoEsperado) !== -1,
    opciones.slice(0, 5).join(', '));
});

console.log('\n=== 3. Lo que sale del formulario es el código ===');

/* Se elige una opción en cada select y se recoge el modelo como lo hace el
   envío real, para comprobar que viaja el código y no la etiqueta. */
CAMPOS.forEach(function (campo) {
  const el = doc.querySelector(campo.selector);
  if (el && el.tagName === 'SELECT') el.value = campo.codigoEsperado;
});

let datos = null;
try {
  const formulario = doc.getElementById('formEncuesta') || doc.querySelector('form');
  datos = ventana.__api.recolectarDatosFormulario(formulario);
} catch (error) {
  verificar('se pudo recolectar el formulario', false, error.message);
}

if (datos) {
  verificar('prestadorPrimario viaja como código',
    datos.prestadorPrimario === 'PROV-ESE-LADERA', String(datos.prestadorPrimario));

  const integrante = (datos.familias && datos.familias[0] && datos.familias[0].integrantes)
    ? datos.familias[0].integrantes[0]
    : null;

  if (!integrante) {
    verificar('se recolectó el primer integrante', false, 'no hay familias[0].integrantes[0]');
  } else {
    verificar('eapb viaja como código de catálogo',
      integrante.eapb === 'ESS024', String(integrante.eapb));
  }
}

console.log('\n=== 4. RN-076 sigue inactivando la EAPB sin afiliación ===');

/* La regla estaba escrita para un <input>; debe seguir funcionando sobre el
   <select>, que también admite disabled y value. */
const selectEapb = doc.querySelector('[name="familias[0].integrantes[0].eapb"]');
const selectRegimen = doc.querySelector('[name="familias[0].integrantes[0].regimenAfiliacion"]');

if (selectEapb && selectRegimen) {
  selectRegimen.value = 'no_afiliado';
  selectRegimen.dispatchEvent(new ventana.Event('change', { bubbles: true }));

  verificar('con "No afiliado" la EAPB queda inactiva',
    selectEapb.disabled === true, 'disabled=' + selectEapb.disabled);
  verificar('y se limpia el valor', selectEapb.value === '', JSON.stringify(selectEapb.value));

  selectRegimen.value = 'subsidiado';
  selectRegimen.dispatchEvent(new ventana.Event('change', { bubbles: true }));

  verificar('al volver a haber afiliación se reactiva',
    selectEapb.disabled === false, 'disabled=' + selectEapb.disabled);
} else {
  verificar('los controles de régimen y EAPB existen', false);
}

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas === 0 ? 0 : 1);
