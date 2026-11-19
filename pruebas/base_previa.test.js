/* =========================================================================
   Pruebas: «¿Ya fue caracterizada?» — base anterior a la app
   -------------------------------------------------------------------------
   Sin base ni servidor:
     1. cruce.js: la dirección, el documento y la coordenada se reconocen
        aunque se hayan escrito distinto;
     2. bd/leer_xlsx.js: lee un .xlsx (textos compartidos y en línea, celdas
        saltadas, ZIP comprimido y sin comprimir);
     3. bd/cargar_base_previa.js: agrupa personas en viviendas, corrige
        fechas y coordenadas, y no se lleva nombres;
     4. api/_base_previa.js: valida, ordena, no devuelve coordenadas, anota la
        búsqueda y respeta el tope (con un cliente falso);
     5. base_previa.js en jsdom: el panel, la búsqueda en la copia y que lo
        que llega se pinta como texto.
       node pruebas/base_previa.test.js
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const CRUCE = require(path.join(RAIZ, 'cruce.js'));
const { leerXlsx, fechaDeSerial } = require(path.join(RAIZ, 'bd', 'leer_xlsx.js'));
const { crearLibro, crc32 } = require(path.join(RAIZ, 'api', '_xlsx.js'));
const carga = require(path.join(RAIZ, 'bd', 'cargar_base_previa.js'));
const api = require(path.join(RAIZ, 'api', '_base_previa.js'));
const roles = require(path.join(RAIZ, 'roles.js'));

let pasadas = 0;
let fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

/* ------------------------------------------------------------------ */
console.log('\n=== 1. cruce.js ===');

const DIRECCIONES = [
  ['Cra 14 # 14-14', 'KR 14 # 14 - 14'],
  ['cra97#45-111', 'KR 97 # 45 - 111'],
  ['CL 45 A BIS SUR # 27 B - 15 AP 302', 'CL 45 A BIS SUR # 27 B - 15'],
  ['Calle 1 oeste # 50-20', 'CL 1 OESTE # 50 - 20'],
  ['Cr. 49 bis  oeste 21ª -53', 'KR 49 BIS OESTE # 21 A - 53'],
  ['Calle 14 oeste N 46-44', 'CL 14 OESTE # 46 - 44'],
  ['Cra42aoeste#9-45', 'KR 42 A OESTE # 9 - 45'],
  ['CARRERA 90E OESTE #3D-24', 'KR 90 E OESTE # 3 D - 24'],
  ['Diag. 49ª  oeste # 13 -50', 'DG 49 A OESTE # 13 - 50'],
  ['362 calle 10 # 34-44', 'CL 10 # 34 - 44'],
  ['AV CALLE 5 # 10-20', 'AC 5 # 10 - 20'],
  ['Calle 5 No. 10-20', 'CL 5 # 10 - 20'],
  ['KR 5 S # 12 - 30', 'KR 5 SUR # 12 - 30'],
  ['KR 05 # 014 - 07', 'KR 5 # 14 - 7']
];
DIRECCIONES.forEach(function (par) {
  const clave = CRUCE.claveDeDireccion(par[0]);
  verificar('«' + par[0] + '» → ' + par[1], clave === par[1], String(clave));
});
['KM 8', 'Vereda la reforma', 'casa 34', 'SIN DIRECCION', '', null, 'Calle 19A BIS - 142'].forEach(function (t) {
  verificar('sin nomenclatura completa no hay clave: ' + JSON.stringify(t), CRUCE.claveDeDireccion(t) === null);
});
verificar('la dirección normalizada de la app da su propia clave (sin complementos)',
  CRUCE.claveDeDireccion('CL 2 A OESTE # 93 - 12 AP 201 TO 3') === 'CL 2 A OESTE # 93 - 12');

verificar('documento: sin puntos, espacios ni guiones', CRUCE.documentoDeCruce(' 1.143.929-903 ') === '1143929903');
verificar('documento: letras en mayúscula', CRUCE.documentoDeCruce('ab12345') === 'AB12345');
verificar('documento: menos de 5 caracteres no identifica', CRUCE.documentoDeCruce('14') === null && CRUCE.documentoDeCruce('') === null);

verificar('coordenada sin punto decimal: latitud', CRUCE.coordenadaDeTexto('3443338', 1) === 3.443338);
verificar('coordenada sin punto decimal: longitud', CRUCE.coordenadaDeTexto('-76526951', 2) === -76.526951);
verificar('coordenada con punto o coma se lee tal cual', CRUCE.coordenadaDeTexto('3.4512', 1) === 3.4512 &&
  CRUCE.coordenadaDeTexto('-76,53198', 2) === -76.53198);
verificar('coordenada con menos de 4 decimales no sirve para «cerca de mí»', CRUCE.coordenadaDeTexto('344', 1) === null);
verificar('punto fuera de Cali no se toma', CRUCE.puntoEnCali(4.61, -74.08) === null && CRUCE.puntoEnCali(3.44, -76.52) !== null);
const metros = CRUCE.distanciaEnMetros(3.44, -76.52, 3.4401, -76.52);
verificar('distancia: 0,0001° de latitud son unos 11 m', metros > 10.5 && metros < 11.6, String(metros));

/* ------------------------------------------------------------------ */
console.log('\n=== 2. bd/leer_xlsx.js ===');

const libro = crearLibro({
  hojas: [{ nombre: 'Base', columnas: [{ titulo: 'Número' }, { titulo: 'Texto <raro> & "comillas"' }, { titulo: 'Vacía' }, { titulo: 'Última' }],
    filas: [[45933, 'Ñandú & cía', null, 'x'], [3443338, '', null, 'y']] }]
});
let leido = leerXlsx(libro);
verificar('lee el .xlsx de api/_xlsx.js (texto en línea y números)',
  leido.hoja === 'Base' && leido.filas.length === 3 && leido.filas[1][0] === '45933' && leido.filas[1][1] === 'Ñandú & cía',
  JSON.stringify(leido.filas));
verificar('encabezados con entidades XML', leido.filas[0][1] === 'Texto <raro> & "comillas"', leido.filas[0][1]);
verificar('celdas vacías intermedias quedan en null y no corren las demás', leido.filas[1][2] === null && leido.filas[1][3] === 'x' &&
  leido.filas[2][1] === null && leido.filas[2][3] === 'y', JSON.stringify(leido.filas));
verificar('fecha de Excel: 45933 = 2025-10-03', fechaDeSerial('45933') === '2025-10-03' && fechaDeSerial('45933.88') === '2025-10-03');

/* Un .xlsx con tabla de textos compartidos (como lo guarda Excel), con un
   texto por tramos, una fila saltada y una entrada sin comprimir. */
function zipDePrueba(archivos) {
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;
  archivos.forEach(function (a, i) {
    const nombre = Buffer.from(a.nombre);
    const crudo = Buffer.from(a.datos, 'utf8');
    const comprimir = i % 2 === 0;
    const datos = comprimir ? zlib.deflateRawSync(crudo) : crudo;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(comprimir ? 8 : 0, 8);
    local.writeUInt32LE(crc32(crudo), 14); local.writeUInt32LE(datos.length, 18); local.writeUInt32LE(crudo.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(comprimir ? 8 : 0, 10); central.writeUInt32LE(crc32(crudo), 16);
    central.writeUInt32LE(datos.length, 20); central.writeUInt32LE(crudo.length, 24); central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    locales.push(local, nombre, datos);
    centrales.push(central, nombre);
    desplazamiento += 30 + nombre.length + datos.length;
  });
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12); fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat(locales.concat([directorio, fin]));
}
const xlsxCompartido = zipDePrueba([
  { nombre: 'xl/workbook.xml', datos: '<workbook><sheets><sheet name="Otra" sheetId="1" r:id="rId1"/><sheet name="BD" sheetId="2" r:id="rId2"/></sheets></workbook>' },
  { nombre: 'xl/_rels/workbook.xml.rels', datos: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>' },
  { nombre: 'xl/sharedStrings.xml', datos: '<sst><si><t>Territorio</t></si><si><r><t>Cra 14</t></r><r><t xml:space="preserve"> # 14-14</t></r><rPh><t>X</t></rPh></si><si><t>T48</t></si></sst>' },
  { nombre: 'xl/worksheets/sheet1.xml', datos: '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>no</t></is></c></row></sheetData></worksheet>' },
  { nombre: 'xl/worksheets/sheet2.xml', datos: '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
    '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>12</v></c><c r="C3" t="str"><f>A1</f><v>&#241;</v></c><c r="D3" t="b"><v>1</v></c></row></sheetData></worksheet>' }
]);
leido = leerXlsx(xlsxCompartido, { hoja: 'BD' });
verificar('textos compartidos, tramos con formato (sin la guía fonética) y hoja por nombre',
  leido.hoja === 'BD' && leido.filas[0][0] === 'Territorio' && leido.filas[0][2] === 'Cra 14 # 14-14' && leido.filas[0][1] === null,
  JSON.stringify(leido.filas[0]));
verificar('la fila saltada queda vacía y la siguiente conserva su número',
  leido.filas.length === 3 && leido.filas[1].length === 0 && leido.filas[2][0] === 'T48' && leido.filas[2][1] === '12' &&
  leido.filas[2][2] === 'ñ' && leido.filas[2][3] === '1', JSON.stringify(leido.filas));
verificar('sin nombre de hoja lee la primera', leerXlsx(xlsxCompartido).filas[0][0] === 'no');

/* ------------------------------------------------------------------ */
console.log('\n=== 3. bd/cargar_base_previa.js ===');

const ENCABEZADOS = ['CONCATENAR', 'ID', '4. Territorio', '5. Microterritorio', '6. Corregimiento / Centro de poblado / Vereda',
  '7. Dirección', '8.1 Geopunto (online-offline) - Latitud', '8.2 Geopunto (online-offline) - Longitud',
  '9. Ubicación del hogar (cuando no se cuenta con nomenclatura, punto de referencia)', '9.1 Telefono de referencia',
  '10. Número de Identificación de la familia', '15. Número de identificación del Equipo Básico de Salud (EBS) VIVIEN',
  '17. Número de identificación del responsable', '17.1 Nombre del responsable de la evaluación.',
  '18. Perfil de quien realiza la evaluación', 'NUMERO UNICO DE VIVIENDA', '20. Fecha diligencimiento de la ficha',
  '49. Primer Nombre', '51. Primer Apellido', '53. Tipo de identificación', '54. Número de identificación', 'Hora de inicio VIVIEN'];
function fila(o) {
  return [null, null, o.terr, o.mt, o.barrio, o.dir, o.lat, o.lon, o.ref, '3001234567', o.fam, o.ebs, o.respDoc || null, o.resp, 'Auxiliar de enfermería',
    o.nuv, o.fecha, 'NombreSecreto', 'ApellidoSecreto', o.tipo, o.doc, o.digitada];
}
const filasCarga = [ENCABEZADOS,
  fila({ nuv: '5893', terr: 'T48 ', mt: 'MTO4', barrio: 'SAN PASCUAL- SAN ANTONIO - COMUNA 3 - ESE LADERA', dir: 'Cra 14 # 14-14', lat: '3443338', lon: '-76526951',
    fam: '5893', ebs: 'EBS033 - Comuna 3', respDoc: '66920201', resp: 'Responsable Uno', fecha: '45932', tipo: 'CC-Cédula de Ciudadanía', doc: '1.143.929.903', digitada: '45933.9' }),
  fila({ nuv: '5893', terr: 'T48', mt: 'MT4', barrio: 'SAN PASCUAL- SAN ANTONIO - COMUNA 3 - ESE LADERA', dir: 'Cra 14 # 14-14', lat: '3443338', lon: '-76526951',
    fam: '5893', ebs: 'EBS033 - Comuna 3', respDoc: '66920201', resp: 'Responsable Uno', fecha: '10/22/2025', tipo: 'TI-Tarjeta de Identidad', doc: '1012345678', digitada: null }),
  fila({ nuv: '5893', terr: 'T48', mt: 'MT04', barrio: 'SAN PASCUAL- SAN ANTONIO - COMUNA 3 - ESE LADERA', dir: 'Cra 14 # 14-14', lat: '3443338', lon: '-76526951',
    fam: '5893', ebs: 'EBS033 - Comuna 3', respDoc: '66920201', resp: 'Responsable Uno', fecha: '45932', tipo: 'CC-Cédula de Ciudadanía', doc: '1143929903', digitada: null }),
  fila({ nuv: '7001', terr: 'T76', mt: 'MT02', barrio: 'La Buitrera', dir: 'Vereda la reforma', lat: '344', lon: '-765',
    fam: '7001', ebs: 'EBS001 - Buitrera', respDoc: '31000000', resp: 'responsable dos', fecha: '3/12/2026', tipo: 'CC-Cédula de Ciudadanía', doc: '14', digitada: '46000' }),
  fila({ nuv: '7002', terr: 'T76', mt: 'MT02', barrio: '0', dir: '0', lat: null, lon: null,
    fam: null, ebs: 'EBS001 - Buitrera', respDoc: '66920201', resp: '0', fecha: '18000', tipo: 'RC-Registro Civil', doc: '1109876543', digitada: '46100' }),
  [],
  fila({ nuv: null, terr: '0', mt: '0', fecha: '45932', tipo: 'CC-Cédula de Ciudadanía', doc: '99999999' })
];
const agrupado = carga.agruparViviendas(filasCarga);
const v1 = agrupado.viviendas.find(function (v) { return v.numero === '5893'; });
const v2 = agrupado.viviendas.find(function (v) { return v.numero === '7001'; });
const v3 = agrupado.viviendas.find(function (v) { return v.numero === '7002'; });
verificar('agrupa por número único de vivienda (3 viviendas; la fila sin número no entra)',
  agrupado.viviendas.length === 3 && agrupado.resumen.filasSinVivienda === 1 && agrupado.resumen.filas === 6, JSON.stringify(agrupado.resumen));
verificar('territorio y microterritorio normalizados (T48 , MTO4, MT4 → T48 · MT04)', v1.territorio === 'T48' && v1.microterritorio === 'MT04');
verificar('dirección y su clave', v1.direccion === 'Cra 14 # 14-14' && v1.clave === 'KR 14 # 14 - 14');
verificar('coordenadas reconstruidas', v1.latitud === 3.443338 && v1.longitud === -76.526951);
verificar('EBS separado en código y nombre', v1.ebsCodigo === 'EBS033' && v1.ebsNombre === 'Comuna 3');
verificar('fechas: serial y texto mes/día/año (10/22/2025)', v1.primeraFecha === '2025-10-02' && v1.ultimaFecha === '2025-10-22',
  v1.primeraFecha + ' ' + v1.ultimaFecha);
verificar('documento repetido en la vivienda cuenta una vez; tipo por su código',
  v1.documentos.length === 2 && v1.documentos.some(function (d) { return d.tipo === 'TI' && d.numero === '1012345678'; }) &&
  v1.documentos.some(function (d) { return d.tipo === 'CC' && d.numero === '1143929903'; }), JSON.stringify(v1.documentos));
verificar('personas = filas de la vivienda; familias distintas', v1.personas === 3 && v1.familias === 1);
verificar('3/12/2026 fuera del período (diciembre) → día y mes cruzados: 12 de marzo', v2.ultimaFecha === '2026-03-12', v2.ultimaFecha);
verificar('sin coordenadas útiles ni clave en la vereda; el documento de 2 dígitos no se toma',
  v2.latitud === null && v2.clave === null && v2.documentos.length === 0);
verificar('fecha imposible (1949) → la de digitación', v3.ultimaFecha === '2026-03-19', v3.ultimaFecha);
verificar('«0» y «#N/A» son vacío', v3.direccion === null && v3.division === null && v3.familias === 1);
verificar('sin nombre de quien caracterizó, se toma el de su documento en otra fila', v3.responsable === 'Responsable Uno', v3.responsable);
verificar('el nombre de quien caracterizó, con mayúscula inicial', v2.responsable === 'Responsable Dos', v2.responsable);
verificar('el barrio sin el «- ESE LADERA» pegado', v1.division === 'SAN PASCUAL- SAN ANTONIO - COMUNA 3', v1.division);
const todoElTexto = JSON.stringify(agrupado);
verificar('no se lleva nombres ni teléfonos de las personas',
  todoElTexto.indexOf('NombreSecreto') < 0 && todoElTexto.indexOf('ApellidoSecreto') < 0 && todoElTexto.indexOf('3001234567') < 0);
verificar('el período sale de las fechas', carga.periodoDe('2025-01-03', '2026-06-30') === 'enero de 2025 a junio de 2026');
let errorColumnas = null;
try { carga.agruparViviendas([['A', 'B'], ['1', '2']]); } catch (e) { errorColumnas = e; }
verificar('un Excel sin las columnas se rechaza diciendo cuáles faltan', errorColumnas && /faltan columnas/.test(errorColumnas.message));

/* ------------------------------------------------------------------ */
console.log('\n=== 4. api/_base_previa.js ===');

function falla(cuerpo) {
  try { api.prepararBusqueda(cuerpo); return null; } catch (e) { return e; }
}
verificar('documento corto se rechaza', falla({ modo: 'documento', documento: '123' }).codigo === 'documento');
verificar('dirección ilegible se rechaza con la ayuda', /Cerca de mí/.test(falla({ modo: 'direccion', direccion: 'vereda' }).message));
verificar('ubicación fuera de Cali se rechaza', falla({ modo: 'cercania', latitud: 4.6, longitud: -74.1 }).codigo === 'ubicacion');
verificar('sin modo se rechaza', falla({}).codigo === 'modo');
let b = api.prepararBusqueda({ modo: 'cercania', latitud: '3.44', longitud: '-76.52', radio: 5000 });
verificar('el radio tiene tope', b.radio === api.RADIO_MAXIMO);
b = api.prepararBusqueda({ modo: 'direccion', direccion: 'cra 14 #14-14' });
verificar('la dirección se busca por su clave', b.clave === 'KR 14 # 14 - 14');

const cerca = { modo: 'cercania', punto: { latitud: 3.44, longitud: -76.52 }, radio: 30 };
const ordenados = api.ordenarResultados([
  { origen: 'previa', fecha: '2025-01-01', latitud: 3.4401, longitud: -76.52 },
  { origen: 'app', fecha: '2026-11-01', latitud: 3.44, longitud: -76.52 },
  { origen: 'previa', fecha: '2025-05-01', latitud: 3.445, longitud: -76.52 },
  { origen: 'previa', fecha: '2025-05-01', latitud: null, longitud: null }
], cerca);
verificar('cercanía: fuera del radio no entra; la más cercana primero',
  ordenados.total === 2 && ordenados.resultados[0].origen === 'app' && ordenados.resultados[1].distancia === 11, JSON.stringify(ordenados));
verificar('las coordenadas no salen hacia el navegador', ordenados.resultados.every(function (r) { return !('latitud' in r) && !('longitud' in r); }));
const muchos = Array.from({ length: 30 }, function (_, i) { return { origen: 'previa', fecha: '2025-01-' + String(i + 1).padStart(2, '0') }; });
const recortados = api.ordenarResultados(muchos, { modo: 'documento' });
verificar('más de ' + api.MAXIMO_RESULTADOS + ': se recorta a las más recientes y se dice',
  recortados.truncado && recortados.resultados.length === api.MAXIMO_RESULTADOS && recortados.resultados[0].fecha === '2025-01-30');

verificar('el permiso lo tienen todos los niveles', ['auxiliar_enfermeria', 'enfermeria', 'lider_ebs', 'administrador', 'maestro']
  .every(function (rol) { return roles.puede(rol, 'base_previa.consultar'); }));

(async function () {
  /* Cliente falso: contesta según la consulta y anota lo que se pidió. */
  function clienteFalso(opciones) {
    const consultas = [];
    return {
      consultas: consultas,
      query: async function (sql, params) {
        consultas.push({ sql: sql, params: params });
        if (/WITH recientes/.test(sql)) return { rows: [{ n: opciones.recientes || 0, anotada: opciones.tope ? 0 : 1 }] };
        if (/FROM hist\.persona p\s+JOIN hist\.vivienda v/.test(sql) && /numero_id = \$1/.test(sql)) {
          return { rows: [{ id: 1, numero_anterior: '5893', territorio: 'T48', microterritorio: 'MT04', division_territorial: 'San Pascual',
            direccion: 'Cra 14 # 14-14', latitud: '3.443338', longitud: '-76.526951', fecha: '2025-10-22', ebs_codigo: 'EBS033',
            ebs_nombre: 'Comuna 3', responsable: 'Responsable Uno', familias: 1, personas: 3, periodo: 'enero de 2025 a junio de 2026', tipos: ['CC'] }] };
        }
        if (/FROM aps\.persona p/.test(sql)) return { rows: [{ hogar_id: 9, ficha_id: 90 }] };
        if (/WHERE f\.id = ANY/.test(sql)) {
          return { rows: [{ id: 9, codigo: 'T48MT04H0001', nuv: 12, territorio_codigo: 'T48', microterritorio_codigo: 'MT04',
            division_territorial: 'San Pascual', direccion_normalizada: 'KR 14 # 14 - 14', latitud: null, longitud: null,
            fecha: '2026-11-10', estado: 'sincronizada', ebs: 'EBS033', responsable: 'Responsable App', familias: '1', personas: '2' }] };
        }
        return { rows: [] };
      }
    };
  }

  const usuario = { funcionarioId: 7, equipoCodigo: 'EBS033', equiposApoyoCodigos: [] };
  let db = clienteFalso({});
  const r = await api.buscar(db, usuario, { modo: 'documento', documento: '1.143.929.903' });
  verificar('por documento: une la base anterior y la app, la más reciente primero',
    r.total === 2 && r.resultados[0].origen === 'app' && r.resultados[0].referencia === 'T48MT04H0001 · NUV0012' &&
    r.resultados[1].origen === 'previa' && r.resultados[1].tipoDocumento === 'CC', JSON.stringify(r));
  verificar('la visita de la app dice su estado en palabras', r.resultados[0].estado === 'Cerrada');
  const anotacion = db.consultas[0];
  verificar('la búsqueda se anota primero, con el documento buscado y el tope en la misma consulta',
    /INSERT INTO aud\.evento/.test(anotacion.sql) && anotacion.params[0] === 7 && anotacion.params[3] === 'buscar_documento' &&
    anotacion.params[4] === '1143929903' && anotacion.params[7] === api.TOPE_BUSQUEDAS);
  verificar('las consultas van con parámetros, no con el documento pegado al SQL',
    db.consultas.every(function (c) { return c.sql.indexOf('1143929903') < 0; }));

  db = clienteFalso({ tope: true, recientes: 40 });
  let errorTope = null;
  try { await api.buscar(db, usuario, { modo: 'documento', documento: '1143929903' }); } catch (e) { errorTope = e; }
  verificar('pasado el tope no se busca', errorTope && errorTope.codigo === 'tope' && db.consultas.length === 1);

  /* La copia para sin señal es toda la base, sin importar el EBS de la
     persona (2026-11-19): ni siquiera hace falta que tenga uno. */
  const consultasCopia = [];
  const dbCopia = {
    query: async function (sql, params) {
      consultasCopia.push({ sql: sql, params: params });
      if (/FROM hist\.vivienda v\s*$/.test(sql.trim()) || /FROM hist\.vivienda v\n/.test(sql + '\n')) {
        return { rows: [
          { id: 1, numero_anterior: '5893', territorio: 'T48', microterritorio: 'MT04', division_territorial: 'A', direccion: 'Cra 14 # 14-14',
            clave_direccion: 'KR 14 # 14 - 14', latitud: '3.44', longitud: '-76.52', fecha: '2025-10-22', ebs_codigo: 'EBS033',
            ebs_nombre: 'Comuna 3', responsable: 'R', familias: 1, personas: 2 },
          { id: 2, numero_anterior: '7001', territorio: 'T76', microterritorio: 'MT02', division_territorial: 'B', direccion: 'Vereda',
            clave_direccion: null, latitud: null, longitud: null, fecha: '2025-03-01', ebs_codigo: 'EBS001',
            ebs_nombre: 'Buitrera', responsable: 'S', familias: 1, personas: 1 }] };
      }
      if (/FROM hist\.persona p$/.test(sql.trim())) return { rows: [{ vivienda_id: 1, numero_id: '1143929903' }, { vivienda_id: 2, numero_id: '22222222' }] };
      if (/DISTINCT ON \(h\.id\)/.test(sql)) {
        return { rows: [{ id: 9, codigo: 'T200MT01H0001', nuv: 3, territorio_codigo: 'T200', microterritorio_codigo: 'MT01',
          division_territorial: 'C', direccion_normalizada: 'CL 1 # 2 - 3', latitud: null, longitud: null, fecha: '2026-11-10',
          estado: 'cerrada', ebs: 'EBS064', responsable: 'T', familias: '1', personas: '1' }] };
      }
      if (/DISTINCT f\.hogar_id/.test(sql)) return { rows: [{ hogar_id: 9, numero_id: '33333333' }] };
      return { rows: [] };
    }
  };
  const copiaTotal = await api.armarCopia(dbCopia, { funcionarioId: 7, equipoCodigo: null, equiposApoyoCodigos: [] });
  verificar('la copia para sin señal trae toda la base, aun sin EBS: viviendas de cualquier EBS y territorio',
    copiaTotal.disponible === true && copiaTotal.viviendas.length === 3 &&
    copiaTotal.viviendas.map(function (v) { return v[9]; }).join(',') === 'EBS033,EBS001,EBS064' &&
    copiaTotal.documentos.length === 3, JSON.stringify(copiaTotal.viviendas.map(function (v) { return v[9]; })));
  verificar('ninguna consulta de la copia filtra por EBS ni por territorio',
    consultasCopia.filter(function (c) { return !/INSERT INTO aud/.test(c.sql); })
      .every(function (c) { return !/ebs_codigo\s*=|territorio\s*=|territorio_codigo\s*=/.test(c.sql) && !(c.params && c.params.length); }));
  verificar('la descarga de la copia queda en la auditoría',
    consultasCopia.some(function (c) { return /INSERT INTO aud\.evento/.test(c.sql) && /copia_sin_senal/.test(c.sql) && c.params[2] === 7; }));

  /* ---------------------------------------------------------------- */
  console.log('\n=== 5. base_previa.js en la página ===');

  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.SESION = {
    usuario: function () { return { documento: '1144099001', equipoCodigo: 'EBS033', equiposApoyoCodigos: [] }; },
    puede: function (permiso) { return permiso === 'base_previa.consultar'; }
  };
  w.BOVEDA = { abierta: function () { return false; }, alAbrir: function () {}, antesDeCerrar: function () {} };
  w.eval(fs.readFileSync(path.join(RAIZ, 'cruce.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(RAIZ, 'base_previa.js'), 'utf8'));
  const doc = w.document;
  const P = w.BASE_PREVIA._paraPruebas;
  /* jsdom todavía no ha disparado DOMContentLoaded: se inicializa a mano (la
     segunda llamada, la del evento, no hace nada). */
  P.inicializar();

  verificar('con el permiso, el panel se muestra en Inicio', doc.getElementById('panelYaCaracterizada').hidden === false);
  verificar('el panel está en Inicio, antes de la población caracterizada', (function () {
    const panel = doc.getElementById('panelYaCaracterizada');
    const composicion = doc.querySelector('#view-inicio .composicion');
    return panel.closest('#view-inicio') && (panel.compareDocumentPosition(composicion) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  })());
  const campo = doc.getElementById('textoBusquedaPrevia');
  verificar('documento: teclado numérico y ayuda', campo.getAttribute('inputmode') === 'numeric' &&
    /sin puntos/.test(doc.getElementById('ayudaBusquedaPrevia').textContent));
  doc.querySelector('input[value="direccion"]').checked = true;
  doc.querySelector('input[value="direccion"]').dispatchEvent(new w.Event('change'));
  campo.value = 'cra 14 #14-14';
  campo.dispatchEvent(new w.Event('input'));
  verificar('dirección: dice cómo la va a buscar mientras se escribe',
    doc.getElementById('ayudaBusquedaPrevia').textContent === 'Se buscará como KR 14 # 14 - 14.', doc.getElementById('ayudaBusquedaPrevia').textContent);
  doc.querySelector('input[value="cercania"]').checked = true;
  doc.querySelector('input[value="cercania"]').dispatchEvent(new w.Event('change'));
  verificar('cerca de mí: sin campo de texto y el botón lo dice',
    doc.getElementById('filaTextoBusquedaPrevia').hidden === true && /cerca de mí/.test(doc.getElementById('btnBuscarPrevia').textContent));

  const copia = P.indexar({
    viviendas: [
      [0, '2025-10-22', 'T48', 'MT04', 'San Pascual', 'Cra 14 # 14-14', 'KR 14 # 14 - 14', 3.443338, -76.526951, 'EBS033', 'Comuna 3',
        'Responsable Uno', 1, 3, 'Vivienda 5893 de la base anterior', null],
      [1, '2026-11-10', 'T48', 'MT04', 'San Pascual', 'KR 14 # 14 - 14 AP 2', 'KR 14 # 14 - 14', 3.4434, -76.52695, 'EBS033', null,
        'Responsable App', 1, 2, 'T48MT04H0001 · NUV0012', 'Sin consentimiento'],
      [0, '2025-03-01', 'T49', 'MT01', 'Otra', 'Vereda', null, 3.5, -76.6, 'EBS031', 'Comuna 1', 'Otra', 1, 1, null, null]
    ],
    documentos: [[0, '1143929903'], [1, '1143929903'], [2, '22222222']]
  }, { documento: '1144099001' });
  let res = P.buscarEnCopia(copia, P.prepararBusqueda('documento', '1143929903'));
  verificar('sin señal, por documento: las dos visitas, la más reciente primero',
    res.total === 2 && res.resultados[0].origen === 'app' && res.resultados[1].origen === 'previa');
  res = P.buscarEnCopia(copia, P.prepararBusqueda('direccion', 'Carrera 14 No. 14-14'));
  verificar('sin señal, por dirección escrita distinto', res.total === 2);
  res = P.buscarEnCopia(copia, P.prepararBusqueda('cercania', null, { latitud: 3.443338, longitud: -76.526951 }, 30));
  verificar('sin señal, cerca de mí: sólo las de menos de 30 m, con su distancia',
    res.total === 2 && res.resultados[0].distancia === 0 && res.resultados.every(function (r) { return r.distancia <= 30; }));

  P.pintarResultado(Object.assign({ fuente: 'copia', copia: { territorios: ['T48'], generada: '2026-11-18T15:00:00Z' } },
    P.buscarEnCopia(copia, P.prepararBusqueda('documento', '1143929903'))));
  const zona = doc.getElementById('resultadoBusquedaPrevia');
  verificar('el resultado avisa que ya fue caracterizada y dice qué coincidió',
    /Ya fue caracterizada/.test(zona.textContent) && /Mismo documento/.test(zona.textContent) && zona.querySelectorAll('.previa-item').length === 2);
  verificar('dice que se buscó en la copia del teléfono, sin señal', /Sin internet: se buscó en las viviendas guardadas en este teléfono \(actualizadas el/.test(zona.querySelector('.previa-fuente').textContent));
  verificar('el estado de la visita de la app se muestra si no está cerrada', /Sin consentimiento/.test(zona.textContent));
  verificar('fecha en palabras', /22 oct 2025/.test(zona.textContent) && P.fechaLegible('2026-11-10') === '10 nov 2026');

  P.pintarResultado({ fuente: 'servidor', modo: 'documento', total: 1, truncado: false, resultados: [{
    origen: 'previa', fecha: '2025-01-01', direccion: '<img src=x onerror="window.__inyectado=1">', responsable: '<b>x</b>',
    territorio: 'T48', personas: 1, familias: 1 }] });
  verificar('lo que llega se pinta como texto, nunca como HTML',
    zona.querySelector('img') === null && zona.querySelector('b') === null && /<img src=x/.test(zona.textContent) && !w.__inyectado);

  P.pintarResultado({ fuente: 'servidor', modo: 'direccion', buscado: 'KR 1 # 2 - 3', total: 0, truncado: false, resultados: [] });
  verificar('si no aparece, lo dice y sugiere otra forma de buscar',
    /No aparece caracterizada/.test(zona.textContent) && /pruebe con el documento/.test(zona.textContent));

  /* Sin señal y sin copia (jsdom no tiene IndexedDB): lo dice en vez de fallar. */
  Object.defineProperty(w.navigator, 'onLine', { configurable: true, get: function () { return false; } });
  doc.querySelector('input[value="documento"]').checked = true;
  doc.querySelector('input[value="documento"]').dispatchEvent(new w.Event('change'));
  campo.value = '1143929903';
  doc.getElementById('formYaCaracterizada').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await new Promise(function (r) { setTimeout(r, 20); });
  verificar('sin señal y sin copia: lo explica', /todavía no tiene viviendas guardadas/.test(zona.textContent), zona.textContent);

  const sinPermiso = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' }).window;
  sinPermiso.SESION = { usuario: function () { return null; }, puede: function () { return false; } };
  sinPermiso.eval(fs.readFileSync(path.join(RAIZ, 'cruce.js'), 'utf8'));
  sinPermiso.eval(fs.readFileSync(path.join(RAIZ, 'base_previa.js'), 'utf8'));
  verificar('sin el permiso, el panel no se muestra', sinPermiso.document.getElementById('panelYaCaracterizada').hidden === true);

  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  verificar('la aplicación sin señal lleva cruce.js y base_previa.js', /'\/cruce\.js'/.test(sw) && /'\/base_previa\.js'/.test(sw));

  console.log('\nPasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
