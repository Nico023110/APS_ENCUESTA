/* =========================================================================
   La aplicación instalada, de la instalación a la actualización
   -------------------------------------------------------------------------
       npm run e2e:pwa

   Un solo recorrido, en orden, como lo vive quien está en terreno, en un teléfono
   emulado y contra la copia local de la base (ver pwa_banco.js):

      1. se puede instalar
      2. primer ingreso con señal
      3. abre sin red
      4. una ficha completa, de tres integrantes, sin red
      5. el bloqueo por inactividad se resuelve sin red
      6. se puede volver a entrar sin red
      7. vuelve la señal, con la sesión vencida, y la ficha sube a la base
      8. señal débil: nada se queda esperando
      9. versión nueva sin perder lo guardado
     10. el teléfono: controles y anchos
     11. cuánto cabe en el dispositivo
     12. dos personas en un mismo equipo
     13. olvidó la contraseña

   Las fichas van cifradas: por eso casi nunca se abre el almacenamiento directamente
   y sí obtenerEncuestas, y abrir desde cero siempre pide la contraseña (abrirYEntrar).

   Lo que esto NO prueba: un teléfono de verdad. Ver pruebas/e2e/README.md.
   ========================================================================= */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, chromium, webkit } = require('@playwright/test');
const { montarBanco, asegurarBaseLocal } = require('./pwa_banco');
const { FICHA, PERSONAS, limpiarBase } = require('./ficha_de_prueba');
const { USUARIO_PRUEBA } = require('../_sesion_prueba');
const ayudas = require('./ayudas');
const flujo = require('./diligenciar');

test.describe.configure({ mode: 'serial' });

const DOCUMENTO = USUARIO_PRUEBA.documento;
const CLAVE = USUARIO_PRUEBA.clave;

/* El proxy en un puerto por proyecto; el servidor, en el siguiente. */
const PUERTOS = { 'android-chromium': 5181, 'ios-webkit': 5183 };

let banco = null;
let perfil = null;
let contexto = null;
let pagina = null;
let codigoFicha = null;
/* La ficha real tal como quedó esperando señal, de molde para la prueba 12. */
let fichaSinSubir = null;

const externas = [];
const excepciones = [];

const esChromium = function () { return test.info().project.name === 'android-chromium'; };

let redQuitada = false;

/* El corte de verdad está en el proxy (banco.sinRed): por ahí no pasa nada. La
   emulación del navegador sólo pone navigator.onLine en false, y no sirve igual en
   los dos motores. En WebKit, con ella activa, ninguna carga llega siquiera al
   service worker, ni con la red viva, y no se puede navegar: se usa sólo el corte
   del proxy, que deja navigator.onLine en true (el caso de una rayita de señal, o
   de un wifi sin internet). En Chromium hay que darla después de abrir, porque a
   una página nueva le sigue diciendo que hay red. Son rarezas de la emulación, no
   de un teléfono. */
async function navegar(hoja, ruta) {
  await contexto.setOffline(false);
  await hoja.goto(ruta);
  if (redQuitada && esChromium()) await contexto.setOffline(true);
}

/* «Cerrar la aplicación»: fuera todas las páginas. El contexto es el teléfono. */
async function abrir(ruta) {
  for (const abierta of contexto.pages()) await abierta.close();
  pagina = await contexto.newPage();
  pagina.on('pageerror', function (error) { excepciones.push(error.message); });
  await navegar(pagina, ruta);
  return pagina;
}

async function quitarRed() {
  redQuitada = true;
  banco.sinRed();
  if (esChromium()) await contexto.setOffline(true);
}

async function devolverRed() {
  redQuitada = false;
  await contexto.setOffline(false);
  banco.conRed();
}

async function foto(nombre) {
  await pagina.screenshot({ path: test.info().outputPath(nombre + '.png') });
}

/* Los archivos que sw.js promete guardar, leídos del propio sw.js publicado. */
function archivosDelTrabajador() {
  const texto = banco.leer('sw.js').toString('utf8');
  const lista = texto.slice(texto.indexOf('const ARCHIVOS = ['), texto.indexOf('];', texto.indexOf('const ARCHIVOS = [')));
  return lista.match(/'\/[^']*'/g).map(function (s) { return s.slice(1, -1); });
}

async function leerNucleo() {
  return pagina.evaluate(async function () {
    const nombres = await caches.keys();
    const nucleos = nombres.filter(function (n) { return n.indexOf('aps-nucleo-') === 0; });
    const nombre = nucleos.length ? nucleos[nucleos.length - 1] : null;
    const cache = nombre ? await caches.open(nombre) : null;
    const llaves = cache ? await cache.keys() : [];
    const portada = cache ? await cache.match('/index.html') : null;
    return {
      nombre: nombre,
      nombres: nombres,
      rutas: llaves.map(function (l) { return new URL(l.url).pathname; }),
      csp: portada ? portada.headers.get('content-security-policy') : null
    };
  });
}

/* Lo que el dispositivo tiene guardado, sin lo que cambia con solo usarlo. */
function fotoDelAlmacenamiento() {
  return pagina.evaluate(function () {
    const salida = {};
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (/^aps_(encuestas|borrador_|en_curso_|cifrado_|boveda_|dispositivo|consecutivo_ficha)/.test(clave)) {
        salida[clave] = localStorage.getItem(clave);
      }
    }
    return salida;
  });
}

function esperarWorkerNuevo() {
  return pagina.waitForFunction(async function () {
    const registro = await navigator.serviceWorker.getRegistration();
    return Boolean(registro && registro.waiting);
  }, null, { timeout: 30000 });
}

async function entrarCon(documento, clave) {
  await pagina.locator('#documento').fill(documento);
  await pagina.locator('#clave').fill(clave);
  await pagina.locator('#btnIngresar').click();
}

const velo = function () { return pagina.locator('#bloqueoSesion'); };

/* Abrir desde cero pide la contraseña: la llave vive en la memoria de la página. */
async function abrirYEntrar(ruta, clave) {
  await abrir(ruta);
  await desbloquearCon(clave || CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });
  await expect(pagina.locator('#appTabs')).toBeVisible();
  return pagina;
}

function fichasPendientes() {
  return pagina.evaluate(function () {
    return window.obtenerEncuestas().filter(function (e) { return e.sincronizada !== true; }).length;
  });
}

/* Lo que está guardado de verdad, tal cual, para ver qué se puede leer sin la llave. Sin
   los catálogos: hay barrios que se llaman como una persona (Laureano Gómez). */
function almacenamientoCrudo() {
  return pagina.evaluate(function () {
    const salida = {};
    Object.keys(localStorage).forEach(function (clave) {
      if (!/^aps_(catalogo|cups)/.test(clave)) salida[clave] = localStorage.getItem(clave);
    });
    return JSON.stringify(salida);
  });
}

async function desbloquearCon(clave) {
  await velo().locator('input[name="clave"]').fill(clave);
  await velo().locator('button[type="submit"]').click();
}

async function irA(vista) {
  await pagina.locator('#appTabs [data-view="' + vista + '"]').click();
  await expect(pagina.locator('#view-' + vista)).toHaveClass(/is-active/);
}

/* Lo que trae el perfil del teléfono y sirve para abrir un contexto. */
function opcionesDelTelefono(info) {
  const opciones = Object.assign({}, info.project.use, {
    baseURL: banco.url,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    permissions: ['geolocation'],
    geolocation: { latitude: 3.451647, longitude: -76.531985 }
  });
  delete opciones.defaultBrowserType;
  return opciones;
}

test.beforeAll(async function ({ browser }, info) {
  asegurarBaseLocal();
  await limpiarBase();
  banco = await montarBanco({ puerto: PUERTOS[info.project.name] });

  /* En WebKit, con perfil en disco, como un teléfono: un contexto normal de Playwright
     es de navegación privada, y ahí su Cache Storage vive en memoria y se vacía cuando
     nadie la está usando (visto: la caché seguía listada, con cero entradas). En
     Chromium, contexto normal: Playwright se engancha a cada worker que arranca, y con
     perfil en disco eso deja de vez en cuando una navegación colgada, cosa que no pasa
     sin él (150 ciclos de versión nueva por CDP, sin ninguna). */
  if (info.project.name === 'ios-webkit') {
    perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'aps-pwa-perfil-'));
    contexto = await webkit.launchPersistentContext(perfil, opcionesDelTelefono(info));
  } else {
    contexto = await browser.newContext(opcionesDelTelefono(info));
  }

  /* La geocodificación es el único tercero admitido por la CSP. */
  contexto.on('request', function (peticion) {
    const url = peticion.url();
    if (url.indexOf(banco.url) === 0 || /^(data|blob):/.test(url)) return;
    if (/nominatim\.openstreetmap\.org/.test(url)) return;
    externas.push(url);
  });
});

test.afterAll(async function () {
  if (contexto) await contexto.close().catch(function () {});
  if (banco) await banco.desmontar();
  if (perfil) {
    try { fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 3 }); } catch (error) { /* temporal */ }
  }
  await limpiarBase();
});

/* -------------------------------------------------------------------------
   1. INSTALAR
   ------------------------------------------------------------------------- */

test('1. Se puede instalar: manifiesto, iconos y criterios del navegador', async function () {
  await abrir('/login.html');

  const manifiesto = await pagina.evaluate(function () {
    return fetch(document.querySelector('link[rel="manifest"]').href).then(function (r) {
      return r.json().then(function (cuerpo) { return { tipo: r.headers.get('content-type'), cuerpo: cuerpo }; });
    });
  });
  expect(manifiesto.tipo).toContain('application/manifest+json');
  expect(manifiesto.cuerpo.display).toBe('standalone');
  expect(manifiesto.cuerpo.start_url).toBe('/');
  expect(manifiesto.cuerpo.scope).toBe('/');
  expect(manifiesto.cuerpo.short_name).toBe('Encuesta APS');

  /* Cada ícono se abre de verdad: que esté en el manifiesto no prueba que exista
     ni que mida lo que dice. */
  const iconos = manifiesto.cuerpo.icons.map(function (i) { return { src: i.src, lado: parseInt(i.sizes, 10) }; });
  iconos.push({ src: '/iconos/apple-touch-icon.png', lado: 180 });
  for (const icono of iconos) {
    const medido = await pagina.evaluate(function (src) {
      return new Promise(function (resolver) {
        const img = new Image();
        img.onload = function () { resolver(img.naturalWidth + 'x' + img.naturalHeight); };
        img.onerror = function () { resolver('no cargó'); };
        img.src = src;
      });
    }, icono.src);
    expect(medido, icono.src).toBe(icono.lado + 'x' + icono.lado);
  }

  await expect(pagina.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Encuesta APS');

  if (esChromium()) {
    /* La propia evaluación de Chromium: una lista vacía es «se puede instalar». */
    const cdp = await contexto.newCDPSession(pagina);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors.map(function (e) { return e.errorId; })).toEqual([]);
    const { errors } = await cdp.send('Page.getAppManifest');
    expect(errors).toEqual([]);
    await cdp.detach();
  }

  /* El enlace a la guía se ve porque es un teléfono y no está instalada. */
  await expect(pagina.locator('[data-enlace-instalar]')).toBeVisible();
  await foto('01-acceso');

  /* La guía abre con los pasos del sistema del teléfono. */
  await pagina.locator('[data-enlace-instalar]').click();
  await pagina.waitForURL(/\/instalar/);
  const sistema = esChromium() ? 'android' : 'ios';
  const otro = esChromium() ? 'ios' : 'android';
  await expect(pagina.locator('[data-pasos="' + sistema + '"]')).toBeVisible();
  await expect(pagina.locator('[data-pasos="' + otro + '"]')).toBeHidden();
  await foto('01-instalar');

  /* En iPhone la aplicación instalada no ve lo guardado en Safari: se avisa antes
     de instalar. En Android es el mismo almacenamiento y no hay de qué avisar. */
  await pagina.evaluate(function () {
    localStorage.setItem('aps_encuestas', JSON.stringify([{ id: 'x', sincronizada: false }]));
  });
  await pagina.reload();
  if (esChromium()) await expect(pagina.locator('#avisoPendientes')).toBeHidden();
  else await expect(pagina.locator('#avisoPendientes')).toContainText('1 ficha sin subir');
  await pagina.evaluate(function () { localStorage.removeItem('aps_encuestas'); });

  /* Ya instalada (lo que iOS dice con navigator.standalone): no ofrece instalar, y
     si iOS la abre en la guía, de ahí pasa a la aplicación. */
  const instalada = await contexto.newPage();
  await instalada.addInitScript(function () {
    Object.defineProperty(Navigator.prototype, 'standalone', { get: function () { return true; }, configurable: true });
  });
  await instalada.goto('/login.html');
  await expect(instalada.locator('#formAcceso')).toBeVisible();
  await expect(instalada.locator('[data-enlace-instalar]')).toBeHidden();
  await instalada.goto('/instalar');
  await instalada.waitForURL(/login/);
  await instalada.close();
});

/* -------------------------------------------------------------------------
   2. PRIMER INGRESO
   ------------------------------------------------------------------------- */

test('2. Primer ingreso con señal: queda lista para trabajar sin señal', async function () {
  await abrir('/login.html');
  await ayudas.iniciarSesion(pagina, null);
  await expect(pagina.locator('#appTabs')).toBeVisible();

  /* Controla la página: de aquí en adelante todo sale del dispositivo. */
  await pagina.waitForFunction(function () {
    return navigator.serviceWorker && navigator.serviceWorker.controller !== null;
  }, null, { timeout: 60000 });

  /* El aviso de «ya puede salir» se dio. */
  await expect.poll(function () {
    return pagina.evaluate(function () { return localStorage.getItem('aps_pwa_lista_avisada'); });
  }).toBe('si');

  /* Guardó todo lo que dice guardar. */
  /* controller ya se ve mientras el worker termina de activarse: un instante. */
  await expect.poll(async function () { return (await leerNucleo()).nombre; }, { timeout: 30000 }).toMatch(/^aps-nucleo-/);
  const nucleo = await leerNucleo();
  expect(nucleo.nombre).toMatch(/^aps-nucleo-/);
  expect(nucleo.rutas.sort()).toEqual(archivosDelTrabajador().sort());
  expect(nucleo.rutas.some(function (r) { return r.indexOf('/api/') === 0; })).toBe(false);
  /* La misma política de seguridad con o sin red. */
  expect(nucleo.csp).toContain("default-src 'self'");

  /* Los catálogos que el formulario necesita sin red. */
  await expect.poll(function () {
    return pagina.evaluate(function () {
      return Boolean(localStorage.getItem('aps_catalogo_acciones') && localStorage.getItem('aps_catalogos_dinamicos'));
    });
  }).toBe(true);

  /* Para verificar sin señal hay una derivación, nunca la contraseña. */
  const guardado = await pagina.evaluate(function () { return JSON.stringify(Object.assign({}, localStorage)); });
  expect(guardado).not.toContain(CLAVE);
  const copia = await pagina.evaluate(function (documento) {
    return JSON.parse(localStorage.getItem('aps_acceso_local_' + documento));
  }, DOCUMENTO);
  expect(copia.iteraciones).toBeGreaterThanOrEqual(600000);
  expect(copia.hash.length).toBeGreaterThan(20);

  /* La llave de las fichas queda envuelta dos veces y en ninguna parte en claro. */
  const boveda = await pagina.evaluate(function (documento) {
    return JSON.parse(localStorage.getItem('aps_boveda_' + documento));
  }, DOCUMENTO);
  expect(boveda.iteraciones).toBeGreaterThanOrEqual(600000);
  expect(boveda.envuelta.length).toBeGreaterThan(40);
  expect(boveda.custodia.length, 'el servidor debía dar la custodia al verificar la contraseña').toBeGreaterThan(40);

  /* La custodia sólo se entrega con la contraseña: con la cookie sola, no. */
  const sinContrasena = await pagina.evaluate(function () {
    return fetch('/api/sesion', { headers: { 'X-Requested-With': 'fetch' } }).then(function (r) { return r.json(); });
  });
  expect(sinContrasena.usuario.documento).toBe(DOCUMENTO);
  expect(JSON.stringify(sinContrasena)).not.toContain('llaveCustodia');

  /* Recién ingresada no pidió la contraseña otra vez, y la llave no pasó por el disco. */
  await expect(velo()).toBeHidden();
  expect(await pagina.evaluate(function () { return window.BOVEDA.abierta(); })).toBe(true);
  expect(await pagina.evaluate(function () { return sessionStorage.length; })).toBe(0);

  /* La sesión sigue en la cookie que el JavaScript no puede leer. */
  const cookie = (await contexto.cookies()).find(function (c) { return c.name === 'aps_sesion'; });
  expect(cookie.httpOnly).toBe(true);
  /* WebKit en Windows guarda las cookies con otro motor y no conserva SameSite. */
  if (esChromium()) expect(cookie.sameSite).toBe('Strict');
});

/* -------------------------------------------------------------------------
   3. ABRIR SIN RED
   ------------------------------------------------------------------------- */

test('3. Abre sin red: la aplicación, sus fuentes, sus iconos y sus avisos', async function () {
  await quitarRed();
  await abrirYEntrar('/');

  const recursos = await pagina.evaluate(async function () {
    await document.fonts.ready;
    return {
      fuentes: Array.from(document.fonts).filter(function (f) { return f.status === 'loaded'; })
        .map(function (f) { return f.family.replace(/["']/g, ''); }),
      avisos: typeof window.Swal
    };
  });
  expect(recursos.fuentes).toContain('Phosphor');
  expect(recursos.fuentes).toContain('Plus Jakarta Sans');
  expect(recursos.avisos).toBe('function');

  /* Con la página ya abierta, la emulación sí sirve en los dos motores para ver
     qué dice la aplicación cuando el sistema avisa que no hay red. */
  await contexto.setOffline(true);
  await expect(pagina.locator('#sincronia')).toHaveAttribute('data-estado', 'sin-red');
  await foto('03-sin-red');
  if (!esChromium()) await contexto.setOffline(false);

  for (const ruta of ['/login.html?motivo=expirada', '/instalar']) {
    const otra = await contexto.newPage();
    await navegar(otra, ruta);
    await expect(otra.locator('body')).toBeVisible();
    await expect(otra.locator(ruta === '/instalar' ? '.instalar__titulo' : '#formAcceso')).toBeVisible();
    await otra.close();
  }

  expect(excepciones, 'la aplicación lanzó excepciones al abrir sin red').toEqual([]);
});

test('3b. Sin red, cerrar y volver a abrir la aplicación', async function () {
  for (let i = 0; i < 3; i++) {
    await abrirYEntrar('/');
  }
});

/* -------------------------------------------------------------------------
   4. UNA FICHA COMPLETA SIN RED
   ------------------------------------------------------------------------- */

test('4. Sin red se diligencia y se guarda una ficha completa de tres integrantes', async function () {
  const diario = ayudas.crearDiario();
  const ficha = Object.assign({}, FICHA, { sesionYaAbierta: true });

  await abrirYEntrar('/');
  /* El recorrido navega al empezar: con la emulación activa WebKit no navega (ver navegar). La red sigue cortada en el proxy. */
  await contexto.setOffline(false);
  await flujo.diligenciarEncuesta(pagina, diario, ficha, PERSONAS);
  if (esChromium()) await contexto.setOffline(true);

  expect(diario.problemas.map(function (p) {
    return '«' + p.zona + '» ' + p.etiqueta + ': ' + p.motivo + (p.detalle ? ' — ' + p.detalle : '');
  }), 'hubo campos que no se pudieron diligenciar sin red').toEqual([]);

  await pagina.locator('#seccion-cierre').scrollIntoViewIfNeeded();
  await pagina.locator('#btnGuardar').click();
  const confirmar = pagina.locator('#modalConfirmar:not([hidden]) #btnConfirmarEliminar');
  await confirmar.waitFor({ state: 'visible', timeout: 5000 }).catch(async function () {
    /* Sin confirmación es que la ficha no cerró: se dice por qué, no sólo que no llegó. */
    const avisos = await ayudas.leerAvisos(pagina);
    const errores = await ayudas.leerErroresDeCampo(pagina);
    const impedimentos = await ayudas.leerImpedimentos(pagina);
    throw new Error('La ficha no cerró. ' + JSON.stringify({ avisos: avisos, errores: errores, impedimentos: impedimentos }, null, 1));
  });
  await foto('04-confirmar-guardado');
  await confirmar.click();

  const aviso = pagina.locator('.swal2-popup');
  await expect(aviso).toContainText('pendiente de sincronizar');
  await foto('04-guardada-sin-red');
  await pagina.getByRole('button', { name: 'Entendido' }).click();

  const estado = await pagina.evaluate(function (codigo) {
    const todas = window.obtenerEncuestas();
    const nuestra = todas.find(function (e) { return e.codigoFicha === codigo; });
    const crudo = localStorage.getItem('aps_encuestas') || '';
    const borradores = Object.keys(localStorage).filter(function (k) { return /^aps_(cifrado_)?borrador_/.test(k); });
    return {
      existe: Boolean(nuestra),
      sincronizada: nuestra ? nuestra.sincronizada : null,
      integrantes: nuestra ? nuestra.familias[0].integrantes.length : 0,
      largo: crudo.length,
      borradores: borradores,
      ficha: nuestra
    };
  }, ficha.codigo);

  expect(estado.existe).toBe(true);
  expect(estado.sincronizada).toBe(false);
  expect(estado.integrantes).toBe(3);
  expect(estado.borradores).toEqual([]);
  /* Queda a nombre de quien tiene la sesión. */
  expect(estado.ficha.capturadaPor).toBe(DOCUMENTO);
  codigoFicha = ficha.codigo;
  fichaSinSubir = estado.ficha;
  console.log('   Tamaño de la ficha en el dispositivo: ' + estado.largo + ' caracteres');

  /* Cerrar y volver a abrir sin red: sigue ahí. */
  await abrirYEntrar('/');
  await expect(pagina.locator('#sincronia')).toHaveAttribute('data-estado', /sin-red|pendiente/);
  expect(await fichasPendientes()).toBe(1);

  /* Cifrada: lo único que se puede leer sin la llave es de quién es y si subió. */
  const sobres = await pagina.evaluate(function () { return JSON.parse(localStorage.getItem('aps_encuestas')); });
  expect(sobres.length).toBe(1);
  expect(Object.keys(sobres[0]).sort()).toEqual(['capturadaPor', 'sellada', 'sincronizada']);
  expect(sobres[0].capturadaPor).toBe(DOCUMENTO);
  const crudoTrasCerrar = await almacenamientoCrudo();
  PERSONAS.forEach(function (persona) {
    expect(persona.primerApellido.length).toBeGreaterThan(0);
    expect(crudoTrasCerrar, 'se lee un apellido en el almacenamiento').not.toContain(persona.primerApellido);
    expect(crudoTrasCerrar, 'se lee un nombre en el almacenamiento').not.toContain(persona.primerNombre);
  });
  expect(crudoTrasCerrar, 'se lee la ficha en el almacenamiento').not.toContain('"familias"');
  expect(crudoTrasCerrar, 'se lee el código de la ficha').not.toContain(codigoFicha);

  await irA('historial');
  await expect(pagina.locator('#view-historial')).toContainText(codigoFicha);
  await foto('04-historial-sin-red');

  expect(excepciones, 'la aplicación lanzó excepciones al diligenciar sin red').toEqual([]);
});

/* -------------------------------------------------------------------------
   4b. LO QUE YA ESTABA EN EL TELÉFONO
   ------------------------------------------------------------------------- */

test('4b. Lo que una versión anterior dejó en claro pasa a cifrado sin perder nada', async function () {
  await abrirYEntrar('/');

  /* Una ficha a medias, para tener un borrador y una ficha sin terminar de verdad. */
  await irA('nueva');
  await ayudas.marcar(pagina, ayudas.crearDiario(), 'consentimiento', 'si', 'Consentimiento informado');
  await pagina.locator('#cabezaFamilia').fill('Nombre de prueba en claro');
  await pagina.evaluate(function () { window.guardarBorradorAhora(); });

  /* El teléfono, tal como lo dejaba la versión anterior: todo en claro, sin capturadaPor. */
  const antes = await pagina.evaluate(function () {
    const usuario = window.SESION.usuario();
    const borrador = 'aps_borrador_' + usuario.id;
    const enCurso = 'aps_en_curso_' + usuario.id;
    const fichas = window.obtenerEncuestas().map(function (ficha) {
      const vieja = Object.assign({}, ficha);
      delete vieja.capturadaPor;
      return vieja;
    });
    const textoBorrador = window.BOVEDA.leerTexto(borrador);
    const textoEnCurso = window.BOVEDA.leerTexto(enCurso);
    window.addEventListener('pagehide', function (evento) { evento.stopImmediatePropagation(); }, true);
    document.addEventListener('visibilitychange', function (evento) { evento.stopImmediatePropagation(); }, true);
    localStorage.setItem('aps_encuestas', JSON.stringify(fichas));
    localStorage.setItem(borrador, textoBorrador);
    localStorage.setItem(enCurso, textoEnCurso);
    localStorage.removeItem('aps_cifrado_borrador_' + usuario.id);
    localStorage.removeItem('aps_cifrado_en_curso_' + usuario.id);
    return { fichas: fichas, borrador: borrador, enCurso: enCurso };
  });
  expect(antes.fichas.length).toBe(1);
  expect(antes.fichas[0].sincronizada).toBe(false);
  expect(await almacenamientoCrudo()).toContain('Nombre de prueba en claro');

  /* Llega esta versión. Sin la contraseña no se lee ni se toca. */
  await abrir('/');
  await expect(velo()).toBeVisible();
  expect(await pagina.evaluate(function () { return window.obtenerEncuestas().length; })).toBe(0);
  const crudoCerrado = await pagina.evaluate(function () { return JSON.parse(localStorage.getItem('aps_encuestas')); });
  expect(crudoCerrado[0].familias, 'sin la contraseña nada debía cambiar').toBeTruthy();

  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });

  /* Ya no se lee en claro. */
  const crudo = await almacenamientoCrudo();
  expect(crudo, 'quedó el borrador en claro').not.toContain('Nombre de prueba en claro');
  expect(crudo, 'quedó la ficha en claro').not.toContain('"familias"');
  expect(crudo).not.toContain(codigoFicha);
  const quedaron = await pagina.evaluate(function (claves) {
    return [localStorage.getItem(claves.borrador), localStorage.getItem(claves.enCurso)];
  }, antes);
  expect(quedaron).toEqual([null, null]);

  /* Y no se perdió nada: la misma ficha, ahora con su dueño. */
  const despues = await pagina.evaluate(function () { return window.obtenerEncuestas(); });
  expect(despues.length).toBe(1);
  expect(Object.assign({}, despues[0], { capturadaPor: undefined })).toEqual(Object.assign({}, antes.fichas[0], { capturadaPor: undefined }));
  expect(despues[0].capturadaPor).toBe(DOCUMENTO);

  /* El borrador vuelve al formulario. */
  await expect(pagina.locator('#cabezaFamilia')).toHaveValue('Nombre de prueba en claro');
  await expect(pagina.locator('#avisoBorrador')).toBeVisible();

  await pagina.evaluate(function () { window.reiniciarFichaEnCurso(); });
  expect(excepciones, 'hubo excepciones al migrar').toEqual([]);
});

/* -------------------------------------------------------------------------
   5. BLOQUEO SIN RED
   ------------------------------------------------------------------------- */

test('5. El bloqueo por inactividad se resuelve sin red', async function () {
  await abrirYEntrar('/');

  /* Lo que se está escribiendo no se pierde al bloquear, y queda cifrado. */
  await irA('nueva');
  await ayudas.marcar(pagina, ayudas.crearDiario(), 'consentimiento', 'si', 'Consentimiento informado');
  await pagina.locator('#cabezaFamilia').fill('Escrito justo antes de bloquear');

  await pagina.evaluate(function () { window.SESION.bloquear(); });
  await expect(velo()).toBeVisible();
  await expect(pagina.locator('.app-main')).toBeHidden();

  /* Bloqueada, la llave ya no está en memoria: no se lee nada. */
  const bloqueada = await pagina.evaluate(function () {
    return {
      abierta: window.BOVEDA.abierta(),
      fichas: window.obtenerEncuestas().length,
      borrador: window.BOVEDA.leerTexto('aps_borrador_' + window.SESION.usuario().id)
    };
  });
  expect(bloqueada).toEqual({ abierta: false, fichas: 0, borrador: null });
  expect(await almacenamientoCrudo()).not.toContain('Escrito justo antes de bloquear');

  /* Escribir falla, en vez de pisar lo guardado con una lista vacía. */
  const intento = await pagina.evaluate(function () {
    const antes = localStorage.getItem('aps_encuestas');
    let error = null;
    try { window.agregarEncuesta({ id: 'x', codigoFicha: 'X' }); } catch (e) { error = e.name; }
    return { error: error, igual: localStorage.getItem('aps_encuestas') === antes };
  });
  expect(intento).toEqual({ error: 'BovedaCerrada', igual: true });

  /* Mal escrita: sigue bloqueada, dice por qué y no saca de la aplicación. */
  await desbloquearCon('NoEsLaClave2026');
  await expect(velo().locator('[data-bloqueo="error"]')).toContainText('incorrect');
  await expect(velo()).toBeVisible();
  await foto('05-bloqueo-clave-mala');

  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });
  await expect(pagina.locator('.app-main')).toBeVisible();

  /* Al desbloquear todo sigue donde estaba. */
  await expect(pagina.locator('#cabezaFamilia')).toHaveValue('Escrito justo antes de bloquear');
  expect(await fichasPendientes()).toBe(1);

  /* Cerrar la aplicación no se salta el bloqueo. */
  await pagina.evaluate(function () { window.SESION.bloquear(); });
  await abrir('/');
  await expect(velo()).toBeVisible();
  await expect(pagina.locator('.app-main')).toBeHidden();
  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });

  /* Abrir desde cero la pide siempre, aunque se haya usado hace un instante: lo que
     el sistema saca de memoria se lleva la llave. Y la ficha a medias vuelve. */
  await abrir('/');
  await expect(velo()).toBeVisible();
  await expect(velo()).toContainText('Sus fichas están protegidas');
  await foto('05-abrir-pide-la-contrasena');
  await expect(pagina.locator('.app-main')).toBeHidden();
  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });
  await expect(pagina.locator('#cabezaFamilia')).toHaveValue('Escrito justo antes de bloquear');

  await pagina.evaluate(function () { window.reiniciarFichaEnCurso(); });
});

/* -------------------------------------------------------------------------
   6. VOLVER A ENTRAR SIN RED
   ------------------------------------------------------------------------- */

test('6. Se puede cerrar sesión y volver a entrar sin red', async function () {
  await abrirYEntrar('/');
  await pagina.locator('.app-usuario').click();
  await pagina.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await pagina.waitForURL(/login/);

  await entrarCon(DOCUMENTO, 'NoEsLaClave2026');
  await expect(pagina.locator('#errorAcceso')).toContainText('incorrect');

  /* Una cuenta que nunca entró en este equipo no entra sin red. */
  await entrarCon('1144000000', CLAVE);
  await expect(pagina.locator('#errorAcceso')).toContainText('ingrese una vez con señal');
  await foto('06-cuenta-desconocida');

  await entrarCon(DOCUMENTO, CLAVE);
  await pagina.waitForURL(function (url) { return !/login/.test(url.pathname); });
  await expect(pagina.locator('#appTabs')).toBeVisible();
  await expect(velo()).toBeHidden();

  /* Lo guardado sigue ahí. El texto depende de si la emulación alcanzó a decir
     «sin señal» en esta página nueva: lo que importa es que sigue pendiente. */
  await expect(pagina.locator('#sincronia')).toHaveAttribute('data-estado', /sin-red|pendiente/);
  expect(await fichasPendientes()).toBe(1);
});

/* -------------------------------------------------------------------------
   7. VUELVE LA SEÑAL
   ------------------------------------------------------------------------- */

test('7. Vuelve la señal con la sesión vencida: entra de nuevo y la ficha sube a la base', async function () {
  const { Client } = require('pg');
  const { opcionesConexion } = require('../../api/_db');
  const enLaBase = async function () {
    const cliente = new Client(opcionesConexion(process.env.DATABASE_URL));
    await cliente.connect();
    try {
      const r = await cliente.query('SELECT count(*)::int AS n FROM aps.ficha WHERE codigo = $1', [codigoFicha]);
      return r.rows[0].n;
    } finally {
      await cliente.end();
    }
  };

  expect(await enLaBase(), 'la ficha no debía estar en la base todavía').toBe(0);

  /* Cuatro horas sin usar la API bastan para vencerla (api/_auth.js). */
  await contexto.clearCookies();
  await devolverRed();

  await expect(pagina.locator('#sincronia')).toHaveAttribute('data-estado', 'pendiente');
  await pagina.locator('#btnSincronizar').click();

  await pagina.waitForURL(/login/);
  await expect(pagina.locator('#avisoMotivo')).toContainText('Su sesión terminó');
  await foto('07-sesion-vencida');

  /* Una contraseña mala con señal la rechaza el servidor. */
  await entrarCon(DOCUMENTO, 'NoEsLaClave2026');
  await expect(pagina.locator('#errorAcceso')).toContainText('incorrect');

  await entrarCon(DOCUMENTO, CLAVE);
  await pagina.waitForURL(function (url) { return !/login/.test(url.pathname); });
  await expect(pagina.locator('#sincronia')).toHaveAttribute('data-estado', 'pendiente');
  expect(await enLaBase(), 'volver a entrar no debía subir nada por su cuenta').toBe(0);

  await pagina.locator('#btnSincronizar').click();
  await expect(pagina.locator('#sincronia .sincronia__titulo')).toContainText('Todo está en la base', { timeout: 30000 });
  await foto('07-sincronizada');

  expect(await enLaBase()).toBe(1);

  const local = await pagina.evaluate(function (codigo) {
    const nuestra = window.obtenerEncuestas().find(function (e) { return e.codigoFicha === codigo; });
    return { sincronizada: nuestra.sincronizada, idHogar: nuestra.idHogar };
  }, codigoFicha);
  expect(local.sincronizada).toBe(true);
  /* El código del hogar lo asigna el servidor al subir. */
  expect(local.idHogar).toBeTruthy();
});

test('7b. Cerrar sesión sin señal no deja la sesión abierta para el siguiente', async function () {
  await abrirYEntrar('/');

  /* La sesión está viva. */
  const estadoSesion = function () {
    return pagina.evaluate(function () {
      return fetch('/api/sesion', { headers: { 'X-Requested-With': 'fetch' } }).then(function (r) { return r.status; });
    });
  };
  expect(await estadoSesion()).toBe(200);

  await quitarRed();
  await pagina.locator('.app-usuario').click();
  await pagina.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await pagina.waitForURL(/login/);

  /* Vuelve la señal y se abre la aplicación: pide contraseña, no entra de largo. */
  await devolverRed();
  await abrir('/');
  await pagina.waitForURL(/login/);
  await expect(pagina.locator('#formAcceso')).toBeVisible();
  await expect.poll(function () {
    return pagina.evaluate(function () { return localStorage.getItem('aps_cierre_pendiente'); });
  }).toBeNull();
  expect(await estadoSesion(), 'la sesión debía quedar cerrada en el servidor').toBe(401);
  await pagina.waitForTimeout(500);
  expect(new URL(pagina.url()).pathname).toBe('/login.html');

  await entrarCon(DOCUMENTO, CLAVE);
  await pagina.waitForURL(function (url) { return !/login/.test(url.pathname); });
  await expect(pagina.locator('#appTabs')).toBeVisible();
});

/* -------------------------------------------------------------------------
   8. SEÑAL DÉBIL
   ------------------------------------------------------------------------- */

test('8. Señal débil: con el servidor sin contestar nada se queda esperando', async function () {
  await abrirYEntrar('/');
  await expect(pagina.locator('#sincronia')).toHaveAttribute('data-estado', /listo|pendiente/);

  /* navigator.onLine sigue diciendo que hay red: es lo que engaña. */
  banco.colgada();

  /* Abre de una vez, y la contraseña se resuelve en el dispositivo. */
  await abrir('/');
  await expect(velo()).toBeVisible({ timeout: 8000 });
  expect(await pagina.evaluate(function () { return navigator.onLine; })).toBe(true);
  const inicioApertura = Date.now();
  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });
  console.log('   Abrir con el servidor sin contestar: ' + (Date.now() - inicioApertura) + ' ms');
  await expect(pagina.locator('#appTabs')).toBeVisible();

  /* El bloqueo también. */
  await pagina.evaluate(function () { window.SESION.bloquear(); });
  const inicioBloqueo = Date.now();
  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 20000 });
  console.log('   Desbloqueo con el servidor sin contestar: ' + (Date.now() - inicioBloqueo) + ' ms');

  /* Guardar no se queda en «Guardando…»: pasa a la cola. */
  const inicioGuardado = Date.now();
  const resultado = await pagina.evaluate(function () {
    return window.enviarFichaAlServidor({ codigoFicha: 'PRUEBA-SENAL-DEBIL' }, null);
  });
  expect(resultado.estado).toBe('sin_red');
  expect(Date.now() - inicioGuardado).toBeLessThan(60000);
  console.log('   Guardar con el servidor sin contestar: ' + (Date.now() - inicioGuardado) + ' ms');

  /* Y el acceso tampoco se queda colgado. */
  const otra = await contexto.newPage();
  await otra.goto('/login.html');
  await otra.locator('#documento').fill(DOCUMENTO);
  await otra.locator('#clave').fill(CLAVE);
  const inicioAcceso = Date.now();
  await otra.locator('#btnIngresar').click();
  await otra.waitForURL(function (url) { return !/login/.test(url.pathname); }, { timeout: 30000 });
  console.log('   Ingreso con el servidor sin contestar: ' + (Date.now() - inicioAcceso) + ' ms');
  await otra.close();

  banco.conRed();
});

/* -------------------------------------------------------------------------
   9. VERSIÓN NUEVA
   ------------------------------------------------------------------------- */

test('9. Una versión nueva llega sola y no toca lo guardado', async function () {
  await abrirYEntrar('/');
  await pagina.waitForFunction(function () { return navigator.serviceWorker.controller !== null; });

  /* Una ficha pendiente de subir, además de la ya subida. */
  const CODIGO_PENDIENTE = codigoFicha.replace(/-\d{4}-(\d{8})$/, '-9201-$1');
  await pagina.evaluate(function (datos) {
    window.agregarEncuesta(Object.assign({}, datos.ficha, { id: 'enc_' + datos.codigo, codigoFicha: datos.codigo, sincronizada: false }));
  }, { ficha: fichaSinSubir, codigo: CODIGO_PENDIENTE });
  const sigueLaPendiente = function () {
    return pagina.evaluate(function (codigo) {
      const ficha = window.obtenerEncuestas().find(function (e) { return e.codigoFicha === codigo; });
      return Boolean(ficha) && ficha.sincronizada === false && ficha.familias.length > 0;
    }, CODIGO_PENDIENTE);
  };
  expect(await sigueLaPendiente()).toBe(true);

  /* Y una ficha a medias en el formulario. */
  await irA('nueva');
  await ayudas.marcar(pagina, ayudas.crearDiario(), 'consentimiento', 'si', 'Consentimiento informado');
  await pagina.locator('#cabezaFamilia').fill('Prueba de actualización');
  await expect.poll(function () {
    return pagina.evaluate(function () {
      return Object.keys(localStorage).filter(function (k) { return k.indexOf('aps_cifrado_borrador_') === 0; }).length;
    });
  }, { timeout: 10000 }).toBe(1);

  const antes = await fotoDelAlmacenamiento();
  const nucleoAntes = await leerNucleo();
  expect(Object.keys(antes).length).toBeGreaterThan(2);

  /* Se publica un cambio en un archivo cualquiera. */
  banco.publicar('app.js', function (t) { return t + '\nwindow.__VERSION_PRUEBA__ = 2;\n'; });
  await pagina.evaluate(function () { window.PWA.buscarVersionNueva(); });
  await expect(pagina.locator('#avisoVersion')).toBeVisible({ timeout: 30000 });
  await foto('09-aviso-version');

  /* Lo abierto sigue con su versión: nada recarga la pantalla en mitad de una visita. */
  expect(await pagina.evaluate(function () { return window.__VERSION_PRUEBA__; })).toBeUndefined();
  await expect(pagina.locator('#cabezaFamilia')).toHaveValue('Prueba de actualización');

  /* Un solo juego de archivos, el nuevo. */
  const nucleoDespues = await leerNucleo();
  expect(nucleoDespues.nombre).not.toBe(nucleoAntes.nombre);
  expect(nucleoDespues.nombres.filter(function (n) { return n.indexOf('aps-nucleo-') === 0; })).toEqual([nucleoDespues.nombre]);

  expect(await fotoDelAlmacenamiento(), 'actualizar cambió lo guardado').toEqual(antes);

  /* «Actualizar»: la ficha a medias vuelve. */
  await pagina.locator('#avisoVersion .aviso-version__boton--principal').click();
  await expect.poll(function () {
    return pagina.evaluate(function () { return window.__VERSION_PRUEBA__; }).catch(function () { return null; });
  }, { timeout: 20000 }).toBe(2);
  /* Abrió desde cero: pide la contraseña, y lo cifrado antes de actualizar se abre. */
  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });
  await expect(pagina.locator('#cabezaFamilia')).toHaveValue('Prueba de actualización');
  await expect(pagina.locator('#avisoBorrador')).toBeVisible();
  expect(await sigueLaPendiente(), 'una ficha pendiente se perdió al actualizar').toBe(true);

  const trasActualizar = await fotoDelAlmacenamiento();
  expect(Object.keys(trasActualizar).sort()).toEqual(Object.keys(antes).sort());
  expect(trasActualizar.aps_encuestas).toEqual(antes.aps_encuestas);

  /* «Más tarde» lo quita, y la próxima apertura ya es la versión nueva. */
  banco.publicar('app.js', function (t) { return t + '\nwindow.__VERSION_PRUEBA__ = 3;\n'; });
  await pagina.evaluate(function () { window.PWA.buscarVersionNueva(); });
  await expect(pagina.locator('#avisoVersion')).toBeVisible({ timeout: 30000 });
  await pagina.getByRole('button', { name: 'Más tarde' }).click();
  await expect(pagina.locator('#avisoVersion')).toHaveCount(0);
  expect(await pagina.evaluate(function () { return window.__VERSION_PRUEBA__; })).toBe(2);
  await abrir('/');
  expect(await pagina.evaluate(function () { return window.__VERSION_PRUEBA__; })).toBe(3);

  /* Y abre sin red en la versión nueva. */
  await quitarRed();
  await abrirYEntrar('/');
  expect(await pagina.evaluate(function () { return window.__VERSION_PRUEBA__; })).toBe(3);
  await devolverRed();

  /* Un despliegue roto (falta un archivo) no se aplica a medias: sigue lo que había. */
  const tableros = banco.leer('tableros.js');
  banco.retirar('tableros.js');
  banco.publicar('app.js', function (t) { return t + '\nwindow.__VERSION_PRUEBA__ = 4;\n'; });
  const nucleoBueno = await leerNucleo();
  await abrir('/');
  await pagina.evaluate(function () { window.PWA.buscarVersionNueva(); });
  await pagina.waitForTimeout(4000);
  await expect(pagina.locator('#avisoVersion')).toHaveCount(0);
  expect((await leerNucleo()).nombre).toBe(nucleoBueno.nombre);
  expect(await pagina.evaluate(function () { return window.__VERSION_PRUEBA__; })).toBe(3);

  /* Se corrige el despliegue y llega el 4, con el worker nuevo incluido. */
  banco.escribir('tableros.js', tableros);
  banco.publicar('sw.js', function (t) { return t + '\n/* otra versión del worker */\n'; });
  await pagina.evaluate(function () { window.PWA.buscarVersionNueva(); });
  await expect(pagina.locator('#avisoVersion')).toBeVisible({ timeout: 30000 });
  await esperarWorkerNuevo();
  await abrirYEntrar('/');
  expect(await pagina.evaluate(function () { return window.__VERSION_PRUEBA__; })).toBe(4);
  await expect(pagina.locator('#cabezaFamilia')).toHaveValue('Prueba de actualización');

  /* Con un worker nuevo esperando, «Actualizar» le da paso y recarga: un worker no
     toma el control por su cuenta con la aplicación abierta. */
  banco.publicar('app.js', function (t) { return t + '\nwindow.__VERSION_PRUEBA__ = 5;\n'; });
  banco.publicar('sw.js', function (t) { return t + '\n/* y otra más */\n'; });
  await pagina.evaluate(function () { window.PWA.buscarVersionNueva(); });
  await expect(pagina.locator('#avisoVersion')).toBeVisible({ timeout: 30000 });
  await esperarWorkerNuevo();
  expect(await pagina.evaluate(function () { return window.__VERSION_PRUEBA__; }), 'la página abierta no cambia sola').toBe(4);
  await pagina.locator('#avisoVersion .aviso-version__boton--principal').click();
  await expect.poll(function () {
    return pagina.evaluate(function () { return window.__VERSION_PRUEBA__; }).catch(function () { return null; });
  }, { timeout: 20000 }).toBe(5);
  await desbloquearCon(CLAVE);
  await expect(velo()).toBeHidden({ timeout: 30000 });
  await expect(pagina.locator('#appTabs')).toBeVisible();
  await expect(pagina.locator('#cabezaFamilia')).toHaveValue('Prueba de actualización');

  expect((await fotoDelAlmacenamiento()).aps_encuestas).toEqual(antes.aps_encuestas);
  expect(await sigueLaPendiente(), 'una ficha pendiente se perdió al actualizar').toBe(true);
  expect(excepciones, 'hubo excepciones al actualizar').toEqual([]);

  /* Se retiran el borrador y la ficha de prueba. */
  await pagina.evaluate(function (codigo) {
    window.reiniciarFichaEnCurso();
    window.eliminarEncuestaPorId('enc_' + codigo);
  }, CODIGO_PENDIENTE);
});

/* -------------------------------------------------------------------------
   10. EL TELÉFONO
   ------------------------------------------------------------------------- */

test('10. En el teléfono: sin zoom al escribir y sin desbordes de ancho', async function () {
  /* iOS acerca la página al enfocar un control editable con letra de menos de 16 px,
     y no la devuelve sola. */
  const controlesChicos = function (hoja) {
    return hoja.evaluate(function () {
      return Array.from(document.querySelectorAll('input, select, textarea')).filter(function (c) {
        if (['hidden', 'checkbox', 'radio', 'file'].indexOf(c.type) !== -1) return false;
        if (c.readOnly || c.disabled) return false;
        return parseFloat(getComputedStyle(c).fontSize) < 16;
      }).map(function (c) {
        return (c.id || c.name || c.className) + ' ' + getComputedStyle(c).fontSize;
      });
    });
  };
  const desborde = function (hoja) {
    return hoja.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
  };

  /* El acceso, en un teléfono sin sesión: con ella, entra de largo. */
  const navegador = await (esChromium() ? chromium : webkit).launch();
  const otro = await navegador.newContext(opcionesDelTelefono(test.info()));
  const acceso = await otro.newPage();
  await acceso.goto('/login.html');
  await expect(acceso.locator('#formAcceso')).toBeVisible();
  expect(await controlesChicos(acceso), 'acceso').toEqual([]);
  expect(await desborde(acceso), 'acceso').toBeLessThanOrEqual(0);
  await navegador.close();

  await abrir('/instalar');
  expect(await desborde(pagina), 'instalar').toBeLessThanOrEqual(0);

  await abrirYEntrar('/');
  expect(await desborde(pagina), 'inicio').toBeLessThanOrEqual(0);
  await foto('10-inicio');

  await irA('nueva');
  expect(await controlesChicos(pagina), 'formulario').toEqual([]);
  expect(await desborde(pagina), 'formulario').toBeLessThanOrEqual(0);
  await foto('10-formulario');

  await irA('historial');
  expect(await desborde(pagina), 'historial').toBeLessThanOrEqual(0);
  await foto('10-historial');
});

/* -------------------------------------------------------------------------
   11. CUÁNTO CABE
   ------------------------------------------------------------------------- */

test('11. Dispositivo lleno: se sueltan copias ya subidas, nunca lo pendiente', async function () {
  await abrirYEntrar('/');

  /* El navegador de verdad, con su cupo de verdad y copias de la ficha real, cifradas
     como queda cualquier ficha. */
  const medida = await pagina.evaluate(function () {
    const original = localStorage.getItem('aps_encuestas');
    const modelo = window.obtenerEncuestas().find(function (e) { return e.sincronizada === true; });
    const copia = function (codigo, subida) {
      return Object.assign({}, modelo, { id: 'copia-' + codigo, codigoFicha: 'COPIA-' + codigo, sincronizada: subida });
    };
    const sobre = function (codigo, subida) { return window.BOVEDA.sellarFichas([copia(codigo, subida)])[0]; };

    /* Diez pendientes y, hasta el borde, copias ya subidas. */
    const pendientes = [];
    for (let i = 0; i < 10; i++) pendientes.push(sobre('P' + i, false));
    const subidas = [];
    for (let i = 0; i < 5000; i++) {
      subidas.push(sobre('S' + i, true));
      try {
        localStorage.setItem('aps_encuestas', JSON.stringify(pendientes.concat(subidas)));
      } catch (error) {
        subidas.pop();
        localStorage.setItem('aps_encuestas', JSON.stringify(pendientes.concat(subidas)));
        break;
      }
    }

    const cuantas = pendientes.length + subidas.length;
    let lanzo = null;
    const inicioGuardado = performance.now();
    /* Hay que pedir sitio de sobra: el borde deja algo libre. */
    for (let i = 0; i < 3 && !lanzo; i++) {
      try { window.agregarEncuesta(copia('NUEVA' + i, false)); } catch (error) { lanzo = error.name; }
    }
    const msGuardar = (performance.now() - inicioGuardado) / 3;
    const inicioLectura = performance.now();
    const despues = window.obtenerEncuestas();
    const msLeer = performance.now() - inicioLectura;
    const salida = {
      fichaCaracteres: JSON.stringify(modelo).length,
      cuantas: cuantas,
      msGuardar: Math.round(msGuardar),
      msLeer: Math.round(msLeer),
      lanzo: lanzo,
      nuevas: despues.filter(function (e) { return /^COPIA-NUEVA/.test(e.codigoFicha); }).length,
      pendientes: despues.filter(function (e) { return e.sincronizada !== true; }).length,
      subidasAntes: subidas.length,
      subidasDespues: despues.filter(function (e) { return e.sincronizada === true; }).length
    };
    localStorage.setItem('aps_encuestas', original);
    return salida;
  });

  console.log('   Una ficha de tres integrantes: ' + medida.fichaCaracteres + ' caracteres. ' +
    'Caben ~' + medida.cuantas + ' fichas como ésta en este motor. Con el dispositivo lleno, guardar una tarda ~' +
    medida.msGuardar + ' ms y leerlas todas ' + medida.msLeer + ' ms.');
  expect(medida.lanzo).toBeNull();
  expect(medida.nuevas).toBe(3);
  expect(medida.pendientes, 'una pendiente se perdió').toBe(13);
  expect(medida.subidasDespues).toBeLessThan(medida.subidasAntes);

  /* Lleno sólo de pendientes y sin red: la ficha de la pantalla no se pierde y se
     dice qué hacer. */
  await quitarRed();
  await abrirYEntrar('/');
  const lleno = await pagina.evaluate(async function () {
    const original = localStorage.getItem('aps_encuestas');
    const modelo = window.obtenerEncuestas().find(function (e) { return e.sincronizada === true; });
    const lista = [];
    for (let i = 0; i < 5000; i++) {
      lista.push(window.BOVEDA.sellarFichas([Object.assign({}, modelo, { id: 'copia-' + i, codigoFicha: 'COPIA-' + i, sincronizada: false })])[0]);
      try {
        localStorage.setItem('aps_encuestas', JSON.stringify(lista));
      } catch (error) {
        lista.pop();
        localStorage.setItem('aps_encuestas', JSON.stringify(lista));
        break;
      }
    }
    /* Se cierra la ficha con todo el tamaño que traería una de verdad. */
    const formulario = document.getElementById('encuestaForm');
    const real = window.construirEncuestaDesdeDatos;
    window.construirEncuestaDesdeDatos = function () {
      return Object.assign({}, modelo, { id: 'copia-pantalla', codigoFicha: 'COPIA-PANTALLA', relleno: 'x'.repeat(200000) });
    };
    const guardo = await window.guardarYReiniciar({}, formulario, 'Guardada.');
    window.construirEncuestaDesdeDatos = real;
    const quedan = window.obtenerEncuestas();
    const salida = { guardo: guardo, pendientes: quedan.length, esperadas: lista.length, esta: quedan.some(function (e) { return e.codigoFicha === 'COPIA-PANTALLA'; }) };
    localStorage.setItem('aps_encuestas', original);
    return salida;
  });
  expect(lleno.guardo).toBe(false);
  expect(lleno.esta).toBe(false);
  expect(lleno.pendientes).toBe(lleno.esperadas);
  await expect(pagina.locator('.swal2-popup')).toContainText('No hay espacio en este equipo');
  await foto('11-sin-espacio');
  await pagina.getByRole('button', { name: 'Entendido' }).click();
  await devolverRed();
});

/* -------------------------------------------------------------------------
   12. DOS PERSONAS EN UN MISMO EQUIPO
   ------------------------------------------------------------------------- */

test('12. Dos personas en un mismo equipo: cada una ve y sube sólo lo suyo', async function () {
  const { Client } = require('pg');
  const { opcionesConexion } = require('../../api/_db');
  const { asegurarUsuarioDePrueba } = require('../_sesion_prueba');

  const OTRA = { documento: '1144099002', nombre: 'Prueba Auxiliar', rol: 'auxiliar_enfermeria', equipo: 'EBS12', clave: CLAVE };

  const conBase = async function (tarea) {
    const cliente = new Client(opcionesConexion(process.env.DATABASE_URL));
    await cliente.connect();
    try {
      return await tarea(cliente);
    } finally {
      await cliente.end();
    }
  };
  const firmaDe = function (codigo) {
    return conBase(async function (cliente) {
      const r = await cliente.query(`
        SELECT fu.numero_id FROM aps.ficha f JOIN aps.funcionario fu ON fu.id = f.responsable_id
         WHERE f.codigo = $1`, [codigo]);
      return r.rows.length ? r.rows[0].numero_id : null;
    });
  };
  await conBase(function (cliente) { return asegurarUsuarioDePrueba(cliente, OTRA); });

  /* Otro código del mismo dispositivo: un consecutivo que la prueba no usa. */
  const otroCodigo = function (consecutivo) {
    return codigoFicha.replace(/-\d{4}-(\d{8})$/, '-' + consecutivo + '-$1');
  };
  const CODIGO_UNA = otroCodigo('9001');
  const CODIGO_OTRA = otroCodigo('9002');
  const CODIGO_RECHAZADA = otroCodigo('9003');
  expect(CODIGO_UNA).not.toBe(codigoFicha);

  /* Una ficha real que se queda esperando señal, en la cola de quien tiene la sesión. */
  const dejarPendiente = function (codigo, responsable) {
    return pagina.evaluate(function (datos) {
      window.agregarEncuesta(Object.assign({}, datos.ficha, {
        id: 'enc_' + datos.codigo, codigoFicha: datos.codigo, sincronizada: false, responsableNumeroId: datos.responsable
      }));
      window.renderizarInicio();
    }, { ficha: fichaSinSubir, codigo: codigo, responsable: responsable });
  };
  const propias = function () {
    return pagina.evaluate(function () {
      return window.obtenerEncuestas().map(function (e) { return e.codigoFicha; });
    });
  };
  const cerrarSesionDesdeElMenu = async function () {
    await pagina.locator('.app-usuario').click();
    await pagina.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await pagina.waitForURL(/login/);
  };
  const entrar = async function (documento, clave) {
    await entrarCon(documento, clave);
    await pagina.waitForURL(function (url) { return !/login/.test(url.pathname); });
    await expect(pagina.locator('#appTabs')).toBeVisible();
  };
  const desborde = function () {
    return pagina.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
  };

  const modulo = function () { return pagina.locator('#sincronia'); };
  const titulo = function () { return pagina.locator('#sincronia .sincronia__titulo'); };
  const avisoAjenas = function () { return pagina.locator('#fichasAjenas'); };

  /* Lo que sale hacia la base, sea cual sea la pestaña. */
  const subidas = [];
  const espiar = function (peticion) {
    if (peticion.method() === 'POST' && /\/api\/guardar_encuesta/.test(peticion.url())) {
      subidas.push(JSON.parse(peticion.postData()).codigoFicha);
    }
  };
  contexto.on('request', espiar);

  /* --- Una persona deja una ficha sin subir y cierra sesión. --- */
  await abrirYEntrar('/');
  await dejarPendiente(CODIGO_UNA, DOCUMENTO);
  await expect(modulo()).toHaveAttribute('data-estado', 'pendiente');
  await expect(avisoAjenas()).toBeHidden();
  await cerrarSesionDesdeElMenu();

  /* Al salir ve que quedó allí. Sólo la cantidad: aquí nadie ha dicho quién es. */
  const avisoAcceso = pagina.locator('#avisoPendientes');
  await expect(avisoAcceso).toContainText('1 ficha sin subir');
  await expect(avisoAcceso).not.toContainText(DOCUMENTO);
  expect(await desborde(), 'acceso con el aviso').toBeLessThanOrEqual(0);
  await foto('12-acceso-con-pendientes');

  /* --- Entra la otra, con señal. --- */
  await entrar(OTRA.documento, OTRA.clave);

  await expect(titulo()).toHaveText('Nada suyo por subir');
  await expect(avisoAjenas()).toBeVisible();
  await expect(avisoAjenas()).toContainText('1 ficha sin subir de ' + USUARIO_PRUEBA.nombre);
  await expect(modulo()).not.toContainText(DOCUMENTO);
  expect(await desborde(), 'Inicio con el aviso').toBeLessThanOrEqual(0);
  await avisoAjenas().scrollIntoViewIfNeeded();
  await foto('12-aviso-de-fichas-ajenas');

  /* No ve lo de la otra persona: ni lo pendiente, ni la copia ya subida con todo su detalle. */
  expect(await propias()).toEqual([]);
  await irA('historial');
  await expect(pagina.locator('#view-historial')).not.toContainText(CODIGO_UNA);
  await irA('inicio');

  /* Sincronizar no se lleva nada ajeno. */
  await pagina.locator('#btnSincronizar').click();
  await expect(modulo()).toHaveAttribute('data-estado', 'listo', { timeout: 30000 });
  expect(subidas).toEqual([]);
  expect(await firmaDe(CODIGO_UNA)).toBeNull();
  await expect(avisoAjenas()).toBeVisible();

  /* Lo suyo sí sube, firmado por ella, y el módulo no dice que todo está en la base. */
  await dejarPendiente(CODIGO_OTRA, OTRA.documento);
  await expect(modulo()).toHaveAttribute('data-estado', 'pendiente');
  await expect(titulo()).toHaveText('1 ficha sin subir');
  await pagina.locator('#btnSincronizar').click();
  await expect(titulo()).toHaveText('Sus fichas están en la base', { timeout: 30000 });
  expect(subidas).toEqual([CODIGO_OTRA]);
  expect(await firmaDe(CODIGO_OTRA)).toBe(OTRA.documento);
  expect(await firmaDe(CODIGO_UNA)).toBeNull();

  /* --- Una pestaña que queda abierta no sigue mostrando a quien ya salió. --- */
  const otraPestana = await contexto.newPage();
  await otraPestana.goto('/');
  await otraPestana.locator('#bloqueoSesion input[name="clave"]').fill(OTRA.clave);
  await otraPestana.locator('#bloqueoSesion button[type="submit"]').click();
  await expect(otraPestana.locator('#appTabs')).toBeVisible({ timeout: 30000 });
  await pagina.bringToFront();
  await cerrarSesionDesdeElMenu();
  await otraPestana.waitForURL(/login/, { timeout: 15000 });
  await otraPestana.close();

  /* --- Vuelve la primera: encuentra lo suyo y lo sube con su firma. --- */
  await entrar(DOCUMENTO, CLAVE);
  await expect(titulo()).toHaveText('1 ficha sin subir');
  await expect(avisoAjenas()).toBeHidden();
  const deLaPrimera = await propias();
  expect(deLaPrimera).toContain(CODIGO_UNA);
  expect(deLaPrimera).toContain(codigoFicha);
  expect(deLaPrimera).not.toContain(CODIGO_OTRA);
  await irA('historial');
  await expect(pagina.locator('#view-historial')).toContainText(CODIGO_UNA);
  await irA('inicio');

  await pagina.locator('#btnSincronizar').click();
  await expect(titulo()).toHaveText('Todo está en la base', { timeout: 30000 });
  expect(subidas).toEqual([CODIGO_OTRA, CODIGO_UNA]);
  expect(await firmaDe(CODIGO_UNA)).toBe(DOCUMENTO);
  expect(await firmaDe(CODIGO_OTRA)).toBe(OTRA.documento);

  /* --- El servidor no firma lo que no es de la sesión, aunque la página se equivoque. --- */
  const rechazo = await pagina.evaluate(function (datos) {
    return fetch('/api/guardar_encuesta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, datos.ficha, { codigoFicha: datos.codigo, capturadaPor: datos.otra }))
    }).then(function (r) {
      return r.json().then(function (cuerpo) { return { estado: r.status, codigo: cuerpo.codigo }; });
    });
  }, { ficha: fichaSinSubir, codigo: CODIGO_RECHAZADA, otra: OTRA.documento });
  expect(rechazo).toEqual({ estado: 409, codigo: 'ficha_de_otra_persona' });
  expect(await firmaDe(CODIGO_RECHAZADA)).toBeNull();

  contexto.off('request', espiar);

  /* --- Lo que ya estaba en un teléfono, sin ninguna marca de dueño. --- */
  const original = await pagina.evaluate(function (datos) {
    const guardada = localStorage.getItem('aps_encuestas');
    const vieja = function (codigo, responsable) {
      const ficha = Object.assign({}, datos.ficha, { id: 'vieja-' + codigo, codigoFicha: codigo, sincronizada: false });
      delete ficha.capturadaPor;
      delete ficha.responsableNumeroId;
      if (responsable) ficha.responsableNumeroId = responsable;
      return ficha;
    };
    localStorage.setItem('aps_encuestas', JSON.stringify([
      vieja('VIEJA-PROPIA', datos.yo), vieja('VIEJA-AJENA', datos.otra),
      vieja('VIEJA-TERCERA', '1144000009'), vieja('VIEJA-SIN-DUENO', null)
    ]));
    return guardada;
  }, { ficha: fichaSinSubir, yo: DOCUMENTO, otra: OTRA.documento });

  await abrirYEntrar('/');
  await expect(pagina.locator('.swal2-popup')).toContainText('sin responsable');
  await pagina.getByRole('button', { name: 'Entendido' }).click();

  const trasMigrar = await pagina.evaluate(function () {
    const nombres = function (lista) { return lista.map(function (e) { return e.codigoFicha; }).sort(); };
    const crudas = JSON.parse(localStorage.getItem('aps_encuestas'));
    return {
      cuantas: crudas.length,
      /* Quien entra no puede cifrar lo de otra persona: espera a que entre. */
      enClaro: nombres(crudas.filter(function (e) { return !e.sellada; })),
      selladas: crudas.filter(function (e) { return e.sellada; }).map(function (e) { return e.capturadaPor; }),
      propias: nombres(window.obtenerEncuestas())
    };
  });
  expect(trasMigrar.cuantas, 'se perdió una ficha al migrar').toBe(4);
  expect(trasMigrar.enClaro).toEqual(['VIEJA-AJENA', 'VIEJA-TERCERA']);
  expect(trasMigrar.selladas).toEqual([DOCUMENTO, DOCUMENTO]);
  expect(trasMigrar.propias).toEqual(['VIEJA-PROPIA', 'VIEJA-SIN-DUENO']);
  await expect(avisoAjenas()).toContainText(OTRA.nombre + ' (1)');
  await expect(avisoAjenas()).toContainText('documento terminado en 0009 (1)');
  await expect(avisoAjenas()).not.toContainText('1144000009');
  await foto('12-migradas');

  await pagina.evaluate(function (guardada) { localStorage.setItem('aps_encuestas', guardada); }, original);
  expect(excepciones, 'hubo excepciones con dos personas en el equipo').toEqual([]);
});

/* -------------------------------------------------------------------------
   13. OLVIDÓ LA CONTRASEÑA
   ------------------------------------------------------------------------- */

test('13. Olvidó la contraseña: se la restablecen y sus fichas sin subir siguen ahí', async function () {
  const { Client } = require('pg');
  const { opcionesConexion } = require('../../api/_db');
  const { asegurarUsuarioDePrueba } = require('../_sesion_prueba');
  const { restablecerClave } = require('../../api/_usuarios');

  const conBase = async function (tarea) {
    const cliente = new Client(opcionesConexion(process.env.DATABASE_URL));
    await cliente.connect();
    try {
      return await tarea(cliente);
    } finally {
      await cliente.end();
    }
  };
  /* Lo que hace el administrador, contra la copia local de la base. */
  const restablecer = function (temporal) {
    return conBase(async function (cliente) {
      const id = (await cliente.query('SELECT id FROM aps.usuario WHERE documento = $1', [DOCUMENTO])).rows[0].id;
      await restablecerClave(cliente, id, { clave: temporal });
    });
  };
  const crearLaPropia = async function (temporal, nueva) {
    await abrir('/login.html');
    await entrarCon(DOCUMENTO, temporal);
    await pagina.locator('#claveNueva').fill(nueva);
    await pagina.locator('#claveRepetida').fill(nueva);
    await pagina.locator('#btnGuardarClave').click();
    await pagina.waitForURL(function (url) { return !/login/.test(url.pathname); }, { timeout: 30000 });
  };
  const codigos = function () {
    return pagina.evaluate(function () { return window.obtenerEncuestas().map(function (e) { return e.codigoFicha; }); });
  };
  const otroCodigo = function (consecutivo) { return codigoFicha.replace(/-\d{4}-(\d{8})$/, '-' + consecutivo + '-$1'); };
  const dejarPendiente = function (codigo) {
    return pagina.evaluate(function (datos) {
      window.agregarEncuesta(Object.assign({}, datos.ficha, { id: 'enc_' + datos.codigo, codigoFicha: datos.codigo, sincronizada: false }));
      window.renderizarInicio();
    }, { ficha: fichaSinSubir, codigo: codigo });
  };

  const NUEVA = 'ClaveTrasOlvidarla2026';
  const OTRA_NUEVA = 'OtraClaveTrasOlvidarla2026';
  const CODIGO = otroCodigo('9101');
  const CODIGO_SIN_CUSTODIA = otroCodigo('9102');

  try {
    await abrirYEntrar('/');
    await dejarPendiente(CODIGO);
    expect(await codigos()).toContain(CODIGO);
    const llaveAntes = await pagina.evaluate(function (documento) {
      return JSON.parse(localStorage.getItem('aps_boveda_' + documento)).id;
    }, DOCUMENTO);

    /* El administrador le da una temporal; ella entra con señal y crea la suya. */
    await restablecer('TemporalDeLaPrueba2026');
    await crearLaPropia('TemporalDeLaPrueba2026', NUEVA);

    /* Recién ingresada, no pide otra vez, y lo de antes se lee: es la misma llave. */
    await expect(velo()).toBeHidden({ timeout: 30000 });
    await expect(pagina.locator('#appTabs')).toBeVisible();
    expect(await codigos()).toContain(CODIGO);
    await expect(pagina.locator('#fichasDeOtraLlave')).toBeHidden();
    const meta = await pagina.evaluate(function (documento) {
      return JSON.parse(localStorage.getItem('aps_boveda_' + documento));
    }, DOCUMENTO);
    expect(meta.id).toBe(llaveAntes);
    expect(meta.anteriores).toEqual([]);

    /* Sin señal abre con la nueva y ya no con la vieja. */
    await quitarRed();
    await pagina.evaluate(function () { window.SESION.bloquear(); });
    await desbloquearCon(CLAVE);
    await expect(velo().locator('[data-bloqueo="error"]')).toContainText('incorrect');
    await expect(velo()).toBeVisible();
    await desbloquearCon(NUEVA);
    await expect(velo()).toBeHidden({ timeout: 30000 });
    await devolverRed();

    /* Y sube. */
    await pagina.locator('#btnSincronizar').click();
    await expect(pagina.locator('#sincronia .sincronia__titulo')).toContainText('Todo está en la base', { timeout: 30000 });
    expect(await fichasPendientes()).toBe(0);

    /* Sin custodia que sirva (no hubo señal desde que se creó, o falta el secreto en el
       servidor): nada se borra, y se abre si recuerda la contraseña anterior. */
    await dejarPendiente(CODIGO_SIN_CUSTODIA);
    await pagina.evaluate(function (documento) {
      const meta = JSON.parse(localStorage.getItem('aps_boveda_' + documento));
      meta.custodia = null;
      localStorage.setItem('aps_boveda_' + documento, JSON.stringify(meta));
    }, DOCUMENTO);
    await restablecer('TemporalDeLaPrueba2027');
    await crearLaPropia('TemporalDeLaPrueba2027', OTRA_NUEVA);
    await expect(velo()).toBeHidden({ timeout: 30000 });

    expect(await codigos(), 'sin la contraseña anterior no se debía leer').not.toContain(CODIGO_SIN_CUSTODIA);
    const aviso = pagina.locator('#fichasDeOtraLlave');
    await expect(aviso).toContainText('1 ficha sin subir guardada con su contraseña anterior');
    await expect(pagina.locator('#sincronia .sincronia__titulo')).toHaveText('Falta abrir lo guardado antes');
    await aviso.scrollIntoViewIfNeeded();
    await foto('13-fichas-con-la-contrasena-anterior');
    /* Sigue contando como pendiente en el aviso del acceso. */
    expect(await pagina.evaluate(function () { return window.PWA.fichasSinSubir(); })).toBeGreaterThan(0);

    await pagina.locator('#btnAbrirOtraLlave').click();
    const dialogo = pagina.locator('.swal2-popup');
    await dialogo.locator('input[type="password"]').fill('NoEsLaClave2026');
    await dialogo.locator('.swal2-confirm').click();
    await expect(dialogo.locator('.swal2-validation-message')).toContainText('no es su contraseña anterior');
    await dialogo.locator('input[type="password"]').fill(NUEVA);
    await dialogo.locator('.swal2-confirm').click();
    await expect(dialogo).toContainText('ya está disponible', { timeout: 30000 });
    await pagina.getByRole('button', { name: 'Entendido' }).click();

    expect(await codigos()).toContain(CODIGO_SIN_CUSTODIA);
    await expect(aviso).toBeHidden();
    const llaves = await pagina.evaluate(function (documento) {
      const meta = JSON.parse(localStorage.getItem('aps_boveda_' + documento));
      const mias = JSON.parse(localStorage.getItem('aps_encuestas')).filter(function (e) { return e.capturadaPor === documento; });
      return { anteriores: meta.anteriores.length, id: meta.id, deLaLlaveDeHoy: mias.every(function (e) { return e.sellada.split('.')[1] === meta.id; }) };
    }, DOCUMENTO);
    expect(llaves.anteriores).toBe(0);
    expect(llaves.deLaLlaveDeHoy).toBe(true);

    expect(excepciones, 'hubo excepciones al recuperar').toEqual([]);
  } finally {
    await conBase(function (cliente) { return asegurarUsuarioDePrueba(cliente); });
  }
});

test('Nada salió a terceros en todo el recorrido', async function () {
  expect(externas, 'la aplicación pidió algo fuera de su propio origen').toEqual([]);
});
