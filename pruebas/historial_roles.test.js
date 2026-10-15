/* Prueba de lo que el historial ofrece a cada rol (RN-228 y RN-225). Monta la
   aplicación completa en jsdom con roles.js y una sesión simulada, fichas en
   el dispositivo y otras que sólo están en la base, y comprueba que:
     - el personal asistencial no corrige una ficha guardada sin autorización,
       pero sí evoluciona su plan (las del equipo; el técnico, las suyas) y
       corrige libremente la que aún no sube;
     - con una autorización vigente, «Corregir» se habilita;
     - la coordinación corrige cualquiera y autoriza, pero no elimina;
     - sólo el maestro elimina, y una ficha de la base se elimina de la base,
       con motivo. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
const fuentes = ['roles.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
  'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'captura_local.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
  .join('\n;\n');

let ok = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const HOY = new Date().toISOString().split('T')[0];
const COMPACTA = HOY.replace(/-/g, '');

function fichaLocal(id, codigo, sincronizada) {
  return {
    id: id, codigoFicha: codigo, sincronizada: sincronizada, fechaRegistro: new Date().toISOString(),
    consentimiento: 'si', fechaDiligenciamiento: HOY, equipoSaludId: 'EBS12', territorio: 'T49', microterritorio: 'MT01',
    hogaresEnVivienda: 1, familias: [], planCuidado: { pendiente: true, accionesRegistradas: 0, alertasSinConducta: 1 }
  };
}

function filaServidor(codigo, responsableId, extra) {
  return Object.assign({
    codigoFicha: codigo, fechaRegistro: new Date().toISOString(), fechasModificacion: [], situacionInminente: ['no_aplica'],
    equipoSaludId: 'EBS12', responsableId: responsableId, territorio: 'T49', microterritorio: 'MT01',
    planCuidado: { pendiente: true, accionesRegistradas: 0, alertasSinConducta: 1 }, permisoPlan: false
  }, extra || {});
}

const CODIGO_LOCAL = '76001-EBS12-AAAA-0001-' + COMPACTA;      // aún no sube
const CODIGO_SUBIDA = '76001-EBS12-AAAA-0002-' + COMPACTA;     // de la profesional, ya en la base
const CODIGO_AUXILIAR = '76001-EBS12-BBBB-0001-' + COMPACTA;   // de la auxiliar, sólo en la base
const CODIGO_AUTORIZADA = '76001-EBS12-BBBB-0002-' + COMPACTA; // con autorización vigente para quien consulta

const USUARIOS = {
  profesional: { rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 100 },
  auxiliar: { rol: 'auxiliar_enfermeria', equipoCodigo: 'EBS12', funcionarioId: 101 },
  coordinacion: { rol: 'lider_ebs', equipoCodigo: null, funcionarioId: 5 },
  maestro: { rol: 'maestro', equipoCodigo: 'EBS12', funcionarioId: 2 }
};

function montar() {
  const almacen = {
    aps_encuestas: JSON.stringify([fichaLocal('loc-1', CODIGO_LOCAL, false), fichaLocal('sub-1', CODIGO_SUBIDA, true)])
  };
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
  window.HTMLElement.prototype.scrollIntoView = function () {};

  let usuario = USUARIOS.profesional;
  window.SESION = { usuario: () => usuario };

  const peticiones = [];
  window.fetch = (url, opciones) => {
    const ruta = String(url);
    const responder = (estado, cuerpo) => Promise.resolve({
      ok: estado >= 200 && estado < 300, status: estado, json: () => Promise.resolve(cuerpo)
    });
    peticiones.push({ ruta: ruta, metodo: (opciones && opciones.method) || 'GET', cuerpo: opciones && opciones.body });
    if (ruta.indexOf('/api/listar_fichas') === 0) {
      return responder(200, [
        filaServidor(CODIGO_SUBIDA, 100),
        filaServidor(CODIGO_AUXILIAR, 101),
        filaServidor(CODIGO_AUTORIZADA, 101, { permisoPlan: true })
      ]);
    }
    if (ruta.indexOf('/api/ficha_completa?') === 0) {
      return responder(200, { encuesta: fichaLocal('x', CODIGO_AUXILIAR, true), corregible: false, planRegistradoEditable: false });
    }
    if (ruta === '/api/ficha_completa' && opciones && opciones.method === 'POST') {
      return responder(200, { eliminada: JSON.parse(opciones.body).codigo });
    }
    return Promise.reject(new Error('sin red'));
  };

  const errores = [];
  window.addEventListener('error', (e) => errores.push(e.message));

  window.eval(fuentes + ';\nwindow.__api = { refrescarFichasDelServidor, renderizarHistorial, abrirCorreccionDeEncuesta, ' +
    'enCorreccion: function () { return encuestaEnCorreccion; }, salirDeCorreccion };');
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return {
    window, doc: window.document, errores, api: window.__api, almacen, peticiones,
    como: function (nombre) { usuario = USUARIOS[nombre]; window.__api.renderizarHistorial(); }
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const app = montar();
  const $ = (s) => app.doc.querySelector(s);
  check('La aplicación arranca sin errores de JS', app.errores.length === 0, app.errores.join(' | '));
  await app.api.refrescarFichasDelServidor();

  const boton = (accion, id) => $('#historialTableBody [data-' + accion + '="' + id + '"]');
  const habilitado = (accion, id) => Boolean(boton(accion, id)) && !boton(accion, id).disabled;

  console.log('\n=== 1. Profesional ===');
  app.como('profesional');
  check('Corrige libremente la ficha que aún no sube', habilitado('corregir', 'loc-1'));
  check('No corrige la suya ya guardada sin autorización', boton('corregir', 'sub-1') && boton('corregir', 'sub-1').disabled);
  check('  el botón dice a quién pedir la autorización',
    /coordinación del EBS o del usuario maestro/.test(boton('corregir', 'sub-1').getAttribute('title') || ''));
  check('No corrige la de la auxiliar', boton('corregir', CODIGO_AUXILIAR).disabled);
  check('Con autorización vigente, Corregir se habilita', habilitado('corregir', CODIGO_AUTORIZADA));
  check('  y la fila lo marca', /Corrección autorizada/.test(boton('corregir', CODIGO_AUTORIZADA).closest('tr').textContent));
  check('Evoluciona el plan de las fichas de su equipo',
    habilitado('evolucionar', 'sub-1') && habilitado('evolucionar', CODIGO_AUXILIAR));
  check('No ve Autorizar ni Eliminar',
    !$('#historialTableBody [data-autorizar]') && !$('#historialTableBody [data-eliminar]'));

  await app.api.abrirCorreccionDeEncuesta('sub-1');
  check('Corregir una ficha guardada sin autorización no abre el formulario', app.api.enCorreccion() === null);
  await app.api.abrirCorreccionDeEncuesta(CODIGO_AUXILIAR);
  check('  tampoco si el servidor dice que no es corregible', app.api.enCorreccion() === null);

  console.log('\n=== 2. Auxiliar ===');
  app.como('auxiliar');
  check('Evoluciona el plan de su ficha', habilitado('evolucionar', CODIGO_AUXILIAR));
  check('  pero no el de la ficha de la profesional', boton('evolucionar', 'sub-1').disabled);

  console.log('\n=== 3. Coordinación del EBS ===');
  app.como('coordinacion');
  check('Corrige cualquier ficha guardada', habilitado('corregir', 'sub-1') && habilitado('corregir', CODIGO_AUXILIAR));
  check('Autoriza correcciones sobre las fichas de la base',
    Boolean(boton('autorizar', 'sub-1')) && Boolean(boton('autorizar', CODIGO_AUXILIAR)) && !boton('autorizar', 'loc-1'));
  check('No elimina fichas', !$('#historialTableBody [data-eliminar]'));

  console.log('\n=== 4. Maestro ===');
  app.como('maestro');
  check('Ve Eliminar en todas las fichas',
    Boolean(boton('eliminar', 'loc-1')) && Boolean(boton('eliminar', 'sub-1')) && Boolean(boton('eliminar', CODIGO_AUXILIAR)));
  check('  la que ya subió dice que se elimina de la base',
    boton('eliminar', 'sub-1').getAttribute('title') === 'Eliminar de la base');

  boton('eliminar', 'sub-1').click();
  check('Eliminar una ficha de la base pide confirmación con motivo',
    $('#modalConfirmar').hidden === false && $('#modalConfirmarMotivoCampo').hidden === false);
  check('  confirmar está apagado mientras no haya motivo', $('#btnConfirmarEliminar').disabled === true);
  const motivo = $('#modalConfirmarMotivo');
  motivo.value = 'Ficha duplicada por error';
  motivo.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  check('  con motivo, se habilita', $('#btnConfirmarEliminar').disabled === false);
  $('#btnConfirmarEliminar').click();
  await esperar(20);
  const pedido = app.peticiones.find((p) => p.ruta === '/api/ficha_completa' && p.metodo === 'POST');
  const cuerpo = pedido ? JSON.parse(pedido.cuerpo) : {};
  check('Pide a la base eliminarla con su motivo',
    cuerpo.accion === 'eliminar' && cuerpo.codigo === CODIGO_SUBIDA && cuerpo.motivo === 'Ficha duplicada por error',
    JSON.stringify(cuerpo));
  check('  y la quita del dispositivo y del historial',
    !JSON.parse(app.almacen.aps_encuestas).some((e) => e.id === 'sub-1') && !boton('corregir', 'sub-1'));

  boton('eliminar', 'loc-1').click();
  check('Eliminar una que aún no sube no pide motivo', $('#modalConfirmar').hidden === false &&
    $('#modalConfirmarMotivoCampo').hidden === true && $('#btnConfirmarEliminar').disabled === false);
  $('#btnConfirmarEliminar').click();
  check('  y la borra sólo del dispositivo, sin ir a la base',
    !JSON.parse(app.almacen.aps_encuestas).some((e) => e.id === 'loc-1') &&
    app.peticiones.filter((p) => p.ruta === '/api/ficha_completa' && p.metodo === 'POST').length === 1);

  check('Sin errores de JS', app.errores.length === 0, app.errores.join(' | '));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + ok + '   Fallidas: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
