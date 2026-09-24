/* =========================================================================
   Genera api/_diccionario_sispro.js desde el anexo técnico APS124CCFP
   -------------------------------------------------------------------------
       node bd/sispro/gen_diccionario.js

   El archivo plano del SI-APS tiene 6 variables en el registro tipo 1, 125
   en el tipo 2 y 119 en el tipo 3, cada una con su nombre, longitud máxima,
   tipo de dato (N, A, D, F, T) y obligatoriedad. Escribirlas a mano sería
   copiar 250 filas con el riesgo de equivocar una; se leen de las tablas
   resumen del anexo (bd/sispro/anexo_APS124CCFP_v7.md), que es el documento
   oficial del Ministerio (versión 7, junio de 2026).

   El resultado es un módulo del servidor: sólo lo usa el generador del
   archivo plano (api/_reporte_sispro.js). Qué dato va en cada variable no
   sale de aquí sino de allí; este diccionario sólo dice cómo debe ir.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const ANEXO = path.join(__dirname, 'anexo_APS124CCFP_v7.md');
const DESTINO = path.join(RAIZ, 'api', '_diccionario_sispro.js');

/* Cada tabla resumen empieza en un título «Tabla Resumen de Campos – Tipo N». */
const FILA = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*([NADFT])\s*\|\s*(SI|NO)\s*\|/;

function leerTablas(texto) {
  const tablas = {};
  let tipoActual = null;
  texto.split(/\r?\n/).forEach(function (linea) {
    const titulo = /Tabla Resumen de Campos – Tipo (\d)/.exec(linea);
    if (titulo) { tipoActual = Number(titulo[1]); tablas[tipoActual] = []; return; }
    if (tipoActual === null) return;
    if (/^#/.test(linea)) { tipoActual = null; return; }
    const m = FILA.exec(linea);
    if (!m) return;
    tablas[tipoActual].push({
      n: Number(m[1]),
      nombre: m[2].replace(/\s+/g, ' '),
      max: Number(m[3]),
      tipo: m[4],
      requerido: m[5] === 'SI'
    });
  });
  return tablas;
}

function verificar(tablas) {
  const esperado = { 1: 6, 2: 125, 3: 119 };
  Object.keys(esperado).forEach(function (tipo) {
    const filas = tablas[tipo] || [];
    if (filas.length !== esperado[tipo]) {
      throw new Error('Tipo ' + tipo + ': se esperaban ' + esperado[tipo] + ' variables y se leyeron ' + filas.length);
    }
    filas.forEach(function (fila, i) {
      if (fila.n !== i) throw new Error('Tipo ' + tipo + ': la variable ' + fila.n + ' está fuera de orden');
    });
  });
}

function generar() {
  const tablas = leerTablas(fs.readFileSync(ANEXO, 'utf8'));
  verificar(tablas);

  const bloque = function (tipo) {
    return '[\n' + tablas[tipo].map(function (f) {
      return '  { n: ' + f.n + ', nombre: ' + JSON.stringify(f.nombre) + ', max: ' + f.max +
        ", tipo: '" + f.tipo + "', requerido: " + f.requerido + ' }';
    }).join(',\n') + '\n]';
  };

  const salida = [
    '/* =========================================================================',
    '   Diccionario de variables del archivo plano APS124CCFP (SI-APS)',
    '   -------------------------------------------------------------------------',
    '   GENERADO por bd/sispro/gen_diccionario.js desde las tablas resumen del',
    '   anexo técnico (bd/sispro/anexo_APS124CCFP_v7.md, versión 7, junio 2026).',
    '   No se edita a mano: se corrige el anexo o el generador y se regenera.',
    '',
    '   tipo: N numérico entero · A alfanumérico · D decimal · F fecha · T texto',
    '   ========================================================================= */',
    '',
    "'use strict';",
    '',
    'const TIPO_1 = ' + bloque(1) + ';',
    '',
    'const TIPO_2 = ' + bloque(2) + ';',
    '',
    'const TIPO_3 = ' + bloque(3) + ';',
    '',
    'module.exports = { TIPO_1, TIPO_2, TIPO_3 };',
    ''
  ].join('\n');

  fs.writeFileSync(DESTINO, salida);
  console.log('Escrito ' + path.relative(RAIZ, DESTINO) + ': ' +
    tablas[1].length + ' + ' + tablas[2].length + ' + ' + tablas[3].length + ' variables.');
}

generar();
