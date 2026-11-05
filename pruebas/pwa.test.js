/* =========================================================================
   La aplicación instalada: lo que se puede comprobar sin navegador
       node pruebas/pwa.test.js

   El recorrido real, en un teléfono emulado y sin red, es pruebas/e2e/pwa.spec.js
   (npm run e2e:pwa). Esto corre con npm test y protege lo que se rompe en silencio:

   1. Un archivo nuevo en una página que no se agrega a la lista de sw.js: todo
      sigue funcionando con red y deja de abrir sin red, en terreno.
   2. Una dependencia externa que vuelve: lo mismo.
   3. El service worker y sus promesas: nunca tocar /api/, nunca cambiar de versión
      a medias, servir sin red.
   4. La verificación de la contraseña sin señal.
   5. El bloqueo: sobrevive a cerrar la aplicación y no saca a nadie por escribir
      mal la contraseña.
   6. El acceso: con señal manda el servidor; sin ella, la copia del dispositivo.
   7. Otra pestaña que cambia de usuario, y lo que el acceso dice de las fichas sin
      subir. La cola por persona es pruebas/cola_por_usuario.test.js.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const leer = function (archivo) { return fs.readFileSync(path.join(RAIZ, archivo), 'utf8'); };

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK    ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle ? '\n        ' + detalle : ''));
  }
}

function esperar(ms) {
  return new Promise(function (resolver) { setTimeout(resolver, ms); });
}

/* ---------------------------------------------------------
   Utilidades: lo que dicen las páginas
   --------------------------------------------------------- */

const PAGINAS = ['index.html', 'login.html', 'instalar.html'];

function recursosDePagina(archivo) {
  const documento = new JSDOM(leer(archivo)).window.document;
  const scripts = Array.from(documento.querySelectorAll('script[src]')).map(function (e) { return e.getAttribute('src'); });
  const enlaces = Array.from(documento.querySelectorAll('link[href]'))
    .filter(function (e) { return e.getAttribute('rel') !== 'preconnect'; })
    .map(function (e) { return e.getAttribute('href'); });
  const imagenes = Array.from(documento.querySelectorAll('img[src]')).map(function (e) { return e.getAttribute('src'); });
  return scripts.concat(enlaces, imagenes);
}

function archivosDeUnaHoja(archivo) {
  const carpeta = path.posix.dirname(archivo);
  const salida = [];
  const patron = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  const texto = leer(archivo);
  let hallazgo;
  while ((hallazgo = patron.exec(texto)) !== null) {
    if (/^(data:|#)/.test(hallazgo[1])) continue;
    salida.push(path.posix.normalize(path.posix.join(carpeta, hallazgo[1].split(/[?#]/)[0])));
  }
  return salida;
}

/* ---------------------------------------------------------
   Banco del service worker: sw.js de verdad, con el navegador simulado
   --------------------------------------------------------- */

const ORIGEN = 'https://aps.ejemplo';

class CacheSimulada {
  constructor() { this.entradas = new Map(); }
  clave(peticion) { return new URL(typeof peticion === 'string' ? peticion : peticion.url, ORIGEN).pathname; }
  async put(peticion, respuesta) { this.entradas.set(this.clave(peticion), respuesta.clone()); }
  async match(peticion) {
    const hallada = this.entradas.get(this.clave(peticion));
    return hallada ? hallada.clone() : undefined;
  }
  async keys() { return Array.from(this.entradas.keys()); }
}

function montarTrabajador(sitio, almacenPrevio) {
  const oyentes = {};
  /* El mismo almacén con otro worker es lo que pasa cuando el navegador lo apaga y
     lo vuelve a arrancar: la memoria se pierde, las cachés no. */
  const almacen = almacenPrevio || new Map();
  const mensajes = [];
  const pedidos = [];
  const estado = { red: true };

  const caches = {
    open: async function (nombre) {
      if (!almacen.has(nombre)) almacen.set(nombre, new CacheSimulada());
      return almacen.get(nombre);
    },
    keys: async function () { return Array.from(almacen.keys()); },
    delete: async function (nombre) { return almacen.delete(nombre); }
  };

  class PeticionLocal extends Request {
    constructor(url, opciones) { super(new URL(url, ORIGEN), opciones); }
  }

  const fetchSimulado = async function (peticion) {
    if (!estado.red) throw new TypeError('Failed to fetch');
    const ruta = new URL(peticion.url).pathname;
    pedidos.push(ruta);
    if (!(ruta in sitio)) return new Response('no existe', { status: 404 });
    if (estado.portal) {
      return new Response('<html>Inicie sesión en la red</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }
    return new Response(sitio[ruta], {
      status: 200,
      headers: {
        'content-type': /\.html$/.test(ruta) ? 'text/html; charset=utf-8' : 'text/plain',
        'content-encoding': 'gzip',
        'content-length': String(sitio[ruta].length),
        'content-security-policy': "default-src 'self'"
      }
    });
  };

  const self = {
    location: new URL(ORIGEN + '/sw.js'),
    addEventListener: function (tipo, oyente) { oyentes[tipo] = oyente; },
    skipWaiting: async function () {},
    clients: {
      claim: async function () {},
      matchAll: async function () {
        return [{ postMessage: function (mensaje) { mensajes.push(mensaje); } }];
      }
    }
  };

  vm.runInNewContext(leer('sw.js'), {
    self: self, caches: caches, fetch: fetchSimulado, crypto: webcrypto, Request: PeticionLocal, Response: Response,
    Headers: Headers, URL: URL, TextEncoder: TextEncoder, AbortController: AbortController, console: console,
    setTimeout: setTimeout, clearTimeout: clearTimeout
  });

  async function disparar(tipo, extra) {
    const esperas = [];
    const evento = Object.assign({ waitUntil: function (p) { esperas.push(p); } }, extra || {});
    oyentes[tipo](evento);
    await Promise.all(esperas);
    return evento;
  }

  return {
    self: self,
    estado: estado,
    almacen: almacen,
    mensajes: mensajes,
    pedidos: pedidos,
    disparar: disparar,
    /* Una petición de la página. Devuelve null si el trabajador no la toca. */
    pedir: async function (ruta, opciones) {
      let respuesta = null;
      const peticion = Object.assign({ method: 'GET', url: new URL(ruta, ORIGEN).href, mode: 'cors' }, opciones || {});
      oyentes.fetch({ request: peticion, respondWith: function (p) { respuesta = p; } });
      return respuesta ? { tocada: true, respuesta: await respuesta } : { tocada: false };
    },
    nucleoVigente: async function () {
      const nombres = Array.from(almacen.keys()).filter(function (k) { return k.indexOf('aps-nucleo-') === 0; });
      return nombres.length ? nombres[nombres.length - 1] : null;
    }
  };
}

function sitioDePrueba(archivos) {
  const sitio = {};
  archivos.forEach(function (ruta) { sitio[ruta] = 'contenido de ' + ruta; });
  return sitio;
}

/* ---------------------------------------------------------
   Banco de la verificación sin señal
   --------------------------------------------------------- */

function almacenSimulado() {
  const datos = new Map();
  return {
    datos: datos,
    getItem: function (k) { return datos.has(k) ? datos.get(k) : null; },
    setItem: function (k, v) { datos.set(k, String(v)); },
    removeItem: function (k) { datos.delete(k); }
  };
}

function montarAccesoLocal() {
  const almacen = almacenSimulado();
  const ventana = { crypto: webcrypto, TextEncoder: TextEncoder };
  vm.runInNewContext(leer('acceso_local.js'), {
    window: ventana, localStorage: almacen, btoa: btoa, atob: atob, console: console, TextEncoder: TextEncoder
  });
  return { acceso: ventana.ACCESO_LOCAL, almacen: almacen };
}

/* ---------------------------------------------------------
   Banco de sesion.js y login.js: los archivos reales, en jsdom
   --------------------------------------------------------- */

const PERFIL = {
  id: 7, documento: '1144099001', tipoId: 'CC', nombre: 'Prueba', rol: 'enfermeria', rolEtiqueta: 'Enfermería',
  nivel: 'profesional', permisos: ['ficha.crear'], equipoCodigo: 'EBS12'
};

const CUERPO_SESION = `
  <header class="app-header"></header><main class="app-main"></main>
  <div id="appUsuario"></div>
  <div id="bloqueoSesion" hidden>
    <form>
      <strong data-bloqueo="nombre"></strong>
      <input type="password" name="clave">
      <p data-bloqueo="error" hidden></p>
      <button type="submit">Continuar</button>
      <button type="button" data-bloqueo="salir">Salir</button>
    </form>
  </div>`;

function accesoLocalSimulado(verificarResultado, opciones) {
  const llamadas = { recordar: [], verificar: [], confirmar: [], olvidar: [], olvidarSesion: 0, cierrePendiente: 0 };
  opciones = opciones || {};
  return {
    llamadas: llamadas,
    olvidarSesion: function () { llamadas.olvidarSesion++; },
    anotarCierrePendiente: function () { llamadas.cierrePendiente++; },
    hayCierrePendiente: function () { return opciones.cierrePendiente === true; },
    recordar: function (d, c, p) { llamadas.recordar.push([d, c, p]); return Promise.resolve(true); },
    verificar: function (d, c) {
      llamadas.verificar.push([d, c]);
      return Promise.resolve(verificarResultado(c));
    },
    confirmar: function (d) { llamadas.confirmar.push(d); },
    olvidar: function (d) { llamadas.olvidar.push(d); }
  };
}

async function montarSesion(opciones) {
  const dom = new JSDOM('<!doctype html><html><head></head><body>' + CUERPO_SESION + '</body></html>', {
    url: ORIGEN + '/', runScripts: 'outside-only'
  });
  const v = dom.window;
  const pedidos = [];

  Object.entries(opciones.almacen || {}).forEach(function (par) { v.localStorage.setItem(par[0], par[1]); });
  if (!('almacen' in opciones) || !opciones.sinPerfil) v.localStorage.setItem('aps_sesion_usuario', JSON.stringify(PERFIL));

  v.Headers = Headers;
  v.Request = Request;
  Object.defineProperty(v.navigator, 'onLine', { configurable: true, get: function () { return opciones.enLinea !== false; } });
  v.ACCESO_LOCAL = opciones.acceso;
  v.fetch = function (url, conf) {
    const ruta = new URL(url, ORIGEN).pathname;
    pedidos.push({ ruta: ruta, conf: conf || {} });
    return (opciones.servidor || function () { return new Promise(function () {}); })(ruta, conf || {});
  };

  /* Los temporizadores largos se disparan a mano: nadie espera 45 segundos. */
  const temporizadores = [];
  const setTimeoutOriginal = v.setTimeout.bind(v);
  v.setTimeout = function (funcion, ms) {
    if (ms >= 1000) { temporizadores.push({ funcion: funcion, ms: ms }); return temporizadores.length; }
    return setTimeoutOriginal(funcion, ms);
  };

  v.eval(leer('sesion.js'));

  /* jsdom dispara DOMContentLoaded por su cuenta, un momento después. */
  while (v.document.readyState === 'loading') await esperar(1);

  return {
    v: v,
    pedidos: pedidos,
    temporizadores: temporizadores,
    velo: function () { return v.document.getElementById('bloqueoSesion'); },
    bloqueada: function () { return !v.document.getElementById('bloqueoSesion').hidden; },
    errorVelo: function () { return v.document.querySelector('[data-bloqueo="error"]').textContent; },
    fuera: function () { return v.document.documentElement.classList.contains('sin-sesion'); },
    responderVelo: async function (clave) {
      v.document.querySelector('#bloqueoSesion input[name="clave"]').value = clave;
      v.document.querySelector('#bloqueoSesion form').dispatchEvent(new v.Event('submit', { cancelable: true, bubbles: true }));
      await esperar(30);
    }
  };
}

function respuestaJson(estado, cuerpo) {
  return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } }));
}

function montarAcceso(opciones) {
  const cuerpo = new JSDOM(leer('login.html')).window.document.body.innerHTML.replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM('<!doctype html><html><body>' + cuerpo + '</body></html>', {
    url: ORIGEN + '/login.html', runScripts: 'outside-only'
  });
  const v = dom.window;
  const pedidos = [];

  Object.defineProperty(v.navigator, 'onLine', { configurable: true, get: function () { return opciones.enLinea !== false; } });
  Object.entries(opciones.almacen || {}).forEach(function (par) { v.localStorage.setItem(par[0], par[1]); });
  v.ACCESO_LOCAL = opciones.acceso;
  v.fetch = function (url, conf) {
    const ruta = new URL(url, ORIGEN).pathname;
    pedidos.push({ ruta: ruta, conf: conf || {} });
    return opciones.servidor(ruta, conf || {});
  };

  /* login.js lee los campos por nombre (formAcceso.clave), y jsdom no da ese atajo. */
  v.document.querySelectorAll('form').forEach(function (formulario) {
    formulario.querySelectorAll('[name]').forEach(function (campo) {
      if (!(campo.name in formulario)) formulario[campo.name] = campo;
    });
  });

  if (opciones.conPwa) v.eval(leer('pwa.js'));
  v.eval(leer('login.js'));

  return {
    v: v,
    pedidos: pedidos,
    error: function () { return v.document.getElementById('errorAcceso').textContent; },
    /* La salida de la página es por `location.replace`, que jsdom no ejecuta: se
       reconoce porque guardó el perfil que sesion.js va a leer. */
    entro: function () { return v.localStorage.getItem('aps_sesion_usuario') !== null; },
    ingresar: async function (documento, clave) {
      v.document.getElementById('documento').value = documento;
      v.document.getElementById('clave').value = clave;
      v.document.getElementById('formAcceso').dispatchEvent(new v.Event('submit', { cancelable: true, bubbles: true }));
      await esperar(30);
    }
  };
}

/* ---------------------------------------------------------
   Las pruebas
   --------------------------------------------------------- */

async function principal() {
  const textoSw = leer('sw.js');
  const ARCHIVOS = textoSw.slice(textoSw.indexOf('const ARCHIVOS = ['), textoSw.indexOf('];', textoSw.indexOf('const ARCHIVOS = ['))
  ).match(/'\/[^']*'/g).map(function (s) { return s.slice(1, -1); });

  console.log('\n=== 1. Todo lo que cargan las páginas está en la lista del service worker ===');

  const faltantes = [];
  const externos = [];
  const hojas = [];
  PAGINAS.forEach(function (pagina) {
    recursosDePagina(pagina).forEach(function (recurso) {
      if (/^data:/.test(recurso)) return;
      if (/^(https?:)?\/\//.test(recurso)) { externos.push(pagina + ': ' + recurso); return; }
      const ruta = '/' + recurso.replace(/^\/+/, '');
      if (ARCHIVOS.indexOf(ruta) === -1) faltantes.push(pagina + ': ' + ruta);
      if (/\.css$/.test(ruta)) hojas.push(ruta.slice(1));
    });
  });
  Array.from(new Set(hojas)).forEach(function (hoja) {
    archivosDeUnaHoja(hoja).forEach(function (archivo) {
      if (ARCHIVOS.indexOf('/' + archivo) === -1) faltantes.push(hoja + ': /' + archivo);
    });
  });

  verificar('cada script, hoja, ícono e imagen de las tres páginas está en ARCHIVOS', faltantes.length === 0, faltantes.join(', '));
  verificar('ninguna página carga nada de otro origen (sin red no llegaría)', externos.length === 0, externos.join(', '));

  const inexistentes = ARCHIVOS.filter(function (ruta) { return !fs.existsSync(path.join(RAIZ, ruta)); });
  verificar('todo lo de la lista existe en el proyecto', inexistentes.length === 0, inexistentes.join(', '));

  const textoIgnorar = leer('.vercelignore');
  const patrones = textoIgnorar.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l.charAt(0) !== '#'; });
  const excluidos = ARCHIVOS.filter(function (ruta) {
    const relativa = ruta.slice(1);
    return patrones.some(function (patron) {
      if (patron.charAt(patron.length - 1) === '/') return relativa.indexOf(patron) === 0;
      if (patron.indexOf('*.') === 0) return relativa.endsWith(patron.slice(1));
      return relativa === patron;
    });
  });
  verificar('.vercelignore no deja por fuera nada de la lista: el despliegue fallaría', excluidos.length === 0, excluidos.join(', '));

  console.log('\n=== 2. Manifiesto e instalación ===');

  const manifiesto = JSON.parse(leer('manifest.webmanifest'));
  verificar('se abre como aplicación, sin barra de navegador', manifiesto.display === 'standalone');
  verificar('abre en la raíz y abarca toda la aplicación', manifiesto.start_url === '/' && manifiesto.scope === '/');
  verificar('tiene nombre corto para el ícono', manifiesto.short_name === 'Encuesta APS');

  const dimensiones = function (ruta) {
    const b = fs.readFileSync(path.join(RAIZ, ruta));
    return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), tipoColor: b[25] };
  };
  manifiesto.icons.forEach(function (icono) {
    const lado = parseInt(icono.sizes, 10);
    const d = dimensiones(icono.src);
    verificar('ícono ' + icono.src + ' mide lo que dice (' + icono.sizes + ')', d.ancho === lado && d.alto === lado);
    verificar('ícono ' + icono.src + ' está en la lista del service worker', ARCHIVOS.indexOf(icono.src) !== -1);
  });
  ['192x192', '512x512'].forEach(function (lado) {
    verificar('hay ícono de ' + lado + ', que Chromium exige para instalar',
      manifiesto.icons.some(function (i) { return i.sizes === lado && i.purpose === 'any'; }));
    verificar('hay ícono recortable de ' + lado + ' para Android',
      manifiesto.icons.some(function (i) { return i.sizes === lado && i.purpose === 'maskable'; }));
  });

  const iconoIos = dimensiones('iconos/apple-touch-icon.png');
  verificar('el ícono de iOS mide 180 × 180 y no tiene transparencia',
    iconoIos.ancho === 180 && iconoIos.alto === 180 && iconoIos.tipoColor === 2);

  PAGINAS.forEach(function (pagina) {
    const doc = new JSDOM(leer(pagina)).window.document;
    verificar(pagina + ' enlaza el manifiesto', doc.querySelector('link[rel="manifest"]') !== null);
    verificar(pagina + ' lleva las etiquetas de iOS',
      doc.querySelector('link[rel="apple-touch-icon"]') !== null &&
      doc.querySelector('meta[name="apple-mobile-web-app-title"]') !== null);
    const scripts = Array.from(doc.querySelectorAll('script[src]')).map(function (e) { return e.getAttribute('src'); });
    verificar(pagina + ' carga pwa.js', scripts.indexOf('pwa.js') !== -1);
  });

  const instalar = new JSDOM(leer('instalar.html')).window.document;
  verificar('la guía tiene los pasos de Android y de iOS',
    instalar.querySelector('[data-pasos="android"]') !== null && instalar.querySelector('[data-pasos="ios"]') !== null);

  console.log('\n=== 3. Seguridad de las cabeceras ===');

  const vercel = JSON.parse(leer('vercel.json'));
  const cspVercel = vercel.headers.find(function (h) { return h.source === '/(.*)'; }).headers
    .find(function (h) { return h.key === 'Content-Security-Policy'; }).value;
  verificar('la CSP de producción ya no admite ningún CDN', !/jsdelivr|googleapis|gstatic|unpkg/.test(cspVercel), cspVercel);
  verificar('la CSP de desarrollo tampoco', !/jsdelivr|googleapis|gstatic|unpkg/.test(leer('servidor.js').slice(leer('servidor.js').indexOf('const CABECERAS_SEGURIDAD'), leer('servidor.js').indexOf('EMULACIÓN DEL CONTRATO'))));
  verificar('la API sigue sin caché en producción',
    vercel.headers.find(function (h) { return h.source === '/api/(.*)'; }).headers[0].value === 'no-store');
  verificar('producción y desarrollo resuelven /instalar',
    vercel.rewrites.some(function (r) { return r.source === '/instalar'; }) && /\/instalar/.test(leer('servidor.js')));

  console.log('\n=== 4. Service worker: instalar y servir sin red ===');

  const sitio = sitioDePrueba(ARCHIVOS);
  const sw = montarTrabajador(sitio);
  await sw.disparar('install');
  await sw.disparar('activate');

  const nombre = await sw.nucleoVigente();
  verificar('al instalar queda un núcleo vigente', /^aps-nucleo-/.test(String(nombre)), String(nombre));
  verificar('el núcleo tiene todos los archivos', sw.almacen.get(nombre).entradas.size === ARCHIVOS.length);
  verificar('instalar por primera vez no avisa de versión nueva', sw.mensajes.length === 0);

  sw.estado.red = false;

  const portada = await sw.pedir('/', { mode: 'navigate' });
  verificar('sin red, «/» abre la aplicación', portada.tocada && (await portada.respuesta.text()) === sitio['/index.html']);
  const acceso = await sw.pedir('/login.html?motivo=expirada', { mode: 'navigate' });
  verificar('sin red, el acceso abre aunque traiga parámetros', acceso.tocada && (await acceso.respuesta.text()) === sitio['/login.html']);
  const alias = await sw.pedir('/login', { mode: 'navigate' });
  verificar('sin red, /login también', (await alias.respuesta.text()) === sitio['/login.html']);
  const guia = await sw.pedir('/instalar', { mode: 'navigate' });
  verificar('sin red, /instalar también', (await guia.respuesta.text()) === sitio['/instalar.html']);
  const otra = await sw.pedir('/una/ruta/que/no/existe', { mode: 'navigate' });
  verificar('sin red, cualquier otra dirección abre la aplicación', (await otra.respuesta.text()) === sitio['/index.html']);
  const script = await sw.pedir('/app.js');
  verificar('sin red, los scripts salen del dispositivo', (await script.respuesta.text()) === sitio['/app.js']);

  const guardada = (await sw.pedir('/index.html')).respuesta;
  verificar('la copia conserva la CSP', guardada.headers.get('content-security-policy') === "default-src 'self'");
  verificar('la copia no dice estar comprimida: el cuerpo ya viene descomprimido', guardada.headers.get('content-encoding') === null);
  verificar('la copia no arrastra un largo que ya no es el suyo', guardada.headers.get('content-length') === null);

  sw.estado.red = true;

  /* Un worker no reemplaza a otro con una página a medio cargar. */
  const conSalto = montarTrabajador(sitio, new Map());
  let saltos = 0;
  conSalto.self.skipWaiting = async function () { saltos++; };
  await conSalto.disparar('install');
  verificar('un worker nuevo no toma el control por su cuenta al instalarse', saltos === 0);
  await conSalto.disparar('message', { data: { tipo: 'activar' } });
  verificar('lo toma cuando se toca «Actualizar»', saltos === 1);

  console.log('\n=== 5. Service worker: lo que no debe tocar ===');

  verificar('no toca /api/ al leer', !(await sw.pedir('/api/listar_fichas')).tocada);
  verificar('no toca /api/ al navegar', !(await sw.pedir('/api/sesion', { mode: 'navigate' })).tocada);
  verificar('no toca un POST', !(await sw.pedir('/api/guardar_encuesta', { method: 'POST' })).tocada);
  verificar('no toca otros orígenes', !(await sw.pedir('https://nominatim.openstreetmap.org/search?q=x')).tocada);
  verificar('no toca archivos que no son de la aplicación', !(await sw.pedir('/.env.local')).tocada && !(await sw.pedir('/bd/01_esquema.sql')).tocada);

  const hayApi = Array.from(sw.almacen.values()).some(function (cache) {
    return Array.from(cache.entradas.keys()).some(function (k) { return k.indexOf('/api/') === 0; });
  });
  verificar('ninguna respuesta de la API quedó guardada', !hayApi);

  console.log('\n=== 6. Service worker: versión nueva ===');

  const buscar = function () { return sw.disparar('message', { data: { tipo: 'buscar-actualizacion' } }); };

  await buscar();
  verificar('sin cambios publicados no pasa nada', (await sw.nucleoVigente()) === nombre && sw.mensajes.length === 0);

  sitio['/reglas.js'] = 'reglas de la versión 2';
  await buscar();
  const nombre2 = await sw.nucleoVigente();
  verificar('un cambio en un solo archivo es una versión nueva', nombre2 !== nombre);
  verificar('se avisa a las ventanas abiertas', sw.mensajes.length === 1 && sw.mensajes[0].tipo === 'actualizacion-lista');
  verificar('la versión anterior se borra: queda un solo juego',
    Array.from(sw.almacen.keys()).filter(function (k) { return k.indexOf('aps-nucleo-') === 0; }).length === 1);
  verificar('el archivo nuevo es el que se sirve', (await (await sw.pedir('/reglas.js')).respuesta.text()) === 'reglas de la versión 2');

  /* Un despliegue roto. */
  const reglas2 = sitio['/reglas.js'];
  sitio['/reglas.js'] = 'reglas de la versión 3';
  const appVieja = sitio['/app.js'];
  delete sitio['/app.js'];
  sw.mensajes.length = 0;
  await buscar();
  verificar('con un archivo que falta no se cambia de versión', (await sw.nucleoVigente()) === nombre2);
  verificar('no se avisa de nada', sw.mensajes.length === 0);
  verificar('nada queda a medias: sigue la versión anterior entera',
    (await (await sw.pedir('/reglas.js')).respuesta.text()) === reglas2 &&
    (await (await sw.pedir('/app.js')).respuesta.text()) === appVieja);
  verificar('tampoco queda basura en el almacenamiento',
    Array.from(sw.almacen.keys()).filter(function (k) { return k.indexOf('aps-nucleo-') === 0; }).length === 1);
  sitio['/app.js'] = appVieja;

  /* Sin red. */
  sw.estado.red = false;
  await buscar();
  verificar('sin red no se cambia de versión ni falla nada', (await sw.nucleoVigente()) === nombre2 && sw.mensajes.length === 0);
  sw.estado.red = true;

  /* Corregido el despliegue, llega. */
  const pedidosAntes = sw.pedidos.length;
  await buscar();
  const nombre3 = await sw.nucleoVigente();
  verificar('corregido el despliegue, llega la versión nueva', nombre3 !== nombre2 && sw.pedidos.length > pedidosAntes);

  /* El navegador apaga el worker cuando quiere: al despertar no tiene nada en memoria. */
  const despierto = montarTrabajador(sitio, sw.almacen);
  despierto.estado.red = false;
  verificar('un worker recién despertado sigue sirviendo sin red',
    (await (await despierto.pedir('/', { mode: 'navigate' })).respuesta.text()) === sitio['/index.html']);

  /* Una descarga cortada a mitad de camino deja una caché a medias, y más nueva. */
  const aMedias = new CacheSimulada();
  await aMedias.put('/index.html', new Response('versión a medias'));
  sw.almacen.set('aps-nucleo-a-medias', aMedias);
  const trasCorte = montarTrabajador(sitio, sw.almacen);
  trasCorte.estado.red = false;
  verificar('un juego a medias no se usa aunque sea el más nuevo: sirve el último completo',
    (await (await trasCorte.pedir('/', { mode: 'navigate' })).respuesta.text()) === sitio['/index.html']);
  sw.almacen.delete('aps-nucleo-a-medias');

  /* Red con portal de acceso: contesta 200 con su propia página a todo. */
  sitio['/reglas.js'] = 'reglas de la versión 4';
  sw.estado.portal = true;
  sw.mensajes.length = 0;
  await buscar();
  verificar('una red con portal de acceso no reemplaza la aplicación por su página',
    (await sw.nucleoVigente()) === nombre3 && sw.mensajes.length === 0 &&
    (await (await sw.pedir('/app.js')).respuesta.text()) === sitio['/app.js']);
  sw.estado.portal = false;

  /* «Borrar archivos en caché» desde el navegador. */
  sitio['/reglas.js'] = 'reglas de la versión 3';
  sw.almacen.get(nombre3).entradas.clear();
  await buscar();
  verificar('si borraron la caché, se vuelve a llenar aunque nada haya cambiado',
    (await sw.nucleoVigente()) === nombre3 && sw.almacen.get(nombre3).entradas.size === ARCHIVOS.length);

  console.log('\n=== 7. Verificar la contraseña sin señal ===');

  const CLAVE = 'ClavePrueba2026';
  const local = montarAccesoLocal();
  verificar('una cuenta sin copia no entra, y dice por qué',
    (await local.acceso.verificar('1144099001', CLAVE)).codigo === 'sin_copia');

  await local.acceso.recordar('1144099001', CLAVE, PERFIL);
  const crudo = local.almacen.getItem('aps_acceso_local_1144099001');
  const copia = JSON.parse(crudo);
  verificar('la contraseña no queda en el dispositivo', crudo.indexOf(CLAVE) === -1);
  verificar('se deriva con al menos 600 000 rondas', copia.iteraciones >= 600000);

  const buena = await local.acceso.verificar('1144099001', CLAVE);
  verificar('la contraseña correcta entra y devuelve el perfil', buena.ok === true && buena.perfil.documento === PERFIL.documento);
  const mala = await local.acceso.verificar('1144099001', CLAVE + 'x');
  verificar('una incorrecta no entra', mala.ok === false && mala.codigo === 'clave');
  verificar('otra cuenta no entra con la misma contraseña', (await local.acceso.verificar('1144099002', CLAVE)).ok === false);

  const segundo = montarAccesoLocal();
  await segundo.acceso.recordar('1144099001', CLAVE, PERFIL);
  const otraCopia = JSON.parse(segundo.almacen.getItem('aps_acceso_local_1144099001'));
  verificar('la sal es propia: la misma contraseña da otra derivación', otraCopia.hash !== copia.hash && otraCopia.sal !== copia.sal);

  /* Normalización igual a la del servidor. */
  const tildes = montarAccesoLocal();
  await tildes.acceso.recordar('1144099001', 'Cláve2026segura', PERFIL);
  verificar('«á» compuesta y descompuesta son la misma contraseña, como en el servidor',
    (await tildes.acceso.verificar('1144099001', 'Cláve2026segura')).ok === true);

  /* Cinco fallos seguidos, como en el servidor. */
  const tope = montarAccesoLocal();
  await tope.acceso.recordar('1144099001', CLAVE, PERFIL);
  for (let i = 0; i < 5; i++) await tope.acceso.verificar('1144099001', 'mala' + i);
  const trasFallos = await tope.acceso.verificar('1144099001', CLAVE);
  verificar('tras cinco fallos ni la correcta entra por un rato', trasFallos.ok === false && trasFallos.codigo === 'bloqueada', JSON.stringify(trasFallos));
  const pasada = JSON.parse(tope.almacen.getItem('aps_acceso_local_1144099001'));
  pasada.bloqueadoHasta = Date.now() - 1000;
  tope.almacen.setItem('aps_acceso_local_1144099001', JSON.stringify(pasada));
  verificar('pasada la espera vuelve a entrar', (await tope.acceso.verificar('1144099001', CLAVE)).ok === true);

  /* Vigencia. */
  const vieja = montarAccesoLocal();
  await vieja.acceso.recordar('1144099001', CLAVE, PERFIL);
  const vencida = JSON.parse(vieja.almacen.getItem('aps_acceso_local_1144099001'));
  vencida.confirmadoEn = Date.now() - 8 * 24 * 60 * 60 * 1000;
  vieja.almacen.setItem('aps_acceso_local_1144099001', JSON.stringify(vencida));
  verificar('tras una semana sin confirmar con el servidor no entra', (await vieja.acceso.verificar('1144099001', CLAVE)).codigo === 'vencida');
  vieja.acceso.confirmar('1144099001', PERFIL);
  verificar('al confirmar con el servidor vuelve a valer', (await vieja.acceso.verificar('1144099001', CLAVE)).ok === true);
  vieja.acceso.olvidar('1144099001');
  verificar('olvidar borra la copia', vieja.almacen.getItem('aps_acceso_local_1144099001') === null);

  /* De quién es la sesión del dispositivo. */
  const dos = montarAccesoLocal();
  const OTRO = Object.assign({}, PERFIL, { id: 8, documento: '1144099002' });
  await dos.acceso.recordar('1144099002', 'OtraClave2026', OTRO);
  await dos.acceso.recordar('1144099001', CLAVE, PERFIL);
  verificar('dice el nombre de quien ya entró en este equipo', dos.acceso.nombreDe('1144099002') === OTRO.nombre);
  verificar('y de quien no, nada', dos.acceso.nombreDe('1144000000') === null);
  verificar('sin señal, el dueño de la sesión entra', (await dos.acceso.verificar('1144099001', CLAVE)).ok === true);
  const intruso = await dos.acceso.verificar('1144099002', 'OtraClave2026');
  verificar('sin señal, otra persona no entra aunque su contraseña sea correcta: firmaría como el dueño de la cookie',
    intruso.ok === false && intruso.codigo === 'otra_sesion', JSON.stringify(intruso));
  dos.acceso.olvidarSesion();
  verificar('sin sesión viva en el dispositivo, sí entra', (await dos.acceso.verificar('1144099002', 'OtraClave2026')).ok === true);

  dos.acceso.anotarSesion('1144099001');
  dos.acceso.anotarCierrePendiente();
  verificar('un cierre hecho sin señal queda anotado', dos.acceso.hayCierrePendiente() === true);
  verificar('tampoco deja entrar a otro mientras tanto', (await dos.acceso.verificar('1144099002', 'OtraClave2026')).codigo === 'otra_sesion');
  await dos.acceso.verificar('1144099001', CLAVE);
  verificar('si su dueño vuelve a entrar, ya no hay nada que cerrar', dos.acceso.hayCierrePendiente() === false);
  dos.acceso.anotarCierrePendiente();
  await dos.acceso.recordar('1144099002', 'OtraClave2026', OTRO);
  verificar('un ingreso con señal reemplaza la sesión: tampoco', dos.acceso.hayCierrePendiente() === false);
  verificar('y la sesión pasa a ser del nuevo', (await dos.acceso.verificar('1144099002', 'OtraClave2026')).ok === true);

  const corrupta = montarAccesoLocal();
  corrupta.almacen.setItem('aps_acceso_local_1144099001', '{no es json');
  verificar('una copia dañada no revienta: es como no tenerla',
    (await corrupta.acceso.verificar('1144099001', CLAVE)).codigo === 'sin_copia');

  console.log('\n=== 8. El bloqueo sobrevive a cerrar la aplicación ===');

  const ABIERTA = { aps_ultima_actividad: String(Date.now() - 60 * 1000) };
  const VENCIDA = { aps_ultima_actividad: String(Date.now() - 21 * 60 * 1000) };
  const resultadoOk = function (clave) {
    return clave === CLAVE ? { ok: true, perfil: PERFIL } : { ok: false, codigo: 'clave', mensaje: 'Documento o contraseña incorrectos.' };
  };

  let s = await montarSesion({ almacen: ABIERTA, acceso: accesoLocalSimulado(resultadoOk) });
  verificar('abierta hace un minuto: entra sin pedir nada', !s.bloqueada());

  s = await montarSesion({ acceso: accesoLocalSimulado(resultadoOk) });
  verificar('sin marca de actividad (ingreso recién hecho): entra', !s.bloqueada());

  s = await montarSesion({ almacen: VENCIDA, acceso: accesoLocalSimulado(resultadoOk) });
  verificar('abierta tras 21 minutos: abre bloqueada', s.bloqueada());
  verificar('lo de atrás no se pinta', s.v.document.documentElement.classList.contains('pantalla-bloqueada'));

  s = await montarSesion({ almacen: { aps_pantalla_bloqueada: 'si', aps_ultima_actividad: String(Date.now()) }, acceso: accesoLocalSimulado(resultadoOk) });
  verificar('la dejó bloqueada y la reabre: sigue bloqueada', s.bloqueada());

  s = await montarSesion({ almacen: ABIERTA, acceso: accesoLocalSimulado(resultadoOk) });
  s.v.SESION.bloquear();
  verificar('bloquear queda anotado en el dispositivo', s.v.localStorage.getItem('aps_pantalla_bloqueada') === 'si');
  verificar('el velo tapa lo de atrás', s.v.document.documentElement.classList.contains('pantalla-bloqueada'));

  console.log('\n=== 9. Desbloquear con y sin señal ===');

  /* Sin red: en el dispositivo, sin tocar el servidor. */
  let acc = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({ almacen: VENCIDA, enLinea: false, acceso: acc });
  const pedidosIniciales = s.pedidos.length;
  await s.responderVelo('mala');
  verificar('sin red, una contraseña mala no desbloquea y dice por qué', s.bloqueada() && /incorrect/.test(s.errorVelo()), s.errorVelo());
  verificar('sin red no se le pregunta al servidor', !s.pedidos.slice(pedidosIniciales).some(function (p) { return p.ruta === '/api/iniciar_sesion'; }));
  await s.responderVelo(CLAVE);
  verificar('sin red, la correcta desbloquea', !s.bloqueada());
  verificar('al desbloquear se retira la marca', s.v.localStorage.getItem('aps_pantalla_bloqueada') === null);
  verificar('y se destapa lo de atrás', !s.v.document.documentElement.classList.contains('pantalla-bloqueada'));

  /* Con señal manda el servidor. */
  acc = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({
    almacen: VENCIDA,
    acceso: acc,
    servidor: function (ruta, conf) {
      if (ruta !== '/api/iniciar_sesion') return new Promise(function () {});
      const cuerpo = JSON.parse(conf.body);
      return cuerpo.clave === CLAVE
        ? respuestaJson(200, { usuario: PERFIL })
        : respuestaJson(401, { error: 'Documento o contraseña incorrectos.', codigo: 'credenciales' });
    }
  });
  await s.responderVelo('mala');
  verificar('con señal, una contraseña mala no desbloquea', s.bloqueada());
  verificar('y no saca de la aplicación: escribirla mal no es perder la sesión', !s.fuera());
  verificar('el servidor decidió, no la copia', acc.llamadas.verificar.length === 0);
  verificar('el error es el del servidor', /incorrect/.test(s.errorVelo()), s.errorVelo());
  verificar('la petición lleva la marca anti-CSRF', (s.pedidos.find(function (p) { return p.ruta === '/api/iniciar_sesion'; }).conf.headers || {})['X-Requested-With'] === 'fetch');
  await s.responderVelo(CLAVE);
  verificar('con señal, la correcta desbloquea', !s.bloqueada());
  verificar('y deja lista la verificación sin señal', acc.llamadas.recordar.length === 1 && acc.llamadas.recordar[0][1] === CLAVE);

  /* Sin respuesta: red caída o servidor caído. */
  acc = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({
    almacen: VENCIDA,
    acceso: acc,
    servidor: function (ruta) {
      return ruta === '/api/iniciar_sesion' ? Promise.reject(new TypeError('Failed to fetch')) : new Promise(function () {});
    }
  });
  await s.responderVelo(CLAVE);
  verificar('si la petición falla, se verifica en el dispositivo', !s.bloqueada() && acc.llamadas.verificar.length === 1);

  acc = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({
    almacen: VENCIDA,
    acceso: acc,
    servidor: function (ruta) {
      return ruta === '/api/iniciar_sesion' ? respuestaJson(503, { error: 'caído' }) : new Promise(function () {});
    }
  });
  await s.responderVelo(CLAVE);
  verificar('con el servidor caído, también', !s.bloqueada() && acc.llamadas.verificar.length === 1);

  /* Señal débil: el servidor no contesta nunca. */
  acc = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({
    almacen: VENCIDA,
    acceso: acc,
    servidor: function (ruta, conf) {
      if (ruta !== '/api/iniciar_sesion') return new Promise(function () {});
      return new Promise(function (resolver, rechazar) {
        conf.signal.addEventListener('abort', function () { rechazar(conf.signal.reason); });
      });
    }
  });
  s.v.document.querySelector('#bloqueoSesion input[name="clave"]').value = CLAVE;
  s.v.document.querySelector('#bloqueoSesion form').dispatchEvent(new s.v.Event('submit', { cancelable: true, bubbles: true }));
  await esperar(10);
  verificar('mientras no contesta sigue bloqueada', s.bloqueada());
  const limite = s.temporizadores.find(function (t) { return t.ms === 10000; });
  verificar('hay un tope de 10 segundos', Boolean(limite));
  limite.funcion();
  await esperar(30);
  verificar('pasado el tope se verifica en el dispositivo', !s.bloqueada() && acc.llamadas.verificar.length === 1);

  /* Sigue la regla de la API. */
  s = await montarSesion({
    almacen: ABIERTA,
    acceso: accesoLocalSimulado(resultadoOk),
    servidor: function (ruta) { return ruta === '/api/sesion' ? respuestaJson(401, { codigo: 'sin_sesion' }) : new Promise(function () {}); }
  });
  await esperar(20);
  verificar('un 401 de la API sigue cerrando la sesión', s.fuera());
  verificar('y borra el perfil', s.v.localStorage.getItem('aps_sesion_usuario') === null);

  let confirmada = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({
    almacen: ABIERTA,
    acceso: confirmada,
    servidor: function (ruta) { return ruta === '/api/sesion' ? respuestaJson(200, { usuario: PERFIL }) : new Promise(function () {}); }
  });
  await esperar(20);
  verificar('si el servidor confirma la sesión, corre la vigencia de la copia', confirmada.llamadas.confirmar.length === 1);

  /* Cerrar sesión. */
  acc = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({
    almacen: ABIERTA,
    acceso: acc,
    servidor: function (ruta) { return ruta === '/api/cerrar_sesion' ? respuestaJson(200, { ok: true }) : new Promise(function () {}); }
  });
  s.v.SESION.cerrar();
  await esperar(20);
  verificar('cerrar sesión con señal olvida la sesión del dispositivo', acc.llamadas.olvidarSesion === 1 && acc.llamadas.cierrePendiente === 0);
  verificar('y sale', s.fuera());

  acc = accesoLocalSimulado(resultadoOk);
  s = await montarSesion({
    almacen: ABIERTA,
    acceso: acc,
    enLinea: false,
    servidor: function () { return Promise.reject(new TypeError('Failed to fetch')); }
  });
  s.v.SESION.cerrar();
  await esperar(20);
  verificar('cerrar sesión sin señal deja anotado que falta avisarle al servidor', acc.llamadas.cierrePendiente === 1 && acc.llamadas.olvidarSesion === 0);
  verificar('y sale igual', s.fuera());

  /* La sesión de otra persona. */
  acc = accesoLocalSimulado(resultadoOk);
  let cerradas = 0;
  s = await montarSesion({
    almacen: ABIERTA,
    acceso: acc,
    servidor: function (ruta) {
      if (ruta === '/api/cerrar_sesion') { cerradas++; return respuestaJson(200, { ok: true }); }
      return ruta === '/api/sesion'
        ? respuestaJson(200, { usuario: Object.assign({}, PERFIL, { documento: '9999999' }) })
        : new Promise(function () {});
    }
  });
  await esperar(30);
  verificar('si la cookie es de otra persona no se adopta su identidad: se cierra y se pide entrar',
    cerradas === 1 && s.fuera() && acc.llamadas.confirmar.length === 0);

  /* El foco automático del acceso no le quita el campo a quien ya está escribiendo. */
  const accesoEscribiendo = montarAcceso({
    acceso: accesoLocalSimulado(resultadoOk),
    servidor: function (ruta) { return ruta === '/api/sesion' ? respuestaJson(401, {}) : new Promise(function () {}); }
  });
  await esperar(10);
  const campoClave = accesoEscribiendo.v.document.getElementById('clave');
  campoClave.focus();
  await esperar(90);
  verificar('en el acceso, el foco automático no se lleva lo que se está tecleando',
    accesoEscribiendo.v.document.activeElement === campoClave,
    accesoEscribiendo.v.document.activeElement && accesoEscribiendo.v.document.activeElement.id);

  console.log('\n=== 10. Señal débil: las peticiones tienen tope ===');

  s = await montarSesion({
    almacen: ABIERTA,
    acceso: accesoLocalSimulado(resultadoOk),
    servidor: function (ruta, conf) {
      if (ruta !== '/api/guardar_encuesta') return new Promise(function () {});
      return new Promise(function (resolver, rechazar) {
        conf.signal.addEventListener('abort', function () { rechazar(conf.signal.reason); });
      });
    }
  });
  let error = null;
  const guardando = s.v.fetch('/api/guardar_encuesta', { method: 'POST' }).catch(function (e) { error = e; });
  const limiteGuardar = s.temporizadores.find(function (t) { return t.ms === 45000; });
  verificar('guardar una ficha espera hasta 45 segundos', Boolean(limiteGuardar));
  limiteGuardar.funcion();
  await guardando;
  verificar('y luego falla como una caída de red: la ficha pasa a la cola', error !== null);
  verificar('sin confundirse con una cancelación, que el buscador de CUPS calla', error && error.name === 'TimeoutError', error && error.name);

  s = await montarSesion({ almacen: ABIERTA, acceso: accesoLocalSimulado(resultadoOk) });
  const cuantosAntes = s.temporizadores.length;
  s.v.fetch('/api/reporte_sispro', { method: 'POST' });
  verificar('los reportes, que tardan, no llevan tope', s.temporizadores.length === cuantosAntes);

  /* Se conserva la cancelación propia del buscador. */
  const canceladora = new AbortController();
  let canceladaEn = null;
  s = await montarSesion({
    almacen: ABIERTA,
    acceso: accesoLocalSimulado(resultadoOk),
    servidor: function (ruta, conf) {
      if (ruta !== '/api/buscar_cups') return new Promise(function () {});
      return new Promise(function (resolver, rechazar) {
        conf.signal.addEventListener('abort', function () { canceladaEn = conf.signal.reason; rechazar(conf.signal.reason); });
      });
    }
  });
  const busqueda = s.v.fetch('/api/buscar_cups?q=87', { signal: canceladora.signal }).catch(function () {});
  canceladora.abort();
  await busqueda;
  verificar('la cancelación del buscador de CUPS sigue funcionando', canceladaEn !== null && canceladaEn.name === 'AbortError', canceladaEn && canceladaEn.name);

  console.log('\n=== 11. El acceso: con señal manda el servidor ===');

  const accesoSinFallo = function () { return accesoLocalSimulado(resultadoOk); };
  const sinSesion = function (ruta) { return ruta === '/api/sesion' ? respuestaJson(401, {}) : null; };

  acc = accesoSinFallo();
  let l = montarAcceso({
    acceso: acc,
    almacen: { aps_ultima_actividad: '1', aps_pantalla_bloqueada: 'si' },
    servidor: function (ruta) { return sinSesion(ruta) || respuestaJson(200, { usuario: PERFIL }); }
  });
  await l.ingresar(PERFIL.documento, CLAVE);
  verificar('con señal entra', l.entro());
  verificar('y deja lista la verificación sin señal', acc.llamadas.recordar.length === 1 && acc.llamadas.recordar[0][1] === CLAVE);
  verificar('no le pregunta a la copia', acc.llamadas.verificar.length === 0);
  verificar('un ingreso nuevo no hereda el bloqueo anterior',
    l.v.localStorage.getItem('aps_ultima_actividad') === null && l.v.localStorage.getItem('aps_pantalla_bloqueada') === null);

  acc = accesoSinFallo();
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) { return sinSesion(ruta) || respuestaJson(401, { error: 'Documento o contraseña incorrectos.', codigo: 'credenciales' }); }
  });
  await l.ingresar(PERFIL.documento, CLAVE);
  verificar('si el servidor dice que no, es que no: la copia no se consulta', !l.entro() && acc.llamadas.verificar.length === 0);

  acc = accesoSinFallo();
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) { return sinSesion(ruta) || respuestaJson(403, { error: 'Su cuenta está desactivada.', codigo: 'inactivo' }); }
  });
  await l.ingresar(PERFIL.documento, CLAVE);
  verificar('una cuenta desactivada pierde también la copia del dispositivo', acc.llamadas.olvidar.length === 1 && !l.entro());

  acc = accesoSinFallo();
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) { return sinSesion(ruta) || respuestaJson(200, { usuario: Object.assign({}, PERFIL, { debeCambiarClave: true, nombre: 'Prueba' }) }); }
  });
  await l.ingresar(PERFIL.documento, 'Temporal2026');
  verificar('una contraseña temporal no se recuerda', acc.llamadas.recordar.length === 0 && !l.entro());

  console.log('\n=== 12. El acceso: sin señal, la copia del dispositivo ===');

  acc = accesoSinFallo();
  l = montarAcceso({
    enLinea: false,
    acceso: acc,
    servidor: function () { return Promise.reject(new TypeError('Failed to fetch')); }
  });
  await l.ingresar(PERFIL.documento, 'mala');
  verificar('sin señal, una contraseña mala no entra', !l.entro() && /incorrect/.test(l.error()), l.error());
  verificar('no se intentó el servidor para iniciar sesión', !l.pedidos.some(function (p) { return p.ruta === '/api/iniciar_sesion'; }));
  await l.ingresar(PERFIL.documento, CLAVE);
  verificar('sin señal, la correcta entra', l.entro());
  verificar('entrar sin señal no cuenta como confirmación del servidor', acc.llamadas.confirmar.length === 0);

  acc = accesoSinFallo();
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) { return ruta === '/api/sesion' ? respuestaJson(401, {}) : Promise.reject(new TypeError('Failed to fetch')); }
  });
  await l.ingresar(PERFIL.documento, CLAVE);
  verificar('cae la señal justo al ingresar: entra con la copia', l.entro() && acc.llamadas.verificar.length === 1);

  acc = accesoSinFallo();
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) { return sinSesion(ruta) || respuestaJson(500, { error: 'caído' }); }
  });
  await l.ingresar(PERFIL.documento, CLAVE);
  verificar('servidor caído: entra con la copia', l.entro() && acc.llamadas.verificar.length === 1);

  acc = accesoLocalSimulado(function () { return { ok: false, codigo: 'sin_copia', mensaje: 'Sin conexión. Este equipo todavía no puede verificar esa cuenta.' }; });
  l = montarAcceso({
    enLinea: false,
    acceso: acc,
    servidor: function () { return Promise.reject(new TypeError('Failed to fetch')); }
  });
  await l.ingresar(PERFIL.documento, CLAVE);
  verificar('sin copia no entra, y lo explica', !l.entro() && /todavía no puede verificar/.test(l.error()), l.error());

  acc = accesoSinFallo();
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) { return ruta === '/api/sesion' ? respuestaJson(200, { usuario: PERFIL }) : new Promise(function () {}); }
  });
  await esperar(30);
  verificar('con sesión viva al abrir el acceso, entra y corre la vigencia', l.entro() && acc.llamadas.confirmar.length === 1);

  /* Un cierre de sesión pendiente. */
  acc = accesoLocalSimulado(resultadoOk, { cierrePendiente: true });
  let preguntoSesion = false;
  let cerroSesion = false;
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) {
      if (ruta === '/api/sesion') { preguntoSesion = true; return respuestaJson(200, { usuario: PERFIL }); }
      if (ruta === '/api/cerrar_sesion') { cerroSesion = true; return respuestaJson(200, { ok: true }); }
      return new Promise(function () {});
    }
  });
  await esperar(30);
  verificar('con un cierre pendiente no se entra de largo con la cookie vieja', !preguntoSesion && !l.entro());
  verificar('primero se cierra en el servidor', cerroSesion && acc.llamadas.olvidarSesion === 1);

  acc = accesoLocalSimulado(resultadoOk);
  l = montarAcceso({
    acceso: acc,
    servidor: function (ruta) { return ruta === '/api/sesion' ? respuestaJson(401, {}) : new Promise(function () {}); }
  });
  await esperar(30);
  verificar('si el servidor dice que no hay sesión, se olvida la del dispositivo', acc.llamadas.olvidarSesion === 1);

  console.log('\n=== 13. Dispositivo sin espacio: lo que no ha subido nunca se suelta ===');

  /* Las funciones reales de app.js y captura_local.js, con un almacén de cupo fijo. */
  function trozo(archivo, desde, hasta) {
    const texto = leer(archivo).replace(/\r\n/g, '\n');
    const a = texto.indexOf(desde);
    const b = texto.indexOf(hasta, a);
    if (a === -1 || b === -1) throw new Error('No se encontró ' + desde + ' en ' + archivo);
    return texto.slice(a, b);
  }

  function montarCola(cupo, fichas) {
    const datos = new Map();
    const usado = function () {
      let n = 0;
      datos.forEach(function (v, k) { n += k.length + v.length; });
      return n;
    };
    const almacen = {
      getItem: function (k) { return datos.has(k) ? datos.get(k) : null; },
      setItem: function (k, v) {
        const sin = usado() - (datos.has(k) ? k.length + datos.get(k).length : 0);
        if (sin + k.length + String(v).length > cupo) {
          const error = new Error('cupo');
          error.name = 'QuotaExceededError';
          throw error;
        }
        datos.set(k, String(v));
      },
      removeItem: function (k) { datos.delete(k); }
    };
    if (fichas) datos.set('aps_encuestas', JSON.stringify(fichas));
    const contexto = { localStorage: almacen, console: { warn: function () {}, error: function () {} } };
    vm.runInNewContext(
      "const STORAGE_KEY = 'aps_encuestas';\n" +
      trozo('app.js', 'function documentoDeLaSesion()', '/**\n * Sustituye una ficha') +
      trozo('captura_local.js', 'function escribirLocal', 'function borrarLocal') +
      'this.api = { obtenerEncuestas, agregarEncuesta, guardarEncuestas, escribirLocal };',
      contexto
    );
    return { api: contexto.api, datos: datos };
  }

  const fichaDe = function (codigo, subida) {
    return { id: codigo, codigoFicha: codigo, sincronizada: subida, relleno: 'x'.repeat(900) };
  };
  const codigos = function (lista) { return Array.from(lista).map(function (f) { return f.codigoFicha; }); };

  /* De la más reciente a la más antigua, como las deja agregarEncuesta. */
  let cola = montarCola(5500, [fichaDe('P2', false), fichaDe('S2', true), fichaDe('P1', false), fichaDe('S1', true)]);
  cola.api.agregarEncuesta(fichaDe('P3', false));
  verificar('con espacio no se suelta nada', codigos(cola.api.obtenerEncuestas()).length === 5);

  cola.api.agregarEncuesta(fichaDe('P4', false));
  verificar('sin espacio se suelta la copia ya subida más antigua, y la ficha nueva queda',
    codigos(cola.api.obtenerEncuestas()).join() === 'P4,P3,P2,S2,P1', codigos(cola.api.obtenerEncuestas()).join());

  cola = montarCola(3000, [fichaDe('P2', false), fichaDe('S2', true), fichaDe('P1', false)]);
  cola.api.agregarEncuesta(fichaDe('P3', false));
  verificar('se suelta lo necesario y nada más', codigos(cola.api.obtenerEncuestas()).join() === 'P3,P2,P1', codigos(cola.api.obtenerEncuestas()).join());

  cola = montarCola(2500, [fichaDe('P2', false), fichaDe('P1', false)]);
  let lanzo = false;
  try { cola.api.agregarEncuesta(fichaDe('P3', false)); } catch (error) { lanzo = error.name === 'QuotaExceededError'; }
  verificar('si todo son pendientes no se suelta ninguna, y falla para que se avise', lanzo);
  verificar('las pendientes siguen intactas', codigos(cola.api.obtenerEncuestas()).join() === 'P2,P1');

  cola = montarCola(2500, [fichaDe('P1', false), fichaDe('S1', true)]);
  verificar('la ficha en curso le gana a una copia ya subida', cola.api.escribirLocal('aps_borrador_7', 'y'.repeat(1200)) === true);
  verificar('la copia subida fue la que salió', codigos(cola.api.obtenerEncuestas()).join() === 'P1');

  cola = montarCola(1500, [fichaDe('P1', false)]);
  verificar('si no hay qué soltar, el borrador dice que no pudo', cola.api.escribirLocal('aps_borrador_7', 'y'.repeat(1200)) === false);
  verificar('sin tocar la pendiente', codigos(cola.api.obtenerEncuestas()).join() === 'P1');

  console.log('\n=== 14. Otra pestaña cambió de usuario ===');

  /* La cookie y el perfil guardado son de todo el navegador: esta pestaña seguiría
     mostrando las fichas de quien ya no está, y las subiría con la sesión nueva. */
  const avisarDeOtraPestana = function (pestana, clave) {
    pestana.v.dispatchEvent(new pestana.v.StorageEvent('storage', { key: clave }));
  };
  const OTRA_CUENTA = JSON.stringify(Object.assign({}, PERFIL, { id: 8, documento: '1144099002' }));

  let pestana = await montarSesion({ acceso: accesoSinFallo() });
  avisarDeOtraPestana(pestana, 'aps_ultima_actividad');
  verificar('un cambio en otra clave no la saca', !pestana.fuera());
  pestana.v.localStorage.setItem('aps_sesion_usuario', JSON.stringify(Object.assign({}, PERFIL, { nombre: 'Prueba al día' })));
  avisarDeOtraPestana(pestana, 'aps_sesion_usuario');
  verificar('la misma persona entrando en otra pestaña no la saca', !pestana.fuera());
  pestana.v.localStorage.setItem('aps_sesion_usuario', OTRA_CUENTA);
  avisarDeOtraPestana(pestana, 'aps_sesion_usuario');
  verificar('si entró otra persona, vuelve al acceso', pestana.fuera());

  pestana = await montarSesion({ acceso: accesoSinFallo() });
  pestana.v.localStorage.removeItem('aps_sesion_usuario');
  avisarDeOtraPestana(pestana, 'aps_sesion_usuario');
  verificar('si cerraron la sesión en otra pestaña, también', pestana.fuera());

  pestana = await montarSesion({ acceso: accesoSinFallo() });
  pestana.v.localStorage.clear();
  avisarDeOtraPestana(pestana, null);
  verificar('si borraron el almacenamiento, también', pestana.fuera());

  /* Volver de la memoria del navegador no dispara `storage`: lo que cambió mientras
     tanto se revisa al mostrarse. */
  pestana = await montarSesion({ acceso: accesoSinFallo() });
  verificar('abrir normalmente no la saca', !pestana.fuera());
  pestana.v.localStorage.setItem('aps_sesion_usuario', OTRA_CUENTA);
  pestana.v.dispatchEvent(new pestana.v.Event('pageshow'));
  verificar('una pestaña que vuelve de la memoria del navegador no sigue con la sesión de antes', pestana.fuera());

  pestana = await montarSesion({ acceso: accesoSinFallo() });
  pestana.v.localStorage.setItem('aps_sesion_usuario', OTRA_CUENTA);
  pestana.v.document.dispatchEvent(new pestana.v.Event('visibilitychange'));
  verificar('una pestaña que vuelve a primer plano, tampoco', pestana.fuera());

  console.log('\n=== 15. Las fichas sin subir, antes de ingresar ===');

  const sinContestar = function () { return new Promise(function () {}); };
  const fichasEnElEquipo = function (lista) { return { aps_encuestas: JSON.stringify(lista) }; };
  const FICHAS_DE_DOS = [
    { id: 'a', codigoFicha: 'COD-A', sincronizada: false, capturadaPor: '1144099001', cabezaFamilia: 'Nombre De Familia' },
    { id: 'b', codigoFicha: 'COD-B', responsableNumeroId: '1144099002' },
    { id: 'c', codigoFicha: 'COD-C', sincronizada: true, capturadaPor: '1144099001' }
  ];
  const avisoDelAcceso = function (lista) {
    const acceso = montarAcceso({ acceso: accesoSinFallo(), conPwa: true, servidor: sinContestar, almacen: lista });
    return { acceso: acceso, nodo: acceso.v.document.getElementById('avisoPendientes') };
  };

  let enAcceso = avisoDelAcceso(fichasEnElEquipo(FICHAS_DE_DOS));
  verificar('el acceso cuenta las pendientes de todas las personas, no lo ya subido',
    !enAcceso.nodo.hidden && /hay 2 fichas sin subir/.test(enAcceso.nodo.textContent), enAcceso.nodo.textContent);
  verificar('  sólo la cantidad: ni documentos, ni códigos, ni nombres',
    !/1144099|COD-|Nombre/.test(enAcceso.nodo.textContent), enAcceso.nodo.textContent);
  verificar('  y es lo mismo que cuenta la guía de instalación', enAcceso.acceso.v.PWA.fichasSinSubir() === 2);

  enAcceso = avisoDelAcceso(fichasEnElEquipo([FICHAS_DE_DOS[0]]));
  verificar('  en singular si es una', /hay 1 ficha sin subir\. Sólo quien la capturó puede subirla/.test(enAcceso.nodo.textContent), enAcceso.nodo.textContent);

  enAcceso = avisoDelAcceso(fichasEnElEquipo([FICHAS_DE_DOS[2]]));
  verificar('sin pendientes no dice nada', enAcceso.nodo.hidden && enAcceso.nodo.textContent === '');

  enAcceso = avisoDelAcceso({ aps_encuestas: '{no es JSON' });
  verificar('una lista ilegible no impide entrar', enAcceso.nodo.hidden && enAcceso.acceso.v.PWA.fichasSinSubir() === 0);

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  if (fallidas > 0) process.exit(1);
  /* jsdom deja temporizadores vivos (el intervalo de inactividad). */
  process.exit(0);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
