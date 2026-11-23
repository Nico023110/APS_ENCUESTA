/* =========================================================================
   Aviso de mudanza a la dirección nueva (mudanza.js y mudanza.json)
       node pruebas/mudanza.test.js

   Protege lo que no se puede probar a última hora:
   1. Apagado (así se sube) no se ve nada en ninguna página.
   2. Antes del corte: el aviso con la fecha y la dirección, en el acceso, la
      aplicación e Instalar; se cierra y no estorba.
   3. Desde el corte: no se empiezan fichas en blanco (sí se termina la que está
      en pantalla), se dice qué falta subir y, con todo arriba, el enlace.
   4. En la dirección nueva nunca aparece; sin señal sigue lo último que se vio;
      una configuración rara (http, fechas malas) es «apagado».
   5. El mudanza.json del repositorio es válido y el servidor lo entrega.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const CODIGO = fs.readFileSync(path.join(RAIZ, 'mudanza.js'), 'utf8');

let pasadas = 0;
let fallidas = 0;
function check(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK    ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle !== undefined ? '  → ' + JSON.stringify(detalle) : '')); }
}

const VIEJA = 'https://aps-encuesta.vercel.app/';
const NUEVA = 'https://ebs.saludladera.gov.co/';
const CORTE = Date.parse('2026-11-27T16:00:00-05:00');
const APERTURA = Date.parse('2026-11-28T06:00:00-05:00');
const ENCENDIDA = {
  activa: true,
  nuevaDireccion: 'https://ebs.saludladera.gov.co',
  corte: '2026-11-27T16:00:00-05:00',
  apertura: '2026-11-28T06:00:00-05:00',
  mensaje: ''
};

const PAGINAS = {
  aplicacion: '<body><header class="app-header"></header><main class="app-main"><section class="view is-active" id="view-inicio"></section></main></body>',
  acceso: '<body class="cuerpo-acceso"><main class="puerta"><section class="puerta__acceso"><p id="avisoMotivo"></p><form id="formAcceso"></form></section></main></body>',
  instalar: '<body class="cuerpo-instalar"><main class="instalar"><header class="instalar__cabecera"></header><p id="avisoInstalada"></p></main></body>'
};

/* Abre una página con mudanza.js: qué responde la red, qué hora es y qué había
   guardado el equipo. */
async function abrir(opciones) {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head>' + PAGINAS[opciones.pagina || 'aplicacion'] + '</html>',
    { url: opciones.url || VIEJA, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const registro = { avisos: [], subidas: 0 };
  w.Date.now = function () { return opciones.ahora; };
  if (opciones.guardada) w.localStorage.setItem('aps_mudanza', JSON.stringify(opciones.guardada));
  w.fetch = function (ruta) {
    registro.ruta = ruta;
    if (opciones.red === 'caida') return Promise.reject(new TypeError('Failed to fetch'));
    if (opciones.red === 404) return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.reject(); } });
    return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve(opciones.configuracion); } });
  };
  w.PWA = { fichasSinSubir: function () { return opciones.sinSubirAntesDeEntrar || 0; } };
  w.mostrarAvisoBreve = function (texto) { registro.avisos.push(texto); };
  w.sincronizarEncuestas = function () { registro.subidas++; };
  w.fichaTieneDatos = function () { return Boolean(opciones.fichaEnPantalla); };
  w.eval(CODIGO);
  await w.MUDANZA.consultar(true);
  if (opciones.sincronia) w.MUDANZA.alCambiarSincronia(opciones.sincronia);
  const caja = w.document.getElementById('mudanza');
  return {
    w: w,
    registro: registro,
    caja: caja,
    texto: caja ? caja.textContent.replace(/\s+/g, ' ').trim() : '',
    enlace: caja && caja.querySelector('a.mudanza__boton') ? caja.querySelector('a.mudanza__boton').href : null,
    boton: function (accion) { return caja ? caja.querySelector('[data-accion="' + accion + '"]') : null; },
    cerrar: function () { w.close(); }
  };
}

(async function () {
  console.log('\n=== Apagado ===');
  for (const pagina of ['aplicacion', 'acceso', 'instalar']) {
    const p = await abrir({ pagina: pagina, ahora: CORTE + 86400000, configuracion: Object.assign({}, ENCENDIDA, { activa: false }) });
    check('apagado: nada en ' + pagina + ', aunque ya pasó el corte', p.caja === null && p.w.MUDANZA.fase() === 'ninguna');
    if (pagina === 'aplicacion') {
      check('apagado: sí deja empezar fichas', p.w.MUDANZA.permiteFichaNueva() && p.w.MUDANZA.permiteEntrarAlFormulario());
      check('apagado: no queda nada guardado en el equipo', p.w.localStorage.getItem('aps_mudanza') === null);
      check('pide /mudanza.json', p.registro.ruta === '/mudanza.json', p.registro.ruta);
    }
    p.cerrar();
  }

  console.log('\n=== Antes del corte: aviso ===');
  const antes = CORTE - 3 * 86400000;
  let p = await abrir({ pagina: 'aplicacion', ahora: antes, configuracion: ENCENDIDA });
  check('aviso en la aplicación', p.caja !== null && p.caja.classList.contains('mudanza--aviso'), p.texto);
  check('dice la fecha y la hora del corte en hora de Colombia', p.texto.indexOf('el viernes 27 de noviembre a las 4:00 p. m.') !== -1, p.texto);
  check('dice la dirección nueva y que es el mismo usuario', p.texto.indexOf('ebs.saludladera.gov.co') !== -1 && p.texto.indexOf('mismo usuario y contraseña') !== -1);
  check('pide subir todo antes', /suba todas sus fichas/.test(p.texto));
  check('antes del corte no hay enlace (la base nueva aún no tiene los datos)', p.enlace === null);
  check('antes del corte sí deja empezar fichas', p.w.MUDANZA.permiteFichaNueva());
  check('va arriba de todo en la aplicación', p.w.document.querySelector('.app-main').firstElementChild === p.caja);
  p.boton('cerrar').click();
  check('«Entendido» lo cierra', p.w.document.getElementById('mudanza') === null);
  p.w.MUDANZA.pintar();
  check('y no vuelve en la misma sesión', p.w.document.getElementById('mudanza') === null);
  check('la configuración queda guardada para abrir sin señal', JSON.parse(p.w.localStorage.getItem('aps_mudanza')).activa === true);
  p.cerrar();

  p = await abrir({ pagina: 'aplicacion', ahora: antes, configuracion: Object.assign({}, ENCENDIDA, { mensaje: 'Texto propio de la coordinación.' }) });
  check('«mensaje» reemplaza el texto del aviso', p.texto.indexOf('Texto propio de la coordinación.') !== -1 && p.texto.indexOf('suba todas') === -1, p.texto);
  p.cerrar();

  p = await abrir({ pagina: 'acceso', ahora: antes, configuracion: ENCENDIDA });
  check('aviso en el acceso, antes del formulario', p.caja !== null && p.w.document.querySelector('.puerta__acceso').firstElementChild === p.caja);
  p.cerrar();
  p = await abrir({ pagina: 'instalar', ahora: antes, configuracion: ENCENDIDA });
  check('aviso en Instalar, después del encabezado', p.caja !== null && p.w.document.querySelector('.instalar__cabecera').nextElementSibling === p.caja);
  p.cerrar();

  const unaHora = Object.assign({}, ENCENDIDA, { corte: '2026-11-27T13:00:00-05:00', apertura: '' });
  p = await abrir({ pagina: 'aplicacion', ahora: antes, configuracion: unaHora });
  check('«a la 1:00 p. m.» (no «a las 1»)', p.texto.indexOf('a la 1:00 p. m.') !== -1, p.texto);
  p.cerrar();

  console.log('\n=== Del corte a la apertura ===');
  const entre = CORTE + 3600000;
  p = await abrir({ pagina: 'aplicacion', ahora: entre, configuracion: ENCENDIDA, sincronia: { estado: 'pendiente', pendientes: 3, ajenas: 0, conOtraLlave: false } });
  check('bloque fuerte que no se cierra', p.caja !== null && p.caja.classList.contains('mudanza--fuerte') && p.boton('cerrar') === null);
  check('dice cuándo abre la dirección nueva', p.texto.indexOf('el sábado 28 de noviembre a las 6:00 a. m.') !== -1, p.texto);
  check('cuenta lo que falta subir', p.texto.indexOf('suba sus 3 fichas') !== -1, p.texto);
  check('todavía sin enlace', p.enlace === null);
  p.boton('subir').click();
  check('«Subir ahora» sincroniza', p.registro.subidas === 1);
  check('no deja «Empezar otra»', p.w.MUDANZA.permiteFichaNueva() === false && p.registro.avisos.length === 1);
  check('y lo explica', /ya no se hacen aquí/.test(p.registro.avisos[0] || ''), p.registro.avisos[0]);
  check('no abre el formulario en blanco', p.w.MUDANZA.permiteEntrarAlFormulario() === false);
  p.cerrar();

  p = await abrir({ pagina: 'aplicacion', ahora: entre, configuracion: ENCENDIDA, fichaEnPantalla: true });
  check('sí abre el formulario para terminar la ficha que está en pantalla', p.w.MUDANZA.permiteEntrarAlFormulario() === true);
  p.cerrar();

  p = await abrir({ pagina: 'aplicacion', ahora: entre, configuracion: ENCENDIDA, sincronia: { estado: 'sin-red', pendientes: 1, ajenas: 2, conOtraLlave: true } });
  check('sin señal: el botón espera', p.boton('subir') && p.boton('subir').disabled && /Esperando señal/.test(p.boton('subir').textContent));
  check('una ficha: «su ficha»', p.texto.indexOf('suba su ficha: sólo está en este equipo') !== -1, p.texto);
  check('fichas de otras personas: que cada una entre', /otras personas sin subir/.test(p.texto));
  check('lo guardado con la contraseña anterior', /contraseña anterior/.test(p.texto));
  p.cerrar();

  p = await abrir({ pagina: 'acceso', ahora: entre, configuracion: ENCENDIDA, sinSubirAntesDeEntrar: 2 });
  check('acceso: se está mudando, con la apertura', /se está mudando/.test(p.texto) && p.texto.indexOf('sábado 28') !== -1, p.texto);
  check('acceso: avisa lo que hay sin subir en el equipo', p.texto.indexOf('2 fichas sin subir') !== -1, p.texto);
  p.cerrar();

  console.log('\n=== Desde la apertura ===');
  const despues = APERTURA + 3600000;
  p = await abrir({ pagina: 'aplicacion', ahora: despues, configuracion: ENCENDIDA, sincronia: { estado: 'listo', pendientes: 0, ajenas: 0, conOtraLlave: false } });
  check('se mudó, con la dirección', p.texto.indexOf('se mudó a ebs.saludladera.gov.co') !== -1, p.texto);
  check('con todo arriba: enlace a la dirección nueva', p.enlace === 'https://ebs.saludladera.gov.co/', p.enlace);
  check('el enlace abre aparte, sin pasarle esta página', p.caja.querySelector('a').rel === 'noopener');
  check('y los pasos (instalar allá, desinstalar esta)', p.caja.querySelectorAll('.mudanza__pasos li').length === 3 && /desinstale esta/.test(p.texto));
  check('sigue sin dejar fichas nuevas', p.w.MUDANZA.permiteFichaNueva() === false);
  p.cerrar();

  p = await abrir({ pagina: 'aplicacion', ahora: despues, configuracion: ENCENDIDA, sincronia: { estado: 'pendiente', pendientes: 2, ajenas: 0, conOtraLlave: false } });
  check('con fichas sin subir: primero subirlas, todavía sin enlace', p.enlace === null && p.boton('subir') !== null);
  p.w.MUDANZA.alCambiarSincronia({ estado: 'listo', pendientes: 0, ajenas: 0, conOtraLlave: false });
  check('al terminar de subir aparece el enlace', p.w.document.querySelector('#mudanza a.mudanza__boton') !== null);
  p.cerrar();

  p = await abrir({ pagina: 'acceso', ahora: despues, configuracion: ENCENDIDA });
  check('acceso: enlace a la dirección nueva', p.enlace === 'https://ebs.saludladera.gov.co/', p.enlace);
  p.cerrar();
  p = await abrir({ pagina: 'instalar', ahora: despues, configuracion: ENCENDIDA });
  check('Instalar: «no instale esta» y enlace a Instalar allá', /No instale esta/.test(p.texto) && p.enlace === 'https://ebs.saludladera.gov.co/instalar', p.enlace);
  p.cerrar();

  console.log('\n=== Dirección nueva, sin señal y configuraciones raras ===');
  p = await abrir({ url: NUEVA, pagina: 'aplicacion', ahora: despues, configuracion: ENCENDIDA });
  check('en la dirección nueva nunca aparece', p.caja === null && p.w.MUDANZA.fase() === 'ninguna' && p.w.MUDANZA.permiteFichaNueva());
  p.cerrar();

  p = await abrir({ pagina: 'aplicacion', ahora: antes, red: 'caida', guardada: ENCENDIDA });
  check('sin señal: usa lo último que vio el equipo', p.caja !== null && /cambia de dirección/.test(p.texto));
  p.cerrar();

  p = await abrir({ pagina: 'aplicacion', ahora: antes, red: 404, guardada: ENCENDIDA });
  check('si el archivo ya no está (404): apagado y se olvida', p.caja === null && p.w.localStorage.getItem('aps_mudanza') === null);
  p.cerrar();

  for (const [nombre, cambio] of [
    ['dirección http', { nuevaDireccion: 'http://ebs.saludladera.gov.co' }],
    ['dirección que no es dirección', { nuevaDireccion: 'ebs' }],
    ['corte sin fecha válida', { corte: 'viernes' }],
    ['activa como texto', { activa: 'true' }]
  ]) {
    p = await abrir({ pagina: 'aplicacion', ahora: despues, configuracion: Object.assign({}, ENCENDIDA, cambio) });
    check('«' + nombre + '» cuenta como apagado', p.caja === null && p.w.MUDANZA.permiteFichaNueva());
    p.cerrar();
  }

  p = await abrir({ pagina: 'aplicacion', ahora: antes, configuracion: Object.assign({}, ENCENDIDA, { mensaje: '<img src=x onerror=alert(1)>' }) });
  check('el mensaje va como texto, nunca como HTML', p.caja.querySelector('img') === null && p.texto.indexOf('<img') !== -1);
  p.cerrar();

  p = await abrir({ pagina: 'aplicacion', ahora: CORTE + 60000, configuracion: Object.assign({}, ENCENDIDA, { apertura: '' }) });
  check('sin apertura: abre a la misma hora del corte', p.w.MUDANZA.fase() === 'mudada');
  p.cerrar();

  console.log('\n=== El archivo del repositorio ===');
  const archivo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'mudanza.json'), 'utf8'));
  check('mudanza.json es JSON válido con los campos', ['activa', 'nuevaDireccion', 'corte', 'apertura', 'mensaje'].every(function (k) { return k in archivo; }));
  check('la dirección nueva es https', /^https:\/\//.test(archivo.nuevaDireccion));
  check('corte y apertura son fechas con zona horaria', !isNaN(Date.parse(archivo.corte)) && /[+-]\d\d:\d\d$/.test(archivo.corte) &&
    (!archivo.apertura || (!isNaN(Date.parse(archivo.apertura)) && Date.parse(archivo.apertura) >= Date.parse(archivo.corte))));
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  check('mudanza.js está en la lista del service worker', sw.indexOf("'/mudanza.js'") !== -1);
  check('mudanza.json NO está en esa lista (se pide siempre a la red)', sw.indexOf("'/mudanza.json'") === -1);
  ['index.html', 'login.html', 'instalar.html'].forEach(function (pagina) {
    check(pagina + ' carga mudanza.js', /<script src="mudanza\.js"><\/script>/.test(fs.readFileSync(path.join(RAIZ, pagina), 'utf8')));
  });
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  check('Vercel no lo guarda en caché', vercel.headers.some(function (h) {
    return h.source === '/mudanza.json' && h.headers.some(function (x) { return x.key === 'Cache-Control' && /no-store/.test(x.value); });
  }));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas ? 1 : 0);
})().catch(function (error) { console.error(error); process.exit(1); });
