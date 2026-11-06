/* Ítem 9 — Buscador de barrios (barrios.js, sobre buscador_lista.js).

   La lista nativa la filtra cada navegador a su manera: Firefox buscaba sólo en
   la etiqueta «Comuna N», así que ningún barrio aparecía por su nombre. Aquí se
   prueba, con el catálogo real, que cualquier barrio se encuentra con y sin
   tildes, y que el campo sigue guardando un nombre y admitiendo lo que no está
   en la lista: las veredas, corregimientos y resguardos no están en ella. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
const fuentes = ['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js', 'reglas.js',
  'formulario.js', 'cups.js', 'buscador_lista.js', 'ocupacion.js', 'barrios.js', 'correccion.js',
  'pruebas/_boveda_abierta.js', 'captura_local.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
  .join('\n;\n');

/* El mismo catálogo que recibe el formulario: bd/17_barrios.sql. */
const barriosReales = [...fs.readFileSync(path.join(BASE, 'bd', '17_barrios.sql'), 'utf8')
  .matchAll(/\('[^']*',\s*'((?:[^']|'')+)',\s*'(\w+)'\)/g)]
  .map((m) => ({ nombre: m[1].replace(/''/g, "'"), comuna: m[2] }));
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

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
/* Sin señal, lo único que hay es la copia que dejó la última conexión. */
almacen.aps_catalogos_dinamicos = JSON.stringify({ barrios: barriosReales });

(async function () {
  if (doc.readyState !== 'complete') {
    await new Promise((listo) => window.addEventListener('load', listo));
  }
  window.eval(fuentes + ';\nwindow.__api = { buscarBarrios, buscarOcupaciones, fijarCatalogosDinamicos, CAT_BARRIOS, MAXIMO_FILAS_EN_LISTA };');
  doc.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  const api = window.__api;
  await new Promise((listo) => window.setTimeout(listo, 50));

  check('La aplicación arranca sin errores de JS', errores.length === 0, errores.join(' | '));
  check('Sin señal, el catálogo sale de la copia guardada', api.CAT_BARRIOS.length === 335, String(api.CAT_BARRIOS.length));

  console.log('\n=== 1. La búsqueda ===');
  const nombres = (q) => api.buscarBarrios(q).filas.map((b) => b.valor);
  const encuentra = (q, nombre) => nombres(q).indexOf(nombre) !== -1;
  [
    ['Terrón', 'Terrón Colorado'], ['terron', 'Terrón Colorado'], ['TERRON', 'Terrón Colorado'],
    ['colorado terron', 'Terrón Colorado'], ['Peñón', 'El Peñón'], ['penon', 'El Peñón'],
    ['el penon', 'El Peñón'], ['alfonso lopez', 'Alfonso López P. 1a. Etapa'],
    ['Alfonso López', 'Alfonso López P. 1a. Etapa'], ['lopez', 'Alfonso López P. 1a. Etapa'],
    ['caney', 'Caney'], ['Fatima', 'Fátima'], ['fátima', 'Fátima'],
    ['20 de julio', '20 de Julio'], ['campina', 'La Campiña'],
    /* El catálogo escribe «Alamos» sin tilde: también al revés. */
    ['Álamos', 'Ciudad Los Alamos'], ['alamos', 'Ciudad Los Alamos'],
    /* «Barrio X» es como suele decirse, aunque el catálogo diga «X». */
    ['barrio terron colorado', 'Terrón Colorado'], ['barrio obrero', 'Barrio Obrero']
  ].forEach(([texto, esperado]) => {
    check('«' + texto + '» encuentra ' + esperado, encuentra(texto, esperado), nombres(texto).slice(0, 6).join(', '));
  });

  const buscarExacto = (q, nombre) => api.buscarBarrios(q).filas.some((b) => b.valor === nombre);
  check('Cada barrio del catálogo se encuentra por su nombre, tal como está',
    barriosReales.every((b) => buscarExacto(b.nombre, b.nombre)),
    barriosReales.filter((b) => !buscarExacto(b.nombre, b.nombre)).map((b) => b.nombre).join(', '));
  check('  y sin tildes',
    barriosReales.every((b) => buscarExacto(sinTildes(b.nombre), b.nombre)),
    barriosReales.filter((b) => !buscarExacto(sinTildes(b.nombre), b.nombre)).map((b) => b.nombre).join(', '));
  check('  y en minúsculas',
    barriosReales.every((b) => buscarExacto(b.nombre.toLowerCase(), b.nombre)));

  check('Lo que no está en la lista no devuelve nada', api.buscarBarrios('xyzxyz').total === 0);
  const parcial = api.buscarBarrios('san cayetano xyzxyz');
  check('Si una palabra no coincide, ofrece lo que se acerca y lo dice', parcial.parcial && parcial.total > 0);
  check('Un texto vacío no devuelve nada', api.buscarBarrios('').total === 0 && api.buscarBarrios('   ').total === 0);

  const antes = barriosReales.slice();
  api.fijarCatalogosDinamicos({ barrios: [{ nombre: 'Barrio Nuevo de Prueba', comuna: '99' }] });
  check('Lee el catálogo vigente: lo nuevo de la base se encuentra sin recargar', encuentra('nuevo prueba', 'Barrio Nuevo de Prueba'));
  check('  y lo que salió ya no', !encuentra('terron', 'Terrón Colorado'));
  api.fijarCatalogosDinamicos({ barrios: antes });

  console.log('\n=== 2. El campo ===');
  const campo = doc.getElementById('divisionTerritorial');
  const lista = () => doc.getElementById('listaBarrios');
  const opciones = () => Array.from(doc.querySelectorAll('#listaBarrios .combo-buscador__opcion'));
  const teclear = (texto) => {
    campo.value = texto;
    campo.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const presionar = (key) => {
    const e = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    campo.dispatchEvent(e);
    return e;
  };
  const guardado = () => new window.FormData(doc.getElementById('encuestaForm')).get('divisionTerritorial');

  check('Ya no depende de la lista nativa del navegador',
    !campo.hasAttribute('list') && doc.querySelectorAll('datalist#listaBarrios').length === 0);

  let bloque = campo.parentElement;
  while (bloque) { bloque.hidden = false; bloque = bloque.parentElement; }
  campo.focus();
  check('El campo recibe el foco', doc.activeElement === campo);
  check('Vacío, no abre ninguna lista', !lista());

  teclear('terron');
  check('Al escribir sin tilde aparece el barrio con tilde',
    lista() && opciones().some((o) => o.dataset.valor === 'Terrón Colorado'));
  check('  con su comuna como ayuda', /Comuna 1\b/.test(opciones()[0].textContent), opciones()[0].textContent);
  check('  anunciada al lector de pantalla',
    campo.getAttribute('aria-expanded') === 'true' && campo.getAttribute('aria-controls') === 'listaBarrios');

  let entradas = 0, cambios = 0;
  const alEntrar = () => entradas++;
  const alCambiar = () => cambios++;
  campo.addEventListener('input', alEntrar);
  campo.addEventListener('change', alCambiar);
  opciones()[0].dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  campo.removeEventListener('input', alEntrar);
  campo.removeEventListener('change', alCambiar);
  check('Tocar una opción deja el nombre, sin la comuna', guardado() === 'Terrón Colorado', guardado());
  check('  la lista se cierra', !lista() && campo.getAttribute('aria-expanded') === 'false');
  check('  y avisa como el teclado, para el mapa y el guardado automático', entradas === 1 && cambios === 1, entradas + '/' + cambios);

  campo.blur();
  campo.focus();
  check('Volver a un barrio ya elegido no abre la lista ni borra lo escrito', !lista() && campo.value === 'Terrón Colorado');
  check('  y se puede seguir escribiendo: no selecciona todo', campo.selectionStart === campo.selectionEnd);

  teclear('san');
  presionar('ArrowDown');
  const marcada = doc.querySelector('#listaBarrios .combo-buscador__opcion--activa');
  check('La flecha marca una opción', !!marcada);
  const enter = presionar('Enter');
  check('Enter elige la marcada y no envía el formulario',
    enter.defaultPrevented && campo.value === marcada.dataset.valor, campo.value);

  teclear('san');
  const enterSinMarcar = presionar('Enter');
  check('Enter sin marcar entre varias no adivina', enterSinMarcar.defaultPrevented && campo.value === 'san', campo.value);
  check('Escape cierra la lista', (presionar('Escape'), !lista()));
  check('  sin borrar lo escrito', campo.value === 'san');

  teclear('caney');
  presionar('Enter');
  check('Enter con una sola opción la elige', campo.value === 'Caney', campo.value);

  console.log('\n=== 3. Sigue siendo texto libre ===');
  campo.focus();
  teclear('Vereda La Buitrera');
  check('Lo que no está en la lista lo dice, sin tratarlo como error',
    lista() && /déjelo como lo escribió/.test(lista().textContent), lista() && lista().textContent);
  campo.blur();
  check('Al salir se guarda tal cual lo escrito', guardado() === 'Vereda La Buitrera', guardado());
  check('  y la lista se cierra', !lista());

  campo.focus();
  check('Volver a un texto libre no abre la lista', !lista());
  teclear('Resguardo xyzxyz');
  const enterSinOpcion = presionar('Enter');
  check('Enter sin opciones no envía ni cambia lo escrito', enterSinOpcion.defaultPrevented && campo.value === 'Resguardo xyzxyz');

  teclear('san xyzxyz');
  presionar('Enter');
  check('Enter no cambia el texto libre por una opción que sólo se acerca', campo.value === 'san xyzxyz', campo.value);

  teclear('alfonso lopez');
  campo.blur();
  check('Sin elegir, no se corrige lo escrito', guardado() === 'alfonso lopez', guardado());

  campo.focus();
  teclear('Barrio Terrón Colorado, sector La Legua');
  campo.blur();
  check('El detalle del sector se conserva', guardado() === 'Barrio Terrón Colorado, sector La Legua', guardado());

  console.log('\n=== 4. Sin catálogo y campo bloqueado ===');
  api.fijarCatalogosDinamicos({ barrios: [] });
  campo.value = '';
  campo.focus();
  teclear('Terrón');
  check('Sin catálogo descargado se puede escribir igual', campo.value === 'Terrón' && lista() && opciones().length === 0);
  campo.blur();
  check('  y se guarda lo escrito', guardado() === 'Terrón', guardado());
  api.fijarCatalogosDinamicos({ barrios: antes });

  campo.value = '';
  campo.readOnly = true;
  campo.focus();
  teclear('terron');
  check('Un campo bloqueado no abre la lista', !lista());
  campo.readOnly = false;
  campo.value = '';
  campo.blur();

  console.log('\n=== 5. Convive con el ítem 73 ===');
  const ocupacion = doc.querySelector('[data-rol="ocupacion"]');
  bloque = ocupacion.parentElement;
  while (bloque) { bloque.hidden = false; bloque = bloque.parentElement; }
  ocupacion.focus();
  ocupacion.value = 'terron';
  ocupacion.dispatchEvent(new window.Event('input', { bubbles: true }));
  check('Escribir en la ocupación no abre la lista de barrios', !lista());
  ocupacion.value = 'mecanico';
  ocupacion.dispatchEvent(new window.Event('input', { bubbles: true }));
  const codigoOcupacion = doc.querySelector('#listaOcupacion .combo-buscador__opcion');
  check('  y abre la suya', !!codigoOcupacion);
  codigoOcupacion.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  check('  que sigue dejando el código', /^\d{4}$/.test(ocupacion.value) && campo.value === '', ocupacion.value);
  ocupacion.value = '';
  ocupacion.blur();

  check('Sin errores de JS durante la prueba', errores.length === 0, errores.join(' | '));

  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail > 0 ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
