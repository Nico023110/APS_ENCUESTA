/* =========================================================================
   Apartado «Reportes» y tableros de población en el navegador (jsdom)
   -------------------------------------------------------------------------
       node pruebas/tableros_vista.test.js

   Monta index.html con una sesión en caché y un fetch simulado, y comprueba
   que el apartado sólo aparece para la coordinación, el administrador y el
   maestro; que al abrirlo pide los tableros (todo el registro) con la
   cabecera anti-CSRF; que pinta la cadena de población, la atención
   prioritaria, las pirámides, las barras y los medidores con las etiquetas
   del instrumento —lo del servidor como texto—; que cambiar de tablero o de
   página no vuelve a pedir y que cambiar un filtro sí; que cada panel se
   lee como tabla; y que la descarga es un CSV para Excel.

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
      viviendas: 12, hogares: 10, hogaresDeclarados: 15, familias: 10, personas: 23, hacinamiento: 1, conCuidador: 1,
      gestantes: 1, preguntadasGestacion: 11, primeraInfancia: 4, mayores: 3, menores6m: 4, discapacidad: 0, victimas: 0,
      respondieronMaterno: 1, respondieronBarreras: 6, conBarreras: 1
    },
    dimensiones: {
      estrato: [{ valor: 'bajo', n: 4 }, { valor: 'medio_bajo', n: 5 }, { valor: 'bajo_bajo', n: 1 }, { valor: 'medio', n: 1 }, { valor: 'medio_alto', n: 1 }],
      comuna: [{ valor: '3', n: 6 }, { valor: '18', n: 2 }, { valor: '1', n: 2 }, { valor: '20', n: 2 }],
      territorio: [{ valor: 'T48', n: 6 }],
      fuenteAgua: [{ valor: 'acueducto_esp', n: 10 }, { valor: 'pila_publica', n: 1 }, { valor: 'carro_tanque', n: 1 }],
      tipoFamilia: [{ valor: 'nuclear_biparental', n: 6 }, { valor: 'unipersonal', n: 2 }, { valor: 'extenso_biparental', n: 1 },
        { valor: 'nuclear_monoparental', n: 1 }],
      integrantesFamilia: [{ valor: '1', n: 2 }, { valor: '2', n: 5 }, { valor: '3', n: 1 }, { valor: '4', n: 2 }],
      apgar: [{ valor: 'alta', n: 2 }, { valor: 'sin_dato', n: 8 }],
      riesgoFamiliar: [{ valor: 'alto', n: 4 }, { valor: 'medio', n: 1 }, { valor: 'bajo', n: 1 }, { valor: 'sin_dato', n: 4 }],
      redesApoyo: [{ valor: 'cuenta_protectoras', n: 7 }, { valor: 'no_cuenta', n: 3 }],
      zarit: [{ valor: 'ausencia', n: 1 }],
      situacionesRiesgo: [{ valor: 'jubilacion', n: 1 }, { valor: 'ninguna', n: 7 }, { valor: 'independencia_hijos', n: 1 }],
      practicasVinculo: [{ valor: 'escucha_activa', n: 4 }],
      practicasHogar: [{ valor: 'tratamiento_agua', n: 4 }],
      cursoVida: [{ valor: 'adultez', sexo: 'hombre', n: 5 }, { valor: 'adultez', sexo: 'mujer', n: 7 },
        { valor: 'vejez', sexo: 'hombre', n: 3 }, { valor: 'primera_infancia', sexo: 'mujer', n: 3 },
        { valor: 'primera_infancia', sexo: 'hombre', n: 1 }, { valor: 'juventud', sexo: 'mujer', n: 3 },
        { valor: 'juventud', sexo: 'hombre', n: 1 }, { valor: 'adultez', sexo: 'intersexual', n: 1 }],
      quinquenio: [{ valor: '25', sexo: 'mujer', n: 3 }, { valor: '40', sexo: 'hombre', n: 3 }, { valor: '0', sexo: 'mujer', n: 3 }],
      nivelEducativo: [{ valor: 'ninguno', sexo: 'mujer', n: 3 }, { valor: 'basica_secundaria', sexo: 'hombre', n: 3 }],
      regimen: [{ valor: 'subsidiado', sexo: 'hombre', n: 5 }, { valor: 'no_afiliado', sexo: 'mujer', n: 2 }],
      etnia: [{ valor: 'ninguna', sexo: 'mujer', n: 13 }, { valor: 'ninguna', sexo: 'hombre', n: 9 }, { valor: 'negro', sexo: 'hombre', n: 1 }],
      antropometria: [{ valor: 'normal', sexo: 'hombre', n: 7 },
        { valor: 'riesgo_desnutricion', sexo: 'mujer', n: 1 }],
      tratamiento: [{ valor: 'si', sexo: 'mujer', n: 2 }],
      lactancia: [{ valor: 'no', sexo: 'mujer', n: 3 }, { valor: 'si', sexo: 'hombre', n: 1 }],
      discapacidad: [{ valor: 'sin_discapacidad', sexo: 'mujer', n: 11 }],
      practicasCuidado: [{ valor: 'actividad_fisica', sexo: 'mujer', n: 2 }],
      enfermedadesNT: [{ valor: 'diabetes', sexo: 'hombre', n: 1 }, { valor: 'ninguna', sexo: 'mujer', n: 8 }],
      conEnfermedadNT: [{ valor: 'si', sexo: 'hombre', n: 2 }, { valor: 'no', sexo: 'mujer', n: 8 }],
      sujetoProteccion: [{ valor: 'migrante', n: 1 }, { valor: 'ninguna', n: 17 }],
      saberes: [{ valor: 'transicion', n: 3 }, { valor: 'ninguna', n: 14 }],
      transmisibles: [{ valor: 'ninguna', n: 19 }],
      barreras: [{ valor: 'sin_agenda', n: 2 }, { valor: 'ninguna', n: 12 }],
      atencionesMaterno: [{ valor: 'preconcepcional', n: 1 }],
      gestacion: [{ valor: 'no', n: 10 }, { valor: 'si', n: 1 }]
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

  console.log('\n=== 2. Abrir: el tablero principal con todo el registro ===');
  const w = montar('lider_ebs');
  const doc = w.document;
  Array.from(doc.querySelectorAll('#menuUsuario .app-menu__item'))
    .find(function (b) { return b.textContent.trim() === 'Reportes'; }).click();
  await esperar(60);
  verificar('abre la vista de tableros con el menú lateral y «Tablero principal» marcado',
    doc.getElementById('view-tableros').classList.contains('is-active') && !doc.getElementById('reportesMenu').hidden &&
    doc.querySelector('#reportesMenu [data-reporte="principal"]').getAttribute('aria-current') === 'page' &&
    doc.querySelector('.app-main').classList.contains('app-main--reportes'));
  const primera = w.__peticiones[0] || {};
  verificar('pide los tableros por GET con la cabecera anti-CSRF, desde 2024 hasta hoy',
    primera.metodo === 'GET' && primera.csrf === 'fetch' && primera.consulta.tablero === '1' &&
    primera.consulta.desde === '2024-01-01' && primera.consulta.hasta === iso(new Date()) && !primera.consulta.ebs,
    JSON.stringify(primera));
  verificar('«Todo el registro» queda marcado', doc.querySelector('[data-periodo-tablero="todo"]').getAttribute('aria-pressed') === 'true');

  verificar('siete paneles en el principal',
    paneles(doc).join() === 'cadena,prioritarios,cursoVida,comunas,estrato,etnia,visita', paneles(doc).join());
  const cadena = Array.from(doc.querySelectorAll('[data-panel="cadena"] .cadena__valor')).map(function (x) { return x.dataset.cifra; });
  verificar('la cadena: viviendas, hogares, familias y personas', cadena.join() === '12,10,10,23', cadena.join());
  verificar('nombra los hogares declarados sin caracterizar', /5 hogares declarados sin caracterizar/.test(panel(doc, 'cadena').textContent));
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

  const comunas = Array.from(doc.querySelectorAll('[data-panel="comunas"] .tbarra__nombre')).map(function (x) { return x.textContent; });
  verificar('viviendas por comuna, de mayor a menor', comunas[0] === 'Comuna 3' && comunas.length === 4, comunas.join(' | '));
  verificar('con cifra y porcentaje sobre las viviendas', /6 · 50 %/.test(panel(doc, 'comunas').querySelector('.tbarra__cifras').textContent),
    panel(doc, 'comunas').querySelector('.tbarra__cifras').textContent);
  const estratos = Array.from(doc.querySelectorAll('[data-panel="estrato"] .tcolumna__nombre')).map(function (x) { return x.textContent; });
  verificar('estrato: la escala completa del catálogo, en su orden', estratos.join() === 'Bajo - Bajo,Bajo,Medio - Bajo,Medio,Medio - Alto,Alto',
    estratos.join());
  verificar('  y el estrato sin viviendas queda en cero, apagado', doc.querySelectorAll('[data-panel="estrato"] .tcolumna.is-cero').length === 1);
  const etnias = Array.from(doc.querySelectorAll('[data-panel="etnia"] .tbarra'));
  verificar('pertenencia étnica: «Ninguna de las anteriores» al final y apagada',
    etnias.length === 2 && etnias[1].classList.contains('is-apagada') && /Ninguna de las anteriores/.test(etnias[1].textContent));
  const medidores = Array.from(doc.querySelectorAll('[data-panel="visita"] .medidor__valor')).map(function (x) { return x.textContent; });
  verificar('medidores: lactancia exclusiva, hacinamiento y cuidador', medidores.join(' | ') === '25 % | 8,3 % | 10 %', medidores.join(' | '));
  verificar('la fuente dice qué entra y de qué fechas',
    /visita más reciente/.test(doc.getElementById('tableroFuente').textContent) && !doc.getElementById('tableroFuente').hidden);

  verificar('lo del servidor se pinta como texto, no como HTML',
    doc.querySelector('#view-tableros img') === null && w.__inyectado === undefined &&
    Array.from(doc.getElementById('tableroEbs').options).some(function (o) { return o.textContent.indexOf('<img') === 0; }));

  console.log('\n=== 3. Tableros y páginas: sin volver a pedir ===');
  doc.querySelector('#reportesMenu [data-reporte="hogares"]').click();
  await esperar(30);
  verificar('Hogares: título, menú marcado y tres páginas',
    doc.getElementById('tableroTitulo').textContent === 'Hogares' &&
    doc.querySelector('#reportesMenu [data-reporte="hogares"]').getAttribute('aria-current') === 'page' &&
    doc.querySelectorAll('#tableroPaginas .tablero-paginas__item').length === 3 && !doc.getElementById('tableroPaginas').hidden);
  verificar('página 1: estructura y contexto', paneles(doc).join() === 'tipoFamilia,apgar,integrantes,riesgo,agua', paneles(doc).join());
  verificar('  sin pedir nada nuevo', w.__peticiones.length === 1, w.__peticiones.length);
  const apgar = Array.from(doc.querySelectorAll('[data-panel="apgar"] .composicion-barra__grado'));
  verificar('APGAR: los tres grados del catálogo y «Sin dato» al final',
    apgar.length === 4 && /Alta funcionalidad/.test(apgar[0].textContent) && /Sin dato/.test(apgar[3].textContent) &&
    apgar[0].querySelector('.tono--ok') !== null, apgar.map(function (g) { return g.textContent; }).join(' | '));
  verificar('riesgo familiar con los colores del semáforo y su nombre',
    doc.querySelectorAll('[data-panel="riesgo"] .composicion-barra__tramo').length === 4 &&
    /Riesgo alto/.test(panel(doc, 'riesgo').textContent) && panel(doc, 'riesgo').querySelector('.tono--alto') !== null);
  const integrantes = Array.from(doc.querySelectorAll('[data-panel="integrantes"] .tcolumna__nombre')).map(function (x) { return x.textContent; });
  verificar('personas por familia de 1 a «10 o más»', integrantes.length === 10 && integrantes[9] === '10 o más', integrantes.join());

  doc.querySelector('#tableroPaginas [data-pagina="desafios"]').click();
  await esperar(30);
  verificar('página 2: desafíos de salud', paneles(doc).join() === 'cuidador,zarit,situaciones,redes', paneles(doc).join());
  verificar('  la página abierta queda marcada',
    doc.querySelector('#tableroPaginas [data-pagina="desafios"]').getAttribute('aria-current') === 'page' &&
    !doc.querySelector('#tableroPaginas [data-pagina="estructura"]').hasAttribute('aria-current'));
  const situaciones = Array.from(doc.querySelectorAll('[data-panel="situaciones"] .tbarra__nombre')).map(function (x) { return x.textContent; });
  verificar('situaciones de riesgo con el texto del instrumento y «Ninguna» al final',
    situaciones.length === 3 && situaciones[2] === 'Ninguna' && situaciones.indexOf('Jubilación') !== -1, situaciones.join(' | '));

  doc.querySelector('#reportesMenu [data-reporte="personas"]').click();
  await esperar(30);
  verificar('Personas: cinco páginas', doc.querySelectorAll('#tableroPaginas .tablero-paginas__item').length === 5);
  verificar('página 1: pirámide por quinquenios con 17 grupos',
    doc.querySelectorAll('[data-panel="piramide"] .espejo__fila').length === 17);
  verificar('nivel educativo: «Ninguno» es el primer peldaño',
    doc.querySelector('[data-panel="educacion"] .espejo__nombre').textContent === 'Ninguno');
  verificar('discapacidad: sin nadie con discapacidad lo dice y cuenta a quienes no se reconocen',
    /Nada registrado/.test(panel(doc, 'discapacidad').textContent) &&
    /11 personas no se reconocen con discapacidad/.test(panel(doc, 'discapacidad').textContent), panel(doc, 'discapacidad').textContent);
  doc.querySelector('#tableroPaginas [data-pagina="salud"]').click();
  await esperar(30);
  verificar('estado nutricional: con etiquetas largas, la categoría pasa encima de las barras',
    panel(doc, 'nutricion').querySelector('.espejo').classList.contains('espejo--arriba'));
  verificar('  y la etiqueta del instrumento no se corta',
    /Riesgo de Desnutrición Aguda \(en <5 años\), o Riesgo de delgadez/.test(panel(doc, 'nutricion').textContent));
  verificar('cambiar de tablero y de página nunca volvió a pedir', w.__peticiones.length === 1, w.__peticiones.length);

  console.log('\n=== 4. Cada panel se lee como tabla ===');
  const transmisibles = panel(doc, 'transmisibles');
  const alternar = transmisibles.querySelector('.tpanel__alternar');
  alternar.click();
  verificar('«Tabla» muestra la tabla y oculta el gráfico',
    alternar.getAttribute('aria-pressed') === 'true' && !transmisibles.querySelector('.tpanel__tabla').hidden &&
    transmisibles.querySelector('.tpanel__grafico').hidden && alternar.textContent.trim() === 'Gráfico');
  const filasTabla = Array.from(transmisibles.querySelectorAll('tbody tr')).map(function (tr) { return tr.textContent; });
  verificar('  con categoría, cantidad y porcentaje', filasTabla.length === 1 && /Ninguna/.test(filasTabla[0]) && /82,6 %/.test(filasTabla[0]),
    filasTabla.join(' | '));
  const tablaEspejo = panel(doc, 'nutricion');
  tablaEspejo.querySelector('.tpanel__alternar').click();
  const cabeceras = Array.from(tablaEspejo.querySelectorAll('thead th')).map(function (th) { return th.textContent; });
  verificar('la tabla de un espejo trae hombres, mujeres y total', cabeceras.join() === 'Categoría,Hombres,Mujeres,Total', cabeceras.join());

  console.log('\n=== 5. Filtros: cambiar uno vuelve a pedir ===');
  const comuna = doc.getElementById('tableroComuna');
  verificar('las comunas llegan del servidor', Array.from(comuna.options).map(function (o) { return o.value; }).join() === ',3,18,Rural');
  comuna.value = '18';
  comuna.dispatchEvent(new w.Event('change'));
  await esperar(40);
  const segunda = w.__peticiones[1] || {};
  verificar('elegir la comuna 18 pide con ese filtro', segunda.consulta && segunda.consulta.comuna === '18', JSON.stringify(segunda));
  const territorios = Array.from(doc.getElementById('tableroTerritorio').options).map(function (o) { return o.value; }).filter(Boolean);
  verificar('  y el territorio ofrece sólo los de esa comuna', territorios.join() === 'T51,T52', territorios.join());
  verificar('  con su nombre', /T51 · Comuna 18/.test(doc.getElementById('tableroTerritorio').options[1].textContent),
    doc.getElementById('tableroTerritorio').options[1].textContent);
  verificar('«Quitar filtros» aparece', !doc.getElementById('btnTableroQuitar').hidden);
  verificar('lo de la página abierta se vuelve a pintar con lo nuevo', paneles(doc).indexOf('nutricion') !== -1);

  doc.getElementById('btnTableroQuitar').click();
  await esperar(40);
  const tercera = w.__peticiones[2] || {};
  verificar('«Quitar filtros» vuelve a pedir sin ellos y se oculta',
    tercera.consulta && !tercera.consulta.comuna && doc.getElementById('btnTableroQuitar').hidden && comuna.value === '',
    JSON.stringify(tercera));

  doc.querySelector('[data-periodo-tablero="anio"]').click();
  await esperar(40);
  const cuarta = w.__peticiones[3] || {};
  verificar('«Este año» pide desde el 1 de enero',
    cuarta.consulta && cuarta.consulta.desde === new Date().getFullYear() + '-01-01' &&
    doc.querySelector('[data-periodo-tablero="anio"]').getAttribute('aria-pressed') === 'true', JSON.stringify(cuarta));

  doc.getElementById('tableroDesde').value = '2026-10-22';
  doc.getElementById('tableroHasta').value = '2026-10-01';
  doc.getElementById('tableroHasta').dispatchEvent(new w.Event('change'));
  await esperar(30);
  verificar('fechas al revés: avisa y no llama al servidor',
    !doc.getElementById('tableroError').hidden && w.__peticiones.length === 4, doc.getElementById('tableroError').textContent);
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
  doc.querySelector('#reportesMenu [data-reporte="hogares"]').click();
  await esperar(30);
  doc.getElementById('btnTableroDescargar').click();
  const nombre = w.__descargas[w.__descargas.length - 1] || '';
  verificar('descarga un CSV con el tablero y el período en el nombre', /^tablero_hogares_\d{4}-\d{2}-\d{2}_2026-10-29\.csv$/.test(nombre), nombre);
  const csv = String((w.__blob && w.__blob.partes && w.__blob.partes[0]) || '');
  verificar('con BOM y «;» como separador', csv.charCodeAt(0) === 0xFEFF && /Categoría;Cantidad;Porcentaje/.test(csv));
  verificar('trae los paneles de las tres páginas, con su ítem',
    /Estructura y contexto · Tipo de familia \(ítem 50\)/.test(csv) && /Desafíos de salud · Sobrecarga del cuidador/.test(csv) &&
    /Prácticas protectoras · Prácticas para el cuidado de la salud y protección en el hogar/.test(csv));

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
