/* =========================================================================
   Vista «Reportes de productividad» en el navegador (jsdom)
   -------------------------------------------------------------------------
       node pruebas/productividad_vista.test.js

   Monta index.html con una sesión en caché y un fetch simulado, y comprueba
   que la vista sólo aparece con productividad.ver (coordinación, líderes,
   administrador y maestro), que al abrirse pide el mes en curso por EBS con
   la cabecera anti-CSRF, que pinta cifras, gráfico y tabla —lo del servidor
   como texto, nunca como HTML, y lo que está en cero apagado—, que cambiar
   la agrupación vuelve a pedir, y que la descarga es un CSV para Excel.

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

function medidas(fichas, extra) {
  return Object.assign({
    fichas: fichas, viviendas: fichas, hogares: fichas, familias: fichas, personas: fichas * 3,
    planPendiente: fichas ? 1 : 0, incompletas: 0, sinConsentimiento: 0, integrantesPendientes: 0,
    diasActivos: fichas ? 2 : 0, primera: fichas ? '2026-10-02' : null, ultima: fichas ? '2026-10-09' : null
  }, extra || {});
}

function respuesta(agrupar) {
  return {
    periodo: { desde: '2026-10-01', hasta: '2026-10-22' },
    agrupar: agrupar,
    filtros: { ebs: null, comuna: null, persona: null },
    totales: medidas(9, { incompletas: 1 }),
    filas: [
      Object.assign({ clave: 'EBS007', etiqueta: 'EBS007', detalle: null }, medidas(6)),
      Object.assign({ clave: 'EBS006', etiqueta: '<img src=x onerror="window.__inyectado=1">', detalle: null }, medidas(3)),
      Object.assign({ clave: 'EBS074', etiqueta: '=HYPERLINK("x")', detalle: null }, medidas(0))
    ],
    porDia: [{ fecha: '2026-10-02', fichas: 4 }, { fecha: '2026-10-09', fichas: 5 }],
    opciones: {
      ebs: ['EBS006', 'EBS007'],
      comunas: [{ valor: '1', etiqueta: 'Comuna 1' }, { valor: 'sin', etiqueta: 'Sin comuna' }],
      personas: [{ valor: '15', etiqueta: 'Ana Pérez', detalle: 'Enfermería (profesional) · EBS007' }]
    }
  };
}

function perfil(rol) {
  return {
    id: 7, rol: rol, nivel: roles.nivelDe(rol), rolEtiqueta: roles.etiquetaDeRol(rol),
    nombre: 'Prueba ' + rol, tipoId: 'CC', documento: '1144099011', equipoCodigo: roles.requiereEquipo(rol) ? 'EBS12' : null,
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
  w.URL.createObjectURL = function () { return 'blob:productividad'; };
  w.URL.revokeObjectURL = function () {};
  w.__descargas = [];
  w.HTMLAnchorElement.prototype.click = function () { w.__descargas.push(this.download); };
  const BlobOriginal = w.Blob;
  w.Blob = function (partes, opciones) { w.__blob = { partes: partes, tipo: opciones && opciones.type }; return new BlobOriginal(partes, opciones); };

  /* fetch simulado: se instala antes que sesion.js, que lo envuelve. */
  w.__peticiones = [];
  w.fetch = function (url, opciones) {
    if (String(url).indexOf('/api/productividad') === -1) return Promise.reject(new Error('sin red'));
    const consulta = new URL(String(url), 'http://localhost').searchParams;
    w.__peticiones.push({
      metodo: (opciones && opciones.method) || 'GET',
      consulta: Object.fromEntries(consulta.entries()),
      csrf: opciones && opciones.headers && opciones.headers.get('X-Requested-With')
    });
    return Promise.resolve({
      ok: true, status: 200,
      headers: { get: function () { return null; } },
      json: function () { return Promise.resolve(respuesta(consulta.get('agrupar') || 'ebs')); }
    });
  };

  const fuentes = ['sesion.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
    'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'captura_local.js', 'app.js', 'roles.js', 'usuarios.js',
    'reporte.js', 'productividad.js']
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

function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function principal() {
  console.log('\n=== 1. Quién lo ve ===');
  ['coordinador_ebs', 'lider_ebs', 'administrador', 'maestro'].forEach(function (rol) {
    verificar(rol + ': el menú ofrece «Reportes de productividad»',
      opcionesDelMenu(montar(rol)).indexOf('Reportes de productividad') !== -1);
  });
  ['enfermeria', 'auxiliar_enfermeria', 'medicina'].forEach(function (rol) {
    const w = montar(rol);
    verificar(rol + ': el menú no lo ofrece', opcionesDelMenu(w).indexOf('Reportes de productividad') === -1);
    w.PRODUCTIVIDAD.abrir();
    verificar(rol + ': abrir la vista a mano no hace nada ni pide nada',
      !w.document.getElementById('view-productividad').classList.contains('is-active') && w.__peticiones.length === 0);
  });

  console.log('\n=== 2. Abrir: el mes en curso por EBS ===');
  const w = montar('lider_ebs');
  const doc = w.document;
  const hoy = new Date();
  verificar('propone del primero del mes a hoy',
    doc.getElementById('productividadDesde').value === iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)) &&
    doc.getElementById('productividadHasta').value === iso(hoy),
    doc.getElementById('productividadDesde').value + ' / ' + doc.getElementById('productividadHasta').value);

  Array.from(doc.querySelectorAll('#menuUsuario .app-menu__item'))
    .find(function (b) { return b.textContent.trim() === 'Reportes de productividad'; }).click();
  await esperar(50);
  verificar('la opción abre la vista', doc.getElementById('view-productividad').classList.contains('is-active'));
  const primera = w.__peticiones[0] || {};
  verificar('y la genera sola: GET con la cabecera anti-CSRF, agrupado por EBS',
    primera.metodo === 'GET' && primera.csrf === 'fetch' && primera.consulta.agrupar === 'ebs' &&
    primera.consulta.desde === iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), JSON.stringify(primera));

  const resultado = doc.getElementById('productividadResultado');
  const cifras = Array.from(resultado.querySelectorAll('.reporte__cifra-valor')).map(function (x) { return x.textContent; });
  verificar('ocho cifras del período, empezando por fichas y viviendas', cifras.length === 8 && cifras[0] === '9' && cifras[1] === '9',
    cifras.join(','));
  verificar('promedio por día con actividad con coma decimal', cifras[6] === '4,5', cifras[6]);
  verificar('nombra las visitas incompletas', /1 visitas cerradas como incompletas/.test(resultado.textContent));
  verificar('gráfico con una columna por fecha con fichas', resultado.querySelectorAll('.productividad__barra').length === 2);
  verificar('cada columna se puede leer con el teclado',
    resultado.querySelector('.productividad__columna').getAttribute('tabindex') === '0' &&
    /fichas$/.test(resultado.querySelector('.productividad__columna').getAttribute('aria-label') || ''));

  const filas = Array.from(resultado.querySelectorAll('.productividad__tabla tbody tr[data-texto]'));
  verificar('una fila por grupo, de más a menos fichas',
    filas.length === 3 && filas[0].querySelector('th').textContent === 'EBS007' && filas[2].classList.contains('is-cero'),
    filas.map(function (f) { return f.querySelector('th').textContent; }).join(' | '));
  verificar('cuenta cuántos no tienen fichas', /1 sin fichas en el período/.test(resultado.textContent));
  verificar('lo que llega del servidor se pinta como texto, no como HTML',
    resultado.querySelector('img') === null && w.__inyectado === undefined && resultado.textContent.indexOf('<img src=x') !== -1);
  verificar('llena los filtros con lo que hay en el período',
    doc.getElementById('productividadEbs').options.length === 3 &&
    doc.getElementById('productividadPersona').options[1].textContent === 'Ana Pérez — Enfermería (profesional) · EBS007');

  console.log('\n=== 3. Ordenar, agrupar y filtrar ===');
  resultado.querySelector('thead th .productividad__orden').click();
  const ordenadas = Array.from(resultado.querySelectorAll('.productividad__tabla tbody th')).map(function (t) { return t.textContent; });
  verificar('pulsar la cabecera del grupo ordena por nombre', ordenadas[0] !== 'EBS007' || ordenadas[2] === 'EBS007', ordenadas.join(' | '));

  doc.getElementById('productividadAgrupar').value = 'dia';
  doc.getElementById('productividadAgrupar').dispatchEvent(new w.Event('change'));
  await esperar(50);
  verificar('cambiar la agrupación vuelve a pedir, sin pulsar «Generar»',
    w.__peticiones.length === 2 && w.__peticiones[1].consulta.agrupar === 'dia', JSON.stringify(w.__peticiones[1]));

  doc.getElementById('productividadEbs').value = 'EBS007';
  doc.getElementById('productividadEbs').dispatchEvent(new w.Event('change'));
  await esperar(50);
  verificar('el filtro de EBS va en la consulta', (w.__peticiones[2] || {}).consulta && w.__peticiones[2].consulta.ebs === 'EBS007');

  doc.getElementById('productividadDesde').value = '2026-10-22';
  doc.getElementById('productividadHasta').value = '2026-10-01';
  doc.getElementById('formProductividad').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar(20);
  verificar('fechas al revés: avisa y no llama al servidor',
    !doc.getElementById('productividadError').hidden && w.__peticiones.length === 3,
    doc.getElementById('productividadError').textContent);

  console.log('\n=== 3b. Buscar por texto ===');
  doc.getElementById('productividadDesde').value = '2026-10-01';
  doc.getElementById('productividadHasta').value = '2026-10-22';
  const teclear = function (entrada, texto) {
    entrada.value = texto;
    entrada.dispatchEvent(new w.Event('input'));
  };
  const tecla = function (entrada, nombre) {
    entrada.dispatchEvent(new w.KeyboardEvent('keydown', { key: nombre, bubbles: true, cancelable: true }));
  };
  const opcionesVisibles = function (id) {
    return Array.from(doc.querySelectorAll('#' + id + 'Lista [role="option"]')).map(function (li) { return li.textContent; });
  };

  ['productividadAgrupar', 'productividadEbs', 'productividadComuna', 'productividadPersona'].forEach(function (id) {
    const entrada = doc.getElementById(id + 'Buscar');
    verificar(id.replace('productividad', '') + ': tiene campo de búsqueda y su etiqueta apunta a él',
      entrada && entrada.getAttribute('role') === 'combobox' &&
      doc.querySelector('label[for="' + id + 'Buscar"]') !== null && doc.getElementById(id).hidden);
  });

  const persona = doc.getElementById('productividadPersonaBuscar');
  persona.focus();
  verificar('al entrar al campo se despliegan todas las opciones',
    !doc.getElementById('productividadPersonaLista').hidden && opcionesVisibles('productividadPersona').length === 2,
    opcionesVisibles('productividadPersona').join(' | '));
  teclear(persona, 'perez ebs007');
  verificar('escribir filtra sin mayúsculas ni tildes, palabra por palabra',
    opcionesVisibles('productividadPersona').length === 1 && /Ana Pérez/.test(opcionesVisibles('productividadPersona')[0]),
    opcionesVisibles('productividadPersona').join(' | '));
  tecla(persona, 'Enter');
  await esperar(50);
  verificar('Enter elige la coincidencia y vuelve a pedir el reporte con ella',
    doc.getElementById('productividadPersona').value === '15' && (w.__peticiones[3] || {}).consulta &&
    w.__peticiones[3].consulta.persona === '15', JSON.stringify(w.__peticiones[3]));
  verificar('el campo muestra lo elegido y ofrece quitarlo',
    /^Ana Pérez/.test(persona.value) && !persona.parentNode.querySelector('.combo-filtro__limpiar').hidden, persona.value);

  const ebs = doc.getElementById('productividadEbsBuscar');
  ebs.focus();
  teclear(ebs, 'no existe');
  verificar('sin coincidencias lo dice', /Nada coincide con «no existe»/.test(doc.getElementById('productividadEbsLista').textContent));
  tecla(ebs, 'Escape');
  verificar('Escape cierra y deja lo que estaba, sin pedir nada',
    doc.getElementById('productividadEbsLista').hidden && ebs.value === 'EBS007' && w.__peticiones.length === 4, ebs.value);

  ebs.parentNode.querySelector('.combo-filtro__limpiar').click();
  await esperar(50);
  verificar('la «x» quita el filtro y vuelve a pedir sin él',
    doc.getElementById('productividadEbs').value === '' && ebs.value === '' &&
    w.__peticiones.length === 5 && !w.__peticiones[4].consulta.ebs, JSON.stringify(w.__peticiones[4]));

  const agrupar = doc.getElementById('productividadAgruparBuscar');
  agrupar.focus();
  teclear(agrupar, 'eb');
  tecla(agrupar, 'Enter');
  await esperar(50);
  verificar('la agrupación también se busca por texto', (w.__peticiones[5] || {}).consulta && w.__peticiones[5].consulta.agrupar === 'ebs',
    JSON.stringify(w.__peticiones[5]));

  const filasVisibles = function () {
    return Array.from(resultado.querySelectorAll('.productividad__tabla tbody tr[data-texto]'))
      .filter(function (tr) { return !tr.hidden; }).map(function (tr) { return tr.querySelector('th').textContent; });
  };
  const caja = doc.getElementById('productividadBuscarTabla');
  verificar('la tabla tiene su buscador', caja !== null && filasVisibles().length === 3);
  teclear(caja, '007');
  verificar('escribir en él deja sólo las filas que coinciden', filasVisibles().join(',') === 'EBS007', filasVisibles().join(','));
  verificar('y dice cuántas de cuántas', resultado.querySelector('.productividad__cuenta').textContent === '1 de 3');
  teclear(caja, 'zzz');
  verificar('si ninguna coincide lo dice',
    filasVisibles().length === 0 && !resultado.querySelector('.productividad__sin-coincidencias').hidden);
  resultado.querySelector('thead th .productividad__orden').click();
  verificar('reordenar conserva la búsqueda', doc.getElementById('productividadBuscarTabla').value === 'zzz' && filasVisibles().length === 0);
  teclear(doc.getElementById('productividadBuscarTabla'), '');
  verificar('borrarla las muestra todas', filasVisibles().length === 3);
  verificar('buscar en la tabla no pide nada al servidor', w.__peticiones.length === 6, w.__peticiones.length);

  console.log('\n=== 4. Descargar para Excel ===');
  doc.getElementById('productividadDesde').value = '2026-10-01';
  doc.getElementById('productividadHasta').value = '2026-10-22';
  doc.getElementById('productividadAgrupar').value = 'ebs';
  doc.getElementById('productividadAgrupar').dispatchEvent(new w.Event('change'));
  await esperar(50);
  doc.getElementById('btnProductividadDescargar').click();
  const texto = w.__blob ? w.__blob.partes.join('') : '';
  verificar('descarga un CSV con el agrupamiento y el período en el nombre',
    /^productividad_ebs_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/.test(w.__descargas[0] || ''), w.__descargas[0]);
  verificar('con BOM, para que Excel respete las tildes', texto.charCodeAt(0) === 0xFEFF);
  verificar('separado por «;» y con la fila de total', /\r\nTotal;;9;9;/.test(texto) && texto.indexOf('Fichas;Viviendas;Hogares') !== -1);
  verificar('una celda que empieza por «=» no se vuelve fórmula',
    texto.indexOf('\'=HYPERLINK') !== -1 && !/(^|;|\n)=HYPERLINK/.test(texto));
  verificar('el texto del servidor va tal cual, entre comillas si hace falta', texto.indexOf('"<img src=x onerror=""window.__inyectado=1"">"') !== -1);

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
