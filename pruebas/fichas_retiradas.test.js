/* =========================================================================
   Fichas que la base ya no tiene, en el navegador (jsdom)
   -------------------------------------------------------------------------
       node pruebas/fichas_retiradas.test.js

   Una ficha guardada en este navegador que ya subió a la base y que la base
   ya no tiene (la eliminó el maestro desde otro equipo, o se depuró la base)
   seguía apareciendo «En la base» para siempre. Comprueba que al traer el
   listado de la base se retira esa copia local, que lo que no ha subido no
   se toca, y que con un listado que pudo venir cortado o que no contestó no
   se retira nada.

   No necesita base de datos ni servidor.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const roles = require('../roles.js');

const RAIZ = path.join(__dirname, '..');

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK   ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + detalle : ''));
  }
}

function local(codigo, sincronizada) {
  return { id: 'id-' + codigo, codigoFicha: codigo, sincronizada: sincronizada, fechaRegistro: '2026-08-25T10:21:00Z', territorio: 'T48' };
}

function montar(listado, estado) {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  const perfil = { id: 7, rol: 'enfermeria', nivel: roles.nivelDe('enfermeria'), rolEtiqueta: roles.etiquetaDeRol('enfermeria'),
    nombre: 'Prueba', tipoId: 'CC', documento: '1144099001', equipoCodigo: 'EBS12', permisos: roles.permisosDe('enfermeria'),
    debeCambiarClave: false };
  const almacen = {
    aps_sesion_usuario: JSON.stringify(perfil),
    aps_encuestas: JSON.stringify([local('F-00123', true), local('F-00456', true), local('CSESFFS', true),
      local('PENDIENTE-1', false), local('76001-EBS012-AAAA-0001-20261028', true)])
  };
  Object.defineProperty(w, 'localStorage', {
    value: {
      getItem: function (k) { return k in almacen ? almacen[k] : null; },
      setItem: function (k, v) { almacen[k] = String(v); },
      removeItem: function (k) { delete almacen[k]; }
    },
    configurable: true
  });
  w.navigator.geolocation = { getCurrentPosition: function () {} };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.Headers = Headers;
  w.Request = Request;
  w.fetch = function (url) {
    if (String(url).indexOf('/api/listar_fichas') === -1) return Promise.reject(new Error('sin red'));
    return Promise.resolve({ ok: estado !== 500, status: estado || 200, json: function () { return Promise.resolve(listado); } });
  };
  const fuentes = ['sesion.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
    'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'captura_local.js', 'app.js']
    .map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); })
    .join('\n;\n');
  w.eval(fuentes);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return { w: w, codigos: function () { return JSON.parse(almacen.aps_encuestas).map(function (e) { return e.codigoFicha; }); } };
}

function fila(codigo) {
  return { codigoFicha: codigo, fechaRegistro: '2026-10-28T10:00:00Z', territorio: 'T48', microterritorio: 'MT01' };
}

function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function principal() {
  console.log('\n=== Fichas que la base ya no tiene ===');
  const m = montar([fila('76001-EBS012-AAAA-0001-20261028')]);
  await esperar(80);
  await m.w.refrescarFichasDelServidor();
  verificar('las que subieron y la base ya no tiene se retiran del navegador',
    m.codigos().join() === 'PENDIENTE-1,76001-EBS012-AAAA-0001-20261028', m.codigos().join());
  verificar('  y el historial ya no las muestra',
    !m.w.obtenerEncuestasParaMostrar().some(function (e) { return /F-00123|F-00456|CSESFFS/.test(e.codigoFicha); }));
  verificar('lo que no ha subido se conserva', m.codigos().indexOf('PENDIENTE-1') !== -1);

  const caida = montar([], 500);
  await esperar(80);
  await caida.w.refrescarFichasDelServidor();
  verificar('si la base no contesta no se retira nada', caida.codigos().length === 5, caida.codigos().join());

  const largo = [];
  for (let i = 0; i < 2000; i++) largo.push(fila('X-' + i));
  const cortado = montar(largo);
  await esperar(80);
  await cortado.w.refrescarFichasDelServidor();
  verificar('con un listado que pudo venir cortado no se retira nada', cortado.codigos().length === 5, cortado.codigos().join());

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
