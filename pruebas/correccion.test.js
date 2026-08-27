/* =========================================================================
   Corregir una ficha guardada, y los topes de fecha del instrumento
   -------------------------------------------------------------------------
       node pruebas/correccion.test.js     (requiere jsdom, sin base)

   QUÉ CUBRE Y POR QUÉ

   1. Las filas del plan de cuidado se clonan del plan de la vivienda —es la
      primera del documento y de ahí sale el prototipo—. Renumerar sólo el
      índice dejaba a una fila añadida en 6.2 o en 6.3 llamándose
      `planVivienda.acciones[N]`: dos controles distintos con el mismo nombre.
      Al recolectar ganaba el último, que es el clon en blanco, así que
      agregar una acción a una familia borraba la acción de la vivienda.

   2. El catálogo de acciones no vive en `catalogos.js`: se pide a la base al
      arrancar. Los prototipos se guardan antes de que llegue, así que toda
      fila o bloque creados después nacían con el desplegable vacío y no
      admitían ningún código —ni el que el encuestador quería elegir, ni el
      que traía una ficha puesta a corregir—.

   3. Ninguna fecha capturada puede ser posterior al día en que se diligencia
      la ficha (RN-016 / RN-064). Antes la fecha de nacimiento se contrastaba
      contra hoy, y como la ficha admite hasta 30 días de antigüedad, una
      persona podía quedar naciendo después de haber sido caracterizada.

   4. Poner una ficha a corregir tiene que devolver TODAS sus respuestas al
      formulario: es la prueba de ida y vuelta completa.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK   ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : ''));
  }
}

/* ---------------------------------------------------------
   Montaje de la aplicación
   --------------------------------------------------------- */

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  url: 'http://localhost/',
  pretendToBeVisual: true
});

const ventana = dom.window;

const almacen = {};
Object.defineProperty(ventana, 'localStorage', {
  value: {
    getItem: function (k) { return k in almacen ? almacen[k] : null; },
    setItem: function (k, v) { almacen[k] = String(v); },
    removeItem: function (k) { delete almacen[k]; }
  },
  configurable: true
});
ventana.navigator.geolocation = { getCurrentPosition: function () {} };
ventana.HTMLElement.prototype.scrollIntoView = function () {};

/* Los dos endpoints del catálogo de acciones, con la forma que devuelven de
   verdad. `catalogo_acciones` trae la lista corta de APS —lo que permite
   seguir buscando sin señal— y `buscar_cups` responde a lo que se teclea.
   Ambos llegan después del arranque, como en el navegador. */
const ACCIONES = [
  { codigo: 'NC-AMB-07', nombre: 'Gestión de riesgos de la vivienda', ambito: 'vivienda' },
  { codigo: 'NC-AMB-08', nombre: 'Control de vectores', ambito: 'vivienda' },
  { codigo: 'NC-FAM-02', nombre: 'Evaluación de relevo del cuidador', ambito: 'familia' },
  { codigo: 'NC-GES-06', nombre: 'Gestión de cita de control', ambito: 'persona' }
];

/* Un CUPS oficial fuera de la lista corta de APS: es el caso que el
   desplegable no dejaba registrar y que el buscador vino a resolver. */
const CUPS_OFICIAL = { codigo: '876110', nombre: 'AORTOGRAMA TORÁCICO', tipo: 'CUPS', apto_aps: false };

const TABLA_CUPS = ACCIONES.map(function (a) {
  return { codigo: a.codigo, nombre: a.nombre, tipo: 'NoCUPS', ambito: a.ambito, apto_aps: true };
}).concat([CUPS_OFICIAL]);

let peticionesDeBusqueda = 0;

function responder(cuerpo) {
  return Promise.resolve({ ok: true, json: function () { return Promise.resolve(cuerpo); } });
}

ventana.fetch = function (url) {
  const texto = String(url);

  if (texto.indexOf('catalogo_acciones') !== -1) return responder(ACCIONES);

  if (texto.indexOf('buscar_cups') !== -1) {
    peticionesDeBusqueda++;
    const consulta = new ventana.URL(texto, 'http://localhost').searchParams;
    const exacto = consulta.get('codigo');

    if (exacto) {
      return responder({
        codigo: exacto,
        resultados: TABLA_CUPS.filter(function (f) { return f.codigo === exacto; })
      });
    }

    /* El servidor busca por prefijo en el código y por contenido en el
       nombre; el doble reproduce esas dos formas. */
    const termino = String(consulta.get('q') || '').toLowerCase();
    const filas = termino.length < 2 ? [] : TABLA_CUPS.filter(function (f) {
      return f.codigo.toLowerCase().indexOf(termino) === 0 ||
             f.nombre.toLowerCase().indexOf(termino) !== -1;
    });
    return responder({ termino: termino, total: filas.length, truncado: false, resultados: filas });
  }

  return Promise.reject(new Error('sin red'));
};

const errores = [];
ventana.addEventListener('error', function (e) { errores.push(String(e.message)); });

/* Los <script> del navegador comparten un único alcance global. Evaluar
   archivo por archivo aísla cada `const`, así que hay que concatenarlos. */
const fuentes = ['catalogos.js', 'direccion.js', 'geocodificacion.js', 'reglas.js', 'formulario.js',
  'cups.js', 'correccion.js', 'app.js']
  .map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); })
  .join('\n;\n');

try {
  ventana.eval(fuentes + ';\nwindow.__api = {' +
    ' recolectarDatosFormulario: recolectarDatosFormulario,' +
    ' construirEncuestaDesdeDatos: construirEncuestaDesdeDatos,' +
    ' cargarEncuestaEnFormulario: cargarEncuestaEnFormulario,' +
    ' reiniciarEstadoFormulario: reiniciarEstadoFormulario,' +
    ' validarReglas: validarReglas };');
  ventana.document.dispatchEvent(new ventana.Event('DOMContentLoaded', { bubbles: true }));
} catch (error) {
  errores.push('montaje: ' + error.message);
}

const doc = ventana.document;
const api = ventana.__api;

function $(selector) { return doc.querySelector(selector); }
function porNombre(nombre) { return doc.querySelector('[name="' + nombre + '"]'); }

function disparar(elemento) {
  elemento.dispatchEvent(new ventana.Event('input', { bubbles: true }));
  elemento.dispatchEvent(new ventana.Event('change', { bubbles: true }));
}

function escribir(selector, valor) {
  const elemento = typeof selector === 'string' ? $(selector) : selector;
  if (!elemento) return null;
  elemento.value = valor;
  disparar(elemento);
  return elemento;
}

function marcar(nombre, valor) {
  const elemento = doc.querySelector('[name="' + nombre + '"][value="' + valor + '"]');
  if (!elemento) return null;
  elemento.checked = true;
  disparar(elemento);
  return elemento;
}

/* La fecha de hoy y la de la visita, separadas a propósito: la ficha admite
   hasta 30 días de antigüedad, y ese hueco es donde se colaba una fecha de
   nacimiento posterior a la visita. */
function fechaIso(desplazamientoEnDias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + (desplazamientoEnDias || 0));
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}

const HOY = fechaIso(0);
const HACE_DIEZ_DIAS = fechaIso(-10);
const MANANA = fechaIso(1);

/* =========================================================================
   Las comprobaciones corren tras un turno del bucle de eventos: el catálogo
   de acciones llega por promesa y los desplegables se repintan al recibirlo.
   ========================================================================= */

setTimeout(ejecutar, 0);

/* El buscador espera a que se deje de teclear antes de consultar, así que las
   comprobaciones que lo ejercitan tienen que cederle el turno al reloj. */
function esperar(ms) {
  return new Promise(function (listo) { setTimeout(listo, ms); });
}

async function ejecutar() {
  console.log('\n=== 1. La aplicación se montó ===');
  verificar('sin errores de carga', errores.length === 0, errores.slice(0, 3).join(' | '));
  verificar('el código de la acción se escribe, no se elige de una lista cerrada',
    porNombre('planVivienda.acciones[0].codigoAccion').tagName === 'INPUT',
    porNombre('planVivienda.acciones[0].codigoAccion').tagName);

  console.log('\n=== 2. Una fila nueva no se lleva el nombre del plan de vivienda ===');

  const botonAccionFamilia = $('#contenedorPlanFamilia [data-accion="agregarAccionFamilia"]');
  verificar('existe el botón de agregar acción en 6.2', !!botonAccionFamilia);

  if (botonAccionFamilia) {
    botonAccionFamilia.dispatchEvent(new ventana.MouseEvent('click', { bubbles: true }));

    const filasFamilia = $('#contenedorPlanFamilia [data-rol="filasAccionFamilia"]')
      .querySelectorAll('tr[data-fila="accion"]');

    verificar('la fila se agregó al plan de la familia', filasFamilia.length === 2,
      'filas: ' + filasFamilia.length);

    const nombres = Array.prototype.map.call(
      filasFamilia[1].querySelectorAll('[name]'),
      function (el) { return el.getAttribute('name'); }
    );

    verificar('la fila nueva se llama planesFamilia[0].acciones[1], no planVivienda',
      nombres.length > 0 && nombres.every(function (n) {
        return n.indexOf('planesFamilia[0].acciones[1].') === 0;
      }),
      nombres.join(', '));

    verificar('ningún control del plan de vivienda quedó duplicado',
      doc.querySelectorAll('[name="planVivienda.acciones[1].codigoAccion"]').length === 0,
      'duplicados: ' + doc.querySelectorAll('[name="planVivienda.acciones[1].codigoAccion"]').length);

    const comboNuevo = porNombre('planesFamilia[0].acciones[1].codigoAccion');
    verificar('la fila nueva trae su buscador de procedimientos',
      !!comboNuevo && !!comboNuevo.closest('[data-rol="comboCups"]') &&
      !!comboNuevo.closest('[data-rol="comboCups"]').querySelector('.combo-cups__lista'),
      comboNuevo ? comboNuevo.outerHTML.slice(0, 80) : 'no existe');

    /* La comprobación que cierra el caso: la acción de la vivienda sobrevive
       a que se agregue una acción en otro plan. */
    escribir(porNombre('planVivienda.acciones[0].codigoAccion'), 'NC-AMB-07');
    const recolectado = api.recolectarDatosFormulario($('#encuestaForm'));

    verificar('la acción de la vivienda sobrevive a la fila nueva de 6.2',
      recolectado.planVivienda &&
      recolectado.planVivienda.acciones[0].codigoAccion === 'NC-AMB-07',
      JSON.stringify(recolectado.planVivienda && recolectado.planVivienda.acciones));
  }

  console.log('\n=== 3. Topes de fecha en el formulario (RN-016 / RN-064) ===');

  const campoFicha = $('#fechaDiligenciamiento');
  verificar('la fecha de la ficha no admite días futuros', campoFicha.max === HOY, campoFicha.max);

  escribir(campoFicha, HACE_DIEZ_DIAS);
  const campoNacimiento = doc.querySelector('[data-rol="fechaNacimiento"]');

  verificar('la fecha de nacimiento se topa en el día de la visita',
    campoNacimiento.max === HACE_DIEZ_DIAS, campoNacimiento.max);

  escribir(campoNacimiento, HOY);
  verificar('nacer después de la visita se señala en el acto',
    campoNacimiento.closest('.field').classList.contains('has-error'));

  escribir(campoNacimiento, '1990-02-10');
  verificar('al corregirla el aviso desaparece',
    !campoNacimiento.closest('.field').classList.contains('has-error'));

  escribir(campoFicha, MANANA);
  verificar('fechar la ficha mañana se señala en el acto',
    campoFicha.closest('.field').classList.contains('has-error'));
  escribir(campoFicha, HACE_DIEZ_DIAS);

  console.log('\n=== 4. RN-064 contrasta contra la visita, no contra hoy ===');

  const fichaBase = {
    fechaDiligenciamiento: HACE_DIEZ_DIAS,
    familias: [{ integrantes: [{ tipoId: 'CC', numeroId: '1144099887', fechaNacimiento: HOY }] }]
  };

  const incumplimientos = api.validarReglas(fichaBase)
    .filter(function (i) { return i.codigo === 'RN-064' && i.campo === 'fechaNacimiento'; });

  verificar('una fecha de nacimiento posterior a la visita se rechaza',
    incumplimientos.length > 0,
    'incumplimientos RN-064: ' + incumplimientos.length);

  fichaBase.familias[0].integrantes[0].fechaNacimiento = '1990-02-10';
  const sinIncumplir = api.validarReglas(fichaBase)
    .filter(function (i) { return i.codigo === 'RN-064' && i.campo === 'fechaNacimiento'; });

  verificar('una fecha anterior a la visita se acepta', sinIncumplir.length === 0,
    JSON.stringify(sinIncumplir.map(function (i) { return i.mensaje; })));

  console.log('\n=== 5. El procedimiento se escribe en palabras (ítems 114 / 124 / 136a) ===');

  /* El código CUPS/NoCUPS se conserva —de él dependen la llave foránea a
     cat.cups y el cruce alerta ↔ acción de RN-220—, y al lado va un campo de
     texto donde el profesional describe lo que efectivamente hizo. */
  [['114 · vivienda', 'planVivienda'],
   ['124 · familia', 'planesFamilia[0]'],
   ['136a · persona', 'planesPersona[0]']].forEach(function (par) {
    const codigo = porNombre(par[1] + '.acciones[0].codigoAccion');
    const libre = porNombre(par[1] + '.acciones[0].procedimientoRealizado');

    verificar('ítem ' + par[0] + ': el código se busca contra la tabla',
      !!codigo && codigo.tagName === 'INPUT' && !!codigo.closest('[data-rol="comboCups"]'),
      codigo ? codigo.tagName + (codigo.closest('[data-rol="comboCups"]') ? ' en combo' : ' suelto') : 'no existe');

    verificar('ítem ' + par[0] + ': hay un campo de texto para el procedimiento',
      !!libre && libre.tagName === 'INPUT' && libre.type === 'text',
      libre ? libre.tagName + '/' + libre.type : 'no existe');
  });

  await comprobarBuscadorDeCups();

  console.log('\n=== 7. Poner una ficha a corregir devuelve sus respuestas ===');
  comprobarIdaYVuelta();

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

/* -------------------------------------------------------------------------
   El buscador de procedimientos: se escribe y la tabla responde.
   -------------------------------------------------------------------------
   Lo que se comprueba no es el aspecto sino el contrato: que lo tecleado se
   consulte contra el servidor, que las coincidencias que devuelve se ofrezcan,
   que elegir una deje en el campo el CÓDIGO —es lo que exige la llave foránea
   contra cat.cups— y que un CUPS oficial fuera de la lista corta de APS sea
   ahora registrable, que es lo que el desplegable impedía.
   ------------------------------------------------------------------------- */

async function comprobarBuscadorDeCups() {
  console.log('\n=== 6. El código se busca contra la tabla mientras se escribe ===');

  const entrada = porNombre('planVivienda.acciones[0].codigoAccion');
  const combo = entrada.closest('[data-rol="comboCups"]');
  const lista = combo.querySelector('.combo-cups__lista');

  /* Un solo carácter no se consulta: cualquier término corto trae cientos de
     filas que no ayudan a elegir. */
  const antesDeEscribir = peticionesDeBusqueda;
  escribir(entrada, '8');
  await esperar(400);
  verificar('con un solo carácter no se consulta el servidor',
    peticionesDeBusqueda === antesDeEscribir,
    'peticiones: ' + (peticionesDeBusqueda - antesDeEscribir));
  verificar('y la lista no se abre', lista.hidden === true);

  /* El caso que pidió el cambio: se teclea un prefijo y aparecen los códigos
     que empiezan así. */
  escribir(entrada, '876');
  await esperar(400);

  const opciones = lista.querySelectorAll('.combo-cups__opcion');
  verificar('escribir «876» consulta el servidor', peticionesDeBusqueda > antesDeEscribir,
    'peticiones: ' + (peticionesDeBusqueda - antesDeEscribir));
  verificar('y ofrece el procedimiento que empieza por 876',
    opciones.length === 1 && opciones[0].dataset.codigo === '876110',
    Array.prototype.map.call(opciones, function (o) { return o.dataset.codigo; }).join(', '));
  verificar('la opción muestra el nombre que devolvió la tabla',
    opciones.length > 0 && opciones[0].textContent.indexOf('AORTOGRAMA TORÁCICO') !== -1,
    opciones.length > 0 ? opciones[0].textContent : '(sin opciones)');

  /* Elegir deja el código, nunca el nombre. */
  opciones[0].dispatchEvent(new ventana.MouseEvent('mousedown', { bubbles: true }));
  verificar('elegir deja en el campo el código, no el nombre', entrada.value === '876110',
    JSON.stringify(entrada.value));
  verificar('y cierra la lista', lista.hidden === true);
  verificar('el nombre del procedimiento queda a la vista como confirmación',
    combo.querySelector('.combo-cups__nombre').textContent === CUPS_OFICIAL.nombre,
    JSON.stringify(combo.querySelector('.combo-cups__nombre').textContent));

  /* También se busca por lo que se hizo, no sólo por el código. */
  escribir(entrada, 'vectores');
  await esperar(400);
  const porNombreBuscado = lista.querySelectorAll('.combo-cups__opcion');
  verificar('buscar por nombre encuentra el procedimiento',
    porNombreBuscado.length === 1 && porNombreBuscado[0].dataset.codigo === 'NC-AMB-08',
    Array.prototype.map.call(porNombreBuscado, function (o) { return o.dataset.codigo; }).join(', '));

  /* La regla ya no puede exigir pertenencia a la lista corta de APS: son 64
     de 10.044. Un CUPS oficial tiene que pasar. */
  const conCupsOficial = {
    planVivienda: {
      codigoEbs: 'EBS-001', codigoVivienda: 'HOG-001',
      acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
        codigoAccion: '876110', tipoRespuesta: 'en_sitio' }]
    }
  };
  const rechazos = api.validarReglas(conCupsOficial)
    .filter(function (i) { return i.campo === 'codigoAccion'; });
  verificar('un CUPS oficial fuera de la lista de APS ya no se rechaza',
    rechazos.length === 0,
    JSON.stringify(rechazos.map(function (i) { return i.mensaje; })));

  conCupsOficial.planVivienda.acciones[0].codigoAccion = 'lo que sea que escriba';
  const rechazoProsa = api.validarReglas(conCupsOficial)
    .filter(function (i) { return i.campo === 'codigoAccion'; });
  verificar('pero la prosa en el campo del código sigue rechazándose',
    rechazoProsa.length > 0);

  await comprobarDiagnosticoDeFallos(entrada, combo, lista);

  escribir(entrada, '');
}

/**
 * Cuando la búsqueda falla, el aviso tiene que decir CUÁL de los tres fallos
 * fue. Los tres se arreglan de forma distinta y confundirlos cuesta caro:
 * decir «sin conexión» ante un 500 manda a revisar la red durante un buen
 * rato cuando lo que está caído es la base, y ante un 404 manda a revisar la
 * base cuando lo que pasa es que la página no la sirve su propio servidor.
 */
async function comprobarDiagnosticoDeFallos(entrada, combo, lista) {
  const fetchBueno = ventana.fetch;

  const casos = [
    ['sin red', function () { return Promise.reject(new Error('sin red')); },
      'Sin conexión'],
    ['404 · la página no la sirve su servidor',
      function () { return Promise.resolve({ ok: false, status: 404 }); },
      'no se está sirviendo desde su propio servidor'],
    ['500 · la base no respondió',
      function () { return Promise.resolve({ ok: false, status: 500 }); },
      'Revise la conexión a la base de datos']
  ];

  for (const caso of casos) {
    ventana.fetch = caso[1];
    escribir(entrada, 'visita');
    await esperar(400);

    const aviso = (lista.querySelector('.combo-cups__aviso') || {}).textContent || '';
    verificar('fallo «' + caso[0] + '»: el aviso lo nombra',
      aviso.indexOf(caso[2]) !== -1, JSON.stringify(aviso));
  }

  ventana.fetch = fetchBueno;
}

/* -------------------------------------------------------------------------
   Ida y vuelta: se diligencia, se guarda el objeto, se limpia el formulario
   y se vuelve a cargar. Lo recolectado después tiene que ser lo mismo.
   ------------------------------------------------------------------------- */

function comprobarIdaYVuelta() {
  const formulario = $('#encuestaForm');

  formulario.reset();
  api.reiniciarEstadoFormulario();

  marcar('consentimiento', 'si');
  marcar('situacionInminente', 'no_aplica');
  escribir('#uzpe', 'UZPE006');

  const territorio = $('#territorio');
  escribir(territorio, territorio.options[1].value);
  const micro = $('#microterritorio');
  if (micro.options.length > 1) escribir(micro, micro.options[1].value);

  escribir('#divisionTerritorial', 'Barrio de la prueba');
  escribir('#equipoSaludId', 'EBS-001');
  escribir('#codigoFicha', 'F-IDA-001');
  escribir('#fechaDiligenciamiento', HACE_DIEZ_DIAS);
  escribir('[name="responsableNumeroId"]', '1144012345');
  escribir('[name="perfilProfesional"]', 'enfermeria');
  escribir('[name="entornoAbordaje"]', 'hogar');
  escribir('[name="cabezaFamilia"]', 'Beatriz Salazar');
  escribir('#idHogar', 'HOG-001');
  escribir('[name="estrato"]', 'medio_bajo');
  escribir('#personasEnVivienda', '2');
  escribir('#habitacionesVivienda', '2');
  escribir('[name="tipoVivienda"]', 'apartamento');

  /* Régimen y EAPB juntos a propósito: la EAPB nace deshabilitada y sólo se
     abre al responder el régimen. Es el caso que se perdía en silencio
     cuando un control deshabilitado se daba por aplicado. */
  const prefijo = 'familias[0].integrantes[0].';
  escribir('[name="' + prefijo + 'primerNombre"]', 'Ana');
  escribir('[name="' + prefijo + 'primerApellido"]', 'Gomez');
  marcar(prefijo + 'tipoId', 'CC');
  escribir('[name="' + prefijo + 'numeroId"]', '1144099887');
  escribir('[name="' + prefijo + 'fechaNacimiento"]', '1990-02-10');
  marcar(prefijo + 'sexo', 'mujer');
  escribir('[name="' + prefijo + 'peso"]', '70');
  escribir('[name="' + prefijo + 'talla"]', '170');
  escribir('[name="' + prefijo + 'regimenAfiliacion"]', 'subsidiado');
  escribir('[name="' + prefijo + 'eapb"]', 'ESS024');

  /* Dos acciones en el plan de la vivienda: la segunda es la fila clonada. */
  escribir(porNombre('planVivienda.acciones[0].codigoAccion'), 'NC-AMB-07');
  escribir(porNombre('planVivienda.acciones[0].procedimientoRealizado'),
    'Se revisó la humedad del muro de la cocina');
  $('#btnAgregarAccionVivienda').dispatchEvent(new ventana.MouseEvent('click', { bubbles: true }));
  escribir(porNombre('planVivienda.acciones[1].codigoAccion'), 'NC-AMB-08');

  const original = api.construirEncuestaDesdeDatos(
    api.recolectarDatosFormulario(formulario)
  );

  api.cargarEncuestaEnFormulario(JSON.parse(JSON.stringify(original)));
  const recuperado = api.recolectarDatosFormulario(formulario);

  const CAMPOS = [
    ['codigoFicha', original.codigoFicha],
    ['fechaDiligenciamiento', original.fechaDiligenciamiento],
    ['territorio', original.territorio],
    ['microterritorio', original.microterritorio],
    ['estrato', original.estrato],
    ['tipoVivienda', original.tipoVivienda]
  ];

  CAMPOS.forEach(function (par) {
    verificar('se recupera ' + par[0], recuperado[par[0]] === par[1],
      'se esperaba ' + JSON.stringify(par[1]) + ' y quedó ' + JSON.stringify(recuperado[par[0]]));
  });

  const integrante = recuperado.familias[0].integrantes[0];
  verificar('se recupera el nombre del integrante', integrante.primerNombre === 'Ana',
    JSON.stringify(integrante.primerNombre));
  verificar('se recupera el peso', String(integrante.peso) === '70', JSON.stringify(integrante.peso));

  /* La EAPB es la que se perdía: nace deshabilitada hasta que hay régimen. */
  verificar('se recupera la EAPB, que nace deshabilitada', integrante.eapb === 'ESS024',
    JSON.stringify(integrante.eapb));

  const acciones = (recuperado.planVivienda || {}).acciones || [];
  verificar('se recuperan las dos acciones del plan de vivienda', acciones.length === 2,
    'acciones: ' + acciones.length);
  verificar('la segunda acción conserva su código',
    acciones[1] && acciones[1].codigoAccion === 'NC-AMB-08',
    JSON.stringify(acciones));
  verificar('se recupera el procedimiento escrito a mano',
    acciones[0] && acciones[0].procedimientoRealizado === 'Se revisó la humedad del muro de la cocina',
    JSON.stringify(acciones[0] && acciones[0].procedimientoRealizado));
}
