/* Prueba de «Evolucionar plan» en el navegador (RN-228). Monta la aplicación
   completa en jsdom con una ficha ya sincronizada cuyo plan de cuidado está
   pendiente, y comprueba que:
     - la visita (secciones 1 a 5) queda intocable y lo registrado del plan
       también, mientras lo que falta sigue abierto;
     - lo bloqueado sigue viajando al guardar (inert, no disabled);
     - el guardado pide al servidor que escriba sólo el plan;
     - «Corregir» bloquea lo registrado del plan, pero no la visita. */

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

const HOY = new Date().toISOString().split('T')[0];

const FICHA = {
  id: 'evo-1',
  codigoFicha: '76001-EBS12-EVO1-0001-' + HOY.replace(/-/g, ''),
  sincronizada: true,
  fechaRegistro: new Date().toISOString(),
  consentimiento: 'si',
  fechaDiligenciamiento: HOY,
  equipoSaludId: 'EBS12',
  territorio: 'T49',
  microterritorio: 'MT01',
  estrato: 'bajo',
  hogaresEnVivienda: 1,
  idHogar: 'T49MT01H0001',
  idFamilia: 'T49MT01H0001F0001',
  nuv: 'NUV0001',
  familias: [{
    idFamilia: 'T49MT01H0001F0001', hogarNumero: 1, tipoFamilia: 'unipersonal', numeroIntegrantes: 1,
    integrantes: [{
      primerNombre: 'ANA', primerApellido: 'PRUEBA', tipoId: 'CC', numeroId: '900000301',
      fechaNacimiento: '1980-01-01', sexo: 'mujer', rolFamiliar: 'responsable_economico'
    }]
  }],
  planVivienda: {
    codigoEbs: 'EBS12', codigoVivienda: 'T49MT01H0001',
    acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: 'NC-FAM-01', tipoRespuesta: 'en_sitio' }],
    seguimientos: [{
      seguimientoTipoId: 'CC', seguimientoNumeroId: '1144012345', accionConcertada: 'Control en un mes',
      seg1Fecha: HOY, seg1Estado: 'C'
    }]
  },
  planCuidado: { pendiente: true, accionesRegistradas: 1, alertasSinConducta: 1 }
};

function montar() {
  const almacen = { aps_encuestas: JSON.stringify([FICHA]) };
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

  const enviados = [];
  window.fetch = (url, opciones) => {
    const ruta = String(url);
    const responder = (estado, cuerpo) => Promise.resolve({
      ok: estado >= 200 && estado < 300, status: estado, json: () => Promise.resolve(cuerpo)
    });
    if (ruta.indexOf('/api/ficha_completa') === 0) {
      return responder(200, { encuesta: JSON.parse(JSON.stringify(FICHA)), planRegistradoEditable: false });
    }
    if (ruta.indexOf('/api/guardar_encuesta') === 0) {
      enviados.push(JSON.parse(opciones.body));
      return responder(200, { mensaje: 'Plan de cuidado guardado', soloPlan: true, planCuidado: { pendiente: false } });
    }
    return Promise.reject(new Error('sin red'));
  };

  const errores = [];
  window.addEventListener('error', (e) => errores.push(e.message));

  window.eval(fuentes + ';\nwindow.__api = { abrirEvolucionDePlan, abrirCorreccionDeEncuesta, recolectarDatosFormulario, ' +
    'salirDeCorreccion, enEvolucionDePlan };');
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, doc: window.document, errores, api: window.__api, enviados, almacen };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const bloqueado = (el) => Boolean(el && el.closest('[inert]'));

(async function () {
  const app = montar();
  const $ = (s) => app.doc.querySelector(s);
  check('La aplicación arranca sin errores de JS', app.errores.length === 0, app.errores.join(' | '));

  console.log('\n=== 1. Evolucionar plan ===');
  await app.api.abrirEvolucionDePlan('evo-1');
  await esperar(50);

  check('Entra en modo de evolución del plan', app.api.enEvolucionDePlan() === true);
  check('El aviso lo dice', /Evolucionando el plan de cuidado/.test(($('#avisoCorreccionTexto') || {}).textContent || ''));
  check('La visita queda intocable (estrato, integrantes)',
    bloqueado($('#estrato')) && bloqueado($('[name="familias[0].integrantes[0].primerNombre"]')));
  check('El cierre por causa externa también', bloqueado($('[name="visitaIncompleta"]')));

  const accion = $('[name="planVivienda.acciones[0].codigoAccion"]');
  check('La acción registrada queda bloqueada y marcada', bloqueado(accion) && accion.closest('tr').classList.contains('plan-registrado'));
  await esperar(400);   // más que el retardo del buscador de CUPS
  const listaCups = accion.closest('[data-rol="comboCups"]').querySelector('.combo-cups__lista');
  check('Cargar la ficha no abre el buscador de CUPS sobre la acción registrada',
    listaCups.hidden === true && accion.getAttribute('aria-expanded') !== 'true');
  check('El 1.er seguimiento registrado queda bloqueado', bloqueado($('[name="planVivienda.seguimientos[0].seg1Fecha"]')));
  check('El 2.º seguimiento vacío sigue abierto para completarlo',
    !bloqueado($('[name="planVivienda.seguimientos[0].seg2Fecha"]')) && !bloqueado($('[name="planVivienda.seguimientos[0].seg2Estado"]')));
  check('Se pueden agregar acciones', !bloqueado($('#btnAgregarAccionVivienda')));
  check('El botón Guardar sigue disponible', !bloqueado($('#btnGuardar')));

  const datos = app.api.recolectarDatosFormulario($('#encuestaForm'));
  check('Lo bloqueado sigue viajando en los datos (inert, no disabled)',
    datos.planVivienda && datos.planVivienda.acciones[0].codigoAccion === 'NC-FAM-01' && datos.estrato === 'bajo',
    JSON.stringify(datos.planVivienda && datos.planVivienda.acciones));

  console.log('\n=== 2. Guardar el plan ===');
  const seg2 = $('[name="planVivienda.seguimientos[0].seg2Fecha"]');
  const mes = new Date(); mes.setDate(mes.getDate() + 30);
  seg2.value = mes.toISOString().split('T')[0];
  seg2.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  const estado2 = $('[name="planVivienda.seguimientos[0].seg2Estado"]');
  estado2.value = 'C';
  estado2.dispatchEvent(new app.window.Event('change', { bubbles: true }));

  $('#encuestaForm').dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  await esperar(200);

  const cuerpo = app.enviados[0] || {};
  check('Se envió la ficha al servidor', app.enviados.length === 1, String(app.enviados.length));
  check('  como evolución del plan (soloPlan) de una ficha existente', cuerpo.soloPlan === true && cuerpo.esCorreccion === true);
  check('  con el 2.º seguimiento completado',
    cuerpo.planVivienda && cuerpo.planVivienda.seguimientos[0].seg2Estado === 'C');
  check('Al terminar se sueltan los bloqueos y sale del modo',
    app.doc.querySelectorAll('[data-bloqueo-plan]').length === 0 && app.api.enEvolucionDePlan() === false);
  const copia = JSON.parse(app.almacen.aps_encuestas || '[]').find((e) => e.codigoFicha === FICHA.codigoFicha) || {};
  check('La copia del dispositivo quedó al día con el plan evolucionado',
    copia.planVivienda && copia.planVivienda.seguimientos[0].seg2Estado === 'C', JSON.stringify(copia.planVivienda || null).slice(0, 160));

  console.log('\n=== 3. Corregir bloquea sólo lo registrado del plan ===');
  await app.api.abrirCorreccionDeEncuesta(copia.id || 'evo-1');
  await esperar(50);
  check('Corregir no entra en modo de evolución', app.api.enEvolucionDePlan() === false);
  check('La visita se puede corregir', !bloqueado($('#estrato')));
  check('Lo registrado del plan sigue bloqueado', bloqueado($('[name="planVivienda.acciones[0].codigoAccion"]')));
  check('  incluido el 2.º seguimiento que ya se registró', bloqueado($('[name="planVivienda.seguimientos[0].seg2Fecha"]')));
  check('El aviso explica el bloqueo', /no se puede cambiar sin autorización/.test(($('#avisoCorreccionTexto') || {}).textContent || ''));
  app.api.salirDeCorreccion();
  check('Al salir no queda nada bloqueado', app.doc.querySelectorAll('[data-bloqueo-plan]').length === 0);

  check('Sin errores de JS', app.errores.length === 0, app.errores.join(' | '));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + ok + '   Fallidas: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
