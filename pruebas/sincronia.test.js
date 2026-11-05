/* Prueba del módulo de sincronización de Inicio. Monta la aplicación completa
   en jsdom con fichas en el dispositivo y un servidor simulado, y comprueba
   que el módulo:
     - dice cuántas fichas faltan y pone el botón como acción principal;
     - sin señal no intenta subir y lo dice;
     - mientras sube cuenta «Subiendo n de N», bloquea el botón y no deja
       lanzar una segunda subida;
     - al terminar marca las fichas, anota cuándo y lo dice sin aviso modal;
     - con un rechazo, la ficha sigue pendiente;
     - con nada pendiente, el toque sólo trae lo que hay en la base;
     - lo que se guarda, corrige o elimina mientras sube no se pierde ni vuelve. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
const fuentes = ['roles.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
  'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'pruebas/_boveda_abierta.js', 'captura_local.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
  .join('\n;\n');

let ok = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const HOY = new Date().toISOString().split('T')[0];

function ficha(id, sincronizada) {
  return {
    id: id, codigoFicha: 'COD-' + id, sincronizada: sincronizada, fechaRegistro: new Date().toISOString(),
    fechaDiligenciamiento: HOY, territorio: 'T49', microterritorio: 'MT01', hogaresEnVivienda: 1,
    familias: [], planCuidado: { pendiente: false, accionesRegistradas: 1, alertasSinConducta: 0 }
  };
}

/* guardar: función que decide la respuesta de cada POST a guardar_encuesta;
   puede devolver una promesa que la prueba resuelve cuando quiera. */
function montar(locales, guardar) {
  const almacen = { aps_encuestas: JSON.stringify(locales) };
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
  let enLinea = true;
  Object.defineProperty(window.navigator, 'onLine', { get: () => enLinea, configurable: true });
  window.navigator.geolocation = { getCurrentPosition() {} };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.SESION = { usuario: () => ({ rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 100 }) };

  const peticiones = [];
  const responder = (estado, cuerpo) => ({ ok: estado >= 200 && estado < 300, status: estado, json: () => Promise.resolve(cuerpo) });
  window.fetch = (url, opciones) => {
    const ruta = String(url);
    peticiones.push(ruta);
    /* La base tiene lo que ya subió: una ficha marcada como subida que la base
       no trae se retira del navegador (retirarLocalesQueYaNoEstanEnLaBase). */
    if (ruta.indexOf('/api/listar_fichas') === 0) {
      return Promise.resolve(responder(200, JSON.parse(almacen.aps_encuestas)
        .filter((e) => e.sincronizada === true)
        .map((e) => ({ codigoFicha: e.codigoFicha, fechaRegistro: e.fechaRegistro, territorio: e.territorio, microterritorio: e.microterritorio }))));
    }
    if (ruta === '/api/guardar_encuesta') {
      return Promise.resolve(guardar(JSON.parse(opciones.body))).then((r) => responder(r.estado, r.cuerpo));
    }
    return Promise.reject(new Error('sin red'));
  };

  const avisos = [];
  const errores = [];
  window.addEventListener('error', (e) => errores.push(e.message));
  window.eval(fuentes + ';\nwindow.__api = { sincronizarEncuestas, renderizarEstadoSync, agregarEncuesta, reemplazarEncuesta, eliminarEncuestaPorId };');
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  /* Los avisos modales salen por SweetAlert; en jsdom no existe y la app los
     deja en consola. Se cuentan los que se abrirían. */
  window.Swal = { fire: (o) => { avisos.push(o); return Promise.resolve({}); } };

  const $ = (s) => window.document.querySelector(s);
  return {
    window, doc: window.document, $, api: window.__api, almacen, peticiones, avisos, errores,
    sinSenal: () => { enLinea = false; window.dispatchEvent(new window.Event('offline')); },
    conSenal: () => { enLinea = true; window.dispatchEvent(new window.Event('online')); },
    estado: () => $('#sincronia').dataset.estado,
    titulo: () => $('.sincronia__titulo').textContent,
    detalle: () => $('.sincronia__detalle').textContent,
    boton: () => $('#btnSincronizar'),
    guardadas: () => JSON.parse(almacen.aps_encuestas).filter((e) => e.sincronizada === true).length
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms || 0));

/* El arranque pide catálogos y fichas sin esperar a nadie; sin red simulada
   para los catálogos deja sus propios avisos. Se deja que termine y se
   empieza a contar desde ahí. */
async function asentar(app) {
  await esperar(30);
  app.avisos.length = 0;
  app.peticiones.length = 0;
  return app;
}

(async function () {
  console.log('\n=== 1. Fichas sin subir ===');
  let liberar = [];
  const app = await asentar(montar([ficha('a', false), ficha('b', false), ficha('c', true)], () =>
    new Promise((resolver) => liberar.push(() => resolver({ estado: 200, cuerpo: { codigos: null } })))));
  check('La aplicación arranca sin errores de JS', app.errores.length === 0, app.errores.join(' | '));
  check('Estado pendiente', app.estado() === 'pendiente', app.estado());
  check('  dice cuántas: «2 fichas sin subir»', app.titulo() === '2 fichas sin subir', app.titulo());
  check('  y dónde están', app.detalle() === 'Sólo están en este equipo', app.detalle());
  check('  el botón se puede pulsar y dice qué hace',
    !app.boton().disabled && app.boton().textContent.trim() === 'Sincronizar ahora', app.boton().textContent);
  check('El módulo está junto al total, no al final de la pantalla',
    Boolean(app.$('.bento__total #sincronia')) && !app.$('.bento__acciones [onclick*="sincronizar"]'));

  console.log('\n=== 2. Sin señal ===');
  app.sinSenal();
  check('Estado sin-red al perder la señal', app.estado() === 'sin-red', app.estado());
  check('  «2 fichas esperan la señal»', app.detalle() === '2 fichas esperan la señal', app.detalle());
  check('  botón deshabilitado y lo dice', app.boton().disabled && /Esperando señal/.test(app.boton().textContent));
  const antes = app.peticiones.length;
  await app.api.sincronizarEncuestas();
  check('  sincronizar sin señal no envía nada', app.peticiones.length === antes, app.peticiones.slice(antes).join(','));
  app.conSenal();
  check('Al volver la señal, otra vez pendiente', app.estado() === 'pendiente', app.estado());
  check('  sin señal se avisó una vez, sin intentar', app.avisos.length === 1, JSON.stringify(app.avisos));
  app.avisos.length = 0;

  console.log('\n=== 3. Subiendo ===');
  const subida = app.api.sincronizarEncuestas();
  await esperar();
  check('Estado subiendo', app.estado() === 'subiendo', app.estado());
  check('  «Subiendo 1 de 2…»', app.titulo() === 'Subiendo 1 de 2…', app.titulo());
  check('  botón ocupado', app.boton().disabled && /Sincronizando/.test(app.boton().textContent));
  check('  la barra de avance se ve', !app.$('.sincronia__barra').hidden);
  check('  sin aviso modal que tape el avance', app.avisos.length === 0, JSON.stringify(app.avisos));

  const enviadas = app.peticiones.filter((r) => r === '/api/guardar_encuesta').length;
  app.api.sincronizarEncuestas();
  await esperar();
  check('Un segundo toque no lanza otra subida',
    app.peticiones.filter((r) => r === '/api/guardar_encuesta').length === enviadas);

  liberar.shift()();
  await esperar(5);
  check('Tras la primera: «Subiendo 2 de 2…»', app.titulo() === 'Subiendo 2 de 2…', app.titulo());
  check('  la barra va a la mitad',
    /scaleX\(0\.5\)/.test(app.$('.sincronia__avance').style.transform), app.$('.sincronia__avance').style.transform);

  liberar.shift()();
  await subida;
  check('Al terminar, todo en la base', app.estado() === 'listo' && app.titulo() === 'Todo está en la base', app.titulo());
  check('  dice cuántas subieron y cuándo',
    /^2 fichas subidas hoy a las \d{2}:\d{2}$/.test(app.detalle()), app.detalle());
  check('  las fichas quedan marcadas', app.guardadas() === 3, app.guardadas());
  check('  anota la hora en el dispositivo', Boolean(app.almacen.aps_ultima_sincronizacion));
  check('  después trae lo que hay en la base', app.peticiones.filter((r) => r.indexOf('/api/listar_fichas') === 0).length === 1);
  check('  sin aviso modal: no hay nada que decidir', app.avisos.length === 0, JSON.stringify(app.avisos));
  check('  el botón queda en segundo plano', !app.boton().disabled && app.estado() === 'listo');

  console.log('\n=== 4. Un rechazo ===');
  const rechazo = await asentar(montar([ficha('r', false)], () => ({
    estado: 400, cuerpo: { bloqueos: [{ ruta: 'cups', mensaje: 'El código CUPS no existe.' }] }
  })));
  await rechazo.api.sincronizarEncuestas();
  check('La ficha rechazada sigue pendiente', rechazo.estado() === 'pendiente' && rechazo.guardadas() === 0, rechazo.estado());
  check('  el aviso nombra la ficha y el campo',
    rechazo.avisos.length === 1 && /COD-r: El código CUPS no existe\./.test(rechazo.avisos[0].text),
    JSON.stringify(rechazo.avisos));
  check('  y no se anota como sincronizado', !rechazo.almacen.aps_ultima_sincronizacion);

  console.log('\n=== 5. Nada pendiente ===');
  const vacia = await asentar(montar([], () => ({ estado: 500, cuerpo: {} })));
  check('Sin fichas: «Nada por subir»', vacia.estado() === 'listo' && vacia.titulo() === 'Nada por subir', vacia.titulo());
  const listados = vacia.peticiones.filter((r) => r.indexOf('/api/listar_fichas') === 0).length;
  await vacia.api.sincronizarEncuestas();
  check('El toque trae lo de la base sin subir nada',
    vacia.peticiones.filter((r) => r.indexOf('/api/listar_fichas') === 0).length === listados + 1 &&
    !vacia.peticiones.includes('/api/guardar_encuesta'));
  check('  y lo anota: «Sincronizado hoy a las …»', /^Sincronizado hoy a las \d{2}:\d{2}$/.test(vacia.detalle()), vacia.detalle());
  check('  sin aviso modal', vacia.avisos.length === 0, JSON.stringify(vacia.avisos));

  console.log('\n=== 6. Lo que pasa en el equipo mientras sube ===');
  /* Con poca señal una subida tarda minutos, y nada impide seguir trabajando. Cada
     petición se queda esperando hasta que la prueba la suelta. */
  const sueltas = [];
  const cuerpos = [];
  const durante = await asentar(montar([ficha('v', false), ficha('w', false), ficha('x', false), ficha('y', false)], (cuerpo) => {
    cuerpos.push(cuerpo);
    return new Promise((resolver) => sueltas.push((codigos) => resolver({ estado: 200, cuerpo: { codigos: codigos || null } })));
  }));
  const enLista = () => JSON.parse(durante.almacen.aps_encuestas);
  const laFicha = (id) => enLista().find((e) => e.id === id);
  const conHogares = (id, n) => Object.assign(ficha(id, false), { hogaresEnVivienda: n });

  const subiendo = durante.api.sincronizarEncuestas();
  await esperar();
  check('Primero sale la primera', cuerpos.length === 1 && cuerpos[0].id === 'v', JSON.stringify(cuerpos.map((e) => e.id)));

  durante.api.agregarEncuesta(ficha('nueva', false));
  durante.api.reemplazarEncuesta('w', conHogares('w', 2));
  durante.api.eliminarEncuestaPorId('x');

  sueltas.shift()({ idHogar: 'T49MT01H0001', nuv: 'NUV0001' });
  await esperar(5);
  check('Lo ya subido queda anotado de una vez, sin esperar al final', laFicha('v').sincronizada === true);
  check('  con los códigos que asignó el servidor', laFicha('v').idHogar === 'T49MT01H0001' && laFicha('v').nuv === 'NUV0001');
  check('Una ficha corregida antes de su turno sube corregida', cuerpos.length === 2 && cuerpos[1].id === 'w' && cuerpos[1].hogaresEnVivienda === 2,
    JSON.stringify(cuerpos.map((e) => [e.id, e.hogaresEnVivienda])));

  /* Corregida mientras viaja: lo que llegó a la base es la versión de antes. */
  durante.api.reemplazarEncuesta('w', conHogares('w', 3));
  sueltas.shift()();
  await esperar(5);
  check('Una ficha eliminada antes de su turno no sube', cuerpos.length === 3 && cuerpos[2].id === 'y',
    JSON.stringify(cuerpos.map((e) => e.id)));

  /* Se suelta lo que vaya saliendo hasta que termine: si sale una ficha de más, la
     prueba tiene que fallar, no quedarse esperando y salir como si hubiera pasado. */
  let termino = false;
  subiendo.then(() => { termino = true; });
  while (!termino) {
    if (sueltas.length > 0) sueltas.shift()();
    await esperar(5);
  }
  check('La ficha guardada durante la subida no se pierde', Boolean(laFicha('nueva')));
  check('  y sigue pendiente, para la próxima', laFicha('nueva').sincronizada === false);
  check('La corregida mientras viajaba conserva la corrección', laFicha('w').hogaresEnVivienda === 3);
  check('  y sigue pendiente: esa versión no ha llegado', laFicha('w').sincronizada === false);
  check('La eliminada no vuelve', !laFicha('x'));
  check('Las demás quedan subidas', laFicha('v').sincronizada === true && laFicha('y').sincronizada === true);
  check('El módulo lo dice', durante.estado() === 'pendiente' && durante.titulo() === '2 fichas sin subir', durante.titulo());

  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
