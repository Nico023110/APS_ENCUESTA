/* =========================================================================
   Ítem 24 (punto de referencia) e ítem 29 (personas presentes), 2026-11-24
       node pruebas/presentes_y_referencia.test.js

   24: opcional en la vivienda urbana con dirección; obligatorio en la rural y
       sin dirección. Si queda vacío, el archivo plano lleva la dirección.
   29: quienes están en la caracterización. Con una sola familia se abre una hoja
       por cada persona presente; quien falta se sabe por el ítem 51. Nada de
       eso quita información, ni estorba la segunda visita, ni cambia el
       hacinamiento porque alguien no estuviera.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const roles = require('../roles.js');

const RAIZ = path.join(__dirname, '..');
let pasadas = 0;
let fallidas = 0;
function check(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK    ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + JSON.stringify(detalle) : '')); }
}

/* ---------- el motor ---------- */
const contexto = vm.createContext({ console: console });
['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'reglas.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), contexto, { filename: f });
});
const M = vm.runInContext('({ validarReglas, evaluarAlertas, evaluarAdvertencias, puntoDeReferenciaOpcional })', contexto);

console.log('\n=== 24. ¿El punto de referencia es opcional? ===');
const completa = { canonica: 'CL 5 # 10 - 20', completa: true };
const incompleta = { canonica: '', completa: false, faltantes: ['vía'] };
const sin = { canonica: 'SIN DIRECCION', completa: true };
[
  ['urbana con dirección', { areaUbicacion: 'urbana', direccionNormalizada: completa }, true],
  ['urbana con la dirección incompleta', { areaUbicacion: 'urbana', direccionNormalizada: incompleta }, false],
  ['urbana sin dirección', { areaUbicacion: 'urbana', direccionNormalizada: sin }, false],
  ['rural con dirección', { areaUbicacion: 'rural', direccionNormalizada: completa }, false],
  ['rural sin dirección', { areaUbicacion: 'rural', direccionNormalizada: sin }, false],
  ['centro poblado con dirección', { areaUbicacion: 'centro_poblado', direccionNormalizada: completa }, false],
  ['sin área todavía', { areaUbicacion: '', direccionNormalizada: completa }, false],
  ['leída de la base: urbana con dirección', { areaUbicacion: 'urbana', direccion: 'CL 5 # 10 - 20' }, true],
  ['leída de la base: urbana SIN DIRECCION', { areaUbicacion: 'urbana', direccion: 'SIN DIRECCION' }, false]
].forEach(function (c) { check(c[0] + ' → ' + (c[2] ? 'opcional' : 'obligatorio'), M.puntoDeReferenciaOpcional(c[1]) === c[2]); });

const rn24 = function (d) { return M.validarReglas(Object.assign({ consentimiento: 'si' }, d)).filter(function (b) { return b.codigo === 'RN-024'; }); };
check('rural con dirección y sin punto: pide el punto', rn24({ areaUbicacion: 'rural', direccionNormalizada: completa, ubicacionReferencia: '' }).length > 0);
check('urbana con dirección y sin punto: no lo pide', rn24({ areaUbicacion: 'urbana', direccionNormalizada: completa, ubicacionReferencia: '' }).length === 0);
check('urbana sin dirección: lo pide', rn24({ areaUbicacion: 'urbana', direccionNormalizada: sin, ubicacionReferencia: '' }).length > 0);
check('si lo llena, sigue el máximo de 200 caracteres', rn24({ areaUbicacion: 'urbana', direccionNormalizada: completa, ubicacionReferencia: 'x'.repeat(201) }).length > 0);

console.log('\n=== 24. El archivo plano lleva la dirección ===');
const fuente = fs.readFileSync(path.join(RAIZ, 'api', '_reporte_sispro.js'), 'utf8');
check('la variable 11 usa el punto o, si no hay, la dirección', /11: \{ valor: function \(ctx\) \{ return R\(e\(ctx\)\.ubicacionReferencia \|\| e\(ctx\)\.direccion\); \} \}/.test(fuente));

console.log('\n=== 29. El motor ===');
const ficha = function (p29, integrantes, n51, extra) {
  return Object.assign({ consentimiento: 'si', personasEnVivienda: p29, habitacionesVivienda: 2, elementosParaDormir: 4,
    familias: [{ numeroIntegrantes: n51, integrantes: new Array(integrantes).fill(0).map(function () { return {}; }) }] }, extra || {});
};
const rn29 = function (d) { return M.validarReglas(d).filter(function (b) { return b.codigo === 'RN-029' && b.campo === 'personasEnVivienda' && /caracterizados y sólo/.test(b.mensaje); }); };
check('ficha nueva con más hojas que presentes: bloquea', rn29(ficha(2, 3, 5)).length === 1);
check('con tantas hojas como presentes: no', rn29(ficha(2, 2, 5)).length === 0);
check('en una ficha ya registrada (segunda visita) no bloquea', rn29(ficha(2, 5, 5, { yaRegistradaEnLaBase: true })).length === 0);
check('y menos presentes que integrantes declarados no bloquea', rn29(ficha(2, 2, 6)).length === 0);
const hacinamiento = function (d) { return M.evaluarAlertas(d).filter(function (a) { return /Hacinamiento/.test(a.titulo || a.motivo || JSON.stringify(a)); }).length > 0; };
check('el hacinamiento no se pierde porque alguien no estaba (2 presentes de 7, 2 cuartos)', hacinamiento(ficha(2, 2, 7)));
check('y con toda la familia sigue igual que siempre', hacinamiento(ficha(7, 7, 7)) && !hacinamiento(ficha(4, 4, 4)));
const camas = function (d) { return JSON.stringify(M.evaluarAlertas(d)).indexOf('Déficit de elementos para dormir') !== -1; };
check('el déficit de camas tampoco', camas(ficha(2, 2, 10, { elementosParaDormir: 3 })) && !camas(ficha(2, 2, 2, { elementosParaDormir: 3 })));

/* ---------- el formulario ---------- */
function montar() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  const perfil = { id: 7, rol: 'enfermeria', nivel: roles.nivelDe('enfermeria'), rolEtiqueta: roles.etiquetaDeRol('enfermeria'),
    nombre: 'Prueba', tipoId: 'CC', documento: '1144099001', equipoCodigo: 'EBS004', equiposApoyoCodigos: [],
    permisos: roles.permisosDe('enfermeria'), debeCambiarClave: false };
  const almacen = { aps_sesion_usuario: JSON.stringify(perfil) };
  Object.defineProperty(w, 'localStorage', { value: {
    getItem: function (k) { return k in almacen ? almacen[k] : null; },
    setItem: function (k, v) { almacen[k] = String(v); },
    removeItem: function (k) { delete almacen[k]; } }, configurable: true });
  w.navigator.geolocation = { getCurrentPosition: function () {} };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.Headers = Headers; w.Request = Request;
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  const fuentes = ['sesion.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js', 'reglas.js',
    'antropometria_tablas.js', 'antropometria.js', 'formulario.js', 'cups.js', 'correccion.js', 'pruebas/_boveda_abierta.js',
    'captura_local.js', 'app.js'].map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); }).join('\n;\n');
  w.eval(fuentes + '\n;window.__cargar = cargarEncuestaEnFormulario; window.__datos = recolectarDatosFormulario;' +
    'window.__correccion = function (id) { encuestaEnCorreccion = id; };' +
    'window.__reiniciar = function () { encuestaEnCorreccion = null; document.getElementById("encuestaForm").reset(); reiniciarEstadoFormulario(); };');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  const $ = function (s) { return w.document.querySelector(s); };
  const poner = function (el, valor) {
    el.value = valor;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  const hojas = function (fam) { return w.document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]')[fam || 0].querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]'); };
  return {
    w: w, $: $, poner: poner, hojas: hojas,
    presentes: function (n) { poner($('#personasEnVivienda'), n); },
    familia: function (n, i) { poner(w.document.querySelectorAll('#contenedorFamilias [data-rol="numeroIntegrantes"]')[i || 0], n); },
    valor51: function (i) { return w.document.querySelectorAll('#contenedorFamilias [data-rol="numeroIntegrantes"]')[i || 0].value; },
    escribir: function (i, sel, valor, fam) { poner(hojas(fam)[i].querySelector(sel), valor); },
    /* Formulario en blanco sin volver a cargar la aplicación. */
    nuevo: function () { w.__reiniciar(); }
  };
}
function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  console.log('\n=== 29. Las hojas salen de los presentes ===');
  let m = montar();
  await esperar(60);
  m.presentes('2');
  m.familia('5');
  check('5 en la familia y 2 presentes: 2 hojas', m.hojas().length === 2, m.hojas().length);
  check('el ítem 51 se conserva en 5', m.valor51() === '5');
  check('avisa que faltan 3 (RN-051), sin bloquear', (function () {
    const d = m.w.__datos(m.$('#encuestaForm'));
    const av = m.w.eval('evaluarAdvertencias')(d).filter(function (x) { return x.codigo === 'RN-051' && /faltan 3/.test(x.mensaje); });
    return av.length === 1 && m.w.eval('validarReglas')(d).filter(function (b) { return b.codigo === 'RN-051' && b.campo === 'numeroIntegrantes'; }).length === 0;
  })());
  m.presentes('3');
  check('al subir los presentes a 3 se abre otra hoja', m.hojas().length === 3);
  m.presentes('2');
  check('al bajar se quita la hoja vacía', m.hojas().length === 2);
  m.familia('2');
  check('si la familia baja a 2 siguen 2 hojas', m.hojas().length === 2 && m.valor51() === '2');
  m.familia('1');
  check('y con 1, una hoja', m.hojas().length === 1);

  console.log('\n=== 29. Nunca se pierde información ===');
  m.nuevo();
  m.presentes('3');
  m.familia('3');
  m.escribir(0, '[name$=".primerNombre"]', 'Ana');
  m.escribir(1, '[name$=".primerNombre"]', 'Luis');
  m.escribir(2, '[name$=".primerNombre"]', 'Eva');
  m.presentes('1');
  check('bajar los presentes no borra hojas con datos', m.hojas().length === 3 && m.hojas()[2].querySelector('[name$=".primerNombre"]').value === 'Eva');
  m.nuevo();
  m.presentes('3');
  m.familia('3');
  m.escribir(0, '[name$=".primerNombre"]', 'Ana');
  m.presentes('2');
  check('se quitan las vacías, no la que tiene datos', m.hojas().length === 2 && m.hojas()[0].querySelector('[name$=".primerNombre"]').value === 'Ana');

  console.log('\n=== 29. Si el 29 se llena después o queda vacío ===');
  m.nuevo();
  m.familia('4');
  check('sin el 29, el 51 abre todas (como siempre)', m.hojas().length === 4);
  m.presentes('1');
  check('y al llenarlo quedan las de los presentes', m.hojas().length === 1);
  m.presentes('');
  check('si se borra, vuelven las de toda la familia', m.hojas().length === 4);

  console.log('\n=== 29. Con varias familias sigue como antes ===');
  m.nuevo();
  m.presentes('2');
  m.familia('3');
  check('una familia: 2 hojas', m.hojas().length === 2);
  m.$('#btnAgregarFamilia').click();
  check('al agregar otra familia, la primera vuelve a tener las 3', m.hojas(0).length === 3, m.hojas(0).length);
  m.familia('2', 1);
  check('la segunda abre las suyas', m.hojas(1).length === 2);

  console.log('\n=== 29. Corregir, borradores y segunda visita ===');
  m.nuevo();
  const persona = function (n) { return { tipoId: 'CC', numeroId: '10000' + n, primerNombre: 'P' + n, primerApellido: 'X', fechaNacimiento: '1986-05-10', sexo: 'mujer', peso: 60, talla: 160, clasificacionAntropometrica: 'normal' }; };
  const guardada = { codigoFicha: '76001-EBS004-AAAA-0001-20261120', equipoSaludId: 'EBS004', consentimiento: 'si', personasEnVivienda: 2,
    familias: [{ numeroIntegrantes: 5, integrantes: [persona(1), persona(2), persona(3), persona(4), persona(5)] }] };
  m.w.__cargar(guardada);
  check('una ficha con 5 integrantes y 2 presentes conserva sus 5 hojas al abrirla', m.hojas().length === 5, m.hojas().length);
  m.nuevo();
  const borrador = { consentimiento: 'si', personasEnVivienda: 2, familias: [{ numeroIntegrantes: 5, integrantes: [persona(1), persona(2)] }] };
  m.w.__cargar(borrador, { nueva: true });
  check('un borrador de una ficha nueva vuelve con sus 2 hojas, sin reponer las ausentes', m.hojas().length === 2, m.hojas().length);
  check('  con el 51 intacto', m.valor51() === '5', m.valor51());
  m.nuevo();
  m.presentes('2');
  m.familia('4');
  m.w.__correccion('x1');
  m.presentes('1');
  check('en una corrección el 29 no toca las hojas', m.hojas().length === 2);

  console.log('\n=== 24. La marca «opcional» en el formulario ===');
  m.nuevo();
  const marca = function () { return m.$('#marcaReferencia').textContent; };
  check('empieza obligatorio', marca() === '*', marca());
  const area = m.$('#areaUbicacion');
  check('el formulario tiene la ayuda del 24', m.$('#ayudaReferencia') !== null);
  area.value = 'rural';
  area.dispatchEvent(new m.w.Event('change', { bubbles: true }));
  check('rural: obligatorio', marca() === '*');
  area.value = 'urbana';
  area.dispatchEvent(new m.w.Event('change', { bubbles: true }));
  check('urbana sin dirección completa todavía: obligatorio', marca() === '*', marca());

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas ? 1 : 0);
})().catch(function (error) { console.error(error); process.exit(1); });
