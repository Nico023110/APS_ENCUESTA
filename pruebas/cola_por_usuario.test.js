/* =========================================================================
   Dos personas en un mismo equipo: la cola de fichas
   -------------------------------------------------------------------------
       node pruebas/cola_por_usuario.test.js

   La lista de fichas del dispositivo era una sola. Quien sincronizaba subía
   también lo de los demás, y el servidor, que firma con la sesión, se lo
   atribuía a quien no hizo la visita; además lo veía en su historial.

   Monta la aplicación real en jsdom, varias veces sobre el mismo almacenamiento
   (el «equipo»), y comprueba que:
     1. cada persona ve y sube sólo lo suyo;
     2. pasar a esta forma no pierde ni reescribe ninguna ficha de las que ya
        están en los dispositivos;
     3. escribir lo propio no toca lo ajeno;
     4. el aviso dice de quién son las pendientes ajenas, sin mostrar documentos;
     5. con el dispositivo lleno se suelta primero lo ya subido de otra persona,
        y nunca lo pendiente de nadie;
     6. el servidor no firma una ficha que no es de quien tiene la sesión.

   El recorrido en un navegador de verdad es la prueba 12 de pruebas/e2e/pwa.spec.js.
   No necesita base de datos ni servidor. Sólo datos inventados.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const leer = function (archivo) { return fs.readFileSync(path.join(RAIZ, archivo), 'utf8'); };

const html = leer('index.html');
const fuentes = ['roles.js', 'acceso_local.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js',
  'geocodificacion.js', 'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'pruebas/_boveda_abierta.js', 'captura_local.js', 'app.js']
  .map(leer)
  .join('\n;\n');

let pasadas = 0;
let fallidas = 0;
function check(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK    ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle !== undefined ? '\n        ' + detalle : ''));
  }
}

const esperar = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); };

/* ---------------------------------------------------------
   El equipo, las personas y las fichas
   --------------------------------------------------------- */

const ANA = { id: 1, documento: '1144000001', nombre: 'Ana Ruiz', rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 100 };
const LUIS = { id: 2, documento: '1144000002', nombre: 'Luis Mora', rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 200 };
const TERCERA = '1144000399';

const HOY = new Date().toISOString().split('T')[0];

function ficha(codigo, extras) {
  return Object.assign({
    id: 'enc_' + codigo, codigoFicha: codigo, sincronizada: false, fechaRegistro: new Date().toISOString(),
    fechaDiligenciamiento: HOY, territorio: 'T49', microterritorio: 'MT01', hogaresEnVivienda: 1,
    familias: [], planCuidado: { pendiente: false, accionesRegistradas: 1, alertasSinConducta: 0 }
  }, extras);
}

const de = function (persona, extras) {
  return Object.assign({ responsableNumeroId: persona.documento }, extras);
};

/* Lo que trae el dispositivo y, aparte, lo que ya está en la base: lo subido que
   aquí figura y lo que suba cada prueba, con la firma de quien lo subió. */
function equipoNuevo(fichas) {
  const base = new Map();
  fichas.filter(function (f) { return f.sincronizada === true; }).forEach(function (f) {
    base.set(f.codigoFicha, filaDeLaBase(f, f.capturadaPor || f.responsableNumeroId));
  });
  return { almacen: { aps_encuestas: JSON.stringify(fichas), aps_semilla_retirada: 'si' }, base: base };
}

function filaDeLaBase(f, firma) {
  return {
    codigoFicha: f.codigoFicha, fechaRegistro: f.fechaRegistro, territorio: f.territorio,
    microterritorio: f.microterritorio, firma: firma
  };
}

const crudo = function (equipo) { return JSON.parse(equipo.almacen.aps_encuestas); };
const codigos = function (lista) { return lista.map(function (f) { return f.codigoFicha; }).sort().join(); };
const delEquipo = function (equipo, codigo) { return crudo(equipo).find(function (f) { return f.codigoFicha === codigo; }); };

/* Abrir la aplicación en ese equipo con la sesión de esa persona. */
async function abrir(equipo, usuario, opciones) {
  const o = opciones || {};
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  const almacen = equipo.almacen;
  const escrituras = [];

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: function (k) { return k in almacen ? almacen[k] : null; },
      setItem: function (k, v) { escrituras.push(k); almacen[k] = String(v); },
      removeItem: function (k) { delete almacen[k]; }
    },
    configurable: true
  });

  let enLinea = o.enLinea !== false;
  Object.defineProperty(window.navigator, 'onLine', { get: function () { return enLinea; }, configurable: true });
  window.navigator.geolocation = { getCurrentPosition: function () {} };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.SESION = { usuario: function () { return usuario; } };

  const avisos = [];
  window.Swal = { fire: function (aviso) { avisos.push(aviso); return Promise.resolve({}); } };

  const enviadas = [];
  const responder = function (estado, cuerpo) {
    return { ok: estado >= 200 && estado < 300, status: estado, json: function () { return Promise.resolve(cuerpo); } };
  };
  window.fetch = function (url, conf) {
    const ruta = String(url);
    /* Lo que firmó esa persona: la vista más estrecha que da el servidor, así una
       copia ajena en el dispositivo no se puede confundir con una fila suya. */
    if (ruta.indexOf('/api/listar_fichas') === 0) {
      return Promise.resolve(responder(200, Array.from(equipo.base.values())
        .filter(function (fila) { return fila.firma === usuario.documento; })));
    }
    if (ruta === '/api/guardar_encuesta') {
      const cuerpo = JSON.parse(conf.body);
      enviadas.push(cuerpo);
      if (o.rechazo) return Promise.resolve(responder(o.rechazo.estado, o.rechazo.cuerpo));
      const recibir = function () {
        equipo.base.set(cuerpo.codigoFicha, filaDeLaBase(cuerpo, usuario.documento));
        return responder(200, { codigos: null });
      };
      /* La respuesta se queda esperando hasta que la prueba la suelta. */
      if (o.retenidas) return new Promise(function (resolver) { o.retenidas.push(function () { resolver(recibir()); }); });
      return Promise.resolve(recibir());
    }
    return Promise.reject(new Error('sin red'));
  };

  const errores = [];
  window.addEventListener('error', function (e) { errores.push(e.message); });

  window.eval(fuentes + `;
    window.__api = {
      obtenerEncuestas, obtenerEncuestasParaMostrar, agregarEncuesta, reemplazarEncuesta, eliminarEncuestaPorId,
      retirarLocalesQueYaNoEstanEnLaBase, sincronizarEncuestas, renderizarEstadoSync, guardarYReiniciar,
      fijarConstruccion: function (f) { construirEncuestaDesdeDatos = f; },
      fijarCorreccion: function (id, desdeServidor) { encuestaEnCorreccion = id; correccionDesdeServidor = desdeServidor; }
    };`);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  await esperar(30);

  const $ = function (s) { return window.document.querySelector(s); };
  return {
    window: window, $: $, api: window.__api, avisos: avisos, enviadas: enviadas, escrituras: escrituras, errores: errores,
    estado: function () { return $('#sincronia').dataset.estado; },
    titulo: function () { return $('.sincronia__titulo').textContent; },
    detalle: function () { return $('.sincronia__detalle').textContent; },
    aviso: function () { return $('#fichasAjenas').hidden ? null : $('#fichasAjenas').textContent.trim(); },
    historial: function () { return $('#historialTableBody').textContent; },
    propias: function () { return codigos(window.__api.obtenerEncuestas()); },
    avisoDeAdopcion: function () { return avisos.filter(function (a) { return /sin responsable/.test(a.text); }); },
    sinSenal: function () { enLinea = false; window.dispatchEvent(new window.Event('offline')); },
    conSenal: function () { enLinea = true; window.dispatchEvent(new window.Event('online')); }
  };
}

/* ---------------------------------------------------------
   Lo que se prueba sin montar la aplicación: el cupo y el servidor
   --------------------------------------------------------- */

function trozo(archivo, desde, hasta) {
  const texto = leer(archivo).replace(/\r\n/g, '\n');
  const a = texto.indexOf(desde);
  const b = texto.indexOf(hasta, a);
  if (a === -1 || b === -1) throw new Error('No se encontró ' + desde + ' en ' + archivo);
  return texto.slice(a, b);
}

const conRelleno = function (codigo, persona, subida) {
  return { id: codigo, codigoFicha: codigo, sincronizada: subida, capturadaPor: persona.documento, responsableNumeroId: persona.documento, relleno: 'x'.repeat(900) };
};

/* Las funciones reales de app.js y captura_local.js, con un almacén de cupo fijo. */
function montarCola(usuario, fichas, holgura) {
  const datos = new Map();
  datos.set('aps_encuestas', JSON.stringify(fichas));
  const usado = function () {
    let n = 0;
    datos.forEach(function (v, k) { n += k.length + v.length; });
    return n;
  };
  const cupo = usado() + holgura;
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
  const contexto = {
    localStorage: almacen,
    SESION: { usuario: function () { return usuario; } },
    console: { warn: function () {}, error: function () {} }
  };
  vm.runInNewContext(
    leer('pruebas/_boveda_abierta.js') +
    "const STORAGE_KEY = 'aps_encuestas';\n" +
    trozo('app.js', 'function documentoDeLaSesion()', '/**\n * Sustituye una ficha') +
    trozo('captura_local.js', 'function escribirLocal', 'function borrarLocal') +
    'this.api = { agregarEncuesta, escribirLocal };',
    contexto
  );
  return {
    api: contexto.api,
    todas: function () { return codigos(JSON.parse(datos.get('aps_encuestas'))); }
  };
}

/* El endpoint real, con la base y la sesión sustituidas. Sin red ni base: quien pasa
   el cotejo se detiene en que su cuenta no tiene equipo, sin escribir nada. */
function montarServidor(usuario) {
  const sustituir = function (relativa, exportaciones) {
    const ruta = require.resolve(path.join(RAIZ, relativa));
    require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: exportaciones };
  };
  const contador = { conexiones: 0 };
  const cliente = {
    query: async function (sql) {
      if (/FROM aps\.ficha f/.test(sql)) return { rows: [] };
      if (/^\s*ROLLBACK/.test(sql)) return { rows: [] };
      throw new Error('consulta fuera de la prueba');
    },
    release: function () {}
  };
  sustituir('api/_db.js', {
    obtenerPool: function () {
      return { connect: async function () { contador.conexiones++; return cliente; } };
    }
  });
  sustituir('api/_auth.js', { requerirSesion: async function () { return usuario; } });
  const guardar = require(path.join(RAIZ, 'api', 'guardar_encuesta.js'));

  return {
    contador: contador,
    enviar: async function (cuerpo) {
      const respuesta = { estado: 200, cuerpo: null };
      const res = {
        status: function (codigo) { respuesta.estado = codigo; return this; },
        json: function (c) { respuesta.cuerpo = c; return this; }
      };
      const original = console.error;
      console.error = function () {};
      try {
        await guardar({ method: 'POST', body: cuerpo }, res);
      } finally {
        console.error = original;
      }
      return respuesta;
    }
  };
}

/* ---------------------------------------------------------
   Las pruebas
   --------------------------------------------------------- */

async function principal() {
  console.log('\n=== 1. Cada persona ve y sube sólo lo suyo ===');

  const equipo = equipoNuevo([
    ficha('ANA-VIEJA', de(ANA)),
    ficha('ANA-NUEVA', de(ANA, { capturadaPor: ANA.documento }))
  ]);
  const antesDeLuis = equipo.almacen.aps_encuestas;
  const luis = await abrir(equipo, LUIS);

  check('La aplicación arranca sin errores de JS', luis.errores.length === 0, luis.errores.join(' | '));
  check('Luis no tiene las pendientes de Ana', luis.propias() === '', luis.propias());
  check('  ni se las muestra lo que leen las vistas', luis.api.obtenerEncuestasParaMostrar().length === 0);
  check('  ni el historial', !/ANA-/.test(luis.historial()), luis.historial());
  check('  no le cuentan como suyas', luis.estado() === 'listo' && luis.titulo() === 'Nada suyo por subir', luis.titulo());
  check('  y le dicen que están ahí', /2 fichas sin subir/.test(luis.aviso() || ''), luis.aviso());

  await luis.api.sincronizarEncuestas();
  check('Sincronizar no sube nada de Ana', luis.enviadas.length === 0, codigos(luis.enviadas));
  check('  no llega nada a la base', equipo.base.size === 0);
  check('  las fichas de Ana quedan exactamente como estaban', equipo.almacen.aps_encuestas === antesDeLuis);
  check('  el aviso sigue', /2 fichas sin subir/.test(luis.aviso() || ''), luis.aviso());

  luis.api.agregarEncuesta(ficha('LUIS-1', de(LUIS)));
  luis.api.renderizarEstadoSync();
  check('Lo suyo sí le cuenta', luis.estado() === 'pendiente' && luis.titulo() === '1 ficha sin subir', luis.titulo());
  check('  sin mezclarlo con lo de Ana', /2 fichas sin subir/.test(luis.aviso() || ''), luis.aviso());
  check('  y queda con su marca de dueño', delEquipo(equipo, 'LUIS-1').capturadaPor === LUIS.documento);

  await luis.api.sincronizarEncuestas();
  check('Sube sólo lo suyo', codigos(luis.enviadas) === 'LUIS-1', codigos(luis.enviadas));
  check('  diciendo de quién es', luis.enviadas[0].capturadaPor === LUIS.documento);
  check('  con su firma', equipo.base.get('LUIS-1').firma === LUIS.documento);
  check('  y el título no afirma que todo está en la base',
    luis.titulo() === 'Sus fichas están en la base' && /^1 ficha subida hoy/.test(luis.detalle()), luis.titulo() + ' / ' + luis.detalle());

  const ana = await abrir(equipo, ANA);
  check('Ana vuelve y tiene las suyas, las de antes de la marca y las de después', ana.propias() === 'ANA-NUEVA,ANA-VIEJA', ana.propias());
  check('  no la copia de Luis', !/LUIS-/.test(ana.propias()));
  check('  su historial las muestra pendientes', /ANA-VIEJA/.test(ana.historial()) && /ANA-NUEVA/.test(ana.historial()) && !/LUIS-/.test(ana.historial()));
  check('  el módulo las cuenta', ana.estado() === 'pendiente' && ana.titulo() === '2 fichas sin subir', ana.titulo());
  check('  lo ya subido de Luis no le genera aviso', ana.aviso() === null, ana.aviso());
  check('  la hora de sincronización de Luis no es la suya',
    Boolean(equipo.almacen['aps_ultima_sincronizacion_' + LUIS.documento]) && !equipo.almacen['aps_ultima_sincronizacion_' + ANA.documento] &&
    ana.detalle() === 'Sólo están en este equipo', ana.detalle());

  await ana.api.sincronizarEncuestas();
  check('Ana sube las dos', codigos(ana.enviadas) === 'ANA-NUEVA,ANA-VIEJA', codigos(ana.enviadas));
  check('  también la de antes de la marca dice de quién es', ana.enviadas.every(function (f) { return f.capturadaPor === ANA.documento; }));
  check('  con su firma, no la de Luis', equipo.base.get('ANA-VIEJA').firma === ANA.documento && equipo.base.get('ANA-NUEVA').firma === ANA.documento);
  check('  sin nada ajeno pendiente, «Todo está en la base»', ana.titulo() === 'Todo está en la base', ana.titulo());
  check('  nada se perdió', codigos(crudo(equipo)) === 'ANA-NUEVA,ANA-VIEJA,LUIS-1', codigos(crudo(equipo)));

  console.log('\n=== 2. Lo que ya está en los dispositivos no se pierde ===');

  /* Una lista como la de hoy en un equipo de verdad: sin ninguna marca de dueño. */
  const vieja = [
    ficha('ANA-PEND', de(ANA)),
    ficha('ANA-SUBIDA', de(ANA, { sincronizada: true })),
    ficha('ANA-CORREGIDA', de(ANA, { esCorreccion: true })),
    ficha('LUIS-PEND', de(LUIS)),
    ficha('LUIS-SUBIDA', de(LUIS, { sincronizada: true })),
    ficha('TERCERA-PEND', { responsableNumeroId: TERCERA }),
    ficha('SIN-PEND'),
    ficha('SIN-SUBIDA', { sincronizada: true }),
    ficha('F-00123'),
    ficha('F-00456', { responsableNumeroId: TERCERA })
  ];
  const conSemilla = equipoNuevo(vieja);
  delete conSemilla.almacen.aps_semilla_retirada;
  conSemilla.base.get('SIN-SUBIDA').firma = LUIS.documento;
  const REALES = 'ANA-CORREGIDA,ANA-PEND,ANA-SUBIDA,LUIS-PEND,LUIS-SUBIDA,SIN-PEND,SIN-SUBIDA,TERCERA-PEND';

  const primero = await abrir(conSemilla, LUIS);
  check('Al abrir por primera vez no se pierde ninguna', codigos(crudo(conSemilla)) === REALES, codigos(crudo(conSemilla)));
  check('  salvo las de demostración, sin importar qué responsable traigan',
    !/F-00/.test(conSemilla.almacen.aps_encuestas) && conSemilla.almacen.aps_semilla_retirada === 'si');
  check('Quien entra ve las suyas por su ítem 13, y las que no traen responsable',
    primero.propias() === 'LUIS-PEND,LUIS-SUBIDA,SIN-PEND,SIN-SUBIDA', primero.propias());
  check('  las de otra persona no', !/ANA-|TERCERA-/.test(primero.historial()), primero.historial());
  check('  las sin responsable quedan marcadas a su nombre',
    delEquipo(conSemilla, 'SIN-PEND').capturadaPor === LUIS.documento && delEquipo(conSemilla, 'SIN-SUBIDA').capturadaPor === LUIS.documento);
  check('  y se le dice, porque subirlas es firmarlas',
    primero.avisoDeAdopcion().length === 1 && /1 ficha sin responsable/.test(primero.avisoDeAdopcion()[0].text) &&
    /firmado por usted/.test(primero.avisoDeAdopcion()[0].text), JSON.stringify(primero.avisos));
  check('  las identificadas siguen sin tocar', !('capturadaPor' in delEquipo(conSemilla, 'ANA-PEND')) && !('capturadaPor' in delEquipo(conSemilla, 'TERCERA-PEND')));
  const originales = new Map(vieja.map(function (f) { return [f.codigoFicha, JSON.stringify(f)]; }));
  check('  con todos sus datos', ['ANA-PEND', 'ANA-SUBIDA', 'ANA-CORREGIDA', 'LUIS-PEND', 'LUIS-SUBIDA', 'TERCERA-PEND'].every(function (c) {
    return JSON.stringify(delEquipo(conSemilla, c)) === originales.get(c);
  }));

  const trasPrimero = conSemilla.almacen.aps_encuestas;
  const segundo = await abrir(conSemilla, LUIS);
  check('Abrir otra vez no vuelve a avisar', segundo.avisoDeAdopcion().length === 0, JSON.stringify(segundo.avisos));
  check('  ni cambia nada', conSemilla.almacen.aps_encuestas === trasPrimero);

  const duena = await abrir(conSemilla, ANA);
  check('La otra persona ve las suyas, también la corregida', duena.propias() === 'ANA-CORREGIDA,ANA-PEND,ANA-SUBIDA', duena.propias());
  check('  las sin responsable ya tienen dueño y no se le ofrecen', !/SIN-/.test(duena.propias()) && duena.avisoDeAdopcion().length === 0);
  check('  abrir no reescribe la lista: migrar no mueve nada',
    conSemilla.almacen.aps_encuestas === trasPrimero && duena.escrituras.indexOf('aps_encuestas') === -1);
  check('  y le dicen de quién son las demás', /de otras personas/.test(duena.aviso() || ''), duena.aviso());

  await duena.api.sincronizarEncuestas();
  check('Sube sólo lo suyo que falta', codigos(duena.enviadas) === 'ANA-CORREGIDA,ANA-PEND', codigos(duena.enviadas));
  check('  y la lista sigue completa', codigos(crudo(conSemilla)) === REALES, codigos(crudo(conSemilla)));
  check('  con lo ajeno pendiente', delEquipo(conSemilla, 'LUIS-PEND').sincronizada === false && delEquipo(conSemilla, 'TERCERA-PEND').sincronizada === false);

  const sinResponsable = equipoNuevo([ficha('SIN-SUBIDA', { sincronizada: true })]);
  sinResponsable.base.get('SIN-SUBIDA').firma = LUIS.documento;
  const soloSubida = await abrir(sinResponsable, LUIS);
  check('Una copia ya subida sin responsable no pide aviso: no hay nada que firmar', soloSubida.avisoDeAdopcion().length === 0);

  console.log('\n=== 3. Escribir lo propio no toca lo ajeno ===');

  const compartido = equipoNuevo([
    ficha('ANA-P', de(ANA, { capturadaPor: ANA.documento })),
    ficha('ANA-S', de(ANA, { capturadaPor: ANA.documento, sincronizada: true })),
    ficha('LUIS-P', de(LUIS, { capturadaPor: LUIS.documento })),
    ficha('LUIS-S', de(LUIS, { capturadaPor: LUIS.documento, sincronizada: true }))
  ]);
  const deAna = function () {
    return JSON.stringify(crudo(compartido).filter(function (f) { return f.capturadaPor === ANA.documento; }));
  };
  const anaIntacta = deAna();
  const escritor = await abrir(compartido, LUIS, { enLinea: false });

  escritor.api.agregarEncuesta(ficha('LUIS-N', de(LUIS)));
  check('Agregar', codigos(crudo(compartido)) === 'ANA-P,ANA-S,LUIS-N,LUIS-P,LUIS-S' && deAna() === anaIntacta, codigos(crudo(compartido)));

  escritor.api.reemplazarEncuesta('enc_LUIS-N', ficha('LUIS-N', de(LUIS, { hogaresEnVivienda: 2 })));
  check('Corregir lo propio', delEquipo(compartido, 'LUIS-N').hogaresEnVivienda === 2 && deAna() === anaIntacta);

  escritor.api.eliminarEncuestaPorId('enc_LUIS-N');
  check('Eliminar lo propio', !delEquipo(compartido, 'LUIS-N') && deAna() === anaIntacta, codigos(crudo(compartido)));

  escritor.api.eliminarEncuestaPorId('enc_ANA-P');
  check('Eliminar con el id de una ajena no la borra: no es de esta sesión', Boolean(delEquipo(compartido, 'ANA-P')) && deAna() === anaIntacta);

  /* El listado sólo trae lo que esa persona puede ver. Antes, una copia ajena que no
     venía en él se retiraba del dispositivo. */
  escritor.api.retirarLocalesQueYaNoEstanEnLaBase([{ codigoFicha: 'OTRA' }]);
  check('Lo que la base ya no tiene se retira sólo de lo propio',
    !delEquipo(compartido, 'LUIS-S') && delEquipo(compartido, 'LUIS-P') && deAna() === anaIntacta, codigos(crudo(compartido)));

  /* Capturar sin señal, por el camino real de «Guardar». */
  const formulario = escritor.$('#encuestaForm');
  escritor.api.fijarConstruccion(function () { return ficha('LUIS-CAPTURA', de(LUIS)); });
  await escritor.api.guardarYReiniciar({}, formulario, 'Guardada.');
  check('Lo capturado aquí queda a nombre de quien tiene la sesión', delEquipo(compartido, 'LUIS-CAPTURA').capturadaPor === LUIS.documento);

  /* Corregir sin señal la ficha de otra persona: el ítem 13 sigue siendo el original,
     y la corrección pendiente es de quien corrige. */
  escritor.api.fijarConstruccion(function () { return ficha('ANA-REMOTA', de(ANA)); });
  escritor.api.fijarCorreccion('ANA-REMOTA', { codigoFicha: 'ANA-REMOTA', fechasModificacion: [] });
  await escritor.api.guardarYReiniciar({}, formulario, 'Guardada.');
  const corregida = delEquipo(compartido, 'ANA-REMOTA');
  check('Una corrección de la ficha de otra persona es de quien corrige',
    corregida && corregida.capturadaPor === LUIS.documento && corregida.responsableNumeroId === ANA.documento && corregida.sincronizada === false,
    JSON.stringify(corregida));
  check('  la ve quien corrige', /ANA-REMOTA/.test(escritor.propias()), escritor.propias());
  const duenaOriginal = await abrir(compartido, ANA);
  check('  no quien firmó la ficha', !/ANA-REMOTA/.test(duenaOriginal.propias()), duenaOriginal.propias());

  /* Con señal, «Guardar» manda la marca que el servidor coteja. */
  const conSenal = await abrir(compartido, LUIS);
  conSenal.api.fijarConstruccion(function () { return ficha('LUIS-DIRECTA', de(LUIS)); });
  await conSenal.api.guardarYReiniciar({}, conSenal.$('#encuestaForm'), 'Guardada.');
  check('Guardar con señal también dice de quién es', conSenal.enviadas.length === 1 && conSenal.enviadas[0].capturadaPor === LUIS.documento, JSON.stringify(conSenal.enviadas.length));

  /* Guardar mientras sube: lo de antes de la marca recibe su marca en la primera
     escritura, y eso no puede confundirse con una corrección. */
  const retenidas = [];
  const enSubida = equipoNuevo([
    ficha('LUIS-VIEJA-1', de(LUIS)),
    ficha('LUIS-VIEJA-2', de(LUIS)),
    ficha('ANA-P', de(ANA))
  ]);
  const anaAntes = JSON.stringify(delEquipo(enSubida, 'ANA-P'));
  const subiendo = await abrir(enSubida, LUIS, { retenidas: retenidas });
  const subida = subiendo.api.sincronizarEncuestas();
  await esperar();
  subiendo.api.agregarEncuesta(ficha('LUIS-DURANTE', de(LUIS)));
  /* Se suelta lo que vaya saliendo hasta que termine: si sale una ficha de más, la
     prueba tiene que fallar, no quedarse esperando y salir como si hubiera pasado. */
  let termino = false;
  subida.then(function () { termino = true; });
  while (!termino) {
    if (retenidas.length > 0) retenidas.shift()();
    await esperar(5);
  }
  check('Guardar mientras sube no pierde la ficha, y queda pendiente', delEquipo(enSubida, 'LUIS-DURANTE').sincronizada === false);
  check('  las de antes de la marca suben las dos, con su marca',
    delEquipo(enSubida, 'LUIS-VIEJA-1').sincronizada === true && delEquipo(enSubida, 'LUIS-VIEJA-2').sincronizada === true &&
    delEquipo(enSubida, 'LUIS-VIEJA-2').capturadaPor === LUIS.documento, codigos(subiendo.enviadas));
  check('  y lo ajeno ni sube ni cambia', codigos(subiendo.enviadas) === 'LUIS-VIEJA-1,LUIS-VIEJA-2' &&
    JSON.stringify(delEquipo(enSubida, 'ANA-P')) === anaAntes, codigos(subiendo.enviadas));

  console.log('\n=== 4. El aviso ===');

  const copiaDeAcceso = function (nombre) {
    return JSON.stringify({ version: 1, sal: 'x', hash: 'y', iteraciones: 1, confirmadoEn: Date.now(), fallos: 0, bloqueadoHasta: 0, perfil: { nombre: nombre } });
  };

  /* La misma pantalla con otro contenido en el equipo: el aviso se lee del
     almacenamiento cada vez, y montar la aplicación cuesta segundos. */
  const pizarra = equipoNuevo([]);
  const vista = await abrir(pizarra, LUIS);
  const conFichas = function (fichas, nombres) {
    pizarra.almacen.aps_encuestas = JSON.stringify(fichas);
    Object.keys(pizarra.almacen).forEach(function (k) {
      if (k.indexOf('aps_acceso_local_') === 0) delete pizarra.almacen[k];
    });
    Object.keys(nombres || {}).forEach(function (documento) {
      pizarra.almacen['aps_acceso_local_' + documento] = copiaDeAcceso(nombres[documento]);
    });
    vista.api.renderizarEstadoSync();
  };
  const conNombreDeAna = {};
  conNombreDeAna[ANA.documento] = ANA.nombre;

  check('En un equipo sin nada, «Nada por subir» y sin aviso', vista.titulo() === 'Nada por subir' && vista.aviso() === null, vista.titulo());

  conFichas([ficha('ANA-1', de(ANA)), ficha('ANA-2', de(ANA))], conNombreDeAna);
  check('Con su nombre, si ya entró en este equipo',
    vista.aviso() === 'En este equipo hay 2 fichas sin subir de Ana Ruiz. Sólo esa persona puede subirlas: pídale que ingrese aquí con señal y toque «Sincronizar ahora».',
    vista.aviso());

  vista.sinSenal();
  check('  también sin señal', vista.estado() === 'sin-red' && /Ana Ruiz/.test(vista.aviso() || ''), vista.aviso());
  vista.conSenal();

  conFichas([ficha('ANA-1', de(ANA))], conNombreDeAna);
  check('  en singular si es una', /hay 1 ficha sin subir de Ana Ruiz\. Sólo esa persona puede subirla:/.test(vista.aviso() || ''), vista.aviso());

  conFichas([ficha('TERCERA-1', { responsableNumeroId: TERCERA })]);
  check('Si no se sabe su nombre, por el final de su documento',
    /de otra persona \(documento terminado en 0399\)\./.test(vista.aviso() || ''), vista.aviso());
  check('  nunca el documento entero', vista.$('#sincronia').textContent.indexOf(TERCERA) === -1);

  conFichas([
    ficha('ANA-1', de(ANA)), ficha('ANA-2', de(ANA)), ficha('ANA-S', de(ANA, { sincronizada: true })),
    ficha('TERCERA-1', { responsableNumeroId: TERCERA })
  ], conNombreDeAna);
  check('Varias personas: cada una con lo suyo, sin contar lo ya subido',
    vista.aviso() === 'En este equipo hay 3 fichas sin subir de otras personas: Ana Ruiz (2), documento terminado en 0399 (1). ' +
    'Sólo quien las capturó puede subirlas: pídales que ingresen aquí con señal y toquen «Sincronizar ahora».', vista.aviso());

  const conEtiqueta = {};
  conEtiqueta[ANA.documento] = '<b>Ana</b>';
  conFichas([ficha('ANA-1', de(ANA))], conEtiqueta);
  check('Un nombre se pinta como texto', vista.$('#fichasAjenas b') === null && /<b>Ana<\/b>/.test(vista.aviso() || ''), vista.aviso());

  conFichas([ficha('SIN-1')]);
  check('Una ficha todavía sin dueño no rompe el aviso ni cuenta en él', vista.aviso() === null, vista.aviso());

  conFichas([ficha('LUIS-1', de(LUIS)), ficha('ANA-S', de(ANA, { sincronizada: true }))]);
  check('Sin pendientes ajenas no hay aviso', vista.aviso() === null, vista.aviso());
  check('  y el título es el de siempre', vista.titulo() === '1 ficha sin subir', vista.titulo());

  /* Sin documento en la sesión no hay a quién separarle nada. */
  const sinDocumento = equipoNuevo([ficha('X-1', de(ANA)), ficha('X-2')]);
  const anonima = await abrir(sinDocumento, { rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 300 });
  check('Sin documento en la sesión se ve la lista como siempre, sin marcar nada',
    anonima.propias() === 'X-1,X-2' && !/capturadaPor/.test(sinDocumento.almacen.aps_encuestas) && anonima.aviso() === null, anonima.propias());

  console.log('\n=== 5. Dispositivo lleno ===');

  let cola = montarCola(ANA, [
    conRelleno('ANA-P', ANA, false), conRelleno('ANA-S', ANA, true),
    conRelleno('LUIS-P', LUIS, false), conRelleno('LUIS-S', LUIS, true)
  ], 10);
  cola.api.agregarEncuesta(conRelleno('ANA-N1', ANA, false));
  check('Lo primero que sale es la copia ya subida de otra persona', cola.todas() === 'ANA-N1,ANA-P,ANA-S,LUIS-P', cola.todas());
  cola.api.agregarEncuesta(conRelleno('ANA-N2', ANA, false));
  check('  después la propia', cola.todas() === 'ANA-N1,ANA-N2,ANA-P,LUIS-P', cola.todas());

  let lanzo = null;
  try { cola.api.agregarEncuesta(conRelleno('ANA-N3', ANA, false)); } catch (error) { lanzo = error.name; }
  check('Sólo con pendientes no se suelta ninguna, de nadie, y falla para que se avise', lanzo === 'QuotaExceededError', lanzo);
  check('  siguen todas', cola.todas() === 'ANA-N1,ANA-N2,ANA-P,LUIS-P', cola.todas());

  cola = montarCola(ANA, [conRelleno('ANA-P', ANA, false), conRelleno('LUIS-P', LUIS, false), conRelleno('LUIS-S', LUIS, true)], 10);
  check('La ficha en curso le gana a una copia ya subida, aunque sea de otra persona', cola.api.escribirLocal('aps_borrador_1', 'y'.repeat(900)) === true);
  check('  sale esa, no lo pendiente', cola.todas() === 'ANA-P,LUIS-P', cola.todas());

  console.log('\n=== 6. El servidor no firma lo que no es de la sesión ===');

  const servidor = montarServidor({ rol: 'enfermeria', equipoSaludId: 99, funcionarioId: 5, equipoCodigo: null, documento: ANA.documento });

  let r = await servidor.enviar({ codigoFicha: 'X', capturadaPor: LUIS.documento });
  check('Si la ficha es de otra persona, 409', r.estado === 409 && r.cuerpo.codigo === 'ficha_de_otra_persona', r.estado + ' ' + JSON.stringify(r.cuerpo));
  check('  sin tocar la base', servidor.contador.conexiones === 0, servidor.contador.conexiones);
  check('  con un mensaje que la aplicación sabe mostrar', Array.isArray(r.cuerpo.bloqueos) && /no es de quien capturó/.test(r.cuerpo.bloqueos[0].mensaje));
  check('  sin repetir ningún documento', JSON.stringify(r.cuerpo).indexOf(LUIS.documento) === -1 && JSON.stringify(r.cuerpo).indexOf(ANA.documento) === -1);
  const rechazoReal = { estado: r.estado, cuerpo: r.cuerpo };

  r = await servidor.enviar({ codigoFicha: 'X', capturadaPor: ' ' + ANA.documento + ' ' });
  check('Si es de la sesión, sigue', r.estado !== 409 && servidor.contador.conexiones === 1, r.estado);

  /* endpoint.test.js: «Equipo y responsable ajenos en el cuerpo => 200 con la firma de la sesión». */
  r = await servidor.enviar({ codigoFicha: 'X', responsableNumeroId: LUIS.documento });
  check('Sin la marca, el cuerpo no decide: firma la sesión, como siempre', r.estado !== 409 && servidor.contador.conexiones === 2, r.estado);

  const mal = equipoNuevo([ficha('ANA-1', de(ANA))]);
  const conRechazo = await abrir(mal, ANA, { rechazo: rechazoReal });
  await conRechazo.api.sincronizarEncuestas();
  check('Rechazada al sincronizar, sigue pendiente', delEquipo(mal, 'ANA-1').sincronizada === false && conRechazo.estado() === 'pendiente', conRechazo.estado());
  check('  y se dice qué hacer', conRechazo.avisos.some(function (a) { return /Cierre sesión y vuelva a ingresar/.test(a.text); }), JSON.stringify(conRechazo.avisos));

  conRechazo.api.fijarConstruccion(function () { return ficha('ANA-2', de(ANA)); });
  const guardo = await conRechazo.api.guardarYReiniciar({}, conRechazo.$('#encuestaForm'), 'Guardada.');
  check('Rechazada al guardar, no se guarda aquí y la ficha sigue en pantalla', guardo === false && !delEquipo(mal, 'ANA-2'), String(guardo));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  /* jsdom deja temporizadores vivos. */
  process.exit(fallidas > 0 ? 1 : 0);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
