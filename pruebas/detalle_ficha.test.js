/* Prueba del detalle de una ficha (Historial → Ver): las familias de la
   vivienda y sus integrantes. Una vivienda puede tener varias familias
   (RN-028) y antes el detalle sólo mostraba el código de la primera, sin
   ninguna persona. Monta la aplicación completa en jsdom con fichas
   guardadas en el dispositivo, que el detalle pinta sin ir al servidor. */

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

function ficha(id, familias) {
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
    hogaresEnVivienda: 2,
    familias: familias
  };
}

const FICHAS = [
  ficha('det-1', [
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
  ficha('det-2', []),
  ficha('det-3', [
    { idFamilia: 'T49MT01H0002F0001', tipoFamilia: 'unipersonal', numeroIntegrantes: 1, integrantes: [] }
  ]),
  ficha('det-4', [
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

/** Las secciones del modal, en orden: título y pares etiqueta → valor. */
async function abrirDetalle(app, id) {
  await app.api.abrirModalDetalle(id);
  return Array.from(app.doc.querySelectorAll('#modalDetalleBody .detail-section')).map((s) => {
    const filas = {};
    s.querySelectorAll('.detail-item').forEach((item) => {
      filas[item.querySelector('.detail-label').textContent] = item.querySelector('.detail-value').textContent;
    });
    return { titulo: s.querySelector('h3').textContent, filas };
  });
}

(async function () {
  const app = montar();
  check('La aplicación arranca sin errores de JS', app.errores.length === 0, app.errores.join(' | '));

  console.log('\n=== 1. Vivienda con dos familias ===');
  let secciones = await abrirDetalle(app, 'det-1');
  const titulos = secciones.map((s) => s.titulo);
  const familia1 = secciones.find((s) => s.titulo === 'Familia 1 de 2');
  const familia2 = secciones.find((s) => s.titulo === 'Familia 2 de 2');

  check('Hay una sección por familia', Boolean(familia1 && familia2), titulos.join(' | '));
  check('Las familias van entre el entorno y el plan de cuidado, como en el instrumento',
    titulos.indexOf('Caracterización del entorno') === titulos.indexOf('Familia 1 de 2') - 1 &&
    titulos.indexOf('Plan de cuidado (RN-220)') === titulos.indexOf('Familia 2 de 2') + 1,
    titulos.join(' | '));
  check('Cada familia muestra su propio código (ítem 26)',
    familia1 && familia1.filas['N.° Identificación de la familia'] === 'T49MT01H0001F0001' &&
    familia2 && familia2.filas['N.° Identificación de la familia'] === 'T49MT01H0001F0002');
  check('El tipo de familia sale con su etiqueta de catálogo',
    familia1 && familia1.filas['Tipo de familia'] === 'Nuclear biparental' &&
    familia2 && familia2.filas['Tipo de familia'] === 'Unipersonal');
  check('El número de integrantes declarado', familia1 && String(familia1.filas['N.° de integrantes']) === '2');
  check('Integrante con documento, edad a la fecha de la visita, sexo y rol',
    familia1 && familia1.filas['Integrante 1'] === 'ANA PRUEBA · CC 900000101 · 40 años · Mujer · Responsable económico de la familia',
    familia1 && familia1.filas['Integrante 1']);
  check('Cada familia lista sólo sus integrantes',
    familia1 && familia1.filas['Integrante 2'] && familia1.filas['Integrante 2'].indexOf('JUAN') === 0 &&
    familia2 && familia2.filas['Integrante 1'].indexOf('PEDRO') === 0 && !('Integrante 2' in familia2.filas),
    JSON.stringify(familia2 && familia2.filas));
  check('El rol se lee con su etiqueta', familia1 && /Cónyuge o compañero\(a\)$/.test(familia1.filas['Integrante 2']));

  console.log('\n=== 2. Casos sin datos ===');
  secciones = await abrirDetalle(app, 'det-2');
  const sinFamilias = secciones.find((s) => s.titulo === 'Familias e integrantes');
  check('Una ficha sin familias lo dice en vez de omitir la sección',
    sinFamilias && sinFamilias.filas['Familias caracterizadas'] === 'Ninguna', JSON.stringify(sinFamilias));

  secciones = await abrirDetalle(app, 'det-3');
  const sinIntegrantes = secciones.find((s) => s.titulo === 'Familia 1 de 1');
  check('Una familia sin integrantes muestra la raya de dato vacío',
    sinIntegrantes && sinIntegrantes.filas.Integrantes === '—', JSON.stringify(sinIntegrantes));

  console.log('\n=== 3. Los nombres se escapan ===');
  secciones = await abrirDetalle(app, 'det-4');
  const conHtml = secciones.find((s) => s.titulo === 'Familia 1 de 1');
  check('Un nombre con HTML no crea elementos en el modal',
    app.doc.querySelectorAll('#modalDetalleBody img').length === 0 && app.window.__xss === undefined);
  check('  y se muestra como texto', conHtml && conHtml.filas['Integrante 1'].indexOf('<img src=x') === 0,
    conHtml && conHtml.filas['Integrante 1']);

  check('Sin errores de JS al abrir los detalles', app.errores.length === 0, app.errores.join(' | '));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + ok + '   Fallidas: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
