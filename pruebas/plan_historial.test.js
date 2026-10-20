/* Prueba del plan de cuidado en las tarjetas del historial: el resumen que
   arma el servidor desde las columnas de la base, el que se calcula para la
   ficha del dispositivo, y lo que se pinta (estado, plazo, alertas por
   prioridad, acciones y derivaciones, seguimientos). */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { resumenPlanDesdeFila } = require('../api/_plan_cuidado');

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

const DIA = 86400000;
const HOY = new Date().toISOString().split('T')[0];
const enDias = (n) => new Date(Date.now() + n * DIA).toISOString().split('T')[0];

console.log('\n=== 1. Resumen desde la base ===');
const resumen = resumenPlanDesdeFila({
  plan_acciones: '1', plan_alertas_sin_conducta: '2',
  plan_alertas: { inmediata: 1, prioritaria: 2, regular: 0, vence: '2026-10-01T10:00:00-05:00' },
  plan_derivaciones: { derivadas: 1, proxima_cita: '2026-10-24' },
  plan_seguimientos: { hechos: 1, esperados: 4 }
});
check('Pendiente con alertas sin conducta', resumen.pendiente === true && resumen.alertasSinConducta === 2);
check('Alertas por prioridad', JSON.stringify(resumen.detalle.alertas) === '{"inmediata":1,"prioritaria":2,"regular":0}');
check('Plazo, derivaciones, cita y seguimientos',
  resumen.detalle.venceSinConducta === '2026-10-01T10:00:00-05:00' && resumen.detalle.derivadas === 1 &&
  resumen.detalle.proximaCita === '2026-10-24' && resumen.detalle.seguimientosHechos === 1 &&
  resumen.detalle.seguimientosEsperados === 4);
const vacio = resumenPlanDesdeFila({ plan_acciones: '0', plan_alertas_sin_conducta: '0' });
check('Sin columnas de detalle no se rompe: ceros', vacio.detalle.derivadas === 0 && vacio.detalle.venceSinConducta === null);

console.log('\n=== 2. Ficha del dispositivo y tarjeta ===');
const accion = (tipo, cita) => ({ codigoAccion: '890105', tipoRespuesta: tipo, fechaCita: cita || null });
const local = {
  id: 'loc-1', codigoFicha: 'LOC-1', sincronizada: false, fechaRegistro: new Date().toISOString(),
  fechaDiligenciamiento: HOY, territorio: 'T49', microterritorio: 'MT01', consentimiento: 'si',
  hogaresEnVivienda: 1, familias: [{ integrantes: [{ planPersona: { acciones: [accion('derivada', enDias(5))] } }],
    planFamilia: { acciones: [accion('derivada', enDias(-2))], seguimientos: [{ accionConcertada: 'Visita', seg1Fecha: HOY }] } }],
  planVivienda: { acciones: [accion('en_sitio'), { codigoAccion: '' }],
    seguimientos: [{ accionConcertada: 'Control', seg1Fecha: HOY, seg2Fecha: HOY }, { accionConcertada: '' }] },
  planCuidado: { pendiente: false, accionesRegistradas: 3, alertasSinConducta: 0 }
};
const servidor = {
  codigoFicha: 'SRV-1', fechaRegistro: new Date().toISOString(), fechasModificacion: [], situacionInminente: ['no_aplica'],
  equipoSaludId: 'EBS12', responsableId: 100, territorio: 'T49', microterritorio: 'MT01', permisoPlan: false,
  planCuidado: { pendiente: true, accionesRegistradas: 0, alertasSinConducta: 1,
    detalle: { alertas: { inmediata: 0, prioritaria: 1, regular: 0 }, venceSinConducta: new Date(Date.now() + 2 * DIA).toISOString(),
      derivadas: 0, proximaCita: null, seguimientosHechos: 0, seguimientosEsperados: 0 } }
};
const viejo = Object.assign({}, servidor, { codigoFicha: 'SRV-VIEJO', planCuidado: { pendiente: true, accionesRegistradas: 0, alertasSinConducta: 0 } });

/* Ficha pendiente: 7 personas en 2 habitaciones (hacinamiento, RN-211) sin
   nada en el plan de la vivienda; la familia, derivada con cita y con un
   seguimiento que no se cumplió. */
const pendiente = {
  id: 'loc-2', codigoFicha: 'LOC-2', sincronizada: false, fechaRegistro: new Date().toISOString(),
  fechaDiligenciamiento: HOY, territorio: 'T49', microterritorio: 'MT01', consentimiento: 'si',
  hogaresEnVivienda: 1, personasEnVivienda: 7, habitacionesVivienda: 2,
  planVivienda: { acciones: [], seguimientos: [] },
  familias: [{ idFamilia: 'T49MT01H0009F0001', integrantes: [],
    planFamilia: {
      acciones: [{ codigoAccion: 'NC-FAM-02', procedimientoRealizado: 'Se remitió a <trabajo social>',
        tipoRespuesta: 'derivada', institucionDestino: 'ESE Ladera', fechaCita: enDias(5),
        ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345' }],
      seguimientos: [{ accionConcertada: 'Asistir a la cita', seg1Fecha: HOY, seg1Estado: 'NC',
        seg1MotivoNc: 'No asistió', seguimientoTipoId: 'CC', seguimientoNumeroId: '1144012345' }]
    } }],
  planCuidado: { pendiente: true, accionesRegistradas: 1, alertasSinConducta: 1 }
};

const almacen = { aps_encuestas: JSON.stringify([local, pendiente]) };
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window, 'localStorage', {
  value: { getItem: (k) => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); }, removeItem: (k) => { delete almacen[k]; } },
  configurable: true
});
window.navigator.geolocation = { getCurrentPosition() {} };
window.HTMLElement.prototype.scrollIntoView = function () {};
window.SESION = { usuario: () => ({ rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 100 }) };
/* La base contesta el listado y el detalle básico; el plan completo
   (/api/ficha_completa) le es negado a este usuario. */
window.fetch = (url) => {
  const ruta = String(url);
  const responder = (estado, cuerpo) => Promise.resolve({ ok: estado < 300, status: estado, json: () => Promise.resolve(cuerpo) });
  if (ruta.indexOf('/api/listar_fichas') === 0) return responder(200, [servidor, viejo]);
  if (ruta.indexOf('/api/obtener_ficha') === 0) return responder(200, { familias: [] });
  if (ruta.indexOf('/api/ficha_completa') === 0) return responder(403, { error: 'sin permiso' });
  return Promise.reject(new Error('sin red'));
};
const errores = [];
window.addEventListener('error', (e) => errores.push(e.message));
window.eval(fuentes + ';\nwindow.__api = { detallePlanDeFicha, plazoDeAtencion, refrescarFichasDelServidor, renderizarHistorial, abrirModalDetalle };');
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

(async function () {
  const api = window.__api;
  check('La aplicación arranca sin errores de JS', errores.length === 0, errores.join(' | '));

  const d = api.detallePlanDeFicha(local);
  check('Local: cuenta las derivaciones de todos los planes', d.derivadas === 2, d.derivadas);
  check('  la próxima cita es la futura más cercana, no la pasada', d.proximaCita === enDias(5), d.proximaCita);
  check('  seguimientos: 3 de 4 (las concertaciones vacías no cuentan)',
    d.seguimientosHechos === 3 && d.seguimientosEsperados === 4, d.seguimientosHechos + '/' + d.seguimientosEsperados);

  check('Plazo vencido', api.plazoDeAtencion(new Date(Date.now() - 3 * DIA - 1000).toISOString()).texto === 'Plazo vencido hace 3 días');
  check('Plazo cerca', api.plazoDeAtencion(new Date(Date.now() + 2 * DIA - 1000).toISOString()).nivel === 'cerca');
  check('Plazo con tiempo', api.plazoDeAtencion(new Date(Date.now() + 20 * DIA).toISOString()).texto === 'Vence en 20 días');

  await api.refrescarFichasDelServidor();
  api.renderizarHistorial();
  const celda = (codigo) => Array.from(window.document.querySelectorAll('#historialTableBody tr'))
    .find((tr) => tr.textContent.indexOf(codigo) !== -1).querySelector('.celda-plan');

  const srv = celda('SRV-1');
  check('Tarjeta: estado pendiente y plazo en ámbar', /Pendiente/.test(srv.textContent) &&
    Boolean(srv.querySelector('.plan-resumen__plazo--cerca')), srv.textContent);
  check('  sin el cuadro de alertas, acciones y seguimientos (eso va en «Ver»)',
    !srv.querySelector('dl') && !/Seguimientos/.test(srv.textContent), srv.textContent);

  const loc = celda('LOC-1');
  check('Ficha local registrada: sólo el distintivo, sin plazo',
    /Registrado/.test(loc.textContent) && !loc.querySelector('.plan-resumen__plazo') && !loc.querySelector('dl'));

  const antiguo = celda('SRV-VIEJO');
  check('Fila sin detalle: sólo el distintivo, como antes',
    !antiguo.querySelector('.plan-resumen__plazo') && /Pendiente/.test(antiguo.textContent));

  console.log('\n=== 3. Detalle («Ver») ===');
  await api.abrirModalDetalle('loc-2');
  const sec = window.document.querySelector('#modalDetalleBody .detalle-plan');
  const texto = sec ? sec.textContent : '';
  check('La sección del plan existe', Boolean(sec));
  check('  estado pendiente, plazo y cuentas',
    /Pendiente/.test(texto) && Boolean(sec.querySelector('.plan-resumen__plazo')) &&
    /1 acción · 1 derivación · 1 de 2 seguimientos · 1 alerta sin conducta/.test(texto), texto.slice(0, 300));
  check('  la alerta de hacinamiento, sin conducta y en el plan de la vivienda',
    /Hacinamiento/.test(texto) && /RN-211/.test(texto) && /Sin conducta/.test(texto) && /Plan de la vivienda/.test(texto));
  check('  la acción con su código, la derivación, la cita y quién la hizo',
    /NC-FAM-02/.test(texto) && /Derivada a ESE Ladera · cita el/.test(texto) && /Ejecutó CC 1144012345/.test(texto));
  check('  el texto libre se escapa', /Se remitió a <trabajo social>/.test(texto) && !sec.querySelector('trabajo'));
  check('  el seguimiento: NC con su motivo y el segundo pendiente',
    /1\.er seguimiento: .* · NC: No cumple/.test(texto) && /Motivo: No asistió/.test(texto) &&
    /2\.º seguimiento: pendiente/.test(texto), texto);
  check('  el plan vacío de la vivienda no aparece como bloque',
    !Array.from(sec.querySelectorAll('.detalle-plan__plan-titulo')).some((h) => /vivienda/.test(h.textContent)));

  await api.abrirModalDetalle('SRV-1');
  const remota = window.document.querySelector('#modalDetalleBody .detalle-plan');
  check('Fila de la base sin el plan completo: resumen y por qué no hay más',
    Boolean(remota) && /Pendiente/.test(remota.textContent) &&
    /lo ve quien puede corregir la ficha o evolucionar su plan/.test(remota.textContent),
    remota && remota.textContent);

  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
