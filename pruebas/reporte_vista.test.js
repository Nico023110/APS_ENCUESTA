/* =========================================================================
   Vista «Reporte SI-APS» en el navegador (jsdom)
   -------------------------------------------------------------------------
       node pruebas/reporte_vista.test.js

   Monta index.html con una sesión en caché y un fetch simulado, y comprueba
   que la vista sólo aparece con reporte.generar, que pide el resumen y el
   archivo por POST con la cabecera anti-CSRF, que pinta lo que devuelve el
   servidor como texto (nunca como HTML) y que dispara la descarga.

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

const RESUMEN = {
  nombreArchivo: 'APS124CCFP20260831NI000805027289.TXT',
  periodo: { desde: '2026-08-01', hasta: '2026-08-31' },
  fichas: { enElPeriodo: 5, incluidas: 3, sinConsentimiento: 1, noCerradas: 1, visitasAnterioresDelMismoHogar: 0 },
  registros: { tipo2: 3, tipo3: 9, total: 12 },
  incidencias: {
    total: 4,
    detalle: [
      { tipoRegistro: 2, variable: 4, nombre: 'Subregión vivienda', problema: 'Obligatoria y vacía', cantidad: 3, fichas: ['F-1', 'F-2'] },
      { tipoRegistro: 3, variable: 9, nombre: '<img src=x onerror="window.__inyectado=1">', problema: 'La respuesta «OT» no tiene código en el anexo', cantidad: 1, fichas: ['F-3'] }
    ]
  },
  avisos: ['Falta el código de subregión (variable 4).']
};

function perfil(rol) {
  return {
    id: 7, rol: rol, nivel: roles.nivelDe(rol), rolEtiqueta: roles.etiquetaDeRol(rol),
    nombre: 'Prueba ' + rol, tipoId: 'CC', documento: '1144099011', equipoCodigo: 'EBS12',
    permisos: roles.permisosDe(rol), debeCambiarClave: false
  };
}

function montar(rol) {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;

  const almacen = { aps_sesion_usuario: JSON.stringify(perfil(rol)) };
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
  w.URL.createObjectURL = function () { return 'blob:reporte'; };
  w.URL.revokeObjectURL = function () {};
  w.__descargas = [];
  w.HTMLAnchorElement.prototype.click = function () { w.__descargas.push(this.download); };

  /* fetch simulado: se instala antes que sesion.js, que lo envuelve. */
  w.__peticiones = [];
  w.fetch = function (url, opciones) {
    if (String(url).indexOf('/api/reporte_sispro') === -1) return Promise.reject(new Error('sin red'));
    const cuerpo = JSON.parse(opciones.body);
    w.__peticiones.push({ metodo: opciones.method, cuerpo: cuerpo, csrf: opciones.headers.get('X-Requested-With') });
    if (cuerpo.formato === 'archivo') {
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: function (h) { return h === 'X-Nombre-Archivo' ? RESUMEN.nombreArchivo : null; } },
        blob: function () { return Promise.resolve(new w.Blob(['1|NI|805027289\r\n'])); }
      });
    }
    return Promise.resolve({
      ok: true, status: 200,
      headers: { get: function () { return null; } },
      json: function () { return Promise.resolve(JSON.parse(JSON.stringify(RESUMEN))); }
    });
  };

  const fuentes = ['sesion.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
    'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'app.js', 'roles.js', 'usuarios.js', 'reporte.js']
    .map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); })
    .join('\n;\n');
  w.eval(fuentes);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}

function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function opcionesDelMenu(w) {
  return Array.from(w.document.querySelectorAll('#menuUsuario .app-menu__item')).map(function (b) { return b.textContent.trim(); });
}

async function principal() {
  console.log('\n=== 1. Con reporte.generar (maestro) ===');

  const w = montar('maestro');
  const doc = w.document;

  verificar('el menú del usuario ofrece «Reporte SI-APS»', opcionesDelMenu(w).indexOf('Reporte SI-APS') !== -1,
    opcionesDelMenu(w).join(', '));

  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const iso = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  verificar('por defecto propone el mes anterior completo',
    doc.getElementById('reporteDesde').value === iso(inicio) && doc.getElementById('reporteHasta').value === iso(fin),
    doc.getElementById('reporteDesde').value + ' / ' + doc.getElementById('reporteHasta').value);

  Array.from(doc.querySelectorAll('#menuUsuario .app-menu__item'))
    .find(function (b) { return b.textContent.trim() === 'Reporte SI-APS'; }).click();
  verificar('la opción abre la vista', doc.getElementById('view-reporte').classList.contains('is-active'));

  doc.getElementById('reporteDesde').value = '2026-08-31';
  doc.getElementById('reporteHasta').value = '2026-08-01';
  doc.getElementById('formReporte').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar(20);
  verificar('fechas al revés: avisa y no llama al servidor',
    !doc.getElementById('reporteError').hidden && w.__peticiones.length === 0, doc.getElementById('reporteError').textContent);

  doc.getElementById('reporteDesde').value = '2026-08-01';
  doc.getElementById('reporteHasta').value = '2026-08-31';
  doc.getElementById('formReporte').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar(50);
  const primera = w.__peticiones[0] || {};
  verificar('«Revisar» pide el resumen por POST con la cabecera anti-CSRF',
    primera.metodo === 'POST' && primera.cuerpo && primera.cuerpo.formato === 'resumen' &&
    primera.cuerpo.desde === '2026-08-01' && primera.csrf === 'fetch', JSON.stringify(primera));

  const resultado = doc.getElementById('reporteResultado');
  verificar('pinta el resumen con el nombre del archivo', !resultado.hidden && resultado.textContent.indexOf(RESUMEN.nombreArchivo) !== -1);
  verificar('las cifras: fichas, familias, integrantes e incidencias',
    Array.from(resultado.querySelectorAll('.reporte__cifra-valor')).map(function (x) { return x.textContent; }).join(',') === '3,3,9,4');
  verificar('explica qué fichas no entran', /1 sin consentimiento/.test(resultado.textContent) && /1 sin cerrar/.test(resultado.textContent));
  verificar('muestra el aviso de la subregión', resultado.querySelectorAll('.reporte__aviso').length === 1);
  verificar('una fila por incidencia', resultado.querySelectorAll('.reporte__tabla tbody tr').length === 2);
  verificar('lo que llega del servidor se pinta como texto, no como HTML',
    resultado.querySelector('img') === null && w.__inyectado === undefined &&
    resultado.textContent.indexOf('<img src=x') !== -1);

  doc.getElementById('btnReporteDescargar').click();
  await esperar(50);
  const segunda = w.__peticiones[1] || {};
  verificar('«Descargar archivo» pide el archivo por POST', segunda.metodo === 'POST' && segunda.cuerpo && segunda.cuerpo.formato === 'archivo',
    JSON.stringify(segunda));
  verificar('y lo descarga con el nombre oficial', w.__descargas[0] === RESUMEN.nombreArchivo, JSON.stringify(w.__descargas));

  console.log('\n=== 2. Sin reporte.generar (enfermería) ===');

  const w2 = montar('enfermeria');
  verificar('el menú no ofrece el reporte', opcionesDelMenu(w2).indexOf('Reporte SI-APS') === -1, opcionesDelMenu(w2).join(', '));
  w2.REPORTE_SISPRO.abrir();
  verificar('y abrir la vista a mano no hace nada', !w2.document.getElementById('view-reporte').classList.contains('is-active'));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
