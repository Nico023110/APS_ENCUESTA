/* Prueba de los indicadores de Inicio: viviendas, hogares, familias y
   personas, las viviendas por territorio y las fichas que requieren atención.
   Monta la aplicación completa en jsdom con fichas en el dispositivo y otras
   que sólo están en la base, y comprueba que:
     - una vivienda visitada dos veces cuenta una vez, con su última visita;
     - los hogares se cuentan por hogar (RN-028), no por familia, y los
       declarados sin familias quedan como pendientes;
     - la fila de la base (sin familias, con sus cuentas) y la ficha completa
       del dispositivo se cuentan con el mismo criterio;
     - las filas de atención llevan al historial ya filtrado. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
const fuentes = ['roles.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
  'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'pruebas/_boveda_abierta.js', 'captura_local.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
  .join('\n;\n');

let ok = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const HOY = new Date().toISOString().split('T')[0];
const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();

function integrantes(n) {
  return Array.from({ length: n }, (_, i) => ({ primerNombre: 'P' + i }));
}

/* Ficha completa del dispositivo: dos hogares declarados, el hogar 1 con dos
   familias y el 2 con una; seis personas. */
const LOCAL_COMPLETA = {
  id: 'loc-1', codigoFicha: 'LOC-1', sincronizada: false, fechaRegistro: hace(0),
  fechaDiligenciamiento: HOY, territorio: 'T49', microterritorio: 'MT01',
  hogaresEnVivienda: 2, hacinamiento: 'si', situacionInminente: ['no_aplica'],
  familias: [
    { hogarNumero: 1, integrantes: integrantes(3) },
    { hogarNumero: 1, integrantes: integrantes(1) },
    { hogarNumero: 2, integrantes: integrantes(2) }
  ],
  planCuidado: { pendiente: true, accionesRegistradas: 0, alertasSinConducta: 1 }
};

/* Ficha del dispositivo que declara tres hogares y sólo caracterizó uno. */
const LOCAL_INCOMPLETA = {
  id: 'loc-2', codigoFicha: 'LOC-2', sincronizada: false, fechaRegistro: hace(1),
  fechaDiligenciamiento: HOY, territorio: 'T53', microterritorio: 'MT03',
  hogaresEnVivienda: 3, hacinamiento: 'no', situacionInminente: ['no_aplica'],
  familias: [{ hogarNumero: 1, integrantes: integrantes(2) }],
  planCuidado: { pendiente: false, accionesRegistradas: 2, alertasSinConducta: 0 }
};

function filaServidor(codigo, extra) {
  return Object.assign({
    codigoFicha: codigo, fechaRegistro: hace(5), fechasModificacion: [], situacionInminente: ['no_aplica'],
    equipoSaludId: 'EBS12', responsableId: 100, territorio: 'T49', microterritorio: 'MT01',
    hacinamiento: 'no', planCuidado: { pendiente: false, accionesRegistradas: 1, alertasSinConducta: 0 },
    permisoPlan: false
  }, extra || {});
}

/* NUV0007 visitada dos veces: la visita vieja tenía 1 familia; la nueva, 2
   familias en 2 hogares. Sólo cuenta la nueva. */
const FILAS_SERVIDOR = [
  filaServidor('SRV-VIEJA', {
    nuv: 'NUV0007', idHogar: 'T49MT01H0007', fechaRegistro: hace(30),
    composicion: { hogaresDeclarados: 1, hogares: 1, familias: 1, personas: 4 }
  }),
  filaServidor('SRV-NUEVA', {
    nuv: 'NUV0007', idHogar: 'T49MT01H0007', fechaRegistro: hace(3),
    situacionInminente: ['psicologica'],
    composicion: { hogaresDeclarados: 2, hogares: 2, familias: 2, personas: 5 }
  }),
  filaServidor('SRV-OTRA', {
    nuv: 'NUV0008', idHogar: 'T49MT02H0001', territorio: 'T49',
    composicion: { hogaresDeclarados: '1', hogares: '1', familias: '1', personas: '3' }
  })
];

function montar(locales, filas) {
  const almacen = { aps_encuestas: JSON.stringify(locales) };
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
  /* Sin movimiento: las cifras se escriben al instante. */
  window.matchMedia = (consulta) => ({ matches: /reduce/.test(consulta), addEventListener() {}, removeEventListener() {} });
  window.SESION = { usuario: () => ({ rol: 'enfermeria', equipoCodigo: 'EBS12', funcionarioId: 100 }) };

  window.fetch = (url) => {
    const ruta = String(url);
    if (ruta.indexOf('/api/listar_fichas') === 0) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(filas) });
    }
    return Promise.reject(new Error('sin red'));
  };

  const errores = [];
  window.addEventListener('error', (e) => errores.push(e.message));

  window.eval(fuentes + ';\nwindow.__api = { calcularIndicadores, obtenerEncuestasParaMostrar, refrescarFichasDelServidor, renderizarInicio, cambiarVista, renderizarHistorial, periodoEnHistorial };');
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, doc: window.document, errores, api: window.__api };
}

(async function () {
  console.log('\n=== 1. Conteo ===');
  const app = montar([LOCAL_COMPLETA, LOCAL_INCOMPLETA], FILAS_SERVIDOR);
  const $ = (s) => app.doc.querySelector(s);
  check('La aplicación arranca sin errores de JS', app.errores.length === 0, app.errores.join(' | '));

  await app.api.refrescarFichasDelServidor();
  app.api.renderizarInicio();

  const ind = app.api.calcularIndicadores(app.api.obtenerEncuestasParaMostrar());
  check('5 fichas registradas', ind.totalEncuestas === 5, ind.totalEncuestas);
  check('4 viviendas: NUV0007 visitada dos veces cuenta una', ind.viviendas === 4, ind.viviendas);
  check('Hogares por hogar, no por familia: 2 + 1 + 2 + 1 = 6', ind.hogares === 6, ind.hogares);
  check('Hogares declarados sin caracterizar (RN-028): 2', ind.hogaresSinCaracterizar === 2, ind.hogaresSinCaracterizar);
  check('Familias de la última visita: 3 + 1 + 2 + 1 = 7', ind.familias === 7, ind.familias);
  check('Personas: 6 + 2 + 5 + 3 = 16', ind.personas === 16, ind.personas);
  check('Las cuentas de la base llegan como texto y se suman como número',
    typeof ind.personas === 'number');

  check('Territorios ordenados por viviendas: T49 (3) y T53 (1)',
    ind.territorios.map((t) => t.codigo + ':' + t.viviendas).join(',') === 'T49:3,T53:1',
    JSON.stringify(ind.territorios));
  check('  T49 suma 3 + 2 + 1 familias', ind.territorios[0].familias === 6, ind.territorios[0].familias);

  check('Atención por ficha: 1 situación inminente', ind.situacionesInminentes === 1, ind.situacionesInminentes);
  check('  1 con hacinamiento', ind.conHacinamiento === 1, ind.conHacinamiento);
  check('  1 plan de cuidado pendiente', ind.planPendiente === 1, ind.planPendiente);

  console.log('\n=== 2. Lo que se pinta ===');
  const cifra = (nivel) => $('.cadena__nivel[data-nivel="' + nivel + '"] .cadena__valor').textContent;
  const detalle = (nivel) => $('.cadena__nivel[data-nivel="' + nivel + '"] .cadena__detalle').textContent;
  check('La cadena muestra 4 viviendas, 6 hogares, 7 familias, 16 personas',
    [cifra('viviendas'), cifra('hogares'), cifra('familias'), cifra('personas')].join(',') === '4,6,7,16',
    [cifra('viviendas'), cifra('hogares'), cifra('familias'), cifra('personas')].join(','));
  check('Viviendas: «en 2 territorios»', detalle('viviendas') === 'en 2 territorios', detalle('viviendas'));
  check('Hogares: razón con coma decimal «1,5 por vivienda»', detalle('hogares') === '1,5 por vivienda', detalle('hogares'));
  check('Familias: «1,2 por hogar»', detalle('familias') === '1,2 por hogar', detalle('familias'));
  check('Personas: «2,3 por familia»', detalle('personas') === '2,3 por familia', detalle('personas'));
  check('El aviso de hogares sin caracterizar se ve y lo dice',
    !$('#hogaresSinCaracterizar').hidden && /2 declarados sin caracterizar/.test($('#hogaresSinCaracterizar').textContent),
    $('#hogaresSinCaracterizar').textContent);

  const barras = app.doc.querySelectorAll('#barrasTerritorio .barra');
  check('Una barra por territorio', barras.length === 2, barras.length);
  check('  la mayor llena el carril y la otra a un tercio',
    /--proporcion: 1\.0000/.test(barras[0].getAttribute('style')) && /--proporcion: 0\.3333/.test(barras[1].getAttribute('style')),
    barras[0].getAttribute('style') + ' | ' + barras[1].getAttribute('style'));
  check('  con sus cifras escritas', /3 viviendas · 6 familias/.test(barras[0].textContent), barras[0].textContent);
  check('Nota del panel: «2 territorios»', $('#notaTerritorios').textContent === '2 territorios');

  check('Situación inminente en alerta', $('#atencionInminente').classList.contains('atencion__fila--alerta'));
  check('Plan pendiente en aviso', $('#atencionPlan').classList.contains('atencion__fila--aviso'));
  check('  con su cifra', $('#atencionPlan .atencion__valor').textContent === '1');

  console.log('\n=== 3. Atención → historial filtrado ===');
  app.doc.getElementById('filtroTexto').value = 'algo';
  app.doc.getElementById('filtroIntegrantes').value = 'pendientes';
  $('#atencionPlan').click();
  check('Abre el historial', $('#view-historial').classList.contains('is-active'));
  check('Plan pendiente abre el historial con ese filtro y limpia los demás',
    app.doc.getElementById('filtroPlanCuidado').value === 'pendiente' &&
    app.doc.getElementById('filtroIntegrantes').value === '' && app.doc.getElementById('filtroTexto').value === '');
  const filasHistorial = app.doc.querySelectorAll('#historialTableBody tr.historial-ficha');
  check('  muestra exactamente la ficha que contaba la fila', filasHistorial.length === 1, filasHistorial.length);
  check('El hacinamiento es una cifra, no un botón (el historial ya no lo filtra)',
    $('#atencionHacinamiento').tagName !== 'BUTTON');

  /* Filtro «Integrantes»: las fichas con integrantes por caracterizar y las completas suman todas. */
  const filtroInt = app.doc.getElementById('filtroIntegrantes');
  app.doc.getElementById('filtroPlanCuidado').value = '';
  const contar = (v) => { filtroInt.value = v; filtroInt.dispatchEvent(new app.window.Event('change')); return app.doc.querySelectorAll('#historialTableBody tr.historial-ficha').length; };
  const todas = contar(''), conPendientes = contar('pendientes'), completas = contar('completos');
  check('Filtro de integrantes: pendientes + completos = todas', conPendientes + completas === todas, conPendientes + '+' + completas + ' de ' + todas);
  contar('');
  check('La situación inminente no es un botón (el historial no la filtra)',
    $('#atencionInminente').tagName !== 'BUTTON');

  console.log('\n=== 4. Sin fichas ===');
  const vacia = montar([], []);
  await vacia.api.refrescarFichasDelServidor();
  vacia.api.renderizarInicio();
  const $v = (s) => vacia.doc.querySelector(s);
  check('Cero viviendas, apagado', $v('.cadena__nivel[data-nivel="viviendas"]').classList.contains('cadena__nivel--cero'));
  check('  «Aún sin visitas»', $v('.cadena__nivel[data-nivel="viviendas"] .cadena__detalle').textContent === 'Aún sin visitas');
  check('  sin razón inventada', $v('.cadena__nivel[data-nivel="hogares"] .cadena__detalle').textContent === '');
  check('  sin aviso de hogares', $v('#hogaresSinCaracterizar').hidden);
  check('  el panel de territorios explica qué va a aparecer', Boolean($v('#barrasTerritorio .barras__vacio')));
  check('  y las filas de atención en cero, sin estado',
    !vacia.doc.querySelector('.atencion__fila--alerta, .atencion__fila--aviso'));

  console.log('\n=== 5. Miles con punto ===');
  const grande = montar([], [filaServidor('SRV-GRANDE', {
    nuv: 'NUV0001', composicion: { hogaresDeclarados: 1, hogares: 1, familias: 1, personas: 1284 }
  })]);
  await grande.api.refrescarFichasDelServidor();
  grande.api.renderizarInicio();
  const personas = grande.doc.querySelector('.cadena__nivel[data-nivel="personas"] .cadena__valor').textContent;
  check('1284 personas se escriben 1.284', personas === '1.284', personas);

  console.log('\n=== 6. Historial por fecha y de 20 en 20 ===');
  /* 45 fichas de la base caracterizadas en días distintos: hoy, ayer y hace
     40, 80… días. Se ven las 20 más recientes, agrupadas por período. */
  const diaHace = (d) => { const f = new Date(); f.setDate(f.getDate() - d); return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0'); };
  const muchas = Array.from({ length: 45 }, (_, i) => filaServidor('SRV-H' + i, {
    nuv: 'NUV9' + String(i).padStart(3, '0'),
    fechaDiligenciamiento: diaHace(i === 0 ? 0 : i === 1 ? 1 : 40 + i * 2)
  }));
  const hist = montar([], muchas);
  await hist.api.refrescarFichasDelServidor();
  hist.api.cambiarVista('historial');
  hist.api.renderizarHistorial();
  const $h = (s) => hist.doc.querySelector(s);
  const fichasH = () => hist.doc.querySelectorAll('#historialTableBody tr.historial-ficha');
  const periodosH = () => Array.from(hist.doc.querySelectorAll('#historialTableBody tr.historial-periodo .historial-periodo__titulo')).map((t) => t.textContent);
  check('Se ven las primeras 20 de 45', fichasH().length === 20, fichasH().length);
  check('  la más reciente primero (caracterizada hoy)', /SRV-H0(?!\d)/.test(fichasH()[0].textContent), fichasH()[0].textContent.slice(0, 40));
  check('  agrupadas: «Hoy», «Ayer» y luego por mes', periodosH()[0] === 'Hoy' && periodosH()[1] === 'Ayer' &&
    /^[A-ZÁÉÍÓÚ][a-záéíóú]+ de \d{4}$/.test(periodosH()[2]), periodosH().join(' | '));
  check('  el conteo de la barra lo dice', /^45 fichas · se ven las primeras 20$/.test($h('#historialConteo').textContent), $h('#historialConteo').textContent);
  check('  y «Ver 20 más» está al final', !$h('#historialMas').hidden && $h('#btnHistorialMasTexto').textContent === 'Ver 20 más');
  $h('#btnHistorialMas').click();
  check('«Ver 20 más» muestra 40', fichasH().length === 40, fichasH().length);
  check('  y ofrece las 5 restantes, sin «Ver todas»', $h('#btnHistorialMasTexto').textContent === 'Ver las 5 restantes' &&
    $h('#btnHistorialTodas').hidden);
  $h('#btnHistorialMas').click();
  check('  hasta que no queda ninguna', fichasH().length === 45 && $h('#historialMas').hidden);
  const buscar = hist.doc.getElementById('filtroTexto');
  buscar.value = 'SRV-H1';
  buscar.dispatchEvent(new hist.window.Event('input'));
  check('Un filtro vuelve a empezar y cuenta lo que coincide', fichasH().length === 11 &&
    /^11 de 45 fichas con estos filtros$/.test($h('#historialConteo').textContent), fichasH().length + ' · ' + $h('#historialConteo').textContent);
  buscar.value = '';
  buscar.dispatchEvent(new hist.window.Event('input'));
  check('  y al quitarlo vuelve a las primeras 20', fichasH().length === 20, fichasH().length);
  const hoyH = new Date(2026, 10, 18); // miércoles
  const p = (y, m, d) => hist.api.periodoEnHistorial(new Date(y, m, d), hoyH).titulo;
  check('Períodos: hoy, ayer, esta semana, semana pasada y mes',
    p(2026, 10, 18) === 'Hoy' && p(2026, 10, 17) === 'Ayer' && p(2026, 10, 16) === 'Esta semana' &&
    p(2026, 10, 15) === 'Semana pasada' && p(2026, 10, 9) === 'Semana pasada' && p(2026, 10, 8) === 'Noviembre de 2026' &&
    p(2026, 9, 30) === 'Octubre de 2026', [p(2026, 10, 16), p(2026, 10, 15), p(2026, 10, 9), p(2026, 10, 8)].join(' | '));
  check('  sin fecha, aparte', hist.api.periodoEnHistorial(null, hoyH).titulo === 'Sin fecha de caracterización');

  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
