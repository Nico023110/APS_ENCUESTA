/* =========================================================================
   Encuesta_APS — Libro de Excel (.xlsx) sin dependencias
   -------------------------------------------------------------------------
   Arma un .xlsx (Office Open XML) con lo que trae Node: el XML de cada hoja
   y un ZIP escrito a mano con zlib. No se añade una librería de terceros a
   un archivo que lleva datos personales de toda la red.

   Lo que admite cada hoja, y nada más:
     - una fila de grupos (secciones, con celdas combinadas) y una de títulos;
     - filas de datos: texto, número o vacío;
     - ancho por columna, paneles inmovilizados y autofiltro;
     - filas de texto libre antes de la tabla (hoja de resumen).
   Los textos van en línea (inlineStr): no hace falta tabla de cadenas.
   ========================================================================= */

'use strict';

const zlib = require('zlib');

/* ---------- ZIP ---------- */

const TABLA_CRC = (function () {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buffer) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) c = TABLA_CRC[(c ^ buffer[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* Fecha y hora en el formato de MS-DOS que guarda el ZIP. */
function fechaDos(fecha) {
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  return { hora: hora, dia: dia };
}

function zip(archivos, fecha) {
  const dos = fechaDos(fecha || new Date());
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;

  archivos.forEach(function (archivo) {
    const nombre = Buffer.from(archivo.nombre, 'utf8');
    const datos = Buffer.isBuffer(archivo.datos) ? archivo.datos : Buffer.from(archivo.datos, 'utf8');
    const comprimido = zlib.deflateRawSync(datos, { level: 9 });
    const crc = crc32(datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034B50, 0);
    local.writeUInt16LE(20, 4);            // versión necesaria
    local.writeUInt16LE(0x0800, 6);        // nombres en UTF-8
    local.writeUInt16LE(8, 8);             // deflate
    local.writeUInt16LE(dos.hora, 10);
    local.writeUInt16LE(dos.dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, comprimido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014B50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dos.hora, 12);
    central.writeUInt16LE(dos.dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);

    desplazamiento += local.length + nombre.length + comprimido.length;
  });

  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054B50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat(locales.concat([directorio, fin]));
}

/* ---------- XML ---------- */

/* Escapa y quita lo que XML 1.0 no admite (caracteres de control). */
function xml(valor) {
  return String(valor)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function letraColumna(indice) {
  let n = indice + 1;
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

/* Estilos (índice en cellXfs): 0 normal · 1 título de columna · 2 grupo ·
   3 texto con ajuste · 4 título del libro · 5 etiqueta del resumen. */
const ESTILO = { normal: 0, titulo: 1, grupo: 2, ajustado: 3, tituloLibro: 4, etiqueta: 5 };

const ESTILOS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="4">' +
    '<font><sz val="10"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FF0B3A5B"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="14"/><color rgb="FF0B3A5B"/><name val="Calibri"/><family val="2"/></font>' +
  '</fonts>' +
  '<fills count="4">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0060A0"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE3EEF7"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFC9D6E2"/></left><right style="thin"><color rgb="FFC9D6E2"/></right>' +
      '<top style="thin"><color rgb="FFC9D6E2"/></top><bottom style="thin"><color rgb="FFC9D6E2"/></bottom><diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
      '<alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
      '<alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function celda(referencia, valor, estilo) {
  const s = estilo ? ' s="' + estilo + '"' : '';
  if (valor === null || valor === undefined || valor === '') return estilo ? '<c r="' + referencia + '"' + s + '/>' : '';
  if (typeof valor === 'number' && isFinite(valor)) return '<c r="' + referencia + '"' + s + '><v>' + valor + '</v></c>';
  return '<c r="' + referencia + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xml(valor) + '</t></is></c>';
}

/**
 * Hoja de tabla.
 * @param hoja.columnas  [{ titulo, grupo?, ancho? }]
 * @param hoja.filas     [[valor, …]]
 * @param hoja.antes     filas de texto libre antes de la tabla: [[valor, estilo?], …]
 * @param hoja.fijas     columnas inmovilizadas a la izquierda (por defecto 1)
 * @param hoja.anchos    anchos de columna de una hoja sin tabla
 */
function hojaXml(hoja) {
  const columnas = hoja.columnas || [];
  const antes = hoja.antes || [];
  const hayGrupos = columnas.some(function (c) { return c.grupo; });
  const filas = [];
  const combinadas = [];
  let numero = 0;

  antes.forEach(function (linea) {
    numero++;
    filas.push('<row r="' + numero + '">' + linea.map(function (v, i) {
      const valor = Array.isArray(v) ? v[0] : v;
      const estilo = Array.isArray(v) ? v[1] : 0;
      return celda(letraColumna(i) + numero, valor, estilo);
    }).join('') + '</row>');
  });

  if (columnas.length) {
    if (hayGrupos) {
      numero++;
      let inicio = 0;
      const celdas = [];
      for (let i = 0; i <= columnas.length; i++) {
        const cambia = i === columnas.length || (columnas[i].grupo || '') !== (columnas[inicio].grupo || '');
        if (!cambia) continue;
        celdas.push(celda(letraColumna(inicio) + numero, columnas[inicio].grupo || '', ESTILO.grupo));
        for (let j = inicio + 1; j < i; j++) celdas.push(celda(letraColumna(j) + numero, '', ESTILO.grupo));
        if (i - inicio > 1) combinadas.push(letraColumna(inicio) + numero + ':' + letraColumna(i - 1) + numero);
        inicio = i;
      }
      filas.push('<row r="' + numero + '" ht="18" customHeight="1">' + celdas.join('') + '</row>');
    }
    numero++;
    const filaTitulos = numero;
    filas.push('<row r="' + numero + '" ht="45" customHeight="1">' +
      columnas.map(function (c, i) { return celda(letraColumna(i) + numero, c.titulo, ESTILO.titulo); }).join('') + '</row>');

    (hoja.filas || []).forEach(function (fila) {
      numero++;
      filas.push('<row r="' + numero + '">' +
        fila.map(function (v, i) { return celda(letraColumna(i) + numero, v, 0); }).join('') + '</row>');
    });
    hoja.filaTitulos = filaTitulos;
  }

  const ultimaColumna = letraColumna(Math.max(columnas.length, 1) - 1);
  /* Sin tabla, los anchos los da `anchos` (la hoja de resumen). */
  const medidas = columnas.length ? columnas : (hoja.anchos || [60, 60]).map(function (a) { return { ancho: a }; });
  const ancho = '<cols>' + medidas.map(function (c, i) {
    return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.ancho || 18) + '" customWidth="1"/>';
  }).join('') + '</cols>';

  let vista = '<sheetViews><sheetView workbookViewId="0"' + (hoja.seleccionada ? ' tabSelected="1"' : '') + '/></sheetViews>';
  if (columnas.length) {
    const fijas = hoja.fijas === undefined ? 1 : hoja.fijas;
    const arriba = hoja.filaTitulos;
    const esquina = letraColumna(fijas) + (arriba + 1);
    vista = '<sheetViews><sheetView workbookViewId="0"' + (hoja.seleccionada ? ' tabSelected="1"' : '') + '>' +
      '<pane' + (fijas ? ' xSplit="' + fijas + '"' : '') + ' ySplit="' + arriba + '" topLeftCell="' + esquina + '"' +
      ' activePane="' + (fijas ? 'bottomRight' : 'bottomLeft') + '" state="frozen"/>' +
      '<selection pane="' + (fijas ? 'bottomRight' : 'bottomLeft') + '" activeCell="' + esquina + '" sqref="' + esquina + '"/>' +
      '</sheetView></sheetViews>';
  }

  const dimension = '<dimension ref="A1:' + ultimaColumna + Math.max(numero, 1) + '"/>';
  const filtro = columnas.length && (hoja.filas || []).length
    ? '<autoFilter ref="A' + hoja.filaTitulos + ':' + ultimaColumna + numero + '"/>' : '';
  hoja.rangoFiltro = filtro ? { desde: hoja.filaTitulos, hasta: numero, columna: ultimaColumna } : null;
  const combinar = combinadas.length
    ? '<mergeCells count="' + combinadas.length + '">' + combinadas.map(function (r) { return '<mergeCell ref="' + r + '"/>'; }).join('') + '</mergeCells>'
    : '';

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    dimension + vista + '<sheetFormatPr defaultRowHeight="15"/>' + ancho +
    '<sheetData>' + filas.join('') + '</sheetData>' + filtro + combinar +
    '<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>';
}

/* Excel no admite en el nombre de la hoja : \ / ? * [ ] ni más de 31 caracteres. */
function nombreDeHoja(nombre) {
  return String(nombre).replace(/[:\\/?*\[\]]/g, ' ').slice(0, 31);
}

/**
 * @param libro.hojas   [{ nombre, columnas, filas, antes?, fijas? }]
 * @param libro.titulo  título del documento (propiedades)
 * @param libro.autor
 * @returns Buffer con el .xlsx
 */
function crearLibro(libro) {
  const hojas = libro.hojas;
  hojas[0].seleccionada = true;
  const ahora = libro.fecha || new Date();
  const iso = ahora.toISOString().replace(/\.\d{3}Z$/, 'Z');
  /* Las hojas primero: el libro necesita saber el rango de cada autofiltro. */
  const xmlHojas = hojas.map(hojaXml);
  const nombres = hojas.map(function (h, i) {
    if (!h.rangoFiltro) return '';
    const hojaCitada = "'" + nombreDeHoja(h.nombre).replace(/'/g, "''") + "'";
    return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + xml(hojaCitada) +
      '!$A$' + h.rangoFiltro.desde + ':$' + h.rangoFiltro.columna + '$' + h.rangoFiltro.hasta + '</definedName>';
  }).join('');

  const archivos = [
    { nombre: '[Content_Types].xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      hojas.map(function (h, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>' },
    { nombre: '_rels/.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>' },
    { nombre: 'docProps/core.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xml(libro.titulo || '') + '</dc:title><dc:creator>' + xml(libro.autor || '') + '</dc:creator>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified>' +
      '</cp:coreProperties>' },
    { nombre: 'docProps/app.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Encuesta APS</Application></Properties>' },
    { nombre: 'xl/workbook.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="0"/></bookViews>' +
      '<sheets>' + hojas.map(function (h, i) {
        return '<sheet name="' + xml(nombreDeHoja(h.nombre)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join('') + '</sheets>' +
      /* El autofiltro de cada hoja lleva su nombre definido oculto. */
      (nombres ? '<definedNames>' + nombres + '</definedNames>' : '') +
      '</workbook>' },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      hojas.map(function (h, i) {
        return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      }).join('') +
      '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' },
    { nombre: 'xl/styles.xml', datos: ESTILOS_XML }
  ];
  xmlHojas.forEach(function (datos, i) { archivos.push({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', datos: datos }); });
  return zip(archivos, ahora);
}

module.exports = { crearLibro, ESTILO, letraColumna, crc32 };
