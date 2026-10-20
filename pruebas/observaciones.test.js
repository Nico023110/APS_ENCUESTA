/* Prueba de las mejoras pedidas en las observaciones de la E.S.E. del
   19-10-2026, en el navegador (jsdom) y en la regla del servidor:
     1. nada del plan de cuidado bloquea el guardado: se advierte;
     2. acción «Derivada» con institución y fecha de cita; motivo del «No
        cumple» — campos que sólo aparecen cuando aplican;
     3. alertas en vivo al comienzo del plan;
     4. «Digitar coordenadas», incluido pegar «lat, lon» de Google Maps;
     5. «Guardar avance» y fichas sin terminar en el historial;
     6. búsqueda CUPS sin red, sin tildes y en cualquier orden;
     7. lo registrado del plan a medias se completa, no se cambia (RN-228). */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { cambiosEnPlanRegistrado } = require('../api/_plan_bloqueo');

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

const almacen = {};
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window, 'localStorage', {
  value: { getItem: (k) => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); }, removeItem: (k) => { delete almacen[k]; } },
  configurable: true
});
window.navigator.geolocation = { getCurrentPosition() {} };
window.fetch = () => Promise.reject(new Error('sin red'));
window.HTMLElement.prototype.scrollIntoView = function () {};
const errores = [];
window.addEventListener('error', (e) => errores.push(e.message));
let api;
const doc = window.document;
const $ = (s) => doc.querySelector(s);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function escribir(el, valor) {
  el.value = valor;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}
function marcar(el) {
  el.checked = true;
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}

(async function () {
  /* jsdom dispara su propio DOMContentLoaded poco después de crearse. Si la
     aplicación se carga antes, arranca dos veces —doble escucha en cada botón
     y el formulario reiniciado en la primera espera—: se espera a que el
     documento termine de cargar y sólo entonces se arranca a mano. */
  if (doc.readyState !== 'complete') {
    await new Promise((listo) => window.addEventListener('load', listo));
  }
  window.eval(fuentes + ';\nwindow.__api = { validarReglas, evaluarAdvertencias, recolectarDatosFormulario, ' +
    'renderizarHistorial, guardarYReiniciar, buscarCupsEnElDispositivo, CUPS_RESUELTOS };');
  doc.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  api = window.__api;

  check('La aplicación arranca sin errores de JS', errores.length === 0, errores.join(' | '));

  console.log('\n=== 1. Plan de cuidado sin obligatorios ===');
  const conPlan = {
    planVivienda: {
      codigoEbs: 'X', codigoVivienda: 'Y',
      acciones: [{ ejecutorTipoId: 'CC', codigoAccion: '', tipoRespuesta: 'derivada' }],
      seguimientos: [{ accionConcertada: 'Ventilar la cocina' }, { seguimientoTipoId: 'CC', seg1Estado: 'NC' }]
    }
  };
  const delPlan = (lista) => lista.filter((i) => /^planVivienda/.test(i.ruta || ''));
  check('Una fila del plan a medias no bloquea', delPlan(api.validarReglas(conPlan)).length === 0,
    JSON.stringify(delPlan(api.validarReglas(conPlan)).map((i) => i.codigo)));
  const avisos = delPlan(api.evaluarAdvertencias(conPlan));
  check('  pero lo que falta se advierte', avisos.length > 0);
  check('  la derivación sin destino se advierte',
    avisos.some((i) => /institucionDestino$/.test(i.ruta)), avisos.map((i) => i.ruta).join(', '));
  check('  el «No cumple» sin motivo se advierte', avisos.some((i) => /seg1MotivoNc$/.test(i.ruta)));
  check('  un seguimiento sin fechas todavía no se advierte por el 1.º seguimiento',
    !avisos.some((i) => /seguimientos\[0\]\.seg1$/.test(i.ruta)));

  console.log('\n=== 2. Derivada y «No cumple» en el formulario ===');
  marcar($('input[name="consentimiento"][value="si"]'));
  const filaAccion = $('#filasAccionVivienda tr[data-fila="accion"]');
  const derivacion = filaAccion.querySelector('[data-rol="derivacion"]');
  check('Sin respuesta, la derivación no se ve', derivacion.hidden === true);
  marcar(filaAccion.querySelector('input[value="derivada"]'));
  check('Con «Derivada» aparecen institución y fecha de cita', derivacion.hidden === false &&
    Boolean(derivacion.querySelector('[name$=".institucionDestino"]')) && Boolean(derivacion.querySelector('[name$=".fechaCita"]')));
  escribir(derivacion.querySelector('[name$=".institucionDestino"]'), 'ESE Ladera');
  let datos = api.recolectarDatosFormulario($('#encuestaForm'));
  check('  la institución viaja en los datos', datos.planVivienda.acciones[0].institucionDestino === 'ESE Ladera',
    JSON.stringify(datos.planVivienda.acciones[0]));
  marcar(filaAccion.querySelector('input[value="en_sitio"]'));
  check('Con «En sitio» se oculta y se vacía', derivacion.hidden === true &&
    derivacion.querySelector('[name$=".institucionDestino"]').value === '');

  const filaSeg = $('#filasSeguimientoVivienda tr[data-fila="seguimiento"]');
  const motivo = filaSeg.querySelector('[name$=".seg1MotivoNc"]');
  check('El motivo del 1.º seguimiento no se ve sin «No cumple»', motivo.hidden === true);
  const estado = filaSeg.querySelector('[name$=".seg1Estado"]');
  estado.value = 'NC';
  estado.dispatchEvent(new window.Event('change', { bubbles: true }));
  check('  con «No cumple» aparece', motivo.hidden === false);

  console.log('\n=== 3. Alertas en vivo ===');
  check('El resumen de alertas está al comienzo del plan',
    Boolean($('#seccion-6') && $('#resumenAlertasPlan')) &&
    ($('#seccion-6').compareDocumentPosition($('#resumenAlertasPlan')) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
    ($('#resumenAlertasPlan').compareDocumentPosition($('#seccion-6-1')) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  escribir($('#personasEnVivienda'), '7');
  escribir($('#habitacionesVivienda'), '2');
  await esperar(800);
  const resumen = $('#resumenAlertasCuerpo').textContent;
  check('Sin pulsar «Guardar», el hacinamiento ya aparece', /Hacinamiento/.test(resumen), resumen.slice(0, 200));
  check('  agrupado en 6.1 Vivienda y con su prioridad', /6\.1 Vivienda/.test(resumen) && /Prioritaria|Inmediata|Regular/.test(resumen));
  check('  y el riesgo familiar a la vista', $('#resumenAlertasRiesgo').textContent.length > 0);

  console.log('\n=== 4. Digitar coordenadas ===');
  const lat = $('#latitud');
  const lon = $('#longitud');
  const boton = $('#btnDigitarCoordenadas');
  check('Las coordenadas empiezan de sólo lectura', lat.readOnly && lon.readOnly);
  boton.click();
  check('«Digitar coordenadas» las habilita y lo dice', !lat.readOnly && !lon.readOnly &&
    boton.getAttribute('aria-pressed') === 'true' && /habilitadas/.test(boton.textContent));
  escribir(lat, '3.451647, -76.531985');
  check('Pegar «lat, lon» en la latitud las reparte', lat.value === '3.451647' && lon.value === '-76.531985',
    lat.value + ' | ' + lon.value);
  datos = api.recolectarDatosFormulario($('#encuestaForm'));
  check('  y viajan como digitadas a mano', datos.latitud === 3.451647 && datos.origenCoordenadas === 'manual',
    datos.latitud + ' ' + datos.origenCoordenadas);
  boton.click();
  check('Pulsar otra vez las bloquea', lat.readOnly && lon.readOnly && boton.getAttribute('aria-pressed') === 'false');

  console.log('\n=== 5. Guardar avance y fichas sin terminar ===');
  escribir($('#divisionTerritorial'), 'Barrio de prueba');
  $('#btnGuardarAvance').click();
  const enCurso = () => JSON.parse(almacen.aps_en_curso_local || '[]');
  check('«Guardar avance» deja la ficha en la lista del equipo', enCurso().length === 1, String(enCurso().length));
  check('  y lo dice junto al botón', /Avance guardado en este equipo/.test($('#estadoAvance').textContent),
    $('#estadoAvance').textContent);
  const codigoPrimera = $('#codigoFicha').value;
  $('#btnEmpezarOtraFicha').click();
  check('«Empezar otra» limpia el formulario sin perder la anterior',
    $('#divisionTerritorial').value === '' && enCurso().length === 1 && $('#codigoFicha').value !== codigoPrimera);

  api.renderizarHistorial();
  check('El historial muestra la ficha sin terminar', !$('#fichasEnCurso').hidden &&
    /Sin terminar/.test($('#listaEnCurso').textContent) && $('#listaEnCurso').textContent.indexOf(codigoPrimera) !== -1);
  $('#listaEnCurso [data-continuar]').click();
  await esperar(50);
  check('«Continuar» la devuelve al formulario donde se dejó',
    $('#divisionTerritorial').value === 'Barrio de prueba' && $('#codigoFicha').value === codigoPrimera,
    $('#divisionTerritorial').value + ' ' + $('#codigoFicha').value);

  datos = api.recolectarDatosFormulario($('#encuestaForm'));
  await api.guardarYReiniciar(datos, $('#encuestaForm'), 'x');
  check('Guardarla (aunque quede pendiente de subir) la saca de «sin terminar»', enCurso().length === 0,
    String(enCurso().length));

  console.log('\n=== 6. CUPS sin red ===');
  api.CUPS_RESUELTOS.set('890203', 'CONSULTA DE PRIMERA VEZ POR ODONTOLOGÍA GENERAL');
  const filas = api.buscarCupsEnElDispositivo('odontologia consulta');
  check('Encuentra sin tildes y con las palabras en otro orden', filas.some((f) => f.codigo === '890203'),
    JSON.stringify(filas.map((f) => f.codigo)));
  check('  y por comienzo de código', api.buscarCupsEnElDispositivo('8902').some((f) => f.codigo === '890203'));

  console.log('\n=== 7. Plan a medias registrado (RN-228) ===');
  const antes = { planVivienda: { acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345' }], seguimientos: [] } };
  const completada = { planVivienda: { acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
    codigoAccion: '890203', tipoRespuesta: 'en_sitio' }], seguimientos: [] } };
  check('Completar lo vacío de una acción registrada a medias no es cambiarla',
    cambiosEnPlanRegistrado(antes, completada).length === 0);
  const cambiada = { planVivienda: { acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '9999999', codigoAccion: '890203' }],
    seguimientos: [] } };
  check('Cambiar lo que ya tenía escrito sí lo es', cambiosEnPlanRegistrado(antes, cambiada).length === 1);

  check('Sin errores de JS', errores.length === 0, errores.join(' | '));
  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
