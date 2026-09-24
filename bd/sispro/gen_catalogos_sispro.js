/* =========================================================================
   Genera catalogos_sispro.js a partir de las tablas oficiales de SISPRO
   -------------------------------------------------------------------------
       node bd/sispro/gen_catalogos_sispro.js

   Tres catálogos del instrumento no los enumera el anexo técnico sino que
   remite a tablas de SISPRO: país de origen (ítem 65, variable 9), ocupación
   (ítem 73, variable 18) y EAPB (ítem 76, variable 21). Se generan desde
   bd/sispro/tablas/*.json —descargadas con descargar_tablas.js— para que el
   formulario, el seed de la base y el archivo plano usen exactamente los
   códigos oficiales.

   El resultado es un <script> más del navegador, sin exportaciones, igual
   que catalogos.js: lo cargan también las pruebas y el servidor (vm).
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const TABLAS = path.join(__dirname, 'tablas');
const DESTINO = path.join(RAIZ, 'catalogos_sispro.js');

function leer(nombre) {
  return JSON.parse(fs.readFileSync(path.join(TABLAS, nombre + '.json'), 'utf8'))
    .filter(function (fila) { return fila.habilitado === 'SI'; });
}

/* «REPÚBLICA DOMINICANA» → «República Dominicana». Las partículas van en
   minúscula salvo al inicio; lo que va entre paréntesis se respeta. */
const MENORES = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'en', 'parte'];

function tituloPropio(texto) {
  return String(texto).toLowerCase().split(/(\s+|-|\()/).map(function (parte, i) {
    if (!parte || /^\s+$/.test(parte) || parte === '-' || parte === '(') return parte;
    if (i > 0 && MENORES.indexOf(parte) !== -1) return parte;
    return parte.charAt(0).toUpperCase() + parte.slice(1);
  }).join('');
}

const REGIMEN_EAPB = { S: 'subsidiado', C: 'contributivo', P: 'excepcion', E: 'especial' };

const cadena = function (v) { return JSON.stringify(v); };

/* --- País de origen (tabla Pais) --------------------------------------
   El valor interno es el código ISO de dos letras: es la llave de cat.pais
   y de aps.persona.nacionalidad desde antes del anexo. El código SISPRO
   (numérico de tres dígitos, ISO 3166-1) va en `sispro`, que es lo que se
   reporta en la variable 9 del registro tipo 3. */
const PRIMEROS = ['CO', 'VE'];
const paises = leer('Pais').map(function (f) {
  return { valor: f.extra2, etiqueta: tituloPropio(f.nombre), sispro: f.codigo };
}).sort(function (a, b) {
  const pa = PRIMEROS.indexOf(a.valor);
  const pb = PRIMEROS.indexOf(b.valor);
  if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  return a.etiqueta.localeCompare(b.etiqueta, 'es');
});

/* --- Ocupación (tabla SGDCIUO) -----------------------------------------
   CIUO-08 A.C. a cuatro dígitos. 9998 agrupa a quien no tiene ocupación
   remunerada: jubilado, desempleado, ama de casa, estudiante, menor de edad. */
const ocupaciones = leer('SGDCIUO').map(function (f) {
  return { valor: f.codigo, etiqueta: f.nombre, sispro: f.codigo };
});

/* --- EAPB (tabla SGDCodigoEAPB) ----------------------------------------
   `regimen` alimenta la advertencia de coherencia con el ítem 75 (RN-075). */
const eapb = leer('SGDCodigoEAPB').map(function (f) {
  return {
    valor: f.codigo,
    etiqueta: f.nombre.replace(/\s+/g, ' ').trim(),
    regimen: REGIMEN_EAPB[f.extra1] || null,
    nit: f.extra3 || null,
    sispro: f.codigo
  };
}).sort(function (a, b) { return a.etiqueta.localeCompare(b.etiqueta, 'es'); });

function lista(nombre, filas, formato) {
  return 'const ' + nombre + ' = [\n' + filas.map(formato).join(',\n') + '\n];\n';
}

const salida = [
  '/* =========================================================================',
  '   Encuesta_APS — Catálogos oficiales de SISPRO',
  '   -------------------------------------------------------------------------',
  '   GENERADO por bd/sispro/gen_catalogos_sispro.js a partir de las tablas de',
  '   referencia públicas de SISPRO (bd/sispro/tablas). No editar a mano.',
  '',
  '     CAT_PAIS            ' + paises.length + ' países      — tabla Pais (ítem 65, variable 9)',
  '     CAT_OCUPACION_CIUO  ' + ocupaciones.length + ' ocupaciones — tabla SGDCIUO (ítem 73, variable 18)',
  '     CAT_EAPB            ' + eapb.length + ' entidades   — tabla SGDCodigoEAPB (ítem 76, variable 21)',
  '',
  '   `valor` es lo que guarda la ficha y `sispro` lo que se reporta en el',
  '   archivo plano APS124CCFP. Coinciden salvo en el país: la ficha guarda el',
  '   código ISO de dos letras (llave de cat.pais) y el reporte el numérico.',
  '   ========================================================================= */',
  '',
  "'use strict';",
  '',
  lista('CAT_PAIS', paises, function (p) {
    return '  { valor: ' + cadena(p.valor) + ', etiqueta: ' + cadena(p.etiqueta) + ', sispro: ' + cadena(p.sispro) + ' }';
  }),
  lista('CAT_OCUPACION_CIUO', ocupaciones, function (o) {
    return '  { valor: ' + cadena(o.valor) + ', etiqueta: ' + cadena(o.etiqueta) + ', sispro: ' + cadena(o.sispro) + ' }';
  }),
  '/* `regimen` según SISPRO: S subsidiado, C contributivo, P excepción, E especial. */',
  lista('CAT_EAPB', eapb, function (e) {
    return '  { valor: ' + cadena(e.valor) + ', etiqueta: ' + cadena(e.etiqueta) +
      ', regimen: ' + cadena(e.regimen) + ', nit: ' + cadena(e.nit) + ', sispro: ' + cadena(e.sispro) + ' }';
  })
].join('\n');

fs.writeFileSync(DESTINO, salida);
console.log('OK — países: ' + paises.length + ', ocupaciones: ' + ocupaciones.length + ', EAPB: ' + eapb.length);
console.log('     escrito en ' + DESTINO);
