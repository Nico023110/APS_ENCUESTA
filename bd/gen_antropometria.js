/* =========================================================================
   Genera antropometria_tablas.js a partir de las tablas oficiales de la OMS
   -------------------------------------------------------------------------
     node bd/gen_antropometria.js <carpeta con los seis .xlsx>

   Los archivos son los «expanded tables» que publica la OMS (cdn.who.int):
     wfl_boys.xlsx  wfl_girls.xlsx   peso para la longitud, 0 a 2 años
     wfh_boys.xlsx  wfh_girls.xlsx   peso para la talla, 2 a 5 años
     bmi_boys.xlsx  bmi_girls.xlsx   IMC para la edad, 5 a 19 años (OMS 2007)
   Páginas: who.int/tools/child-growth-standards/standards/weight-for-length-height
            who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age

   De cada fila se guardan L, M y S (Cole). Antes de escribir se comprueba que
   con esos tres números salen las columnas SD3neg … SD3 de la misma tabla: si
   una no cuadra, no se genera nada.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { leerXlsx } = require('./leer_xlsx.js');

const carpeta = process.argv[2];
if (!carpeta) { console.error('Uso: node bd/gen_antropometria.js <carpeta con los .xlsx de la OMS>'); process.exit(1); }

const FUENTES = [
  { tabla: 'longitud', sexo: 'hombre', archivo: 'wfl_boys.xlsx', columna: 'Length', inicio: 45, paso: 0.1, filas: 651 },
  { tabla: 'longitud', sexo: 'mujer', archivo: 'wfl_girls.xlsx', columna: 'Length', inicio: 45, paso: 0.1, filas: 651 },
  { tabla: 'talla', sexo: 'hombre', archivo: 'wfh_boys.xlsx', columna: 'Height', inicio: 65, paso: 0.1, filas: 551 },
  { tabla: 'talla', sexo: 'mujer', archivo: 'wfh_girls.xlsx', columna: 'Height', inicio: 65, paso: 0.1, filas: 551 },
  { tabla: 'imc', sexo: 'hombre', archivo: 'bmi_boys.xlsx', columna: 'Month', inicio: 61, paso: 1, filas: 168 },
  { tabla: 'imc', sexo: 'mujer', archivo: 'bmi_girls.xlsx', columna: 'Month', inicio: 61, paso: 1, filas: 168 }
];
const ESPERADAS = { SD3neg: -3, SD2neg: -2, SD1neg: -1, SD0: 0, SD1: 1, SD2: 2, SD3: 3 };

function numero(texto, donde) {
  const n = Number(texto);
  if (!isFinite(n)) throw new Error('No es un número: ' + texto + ' (' + donde + ')');
  return n;
}

/* El valor que corresponde a un puntaje z (Cole). */
function valorDe(l, m, s, z) {
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}

const salida = { longitud: {}, talla: {}, imc: {} };
let comprobados = 0;
let maximaDiferencia = 0;

FUENTES.forEach(function (f) {
  const { filas } = leerXlsx(fs.readFileSync(path.join(carpeta, f.archivo)));
  const cabeza = filas[0].map(function (c) { return String(c || '').trim(); });
  const indice = function (nombre) {
    const i = cabeza.indexOf(nombre);
    if (i === -1) throw new Error(f.archivo + ': no está la columna ' + nombre);
    return i;
  };
  const cuerpo = filas.slice(1).filter(function (x) { return x[0] !== null && String(x[0]).trim() !== ''; });
  if (cuerpo.length !== f.filas) throw new Error(f.archivo + ': ' + cuerpo.length + ' filas, se esperaban ' + f.filas);

  const L = [];
  const M = [];
  const S = [];
  cuerpo.forEach(function (fila, n) {
    const donde = f.archivo + ' fila ' + (n + 2);
    const clave = numero(fila[indice(f.columna)], donde);
    if (Math.abs(clave - (f.inicio + n * f.paso)) > 0.0001) throw new Error(donde + ': la fila no es la que se esperaba (' + clave + ')');
    const l = numero(fila[indice('L')], donde);
    const m = numero(fila[indice('M')], donde);
    const s = numero(fila[indice('S')], donde);
    Object.keys(ESPERADAS).forEach(function (columna) {
      const enTabla = numero(fila[indice(columna)], donde);
      /* Más allá de ±3 la OMS ajusta la curva; hasta ±3 es la fórmula. */
      const diferencia = Math.abs(valorDe(l, m, s, ESPERADAS[columna]) - enTabla);
      maximaDiferencia = Math.max(maximaDiferencia, diferencia);
      if (diferencia > 0.006) throw new Error(donde + ', ' + columna + ': ' + valorDe(l, m, s, ESPERADAS[columna]).toFixed(4) + ' ≠ ' + enTabla);
      comprobados++;
    });
    L.push(l); M.push(m); S.push(s);
  });

  const unaSolaL = L.every(function (x) { return x === L[0]; });
  salida[f.tabla][f.sexo] = { inicio: f.inicio, paso: f.paso, L: unaSolaL ? L[0] : L, M: M, S: S };
});

const texto = `/* =========================================================================
   Encuesta_APS — Tablas de la OMS para clasificar el estado nutricional
   -------------------------------------------------------------------------
   GENERADO por bd/gen_antropometria.js desde las tablas oficiales de la OMS
   (who.int): no se edita a mano. L, M y S de cada fila:
     longitud  peso para la longitud, 45 a 110 cm (menores de 2 años)
     talla     peso para la talla, 65 a 120 cm (2 a 5 años)
     imc       IMC para la edad, 61 a 228 meses (OMS 2007)
   Las usa antropometria.js (RN-096, Resolución 2465 de 2016).
   ========================================================================= */

(function (raiz) {
  'use strict';
  const TABLAS = ${JSON.stringify(salida)};
  if (typeof module !== 'undefined' && module.exports) module.exports = TABLAS;
  else raiz.TABLAS_OMS = TABLAS;
})(typeof window !== 'undefined' ? window : this);
`;
fs.writeFileSync(path.join(__dirname, '..', 'antropometria_tablas.js'), texto);
console.log('Comprobadas ' + comprobados + ' celdas; diferencia máxima ' + maximaDiferencia.toFixed(4) + '. Escrito antropometria_tablas.js (' + Math.round(texto.length / 1024) + ' KB)');
