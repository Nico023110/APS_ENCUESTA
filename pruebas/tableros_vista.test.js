/* =========================================================================
   Apartado «Reportes» y tablero de población en el navegador (jsdom)
   -------------------------------------------------------------------------
       node pruebas/tableros_vista.test.js

   Monta index.html con una sesión en caché y un fetch simulado, y comprueba
   que el apartado sólo aparece para la coordinación, el administrador y el
   maestro; que al abrirlo pide el tablero (todo el registro) con la
   cabecera anti-CSRF; que es una sola página con los siete paneles del
   seguimiento —la cadena de población, la atención prioritaria, el curso
   de vida, el riesgo familiar, las necesidades por atender, las
   enfermedades crónicas y dónde están las viviendas— con las etiquetas del
   instrumento y lo del servidor como texto; que volver al tablero no
   vuelve a pedir y que cambiar un filtro sí; que cada panel se lee como
   tabla; y que la descarga es un CSV para Excel.

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

/* Una respuesta de /api/productividad?tablero=1 como la arma _tablero.js. */
function respuesta(consulta) {
  const vacia = consulta.get('comuna') === 'Rural';
  if (vacia) {
    return { periodo: { desde: consulta.get('desde'), hasta: consulta.get('hasta') }, rango: {},
      totales: { viviendas: 0 }, dimensiones: {}, opciones: { ebs: [], comunas: [], territorios: [] } };
  }
  return {
    periodo: { desde: consulta.get('desde'), hasta: consulta.get('hasta') },
    filtros: { ebs: consulta.get('ebs'), comuna: consulta.get('comuna'), territorio: consulta.get('territorio') },
    rango: { primera: '2026-08-25', ultima: '2026-10-13' },
    totales: {
      viviendas: 12, hogares: 10, hogaresDeclarados: 15, familias: 10, personas: 23, hacinamiento: 1,
      gestantes: 1, preguntadasGestacion: 11, primeraInfancia: 4, mayores: 3, discapacidad: 0, victimas: 0,
      respondieronBarreras: 6, conBarreras: 1
    },
    dimensiones: {
      comuna: [{ valor: '3', n: 6 }, { valor: '18', n: 2 }, { valor: '1', n: 2 }, { valor: '20', n: 2 }],
      territorio: [{ valor: 'T48', n: 6 }],
      riesgoFamiliar: [{ valor: 'alto', n: 4 }, { valor: 'medio', n: 1 }, { valor: 'bajo', n: 1 }, { valor: 'sin_dato', n: 4 }],
      cursoVida: [{ valor: 'adultez', sexo: 'hombre', n: 5 }, { valor: 'adultez', sexo: 'mujer', n: 7 },
        { valor: 'vejez', sexo: 'hombre', n: 3 }, { valor: 'primera_infancia', sexo: 'mujer', n: 3 },
        { valor: 'primera_infancia', sexo: 'hombre', n: 1 }, { valor: 'juventud', sexo: 'mujer', n: 3 },
        { valor: 'juventud', sexo: 'hombre', n: 1 }, { valor: 'adultez', sexo: 'intersexual', n: 1 }],
      regimen: [{ valor: 'subsidiado', n: 5 }, { valor: 'contributivo', n: 16 }, { valor: 'no_afiliado', n: 2 }],
      tratamiento: [{ valor: 'si', n: 2 }, { valor: 'no', n: 1 }, { valor: 'no_aplica', n: 9 }],
      antropometria: [{ valor: 'normal', n: 7 }, { valor: 'riesgo_desnutricion', n: 1 }],
      lactancia: [{ valor: 'no', n: 3 }, { valor: 'si', n: 1 }],
      enfermedadesNT: [{ valor: 'diabetes', n: 1 }, { valor: 'ninguna', n: 8 }]
    },
    opciones: {
      ebs: ['EBS007', '<img src=x onerror="window.__inyectado=1">'],
      comunas: [{ valor: '3', etiqueta: 'Comuna 3' }, { valor: '18', etiqueta: 'Comuna 18' }, { valor: 'Rural', etiqueta: 'Zona rural' }],
      territorios: [{ valor: 'T48', comuna: '3' }, { valor: 'T51', comuna: '18' }, { valor: 'T52', comuna: '18' }]
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
  w.URL.createObjectURL = function () { return 'blob:tablero'; };
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
      json: function () { return Promise.resolve(respuesta(consulta)); }
    });
  };

  const fuentes = ['sesion.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
    'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'captura_local.js', 'app.js', 'roles.js', 'usuarios.js',
    'reporte.js', 'productividad.js', 'tableros.js']
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

function paneles(doc) {
  return Array.from(doc.querySelectorAll('#tableroContenido .tpanel')).map(function (p) { return p.dataset.panel; });
}

function panel(doc, id) { return doc.querySelector('#tableroContenido [data-panel="' + id + '"]'); }

async function principal() {
  console.log('\n=== 1. Quién lo ve ===');
  ['coordinador_ebs', 'lider_ebs', 'administrador', 'maestro'].forEach(function (rol) {
    verificar(rol + ': el menú del usuario ofrece «Reportes»', opcionesDelMenu(montar(rol)).indexOf('Reportes') !== -1);
  });
  ['enfermeria', 'auxiliar_enfermeria', 'medicina'].forEach(function (rol) {
    const w = montar(rol);
    verificar(rol + ': el menú no lo ofrece', opcionesDelMenu(w).indexOf('Reportes') === -1);
    w.TABLEROS.abrir('principal');
    w.REPORTES.abrir('personas');
    verificar(rol + ': abrir a mano no hace nada ni pide nada',
      !w.document.getElementById('view-tableros').classList.contains('is-active') && w.__peticiones.length === 0 &&
      w.document.getElementById('reportesMenu').hidden);
  });

  console.log('\n=== 2. Abrir: el tablero de población con todo el registro ===');
  const w = montar('lider_ebs');
  const doc = w.document;
  Array.from(doc.querySelectorAll('#menuUsuario .app-menu__item'))
    .find(function (b) { return b.textContent.trim() === 'Reportes'; }).click();
  await esperar(60);
  verificar('abre la vista del tablero con el menú lateral y «Tablero de población» marcado',
    doc.getElementById('view-tableros').classList.contains('is-active') && !doc.getElementById('reportesMenu').hidden &&
    doc.querySelector('#reportesMenu [data-reporte="poblacion"]').getAttribute('aria-current') === 'page' &&
    doc.querySelector('.app-main').classList.contains('app-main--reportes'));
  verificar('la población es un solo tablero, sin páginas',
    doc.querySelectorAll('#reportesMenu [data-reporte="poblacion"], #reportesMenu [data-reporte="hogares"], #reportesMenu [data-reporte="personas"]').length === 1 &&
    doc.getElementById('tableroPaginas') === null && doc.getElementById('tableroTitulo').textContent === 'Tablero de población');
  const primera = w.__peticiones[0] || {};
  verificar('pide el tablero por GET con la cabecera anti-CSRF, desde 2024 hasta hoy',
    primera.metodo === 'GET' && primera.csrf === 'fetch' && primera.consulta.tablero === '1' &&
    primera.consulta.desde === '2024-01-01' && primera.consulta.hasta === iso(new Date()) && !primera.consulta.ebs,
    JSON.stringify(primera));
  verificar('«Todo el registro» queda marcado', doc.querySelector('[data-periodo-tablero="todo"]').getAttribute('aria-pressed') === 'true');

  verificar('siete paneles, los del seguimiento',
    paneles(doc).join() === 'cadena,prioritarios,cursoVida,riesgo,necesidades,enfermedades,ubicacion', paneles(doc).join());
  verificar('en pantalla no van los números de ítem: cada panel lo dice en palabras',
    doc.querySelectorAll('#tableroContenido .tpanel__item').length === 0 && !/Ítem \d/.test(doc.getElementById('tableroContenido').textContent));
  const cadena = Array.from(doc.querySelectorAll('[data-panel="cadena"] .cadena__valor')).map(function (x) { return x.dataset.cifra; });
  verificar('la cadena: viviendas, hogares, familias y personas', cadena.join() === '12,10,10,23', cadena.join());
  verificar('  sin razones que leer', doc.querySelectorAll('[data-panel="cadena"] .cadena__detalle').length === 0 &&
    !/por vivienda/.test(panel(doc, 'cadena').textContent));
  verificar('  y nombra los hogares declarados sin caracterizar', /5 hogares declarados sin caracterizar/.test(panel(doc, 'cadena').textContent));
  const tejas = Array.from(doc.querySelectorAll('[data-panel="prioritarios"] .teja__etiqueta')).map(function (x) { return x.textContent; });
  verificar('cinco grupos de atención prioritaria', tejas.length === 5 && tejas[0] === 'Gestantes' && tejas[4] === 'Víctimas del conflicto armado',
    tejas.join(' | '));
  verificar('el cero se apaga', doc.querySelectorAll('[data-panel="prioritarios"] .teja.is-cero').length === 2);
  verificar('gestantes sobre las mujeres a quienes se preguntó', /de 11 mujeres a quienes se preguntó/.test(panel(doc, 'prioritarios').textContent));

  const filasCurso = Array.from(doc.querySelectorAll('[data-panel="cursoVida"] .espejo__fila'));
  verificar('pirámide por curso de vida: seis grupos, del mayor al menor',
    filasCurso.length === 6 && filasCurso[0].textContent.indexOf('Vejez') !== -1 && filasCurso[5].textContent.indexOf('Primera infancia') !== -1,
    filasCurso.map(function (f) { return f.querySelector('.espejo__nombre').textContent; }).join(' | '));
  const adultez = filasCurso.find(function (f) { return /Adultez/.test(f.querySelector('.espejo__nombre').textContent); });
  verificar('cada fila dice sus cifras por sexo y las lee el lector de pantalla',
    adultez.querySelector('.espejo__ala--hombre .espejo__cifra').textContent === '5' &&
    adultez.querySelector('.espejo__ala--mujer .espejo__cifra').textContent === '7' &&
    /Adultez \(29 a 59\): 5 hombres y 7 mujeres/.test(adultez.querySelector('.tablero-sr').textContent));
  verificar('las personas intersexuales se nombran aparte', /1 persona intersexual/.test(panel(doc, 'cursoVida').textContent));

  const grados = Array.from(doc.querySelectorAll('[data-panel="riesgo"] .composicion-barra__grado'));
  verificar('riesgo familiar: la escala del semáforo en su orden y «Sin dato» al final',
    grados.length === 5 && /Sin riesgo/.test(grados[0].textContent) && /Riesgo alto/.test(grados[3].textContent) && /Sin dato/.test(grados[4].textContent),
    grados.map(function (g) { return g.textContent; }).join(' | '));
  verificar('  con sus colores y su nombre, y sin tramo para lo que está en cero',
    doc.querySelectorAll('[data-panel="riesgo"] .composicion-barra__tramo').length === 4 && panel(doc, 'riesgo').querySelector('.tono--alto') !== null &&
    grados[0].classList.contains('is-cero'));

  const necesidades = Array.from(doc.querySelectorAll('[data-panel="necesidades"] .medidor'));
  verificar('necesidades por atender: seis medidores',
    necesidades.map(function (m) { return m.querySelector('.medidor__etiqueta').textContent; }).join(' | ') ===
      'Personas sin afiliación al sistema de salud | Personas con alguna barrera para recibir sus atenciones | ' +
      'Personas con una condición de salud que no reciben atención ni tratamiento | ' +
      'Personas con alerta nutricional por déficit o exceso de peso | Menores de 6 meses sin lactancia materna exclusiva | ' +
      'Viviendas con hacinamiento',
    necesidades.map(function (m) { return m.querySelector('.medidor__etiqueta').textContent; }).join(' | '));
  const valores = necesidades.map(function (m) { return m.querySelector('.medidor__valor').textContent; });
  verificar('  cada uno sobre quienes respondieron', valores.join(' | ') === '8,7 % | 16,7 % | 33,3 % | 12,5 % | 75 % | 8,3 %', valores.join(' | '));
  verificar('  y dice de cuántos', /1 de 3 personas con alguna condición/.test(necesidades[2].textContent) &&
    /1 de 8 personas valoradas/.test(necesidades[3].textContent) && /3 de 4 menores de 6 meses/.test(necesidades[4].textContent),
    necesidades.map(function (m) { return m.querySelector('.medidor__detalle').textContent; }).join(' | '));

  const enfermedades = Array.from(doc.querySelectorAll('[data-panel="enfermedades"] .tbarra__nombre')).map(function (x) { return x.textContent; });
  verificar('enfermedades crónicas: lo registrado, sin «Ninguna»', enfermedades.join() === 'Diabetes', enfermedades.join(' | '));

  const comunas = Array.from(doc.querySelectorAll('[data-panel="ubicacion"] .tbarra__nombre')).map(function (x) { return x.textContent; });
  verificar('viviendas por comuna, de mayor a menor', panel(doc, 'ubicacion').querySelector('.tpanel__titulo').textContent === 'Viviendas por comuna' &&
    comunas[0] === 'Comuna 3' && comunas.length === 4, comunas.join(' | '));
  verificar('  con cifra y porcentaje sobre las viviendas', /6 · 50 %/.test(panel(doc, 'ubicacion').querySelector('.tbarra__cifras').textContent),
    panel(doc, 'ubicacion').querySelector('.tbarra__cifras').textContent);
  verificar('la fuente dice qué entra y de qué fechas',
    /visita más reciente/.test(doc.getElementById('tableroFuente').textContent) && !doc.getElementById('tableroFuente').hidden);

  verificar('lo del servidor se pinta como texto, no como HTML',
    doc.querySelector('#view-tableros img') === null && w.__inyectado === undefined &&
    Array.from(doc.getElementById('tableroEbs').options).some(function (o) { return o.textContent.indexOf('<img') === 0; }));

  console.log('\n=== 3. Cada panel se lee como tabla ===');
  const enf = panel(doc, 'enfermedades');
  const alternar = enf.querySelector('.tpanel__alternar');
  alternar.click();
  verificar('«Tabla» muestra la tabla y oculta el gráfico',
    alternar.getAttribute('aria-pressed') === 'true' && !enf.querySelector('.tpanel__tabla').hidden &&
    enf.querySelector('.tpanel__grafico').hidden && alternar.textContent.trim() === 'Gráfico');
  const filasTabla = Array.from(enf.querySelectorAll('tbody tr')).map(function (tr) { return tr.textContent; });
  verificar('  con categoría, cantidad y porcentaje', filasTabla.length === 1 && /Diabetes/.test(filasTabla[0]) && /4,3 %/.test(filasTabla[0]),
    filasTabla.join(' | '));
  const curso = panel(doc, 'cursoVida');
  curso.querySelector('.tpanel__alternar').click();
  const cabeceras = Array.from(curso.querySelectorAll('thead th')).map(function (th) { return th.textContent; });
  verificar('la tabla de un espejo trae hombres, mujeres, intersexual y total', cabeceras.join() === 'Categoría,Hombres,Mujeres,Intersexual,Total',
    cabeceras.join());
  const nec = panel(doc, 'necesidades');
  nec.querySelector('.tpanel__alternar').click();
  const filaNec = nec.querySelector('tbody tr').textContent;
  verificar('la de los medidores, la cantidad, de cuántos y el porcentaje', /Personas sin afiliación.*2.*23.*8,7 %/.test(filaNec), filaNec);

  console.log('\n=== 4. Volver al tablero no vuelve a pedir ===');
  doc.querySelector('#reportesMenu [data-reporte="productividad"]').click();
  await esperar(30);
  doc.querySelector('#reportesMenu [data-reporte="poblacion"]').click();
  await esperar(30);
  verificar('los paneles vuelven sin otra consulta del tablero',
    w.__peticiones.filter(function (p) { return p.consulta.tablero; }).length === 1 && paneles(doc).length === 7,
    w.__peticiones.length);

  console.log('\n=== 5. Filtros: cambiar uno vuelve a pedir ===');
  const pedidosAntes = w.__peticiones.length;
  const comuna = doc.getElementById('tableroComuna');
  verificar('las comunas llegan del servidor', Array.from(comuna.options).map(function (o) { return o.value; }).join() === ',3,18,Rural');
  comuna.value = '18';
  comuna.dispatchEvent(new w.Event('change'));
  await esperar(40);
  const segunda = w.__peticiones[pedidosAntes] || {};
  verificar('elegir la comuna 18 pide con ese filtro', segunda.consulta && segunda.consulta.comuna === '18', JSON.stringify(segunda));
  const territorios = Array.from(doc.getElementById('tableroTerritorio').options).map(function (o) { return o.value; }).filter(Boolean);
  verificar('  y el territorio ofrece sólo los de esa comuna', territorios.join() === 'T51,T52', territorios.join());
  verificar('  con su nombre', /T51 · Comuna 18/.test(doc.getElementById('tableroTerritorio').options[1].textContent),
    doc.getElementById('tableroTerritorio').options[1].textContent);
  verificar('«Quitar filtros» aparece', !doc.getElementById('btnTableroQuitar').hidden);
  verificar('con una comuna, las viviendas se abren por territorio',
    panel(doc, 'ubicacion').querySelector('.tpanel__titulo').textContent === 'Viviendas por territorio' &&
    /Comuna 18/.test(panel(doc, 'ubicacion').querySelector('.tpanel__sub').textContent) &&
    /^T48/.test(panel(doc, 'ubicacion').querySelector('.tbarra__nombre').textContent),
    panel(doc, 'ubicacion').textContent);

  doc.getElementById('btnTableroQuitar').click();
  await esperar(40);
  const tercera = w.__peticiones[pedidosAntes + 1] || {};
  verificar('«Quitar filtros» vuelve a pedir sin ellos y se oculta',
    tercera.consulta && !tercera.consulta.comuna && doc.getElementById('btnTableroQuitar').hidden && comuna.value === '',
    JSON.stringify(tercera));
  verificar('  y las viviendas vuelven a ir por comuna', panel(doc, 'ubicacion').querySelector('.tpanel__titulo').textContent === 'Viviendas por comuna');

  doc.querySelector('[data-periodo-tablero="anio"]').click();
  await esperar(40);
  const cuarta = w.__peticiones[pedidosAntes + 2] || {};
  verificar('«Este año» pide desde el 1 de enero',
    cuarta.consulta && cuarta.consulta.desde === new Date().getFullYear() + '-01-01' &&
    doc.querySelector('[data-periodo-tablero="anio"]').getAttribute('aria-pressed') === 'true', JSON.stringify(cuarta));

  doc.getElementById('tableroDesde').value = '2026-10-22';
  doc.getElementById('tableroHasta').value = '2026-10-01';
  doc.getElementById('tableroHasta').dispatchEvent(new w.Event('change'));
  await esperar(30);
  verificar('fechas al revés: avisa y no llama al servidor',
    !doc.getElementById('tableroError').hidden && w.__peticiones.length === pedidosAntes + 3, doc.getElementById('tableroError').textContent);
  verificar('  y el período rápido deja de estar marcado', doc.querySelectorAll('[data-periodo-tablero][aria-pressed="true"]').length === 0);

  doc.getElementById('tableroHasta').value = '2026-10-29';
  doc.getElementById('tableroHasta').dispatchEvent(new w.Event('change'));
  await esperar(40);
  comuna.value = 'Rural';
  comuna.dispatchEvent(new w.Event('change'));
  await esperar(40);
  verificar('sin viviendas con esos filtros lo dice y deshabilita la descarga',
    /No hay viviendas caracterizadas con estos filtros/.test(doc.getElementById('tableroContenido').textContent) &&
    doc.getElementById('btnTableroDescargar').disabled && doc.getElementById('tableroError').hidden);
  doc.getElementById('btnTableroQuitar').click();
  await esperar(40);

  console.log('\n=== 6. Descargar datos ===');
  doc.getElementById('btnTableroDescargar').click();
  const nombre = w.__descargas[w.__descargas.length - 1] || '';
  verificar('descarga un CSV con el período en el nombre', /^tablero_poblacion_\d{4}-\d{2}-\d{2}_2026-10-29\.csv$/.test(nombre), nombre);
  const csv = String((w.__blob && w.__blob.partes && w.__blob.partes[0]) || '');
  verificar('con BOM y «;» como separador', csv.charCodeAt(0) === 0xFEFF && /Categoría;Cantidad;Porcentaje/.test(csv));
  verificar('trae los siete paneles, con el ítem del instrumento',
    /Población caracterizada/.test(csv) && /Necesidades por atender/.test(csv) && /Personas por curso de vida y sexo \(ítem 64 y 66\)/.test(csv) &&
    /Enfermedades crónicas diagnosticadas \(ítem 100\)/.test(csv) && /Viviendas por comuna/.test(csv));

  console.log('\n=== 7. Salir del apartado ===');
  w.cambiarVista('inicio');
  verificar('el menú lateral se oculta y la página vuelve a su ancho',
    doc.getElementById('reportesMenu').hidden && !doc.querySelector('.app-main').classList.contains('app-main--reportes'));
  w.REPORTES.abrir('descargas');
  verificar('las descargas también son del apartado',
    doc.getElementById('view-reporte').classList.contains('is-active') && !doc.getElementById('reportesMenu').hidden &&
    doc.querySelector('#reportesMenu [data-reporte="descargas"]').getAttribute('aria-current') === 'page');

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
