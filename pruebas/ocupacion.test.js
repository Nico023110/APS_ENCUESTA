/* Ítem 73 — Buscador de ocupaciones CIUO (ocupacion.js).

   Un usuario reportó que en el campo «sólo le salía el 9998». Ninguna regla lo
   impone: era la lista nativa del navegador, que no encontraba «mecanico» ni
   «enfermera» y que, con 9998 en el campo, sólo ofrecía 9998. Aquí se prueba
   que cualquier ocupación se puede elegir y que el campo guarda sólo el código. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
const fuentes = ['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js', 'reglas.js',
  'formulario.js', 'cups.js', 'buscador_lista.js', 'ocupacion.js', 'correccion.js', 'pruebas/_boveda_abierta.js', 'captura_local.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
  .join('\n;\n');

let ok = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const almacen = {};
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k) => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = String(v); },
    removeItem: (k) => { delete almacen[k]; }
  },
  configurable: true
});
window.navigator.geolocation = { getCurrentPosition() {} };
window.fetch = () => Promise.reject(new Error('sin red'));
window.HTMLElement.prototype.scrollIntoView = function () {};
const errores = [];
window.addEventListener('error', (e) => errores.push(e.message));
const doc = window.document;

(async function () {
  if (doc.readyState !== 'complete') {
    await new Promise((listo) => window.addEventListener('load', listo));
  }
  window.eval(fuentes + ';\nwindow.__api = { buscarOcupaciones, PALABRAS_COTIDIANAS_OCUPACION, CAT_OCUPACION_CIUO };');
  doc.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  const api = window.__api;

  check('La aplicación arranca sin errores de JS', errores.length === 0, errores.join(' | '));

  console.log('\n=== 1. La búsqueda ===');
  const codigos = (q) => api.buscarOcupaciones(q).filas.map((o) => o.valor);
  [
    ['mecanico', '7231'], ['enfermera', '2221'], ['secretaria', '3343'], ['medica', '2211'],
    ['tecnico', '3111'], ['albanil', '7112'], ['ALBAÑILES', '7112'], ['mesera', '5131'],
    ['conductor taxi', '8324'], ['taxi conductor', '8324'], ['vendedora', '5223'],
    ['vigilante', '5414'], ['celador', '5414'], ['taxista', '8324'], ['oficios varios', '9622'],
    ['empleada domestica', '9111'], ['docente', '2341'], ['plomero', '7126'], ['campesino', '6114'],
    ['5321', '5321'], ['53', '5321'], ['ama de casa', '9998'], ['pensionado', '9998']
  ].forEach(([texto, esperado]) => {
    check('«' + texto + '» encuentra ' + esperado, codigos(texto).indexOf(esperado) !== -1, codigos(texto).slice(0, 8).join(','));
  });

  check('9998 no aparece en una búsqueda de un oficio', ['conductor', 'enfermera', 'vendedor', 'obrero'].every((q) =>
    codigos(q).indexOf('9998') === -1));
  check('Cada ocupación de la tabla se encuentra por su código',
    api.CAT_OCUPACION_CIUO.every((o) => codigos(o.valor).indexOf(o.valor) !== -1));
  check('Cada ocupación de la tabla se encuentra por su nombre',
    api.CAT_OCUPACION_CIUO.every((o) => codigos(o.etiqueta).indexOf(o.valor) !== -1),
    api.CAT_OCUPACION_CIUO.filter((o) => codigos(o.etiqueta).indexOf(o.valor) === -1).map((o) => o.valor).join(','));
  const inexistentes = [];
  api.PALABRAS_COTIDIANAS_OCUPACION.forEach((par) => par[0].forEach((c) => {
    if (!api.CAT_OCUPACION_CIUO.some((o) => o.valor === c)) inexistentes.push(c);
  }));
  check('Las palabras de uso común apuntan a códigos de la tabla', inexistentes.length === 0, inexistentes.join(','));
  check('Lo que no existe no devuelve nada', api.buscarOcupaciones('xyzxyz').total === 0);
  check('«auxiliar de enfermeria» ofrece la de enfermería', codigos('auxiliar de enfermeria').indexOf('3221') !== -1);
  const parcial = api.buscarOcupaciones('conductor xyzxyz');
  check('Si una palabra no coincide, ofrece lo que se acerca y lo dice', parcial.parcial && parcial.total > 0);

  console.log('\n=== 2. El campo ===');
  const campo = doc.querySelector('[data-rol="ocupacion"]');
  const nombre = doc.querySelector('[data-rol="nombreOcupacion"]');
  const lista = () => doc.getElementById('listaOcupacion');
  const opciones = () => Array.from(doc.querySelectorAll('.combo-buscador__opcion'));
  const teclear = (texto) => {
    campo.value = texto;
    campo.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const presionar = (key) => {
    const e = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    campo.dispatchEvent(e);
    return e;
  };
  check('Ya no depende de la lista nativa del navegador',
    !campo.hasAttribute('list') && !doc.getElementById('listaOcupacionesCiuo'));

  // Revelar el campo: en el formulario real está dentro del bloque del integrante.
  let bloque = campo.parentElement;
  while (bloque) { bloque.hidden = false; bloque = bloque.parentElement; }
  campo.focus();
  check('El campo recibe el foco', doc.activeElement === campo);
  check('Al entrar vacío despliega todas las ocupaciones', lista() && opciones().length === api.CAT_OCUPACION_CIUO.length,
    String(opciones().length));
  check('  en el orden de la tabla y diciendo que se puede acotar',
    opciones()[0].dataset.valor === api.CAT_OCUPACION_CIUO[0].valor && /Escriba el oficio o el código/.test(lista().textContent));

  teclear('mecanico');
  check('Al escribir aparece la lista con varias ocupaciones', lista() && opciones().length > 1, String(opciones().length));
  check('  con código y nombre', /\d{4}/.test(opciones()[0].textContent) && /[A-Za-z]/.test(opciones()[0].textContent));
  check('  anunciada al lector de pantalla', campo.getAttribute('aria-expanded') === 'true');

  opciones()[0].dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  check('Tocar una opción deja el código en el campo', /^\d{4}$/.test(campo.value), campo.value);
  check('  el nombre aparece debajo', nombre.textContent.length > 5, nombre.textContent);
  check('  y la lista se cierra', !lista() && campo.getAttribute('aria-expanded') === 'false');

  const elegido = campo.value;
  campo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('Tocar otra vez el campo vuelve a desplegar todas', lista() && opciones().length === api.CAT_OCUPACION_CIUO.length);
  check('  con la elegida marcada', doc.querySelector('.combo-buscador__opcion--activa').dataset.valor === elegido);
  presionar('Escape');
  teclear('');
  check('Borrar lo escrito vuelve a desplegar todas', lista() && opciones().length === api.CAT_OCUPACION_CIUO.length);

  teclear('9998');
  check('Con 9998 completo no hay lista que estorbe', !lista());
  check('  y su nombre se muestra', /Jubilado/.test(nombre.textContent), nombre.textContent);
  campo.blur();
  campo.focus();
  check('Volver a un campo con 9998 lo deja listo para reemplazar',
    campo.selectionStart === 0 && campo.selectionEnd === 4, campo.selectionStart + '-' + campo.selectionEnd);
  check('  y ofrece todas las ocupaciones, no sólo 9998', opciones().length === api.CAT_OCUPACION_CIUO.length);
  teclear('conductor');
  check('  y buscar otra ocupación ofrece otras, no sólo 9998',
    opciones().length > 1 && opciones().every((o) => o.dataset.valor !== '9998'));

  presionar('ArrowDown');
  const marcada = doc.querySelector('.combo-buscador__opcion--activa');
  check('La flecha marca una opción', !!marcada);
  const enter = presionar('Enter');
  check('Enter elige la marcada y no envía el formulario',
    enter.defaultPrevented && campo.value === marcada.dataset.valor, campo.value);

  teclear('conductor');
  check('Escape cierra la lista', (presionar('Escape'), !lista()));
  check('  sin borrar lo escrito', campo.value === 'conductor');

  teclear('zzzz');
  check('Sin resultados, lo dice', /No se encontró/.test(lista().textContent));
  check('  y debajo pide elegir, no habla de código', /Elija una ocupación/.test(nombre.textContent), nombre.textContent);

  teclear('albañil');
  campo.blur();
  check('Un nombre que sólo puede ser uno se resuelve al salir', campo.value === '7112', campo.value);
  check('  y queda el nombre', /Albañiles/.test(nombre.textContent), nombre.textContent);

  campo.focus();
  teclear('conductor');
  campo.blur();
  check('Un nombre que puede ser varios no se adivina', campo.value === 'conductor' && !lista(), campo.value);
  check('  y debajo pide elegir de la lista', /Elija una ocupación/.test(nombre.textContent), nombre.textContent);

  campo.focus();
  teclear('5223 ');
  campo.blur();
  check('Un código con espacio del teclado queda limpio', campo.value === '5223', '[' + campo.value + ']');

  campo.value = '';
  campo.readOnly = true;
  campo.focus();
  teclear('mecanico');
  check('Un campo bloqueado no abre la lista', !lista());
  campo.readOnly = false;
  campo.value = '';
  campo.blur();

  check('Sin errores de JS durante la prueba', errores.length === 0, errores.join(' | '));

  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail > 0 ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
