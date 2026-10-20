/* Prueba de «Completar integrantes» (RN-051). Un integrante declarado en el
   ítem 51 que no estaba en la visita se agrega después, desde el historial.
   Comprueba:
     1. la regla del servidor (api/_integrantes_nuevos.js): lo registrado no
        cambia, sólo se agregan integrantes y el ítem 51 sólo sube;
     2. en el navegador, con una ficha que ya está en la base: el botón del
        historial, el modo con todo bloqueado salvo los integrantes nuevos,
        el ítem 51 y el plan; que sólo cuenten los pendientes de lo nuevo; y
        que el guardado pida al servidor escribir sólo los nuevos;
     3. una ficha que aún no sube se completa como corrección libre. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { revisarIntegrantesNuevos, esDeIntegranteNuevo, cuentaAlCompletar } = require('../api/_integrantes_nuevos');
const { esDelPlan } = require('../api/_plan_bloqueo');

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

const copia = (o) => JSON.parse(JSON.stringify(o));
const persona = (numero, nombre) => ({ tipoId: 'CC', numeroId: numero, primerNombre: nombre, primerApellido: 'PRUEBA' });

console.log('\n=== 1. Regla del servidor ===');
const guardada = { familias: [{ numeroIntegrantes: 3, integrantes: [persona('900000301', 'ANA'), persona('900000302', 'LUIS')] }] };

const conUno = copia(guardada);
conUno.familias[0].integrantes.push(persona('900000303', 'SARA'));
let r = revisarIntegrantesNuevos(guardada, conUno);
check('Agregar el que faltaba: sin bloqueos', r.bloqueos.length === 0, JSON.stringify(r.bloqueos));
check('  el nuevo es el tercero de la familia 1', JSON.stringify(r.nuevos) === '[{"familia":0,"desde":2,"hasta":3}]');

const cambiado = copia(conUno);
cambiado.familias[0].integrantes[1].numeroId = '900000399';
r = revisarIntegrantesNuevos(guardada, cambiado);
check('Cambiar a uno ya registrado se rechaza', r.bloqueos.some((b) => b.ruta === 'familias[0].integrantes[1]'));

const quitado = copia(guardada);
quitado.familias[0].integrantes.pop();
r = revisarIntegrantesNuevos(guardada, quitado);
check('Quitar a uno ya registrado se rechaza', r.bloqueos.some((b) => b.ruta === 'familias[0].integrantes'));

const menos = copia(conUno);
menos.familias[0].numeroIntegrantes = 2;
r = revisarIntegrantesNuevos(guardada, menos);
check('Bajar el ítem 51 se rechaza', r.bloqueos.some((b) => b.ruta === 'familias[0].numeroIntegrantes'));

const mas = copia(conUno);
mas.familias[0].numeroIntegrantes = 4;
r = revisarIntegrantesNuevos(guardada, mas);
check('Subir el ítem 51 se acepta y se anota', r.bloqueos.length === 0 &&
  JSON.stringify(r.aumentos) === '[{"familia":0,"numeroIntegrantes":4}]', JSON.stringify(r));

const otraFamilia = copia(conUno);
otraFamilia.familias.push({ numeroIntegrantes: 1, integrantes: [persona('900000304', 'EVA')] });
r = revisarIntegrantesNuevos(guardada, otraFamilia);
check('Agregar una familia se rechaza', r.bloqueos.some((b) => b.ruta === 'familias'));

const repetido = copia(guardada);
repetido.familias[0].integrantes.push(persona('900000301', 'ANA'));
r = revisarIntegrantesNuevos(guardada, repetido);
check('Agregar a alguien que ya está en la ficha se rechaza',
  r.bloqueos.some((b) => b.ruta === 'familias[0].integrantes[2].numeroId'));

r = revisarIntegrantesNuevos(guardada, copia(guardada));
check('Sin nada nuevo se rechaza y lo dice', r.bloqueos.length === 1 && /No agregó ningún integrante/.test(r.bloqueos[0].mensaje));

const nuevos = [{ familia: 0, desde: 2, hasta: 3 }];
check('Ruta de un integrante nuevo', esDeIntegranteNuevo('familias[0].integrantes[2].peso', nuevos));
check('  y no la de uno registrado', !esDeIntegranteNuevo('familias[0].integrantes[1].peso', nuevos));
check('Cuentan el plan, el ítem 51 y RN-029; no la vivienda',
  cuentaAlCompletar({ ruta: 'planVivienda.acciones[0].codigoAccion' }, nuevos, esDelPlan) &&
  cuentaAlCompletar({ ruta: 'familias[0].numeroIntegrantes' }, nuevos, esDelPlan) &&
  cuentaAlCompletar({ ruta: 'personasEnVivienda', codigo: 'RN-029' }, nuevos, esDelPlan) &&
  !cuentaAlCompletar({ ruta: 'estrato', codigo: 'RN-027' }, nuevos, esDelPlan));
check('  ni el saneamiento (bloque 4)', !cuentaAlCompletar({ ruta: 'fuenteAgua', codigo: 'RN-046' }, nuevos, esDelPlan));

console.log('\n=== 2. En el navegador: ficha que ya está en la base ===');
const HOY = new Date().toISOString().split('T')[0];
const FICHA = {
  id: 'comp-1',
  codigoFicha: '76001-EBS12-COMP-0001-' + HOY.replace(/-/g, ''),
  sincronizada: true,
  fechaRegistro: new Date().toISOString(),
  consentimiento: 'si',
  fechaDiligenciamiento: HOY,
  equipoSaludId: 'EBS12',
  territorio: 'T49',
  microterritorio: 'MT01',
  estrato: 'bajo',
  hogaresEnVivienda: 1,
  personasEnVivienda: 3,
  idHogar: 'T49MT01H0001',
  nuv: 'NUV0001',
  familias: [{
    idFamilia: 'T49MT01H0001F0001', hogarNumero: 1, tipoFamilia: 'nuclear_biparental', numeroIntegrantes: 2,
    integrantes: [{
      primerNombre: 'ANA', primerApellido: 'PRUEBA', tipoId: 'CC', numeroId: '900000301',
      fechaNacimiento: '1980-01-01', sexo: 'mujer', rolFamiliar: 'responsable_economico'
    }]
  }],
  planCuidado: { pendiente: false, accionesRegistradas: 1, alertasSinConducta: 0 }
};
const LOCAL = Object.assign(copia(FICHA), { id: 'loc-1', codigoFicha: 'LOC-1', sincronizada: false });

const almacen = { aps_encuestas: JSON.stringify([FICHA, LOCAL]) };
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window, 'localStorage', {
  value: { getItem: (k) => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); }, removeItem: (k) => { delete almacen[k]; } },
  configurable: true
});
window.navigator.geolocation = { getCurrentPosition() {} };
window.HTMLElement.prototype.scrollIntoView = function () {};
window.SESION = { usuario: () => ({ rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 100 }) };

const enviados = [];
window.fetch = (url, opciones) => {
  const ruta = String(url);
  const responder = (estado, cuerpo) => Promise.resolve({ ok: estado < 300, status: estado, json: () => Promise.resolve(cuerpo) });
  if (ruta.indexOf('/api/ficha_completa') === 0) {
    return responder(200, { encuesta: copia(FICHA), corregible: false, planRegistradoEditable: false });
  }
  if (ruta.indexOf('/api/guardar_encuesta') === 0) {
    enviados.push(JSON.parse(opciones.body));
    return responder(200, { mensaje: 'Integrantes agregados', completarIntegrantes: true, integrantesAgregados: 1 });
  }
  if (ruta.indexOf('/api/listar_fichas') === 0) return responder(200, []);
  return Promise.reject(new Error('sin red'));
};
const errores = [];
window.addEventListener('error', (e) => errores.push(e.message));
window.eval(fuentes + ';\nwindow.__api = { abrirCompletarIntegrantes, enCompletarIntegrantes, renderizarHistorial, ' +
  'recolectarDatosFormulario, guardarYReiniciar, salirDeCorreccion };');
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
/* Los avisos salen por SweetAlert; en jsdom no existe y se cuentan aquí. */
const avisos = [];
window.Swal = { fire: (o) => { avisos.push(o); return Promise.resolve({}); } };

const $ = (s) => window.document.querySelector(s);
const $$ = (s) => Array.from(window.document.querySelectorAll(s));
const esperar = (ms) => new Promise((res) => setTimeout(res, ms));
const bloqueado = (el) => Boolean(el && el.closest('[inert]'));
const bloques = () => $$('#contenedorFamilias > [data-bloque="familia"]')[0]
  .querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]');
const cambiar = (el, valor) => { el.value = valor; el.dispatchEvent(new window.Event('change', { bubbles: true })); };

(async function () {
  const api = window.__api;
  check('La aplicación arranca sin errores de JS', errores.length === 0, errores.join(' | '));

  api.renderizarHistorial();
  const boton = $('#historialTableBody [data-completar="comp-1"]');
  check('El historial ofrece «Completar integrantes» y dice cuántos faltan',
    Boolean(boton) && /Completar integrantes/.test(boton.textContent) && /falta 1/.test(boton.textContent) && !boton.disabled,
    boton && boton.outerHTML);

  boton.click();
  await esperar(50);
  check('Entra en el modo de completar integrantes', api.enCompletarIntegrantes() === true);
  check('El aviso dice que quedó lista para completar (no «sin pendientes»)',
    avisos.some((a) => /lista para completar sus integrantes/.test(a.text || '')),
    JSON.stringify(avisos.map((a) => a.text)));
  check('El aviso lo dice', /Completando los integrantes/.test(($('#avisoCorreccionTexto') || {}).textContent || ''));
  check('Se agregó el bloque del integrante que faltaba', bloques().length === 2, String(bloques().length));
  check('El integrante registrado queda bloqueado', bloqueado(bloques()[0]));
  check('El nuevo queda abierto', !bloqueado(bloques()[1]) &&
    !bloqueado(bloques()[1].querySelector('[name$=".primerNombre"]')));
  check('La vivienda y la familia quedan bloqueadas',
    bloqueado($('#estrato')) && bloqueado($('[name="familias[0].tipoFamilia"]')));
  check('El ítem 51 queda abierto', !bloqueado($('[name="familias[0].numeroIntegrantes"]')));
  check('El plan de cuidado queda abierto', !bloqueado($('#btnAgregarAccionVivienda')));
  check('El cierre por causa externa, bloqueado', bloqueado($('[name="visitaIncompleta"]')));
  check('Guardar sigue disponible', !bloqueado($('#btnGuardar')));

  const campo51 = $('[name="familias[0].numeroIntegrantes"]');
  cambiar(campo51, '1');
  check('El ítem 51 no baja de lo declarado', campo51.value === '2' && bloques().length === 2, campo51.value);
  cambiar(campo51, '3');
  check('Subir el ítem 51 agrega un bloque abierto', bloques().length === 3 && !bloqueado(bloques()[2]));
  cambiar(campo51, '2');
  check('Volver a 2 quita sólo el agregado', bloques().length === 2 && bloqueado(bloques()[0]));

  $('#encuestaForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await esperar(20);
  const marcados = $$('.has-error');
  check('Guardar vacío marca pendientes', marcados.length > 0);
  check('  sólo en el integrante nuevo, no en lo registrado',
    marcados.every((el) => bloques()[1].contains(el) || /numeroIntegrantes/.test(el.innerHTML)),
    marcados.filter((el) => !bloques()[1].contains(el)).map((el) => (el.querySelector('[name]') || {}).name).join(', '));
  check('  sin enviar nada', enviados.length === 0);
  const mensajeModal = $('#modalConfirmar');
  if (mensajeModal && !mensajeModal.hidden) $('#btnCancelarEliminar').click();

  const nuevo = bloques()[1];
  cambiar(nuevo.querySelector('[name$=".primerNombre"]'), 'SARA');
  cambiar(nuevo.querySelector('[name$=".primerApellido"]'), 'PRUEBA');
  const datos = api.recolectarDatosFormulario($('#encuestaForm'));
  check('Lo bloqueado sigue viajando (inert, no disabled)',
    datos.estrato === 'bajo' && datos.familias[0].integrantes[0].numeroId === '900000301' &&
    datos.familias[0].integrantes.length === 2, JSON.stringify(datos.familias[0].integrantes.map((i) => i.primerNombre)));

  await api.guardarYReiniciar(datos, $('#encuestaForm'), 'x');
  const cuerpo = enviados[0] || {};
  check('El guardado pide escribir sólo los integrantes nuevos',
    cuerpo.completarIntegrantes === true && cuerpo.esCorreccion === true && cuerpo.soloPlan !== true, JSON.stringify(Object.keys(cuerpo)));
  check('  con el integrante nuevo', cuerpo.familias && cuerpo.familias[0].integrantes[1].primerNombre === 'SARA');
  check('Al terminar sale del modo y suelta los bloqueos',
    api.enCompletarIntegrantes() === false && $$('[data-bloqueo-plan]').length === 0);
  const actualizada = JSON.parse(almacen.aps_encuestas).find((e) => e.codigoFicha === FICHA.codigoFicha) || {};
  check('La copia del dispositivo queda con los dos integrantes',
    actualizada.familias && actualizada.familias[0].integrantes.length === 2);

  console.log('\n=== 3. Ficha que aún no sube ===');
  api.renderizarHistorial();
  $('#historialTableBody [data-completar="loc-1"]').click();
  await esperar(50);
  check('Se abre como corrección libre, no en el modo bloqueado',
    api.enCompletarIntegrantes() === false && !bloqueado($('#estrato')));
  check('  con el bloque del integrante que faltaba', bloques().length === 2);
  api.salirDeCorreccion();

  check('Sin errores de JS', errores.length === 0, errores.join(' | '));
  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
