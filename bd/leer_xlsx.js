/* =========================================================================
   Encuesta_APS — Leer un libro de Excel (.xlsx) sin dependencias
   -------------------------------------------------------------------------
   La contraparte de api/_xlsx.js, con la misma razón: los Excel que entran
   aquí llevan datos personales de toda la red, y no se les pasa por una
   librería de terceros. Node trae lo necesario: un .xlsx es un ZIP (zlib) con
   una hoja en XML y una tabla de textos compartidos.

   Lee la primera hoja (o la que se nombre) y devuelve sus filas como
   arreglos de textos, en el orden de las columnas:

     const { filas } = leerXlsx(buffer);           // filas[0] = encabezados
     const { filas } = leerXlsx(buffer, { hoja: 'BD GENERAL' });

   Cada celda llega como texto (o null si está vacía): los números tal como
   los guardó Excel («45933» para una fecha, «3443338» para una coordenada).
   Interpretar fechas o decimales es de quien conoce la columna. Para eso,
   fechaDeSerial(45933) = '2025-10-03'.
   ========================================================================= */

'use strict';

const zlib = require('zlib');

/* ---------- ZIP ---------- */

const FIRMA_FIN_DIRECTORIO = 0x06054b50;
const FIRMA_ENTRADA_DIRECTORIO = 0x02014b50;
const FIRMA_ENCABEZADO_LOCAL = 0x04034b50;

function entradasDelZip(buffer) {
  /* El fin del directorio central está al final, antes de un comentario de
     hasta 64 KB. */
  let fin = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
    if (buffer.readUInt32LE(i) === FIRMA_FIN_DIRECTORIO) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no es un .xlsx (no se encontró el índice del ZIP).');

  const total = buffer.readUInt16LE(fin + 10);
  let posicion = buffer.readUInt32LE(fin + 16);
  const entradas = new Map();

  for (let n = 0; n < total; n++) {
    if (buffer.readUInt32LE(posicion) !== FIRMA_ENTRADA_DIRECTORIO) {
      throw new Error('El índice del ZIP está dañado.');
    }
    const metodo = buffer.readUInt16LE(posicion + 10);
    const comprimido = buffer.readUInt32LE(posicion + 20);
    const largoNombre = buffer.readUInt16LE(posicion + 28);
    const largoExtra = buffer.readUInt16LE(posicion + 30);
    const largoComentario = buffer.readUInt16LE(posicion + 32);
    const local = buffer.readUInt32LE(posicion + 42);
    const nombre = buffer.toString('utf8', posicion + 46, posicion + 46 + largoNombre);
    entradas.set(nombre, { metodo: metodo, comprimido: comprimido, local: local });
    posicion += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

function leerEntrada(buffer, entradas, nombre) {
  const entrada = entradas.get(nombre);
  if (!entrada) return null;
  const p = entrada.local;
  if (buffer.readUInt32LE(p) !== FIRMA_ENCABEZADO_LOCAL) throw new Error('Entrada dañada en el ZIP: ' + nombre);
  const inicio = p + 30 + buffer.readUInt16LE(p + 26) + buffer.readUInt16LE(p + 28);
  const datos = buffer.subarray(inicio, inicio + entrada.comprimido);
  if (entrada.metodo === 0) return Buffer.from(datos);
  if (entrada.metodo === 8) return zlib.inflateRawSync(datos);
  throw new Error('Compresión no admitida en ' + nombre + ' (método ' + entrada.metodo + ').');
}

/* ---------- XML ---------- */

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function texto(xml) {
  return xml.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, function (todo, cuerpo) {
    if (cuerpo.charAt(0) === '#') {
      const codigo = cuerpo.charAt(1) === 'x' ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10);
      return isFinite(codigo) ? String.fromCodePoint(codigo) : todo;
    }
    return Object.prototype.hasOwnProperty.call(ENTIDADES, cuerpo) ? ENTIDADES[cuerpo] : todo;
  });
}

/* Todo el texto de un <si> o de un <is>: un texto plano (<t>) o con formato
   por tramos (<r><t>…</t></r>). Las guías fonéticas (<rPh>) no son texto. */
function textoDeTramos(xml) {
  const limpio = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let salida = '';
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(limpio)) !== null) salida += m[1] ? texto(m[1]) : '';
  return salida;
}

function atributo(atributos, nombre) {
  const m = new RegExp('\\b' + nombre + '="([^"]*)"').exec(atributos);
  return m ? texto(m[1]) : null;
}

function indiceDeColumna(referencia) {
  const letras = /^[A-Z]+/.exec(referencia);
  if (!letras) return -1;
  let indice = 0;
  for (const letra of letras[0]) indice = indice * 26 + (letra.charCodeAt(0) - 64);
  return indice - 1;
}

/* ---------- Libro ---------- */

function rutaDeLaHoja(buffer, entradas, nombreHoja) {
  const libro = leerEntrada(buffer, entradas, 'xl/workbook.xml');
  const relaciones = leerEntrada(buffer, entradas, 'xl/_rels/workbook.xml.rels');
  if (!libro || !relaciones) return 'xl/worksheets/sheet1.xml';

  const hojas = [];
  const reHoja = /<sheet\b([^>]*)\/?>/g;
  let m;
  const xmlLibro = libro.toString('utf8');
  while ((m = reHoja.exec(xmlLibro)) !== null) {
    hojas.push({ nombre: atributo(m[1], 'name'), relacion: atributo(m[1], 'r:id') });
  }
  const elegida = nombreHoja
    ? hojas.find(function (h) { return h.nombre === nombreHoja; })
    : hojas[0];
  if (!elegida) throw new Error('El libro no tiene la hoja «' + nombreHoja + '».');

  const xmlRelaciones = relaciones.toString('utf8');
  const reRelacion = /<Relationship\b([^>]*)\/?>/g;
  while ((m = reRelacion.exec(xmlRelaciones)) !== null) {
    if (atributo(m[1], 'Id') === elegida.relacion) {
      const destino = atributo(m[1], 'Target').replace(/^\//, '');
      return { ruta: destino.indexOf('xl/') === 0 ? destino : 'xl/' + destino, nombre: elegida.nombre };
    }
  }
  throw new Error('No se encontró el archivo de la hoja «' + elegida.nombre + '».');
}

/**
 * @param {Buffer} buffer el .xlsx
 * @param {{hoja?:string}} [opciones]
 * @returns {{hoja:string, filas:(string|null)[][]}}
 */
function leerXlsx(buffer, opciones) {
  const entradas = entradasDelZip(buffer);
  const destino = rutaDeLaHoja(buffer, entradas, opciones && opciones.hoja);
  const ruta = typeof destino === 'string' ? destino : destino.ruta;

  const compartidos = [];
  const xmlCompartidos = leerEntrada(buffer, entradas, 'xl/sharedStrings.xml');
  if (xmlCompartidos) {
    const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
    const xml = xmlCompartidos.toString('utf8');
    let m;
    while ((m = re.exec(xml)) !== null) compartidos.push(m[1] ? textoDeTramos(m[1]) : '');
  }

  const hoja = leerEntrada(buffer, entradas, ruta);
  if (!hoja) throw new Error('El libro no trae la hoja ' + ruta + '.');
  const xml = hoja.toString('utf8');

  const filas = [];
  const reFila = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  const reCelda = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let fila;
  while ((fila = reFila.exec(xml)) !== null) {
    const numero = Number(atributo(fila[1], 'r'));
    const valores = [];
    if (fila[2]) {
      let celda;
      let siguiente = 0;
      reCelda.lastIndex = 0;
      while ((celda = reCelda.exec(fila[2])) !== null) {
        const referencia = atributo(celda[1], 'r');
        const columna = referencia ? indiceDeColumna(referencia) : siguiente;
        siguiente = columna + 1;
        const tipo = atributo(celda[1], 't');
        const cuerpo = celda[2] || '';
        let valor = null;
        if (tipo === 'inlineStr') {
          const is = /<is\b[^>]*>([\s\S]*?)<\/is>/.exec(cuerpo);
          valor = is ? textoDeTramos(is[1]) : null;
        } else {
          const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cuerpo);
          if (v) {
            valor = tipo === 's' ? (compartidos[Number(v[1])] !== undefined ? compartidos[Number(v[1])] : null) : texto(v[1]);
          }
        }
        if (valor !== null && valor !== '') valores[columna] = valor;
      }
    }
    /* Las filas pueden saltarse (vacías): se respeta su número. */
    const indice = isFinite(numero) && numero > 0 ? numero - 1 : filas.length;
    for (let i = 0; i < valores.length; i++) if (valores[i] === undefined) valores[i] = null;
    filas[indice] = valores;
  }
  for (let i = 0; i < filas.length; i++) if (filas[i] === undefined) filas[i] = [];

  return { hoja: typeof destino === 'string' ? null : destino.nombre, filas: filas };
}

/* Excel cuenta los días desde el 30 de diciembre de 1899 (con su 29 de
   febrero de 1900 inexistente ya compensado en esa fecha base). */
function fechaDeSerial(serial) {
  const n = Number(serial);
  if (!isFinite(n) || n < 1 || n > 2958465) return null;
  const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return fecha.toISOString().slice(0, 10);
}

module.exports = { leerXlsx, fechaDeSerial, indiceDeColumna };
