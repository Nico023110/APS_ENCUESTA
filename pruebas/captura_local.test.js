/* Prueba de integración de captura_local.js: el código de la ficha (RN-015)
   y el borrador automático. Monta la aplicación completa en jsdom, y para la
   recuperación la vuelve a montar sobre el mismo almacenamiento, como si el
   navegador se hubiera cerrado a mitad de la visita. */

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

/** Monta la aplicación sobre `almacen`, que sobrevive entre montajes. */
function montar(almacen) {
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

  window.eval(fuentes + ';\nwindow.__api = { guardarBorradorAhora, guardarYReiniciar, recolectarDatosFormulario, ' +
    'reiniciarFichaEnCurso, abrirCorreccionDeEncuesta, obtenerEncuestas, get codigoEnCurso() { return codigoEnCurso; } };');
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

  const doc = window.document;
  return {
    window, doc, errores, api: window.__api,
    $: (s) => doc.querySelector(s),
    escribir(sel, valor) {
      const el = doc.querySelector(sel);
      el.value = valor;
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
    },
    marcar(nombre, valor) {
      const el = doc.querySelector('input[name="' + nombre + '"][value="' + valor + '"]');
      el.checked = true;
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
    }
  };
}

const FORMATO = /^76001-([A-Z0-9]+)-([A-Z0-9]{4})-(\d{4,})-(\d{8})$/;
const CLAVE_BORRADOR = 'aps_borrador_local';

(async function () {
  const almacen = {};

  console.log('\n=== 1. Código de la ficha (RN-015) ===');
  let app = montar(almacen);
  check('La aplicación arranca sin errores de JS', app.errores.length === 0, app.errores.join(' | '));

  const campo = app.$('#codigoFicha');
  const partes = FORMATO.exec(campo.value);
  check('La ficha nueva nace con código municipio-equipo-dispositivo-consecutivo-fecha', Boolean(partes), campo.value);
  check('El campo es de sólo lectura', campo.readOnly === true);
  check('El consecutivo de la primera ficha es 0001', partes && partes[3] === '0001', campo.value);
  check('Sin equipo en la sesión, el segmento es SINEQ', partes && partes[1] === 'SINEQ', campo.value);
  check('El identificador del dispositivo queda guardado', almacen.aps_dispositivo === (partes && partes[2]), almacen.aps_dispositivo);

  const hoy = new Date();
  const fechaHoy = String(hoy.getFullYear()) + String(hoy.getMonth() + 1).padStart(2, '0') + String(hoy.getDate()).padStart(2, '0');
  check('La fecha del código es la de hoy', partes && partes[4] === fechaHoy, campo.value);

  app.escribir('#equipoSaludId', 'ebs-12');
  check('El código sigue al equipo mientras la ficha no se ha guardado',
    FORMATO.exec(campo.value) && FORMATO.exec(campo.value)[1] === 'EBS12', campo.value);

  const codigoPrimera = campo.value;
  app.marcar('consentimiento', 'si');
  app.escribir('#divisionTerritorial', 'Barrio Prueba');
  await app.api.guardarYReiniciar(app.api.recolectarDatosFormulario(app.$('#encuestaForm')), app.$('#encuestaForm'), 'Prueba.');

  const guardadas = app.api.obtenerEncuestas();
  check('Sin red, la ficha queda en el dispositivo con su código',
    guardadas.length === 1 && guardadas[0].codigoFicha === codigoPrimera, JSON.stringify(guardadas.map((e) => e.codigoFicha)));
  check('El consecutivo usado queda registrado', almacen.aps_consecutivo_ficha === '1', almacen.aps_consecutivo_ficha);
  const siguiente = FORMATO.exec(app.$('#codigoFicha').value);
  check('La ficha siguiente toma el consecutivo 0002', siguiente && siguiente[3] === '0002', app.$('#codigoFicha').value);
  check('El mismo dispositivo conserva su identificador', siguiente && siguiente[2] === partes[2]);
  check('Guardar la ficha borra el borrador', !(CLAVE_BORRADOR in almacen));

  console.log('\n=== 2. Corregir conserva el código ===');
  app.api.abrirCorreccionDeEncuesta(guardadas[0].id);
  check('Al corregir, el ítem 15 trae el código de la ficha y no uno nuevo',
    app.$('#codigoFicha').value === codigoPrimera, app.$('#codigoFicha').value);
  app.api.guardarBorradorAhora();
  check('Abrir una corrección sin cambiar nada no crea borrador', !(CLAVE_BORRADOR in almacen));
  app.api.reiniciarFichaEnCurso();

  console.log('\n=== 3. Borrador automático ===');
  app.marcar('consentimiento', 'si');
  app.api.guardarBorradorAhora();
  check('Marcar sólo el consentimiento no crea borrador', !(CLAVE_BORRADOR in almacen));

  app.escribir('#divisionTerritorial', 'Vereda La Buitrera');
  app.escribir('#personasEnVivienda', '5');
  app.api.guardarBorradorAhora();
  const borrador = almacen[CLAVE_BORRADOR] ? JSON.parse(almacen[CLAVE_BORRADOR]) : null;
  check('Al escribir, la ficha en curso se guarda como borrador', Boolean(borrador));
  check('El borrador trae lo diligenciado',
    borrador && borrador.datos.divisionTerritorial === 'Vereda La Buitrera' && borrador.datos.personasEnVivienda === 5);
  check('El borrador trae el código de la ficha', borrador && borrador.codigoFicha === app.$('#codigoFicha').value);
  const codigoBorrador = borrador && borrador.codigoFicha;

  await new Promise((r) => setTimeout(r, 1400));
  app.escribir('#ubicacionReferencia', 'Casa azul');
  await new Promise((r) => setTimeout(r, 1400));
  const trasPausa = JSON.parse(almacen[CLAVE_BORRADOR]);
  check('Tras la pausa, el borrador se actualiza solo', trasPausa.datos.ubicacionReferencia === 'Casa azul');

  console.log('\n=== 4. Recuperación al reabrir ===');
  app.window.close();
  app = montar(almacen);
  check('La aplicación reabre sin errores de JS', app.errores.length === 0, app.errores.join(' | '));
  check('Abre directo en Nueva encuesta', app.$('#view-nueva').classList.contains('is-active'));
  check('Recupera lo diligenciado',
    app.$('#divisionTerritorial').value === 'Vereda La Buitrera' && app.$('#personasEnVivienda').value === '5' &&
    app.$('#ubicacionReferencia').value === 'Casa azul');
  check('Recupera el código de la ficha, no genera otro', app.$('#codigoFicha').value === codigoBorrador, app.$('#codigoFicha').value);
  check('Conserva el consentimiento dado', app.$('input[name="consentimiento"][value="si"]').checked);
  const aviso = app.$('#avisoBorrador');
  check('Muestra el aviso de ficha recuperada', aviso && !aviso.hidden && /Ficha sin terminar recuperada/.test(aviso.textContent));

  app.api.reiniciarFichaEnCurso();
  check('Descartar borra el borrador', !(CLAVE_BORRADOR in almacen));
  check('Descartar oculta el aviso', app.$('#avisoBorrador').hidden === true);
  check('Descartar deja el formulario en blanco', app.$('#divisionTerritorial').value === '');

  console.log('\n=== 5. Consentimiento sin responder ===');
  app.escribir('#divisionTerritorial', 'Barrio Sin Consentimiento');
  app.api.guardarBorradorAhora();
  app.window.close();
  app = montar(almacen);
  check('Se recupera la ficha empezada sin consentimiento', app.$('#divisionTerritorial').value === 'Barrio Sin Consentimiento');
  check('El consentimiento sigue sin responder: el sistema no marca «SÍ» por el encuestado',
    !app.$('input[name="consentimiento"]:checked'));
  app.api.reiniciarFichaEnCurso();

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + ok + '   Fallidas: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
