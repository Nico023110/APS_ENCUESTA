/* Prueba del detalle de una ficha (Historial → Ver): los hogares de la
   vivienda, la familia de cada hogar y sus integrantes. Una vivienda puede
   tener varios hogares familiares (ítem 28, RN-028) y antes el detalle sólo
   mostraba el código de la primera familia, sin ninguna persona. Monta la
   aplicación completa en jsdom con fichas guardadas en el dispositivo, que el
   detalle pinta sin ir al servidor. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
const fuentes = ['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js', 'reglas.js',
  'formulario.js', 'cups.js', 'correccion.js', 'captura_local.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
  .join('\n;\n');

let ok = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

function persona(primerNombre, numeroId, fechaNacimiento, sexo, rolFamiliar) {
  return { primerNombre, primerApellido: 'PRUEBA', tipoId: 'CC', numeroId, fechaNacimiento, sexo, rolFamiliar };
}

function ficha(id, hogaresEnVivienda, familias) {
  return {
    id: id,
    codigoFicha: '76001-EBS12-TEST-000' + id.slice(-1) + '-20261013',
    fechaRegistro: '2026-10-13T15:00:00.000Z',
    fechaDiligenciamiento: '2026-10-13',
    territorio: 'T49',
    microterritorio: 'MT01',
    nuv: 'NUV0012',
    idHogar: 'T49MT01H0001',
    idFamilia: 'T49MT01H0001F0001',
    hogaresEnVivienda: hogaresEnVivienda,
    familias: familias
  };
}

const FICHAS = [
  /* Dos hogares, los dos caracterizados. */
  ficha('det-1', 2, [
    {
      idFamilia: 'T49MT01H0001F0001', tipoFamilia: 'nuclear_biparental', numeroIntegrantes: 2,
      integrantes: [
        persona('ANA', '900000101', '1986-03-10', 'mujer', 'responsable_economico'),
        persona('JUAN', '900000102', '1984-07-22', 'hombre', 'conyuge')
      ]
    },
    {
      idFamilia: 'T49MT01H0001F0002', tipoFamilia: 'unipersonal', numeroIntegrantes: 1,
      integrantes: [persona('PEDRO', '900000103', '1956-01-15', 'hombre', 'responsable_economico')]
    }
  ]),
  /* Dos hogares declarados y ninguna familia en la visita. */
  ficha('det-2', 2, []),
  /* Tres hogares declarados, uno caracterizado y sin todos sus integrantes. */
  ficha('det-3', 3, [
    {
      idFamilia: 'T49MT01H0002F0001', tipoFamilia: 'nuclear_monoparental', numeroIntegrantes: 3,
      integrantes: [persona('LUZ', '900000105', '1990-06-01', 'mujer', 'responsable_economico')]
    }
  ]),
  ficha('det-4', 1, [
    {
      idFamilia: 'T49MT01H0003F0001', tipoFamilia: 'unipersonal', numeroIntegrantes: 1,
      integrantes: [persona('<img src=x onerror="window.__xss=1">', '900000104', '1990-01-01', 'mujer', 'responsable_economico')]
    }
  ])
];

function montar() {
  const almacen = { aps_encuestas: JSON.stringify(FICHAS) };
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

  window.eval(fuentes + ';\nwindow.__api = { abrirModalDetalle };');
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, doc: window.document, errores, api: window.__api };
}

const texto = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);

/** El detalle abierto: títulos de sección, filas de la vivienda y los hogares. */
async function abrirDetalle(app, id) {
  await app.api.abrirModalDetalle(id);
  const cuerpo = app.doc.querySelector('#modalDetalleBody');
  const secciones = Array.from(cuerpo.querySelectorAll('.detail-section'));
  const seccionHogares = secciones.find((s) => texto(s.querySelector('h3')) === 'Hogares y familias de la vivienda');
  const vivienda = secciones.find((s) => texto(s.querySelector('h3')) === 'Datos generales de la vivienda');
  return {
    titulos: secciones.map((s) => texto(s.querySelector('h3'))),
    etiquetasVivienda: vivienda ? Array.from(vivienda.querySelectorAll('.detail-label')).map(texto) : [],
    resumen: seccionHogares && texto(seccionHogares.querySelector('.detalle-hogares__resumen')),
    hogares: seccionHogares ? Array.from(seccionHogares.querySelectorAll('.detalle-hogar')).map((h) => ({
      titulo: texto(h.querySelector('.detalle-hogar__titulo')),
      familia: texto(h.querySelector('.detalle-hogar__familia')),
      pendiente: texto(h.querySelector('.badge--warning')),
      meta: texto(h.querySelector('.detalle-hogar__meta')),
      integrantes: Array.from(h.querySelectorAll('.detalle-integrante')).map((i) => ({
        nombre: texto(i.querySelector('.detalle-integrante__nombre')),
        datos: texto(i.querySelector('.detalle-integrante__datos'))
      }))
    })) : null
  };
}

(async function () {
  const app = montar();
  check('La aplicación arranca sin errores de JS', app.errores.length === 0, app.errores.join(' | '));

  console.log('\n=== 1. Vivienda con dos hogares caracterizados ===');
  let d = await abrirDetalle(app, 'det-1');
  const iHogares = d.titulos.indexOf('Hogares y familias de la vivienda');
  check('Hay una sección de hogares y familias', iHogares !== -1, d.titulos.join(' | '));
  check('Va entre el entorno y el plan de cuidado, como en el instrumento',
    d.titulos[iHogares - 1] === 'Caracterización del entorno' && d.titulos[iHogares + 1] === 'Plan de cuidado (RN-220)',
    d.titulos.join(' | '));
  check('El resumen cuenta hogares y personas', d.resumen === '2 hogares · 3 personas', d.resumen);
  check('Un bloque por hogar, numerado', d.hogares && d.hogares.map((h) => h.titulo).join('|') === 'Hogar 1|Hogar 2',
    JSON.stringify(d.hogares && d.hogares.map((h) => h.titulo)));
  check('Cada hogar muestra el código de su familia (ítem 26)',
    d.hogares[0].familia === 'Familia T49MT01H0001F0001' && d.hogares[1].familia === 'Familia T49MT01H0001F0002',
    d.hogares.map((h) => h.familia).join(' | '));
  check('El tipo de familia y el número de integrantes',
    d.hogares[0].meta === 'Nuclear biparental · 2 integrantes' && d.hogares[1].meta === 'Unipersonal · 1 integrante',
    d.hogares.map((h) => h.meta).join(' | '));
  check('Cada hogar lista sólo a sus integrantes',
    d.hogares[0].integrantes.map((i) => i.nombre).join('|') === 'ANA PRUEBA|JUAN PRUEBA' &&
    d.hogares[1].integrantes.map((i) => i.nombre).join('|') === 'PEDRO PRUEBA',
    JSON.stringify(d.hogares.map((h) => h.integrantes.map((i) => i.nombre))));
  check('Integrante con rol, sexo, edad a la fecha de la visita y documento',
    d.hogares[0].integrantes[0].datos === 'Responsable económico de la familia · Mujer · 40 años · CC 900000101',
    d.hogares[0].integrantes[0].datos);
  check('Ningún hogar caracterizado aparece como pendiente', d.hogares.every((h) => h.pendiente === null));
  check('Los datos de la vivienda ya no repiten el código de una sola familia',
    d.etiquetasVivienda.indexOf('N.° Identificación de la familia') === -1 &&
    d.etiquetasVivienda.indexOf('N.° Identificación del hogar') !== -1, d.etiquetasVivienda.join(' | '));

  console.log('\n=== 2. Hogares declarados sin caracterizar (RN-028) ===');
  d = await abrirDetalle(app, 'det-2');
  check('Sin familias, el resumen lo dice', d.resumen === '2 hogares declarados · 0 caracterizados · 0 personas', d.resumen);
  check('Los hogares declarados aparecen como pendientes',
    d.hogares.length === 2 && d.hogares.every((h) => h.pendiente === 'Sin caracterizar' && h.familia === null),
    JSON.stringify(d.hogares));
  check('  y dicen dónde se completan', /Historial → Corregir \(RN-028\)/.test(d.hogares[0].meta), d.hogares[0].meta);

  d = await abrirDetalle(app, 'det-3');
  check('Un hogar caracterizado y dos pendientes',
    d.resumen === '3 hogares declarados · 1 caracterizado · 1 persona' &&
    d.hogares.map((h) => (h.pendiente ? 'pendiente' : 'familia')).join('|') === 'familia|pendiente|pendiente',
    d.resumen + ' / ' + JSON.stringify(d.hogares.map((h) => h.pendiente)));
  check('Una familia con integrantes por caracterizar lo cuenta',
    d.hogares[0].meta === 'Nuclear monoparental · 1 de 3 integrantes caracterizados', d.hogares[0].meta);

  console.log('\n=== 3. Los nombres se escapan ===');
  d = await abrirDetalle(app, 'det-4');
  check('Un nombre con HTML no crea elementos en el modal',
    app.doc.querySelectorAll('#modalDetalleBody img').length === 0 && app.window.__xss === undefined);
  check('  y se muestra como texto', d.hogares[0].integrantes[0].nombre.indexOf('<img src=x') === 0,
    d.hogares[0].integrantes[0].nombre);

  check('Sin errores de JS al abrir los detalles', app.errores.length === 0, app.errores.join(' | '));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + ok + '   Fallidas: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
