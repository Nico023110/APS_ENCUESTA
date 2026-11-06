/* =========================================================================
   Encuesta_APS — Service worker: la aplicación abre sin señal
   -------------------------------------------------------------------------
   Guarda en el dispositivo los archivos de la aplicación (el «núcleo») y los
   sirve desde ahí, con o sin red. Es lo que hace posible abrirla en terreno.

   QUÉ NO HACE, A PROPÓSITO

   - No toca /api/. Esas peticiones pasan directo a la red, con su cookie y su
     cabecera anti-CSRF, y si no hay red fallan como siempre: la aplicación ya
     sabe qué hacer. Un dato de salud nunca entra en esta caché.
   - No toca las fichas. Están en localStorage, que un cambio de versión no
     borra.
   - No sincroniza. La sincronización sigue siendo la de «Sincronizar ahora».

   LO ÚNICO QUE GUARDA EN MEMORIA

   La llave de las fichas vive sólo en la memoria de la página, y el acceso y la
   aplicación son dos páginas. Este worker sobrevive a esa navegación: guarda la
   llave unos segundos, en una variable, y se la da una sola vez a la primera que la
   pida (boveda.js). Nunca va a la caché ni al disco.

   CÓMO SE ACTUALIZA

   Lo habitual es poner un número de versión en este archivo y subirlo con cada
   despliegue. Aquí no hay paso de compilación que lo haga, y un olvido dejaría
   a todo el personal de campo con la versión vieja sin que nadie lo note. Por
   eso la versión es el contenido: al abrir la aplicación con red se piden los
   archivos con validación contra el servidor (un 304 no baja nada), se saca una
   huella de todos juntos y, si cambió, se guarda el juego completo en una caché
   nueva, con esa huella por nombre, y se borra la anterior. Vale el último juego
   completo: nunca queda una mezcla de archivos viejos y nuevos, y si la descarga
   se corta no cambia nada.

   La página que ya está abierta sigue con su versión; se le avisa y aplica la
   nueva al volver a abrirse (ver pwa.js). Así nada recarga la pantalla en mitad
   de una visita.

   SI ESTE ARCHIVO ALGUNA VEZ DEJA LA APLICACIÓN MAL

   El navegador lo revisa en cada apertura con red. Para retirarlo basta con
   publicar en su lugar uno que borre las cachés y se dé de baja:
     self.addEventListener('install', function () { self.skipWaiting(); });
     self.addEventListener('activate', function (e) {
       e.waitUntil(caches.keys()
         .then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); })
         .then(function () { return self.registration.unregister(); }));
     });
   Las fichas no se pierden: viven en localStorage, no aquí.
   ========================================================================= */

'use strict';

/* Todo lo que index.html, login.html e instalar.html cargan. Si se agrega un
   script o una hoja a esas páginas y no se pone aquí, la aplicación deja de
   abrir sin red: pruebas/pwa.test.js falla si falta alguno. */
const ARCHIVOS = [
  '/index.html',
  '/login.html',
  '/instalar.html',
  '/manifest.webmanifest',
  '/styles.css',
  '/logo-ladera.png',

  '/pwa.js',
  '/acceso_local.js',
  '/boveda.js',
  '/sesion.js',
  '/login.js',
  '/instalar.js',
  '/catalogos_sispro.js',
  '/catalogos.js',
  '/anexo.js',
  '/direccion.js',
  '/geocodificacion.js',
  '/reglas.js',
  '/formulario.js',
  '/cups.js',
  '/buscador_lista.js',
  '/ocupacion.js',
  '/barrios.js',
  '/correccion.js',
  '/captura_local.js',
  '/guia_campos.js',
  '/app.js',
  '/roles.js',
  '/usuarios.js',
  '/reporte.js',
  '/productividad.js',
  '/tableros.js',

  '/iconos/apple-touch-icon.png',
  '/iconos/icono-192.png',
  '/iconos/icono-512.png',
  '/iconos/icono-maskable-192.png',
  '/iconos/icono-maskable-512.png',

  '/vendor/fuentes/fuentes.css',
  '/vendor/fuentes/plus-jakarta-sans-latin.woff2',
  '/vendor/fuentes/plus-jakarta-sans-latin-ext.woff2',
  '/vendor/fuentes/jetbrains-mono-latin.woff2',
  '/vendor/fuentes/jetbrains-mono-latin-ext.woff2',
  '/vendor/phosphor/style.css',
  '/vendor/phosphor/Phosphor.woff2',
  '/vendor/sweetalert2/sweetalert2.all.min.js',
  '/vendor/noble-ciphers/xchacha20poly1305.js'
];

/* Direcciones que el servidor resuelve a un archivo (vercel.json, servidor.js). */
const ALIAS = {
  '/': '/index.html',
  '/login': '/login.html',
  '/login/': '/login.html',
  '/instalar': '/instalar.html',
  '/instalar/': '/instalar.html'
};

const PREFIJO_NUCLEO = 'aps-nucleo-';
const LIMITE_DESCARGA_MS = 2 * 60 * 1000;

/* Lo que se guarda no es la respuesta de la red tal cual: el cuerpo ya viene
   descomprimido, y si la copia conservara estas cabeceras el navegador podría
   intentar descomprimirla otra vez. Las demás —entre ellas la CSP— se conservan:
   la página abierta sin red queda bajo la misma política que con red. */
const CABECERAS_QUE_NO_SE_GUARDAN = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];

/* El nombre del núcleo vigente. Es sólo una comodidad: el navegador apaga este
   worker cuando quiere, y al despertar se vuelve a buscar. */
let vigente = null;
let busquedaEnCurso = null;

/* La llave de camino del acceso a la aplicación (ver arriba). Lo normal es que no
   pase de unas decenas de milisegundos: esto sólo cubre una página que no llegó. */
const VIGENCIA_ENTREGA_MS = 10 * 1000;
let llaveEnTransito = null;

/* ---------------------------------------------------------
   1. EL NÚCLEO: DESCARGAR, GUARDAR, PASAR A LA VERSIÓN NUEVA
   --------------------------------------------------------- */

function aHexadecimal(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
    return byte.toString(16).padStart(2, '0');
  }).join('');
}

function digerir(datos) {
  return crypto.subtle.digest('SHA-256', datos).then(aHexadecimal);
}

/* Una red con portal de acceso o un proxy pueden contestar 200 con su propia página
   a cualquier dirección. Guardarla como si fuera la aplicación la dejaría sin abrir
   hasta la siguiente versión. */
function comprobarQueEsDeLaAplicacion(ruta, respuesta) {
  if (respuesta.url && new URL(respuesta.url).origin !== self.location.origin) {
    throw new Error(ruta + ' llegó de otro origen: ' + respuesta.url);
  }
  const tipo = respuesta.headers.get('content-type') || '';
  if (ruta.slice(-5) !== '.html' && /text\/html/i.test(tipo)) {
    throw new Error(ruta + ' llegó como una página HTML');
  }
}

/**
 * Baja todos los archivos. Si uno solo falla, falla todo: un juego incompleto
 * no sirve para abrir sin red.
 * @param {RequestCache} modo 'reload' ignora la caché HTTP; 'no-cache' la valida.
 */
async function descargarNucleo(modo) {
  /* Con una rayita de señal una descarga se puede quedar colgada para siempre, y
     con ella toda búsqueda posterior. */
  const control = new AbortController();
  const temporizador = setTimeout(function () { control.abort(); }, LIMITE_DESCARGA_MS);

  try {
    const descargas = await Promise.all(ARCHIVOS.map(async function (ruta) {
      const respuesta = await fetch(new Request(ruta, { cache: modo, credentials: 'same-origin', signal: control.signal }));
      if (!respuesta.ok) throw new Error('No se pudo descargar ' + ruta + ' (HTTP ' + respuesta.status + ')');
      comprobarQueEsDeLaAplicacion(ruta, respuesta);
      const cuerpo = await respuesta.arrayBuffer();
      const cabeceras = new Headers();
      respuesta.headers.forEach(function (valor, nombre) {
        if (CABECERAS_QUE_NO_SE_GUARDAN.indexOf(nombre.toLowerCase()) === -1) cabeceras.set(nombre, valor);
      });
      return { ruta: ruta, cuerpo: cuerpo, cabeceras: cabeceras, huella: await digerir(cuerpo) };
    }));

    const lista = descargas.map(function (d) { return d.ruta + ':' + d.huella; }).join('\n');
    const huella = await digerir(new TextEncoder().encode(lista));
    return { nombre: PREFIJO_NUCLEO + huella.slice(0, 24), descargas: descargas };
  } finally {
    clearTimeout(temporizador);
  }
}

async function guardarNucleo(nucleo) {
  const cache = await caches.open(nucleo.nombre);
  await Promise.all(nucleo.descargas.map(function (d) {
    /* Respuesta nueva, no la de la red: una que llegó por una redirección no
       se puede entregar a una navegación en Safari. */
    return cache.put(d.ruta, new Response(d.cuerpo, { status: 200, statusText: 'OK', headers: d.cabeceras }));
  }));
}

function nombresDeNucleos() {
  return caches.keys().then(function (nombres) {
    return nombres.filter(function (n) { return n.indexOf(PREFIJO_NUCLEO) === 0; });
  });
}

/* El último juego completo: las cachés se listan en el orden en que se crearon, y
   uno que se quedó a medias (se cortó la descarga, se apagó el worker) no cuenta. */
async function buscarNucleoCompleto() {
  const nombres = await nombresDeNucleos();
  for (let i = nombres.length - 1; i >= 0; i--) {
    const cache = await caches.open(nombres[i]);
    if ((await cache.keys()).length >= ARCHIVOS.length) return nombres[i];
  }
  return null;
}

async function leerVigente() {
  if (!vigente) vigente = await buscarNucleoCompleto();
  return vigente;
}

/* Avisa a las ventanas abiertas: se les ofrece recargar (pwa.js). */
async function avisarVersionNueva() {
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  ventanas.forEach(function (ventana) { ventana.postMessage({ tipo: 'actualizacion-lista' }); });
}

/** Deja sólo el núcleo indicado y, si había otro, avisa que hay versión nueva. */
async function pasarA(nombre) {
  const otros = (await nombresDeNucleos()).filter(function (n) { return n !== nombre; });
  vigente = nombre;
  await Promise.all(otros.map(function (n) { return caches.delete(n); }));
  if (otros.length > 0) await avisarVersionNueva();
}

/**
 * Compara lo publicado con lo guardado y, si cambió, pasa a la versión nueva.
 * Sin red rechaza y no cambia nada.
 */
function buscarActualizacion() {
  if (busquedaEnCurso) return busquedaEnCurso;
  busquedaEnCurso = (async function () {
    const nucleo = await descargarNucleo('no-cache');
    /* Mismo contenido, y sigue ahí: quien borra «archivos en caché» desde el
       navegador se lleva esta caché, no su nombre. */
    if (nucleo.nombre === await leerVigente()) {
      const cache = await caches.open(nucleo.nombre);
      if (await cache.match(ARCHIVOS[0])) return false;
    }
    await guardarNucleo(nucleo);
    await pasarA(nucleo.nombre);
    return true;
  })();
  const limpiar = function () { busquedaEnCurso = null; };
  busquedaEnCurso.then(limpiar, limpiar);
  return busquedaEnCurso;
}

/* ---------------------------------------------------------
   2. CICLO DE VIDA
   --------------------------------------------------------- */

self.addEventListener('install', function (evento) {
  /* Si falla la descarga, este worker se descarta y sigue el anterior: el
     navegador lo reintenta en la próxima apertura.

     Sin skipWaiting: cambiar de worker con la página a medio cargar es buscarse
     peticiones sin respuesta y una aplicación que no termina de abrir en terreno. Un
     worker nuevo espera a que se cierre la aplicación o a que se toque «Actualizar»
     (pwa.js); mientras tanto, el vigente sigue trayendo los archivos. */
  evento.waitUntil(descargarNucleo('reload').then(guardarNucleo));
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil((async function () {
    const nombre = await buscarNucleoCompleto();
    if (nombre) await pasarA(nombre);
    await self.clients.claim();
  })());
});

self.addEventListener('message', function (evento) {
  const datos = evento.data || {};
  if (datos.tipo === 'buscar-actualizacion') {
    evento.waitUntil(buscarActualizacion().catch(function () { /* sin red: otra vez será */ }));
  }
  /* Lo pide «Actualizar», con la página ya cargada y a punto de recargarse. */
  if (datos.tipo === 'activar') evento.waitUntil(self.skipWaiting());

  if (datos.tipo === 'llave-dejar') {
    olvidarLlaveEnTransito();
    const dejada = { documento: datos.documento, id: datos.id, llave: datos.llave };
    llaveEnTransito = dejada;
    evento.ports[0].postMessage({ ok: true });
    /* Sin esto, el navegador puede apagar el worker antes de que llegue la página. */
    evento.waitUntil(new Promise(function (resolver) {
      setTimeout(function () {
        if (llaveEnTransito === dejada) olvidarLlaveEnTransito();
        resolver();
      }, VIGENCIA_ENTREGA_MS);
    }));
  }
  if (datos.tipo === 'llave-tomar') {
    evento.ports[0].postMessage(llaveEnTransito);
    olvidarLlaveEnTransito();
  }
});

function olvidarLlaveEnTransito() {
  if (llaveEnTransito && llaveEnTransito.llave) llaveEnTransito.llave.fill(0);
  llaveEnTransito = null;
}

/* ---------------------------------------------------------
   3. RESPONDER
   --------------------------------------------------------- */

async function responder(peticion, ruta, esNavegacion) {
  const nombre = await leerVigente();
  const cache = nombre ? await caches.open(nombre) : null;

  if (cache) {
    const guardada = await cache.match(ruta);
    if (guardada) return guardada;
  }

  try {
    return await fetch(peticion);
  } catch (error) {
    if (esNavegacion && cache) {
      const inicio = await cache.match('/index.html');
      if (inicio) return inicio;
    }
    throw error;
  }
}

self.addEventListener('fetch', function (evento) {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.indexOf('/api/') === 0) return;

  const ruta = ALIAS[url.pathname] || url.pathname;
  const esNavegacion = peticion.mode === 'navigate';
  if (!esNavegacion && ARCHIVOS.indexOf(ruta) === -1) return;

  evento.respondWith(responder(peticion, ruta, esNavegacion));
});
