/* =========================================================================
   Pruebas unitarias: completitud de una ficha para el archivo plano
   (api/_completitud.js). Una ficha está completa con todos los integrantes
   del ítem 51 y una familia en cada hogar del ítem 28; si estaba incompleta
   en la base y un guardado la completa, se anota en aud.evento. No tocan la
   base: el cliente es falso.
       node pruebas/completitud.test.js
   ========================================================================= */

'use strict';

const path = require('path');
const c = require(path.join(__dirname, '..', 'api', '_completitud.js'));

let pasadas = 0;
let fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const persona = function () { return { primerNombre: 'P' }; };
const familia = function (declarados, capturados, hogar) {
  return { numeroIntegrantes: declarados, integrantes: Array.from({ length: capturados }, persona), hogarNumero: hogar };
};

console.log('\n=== Faltantes ===');
let f = c.faltantesDeFicha({ hogaresEnVivienda: 1, familias: [familia(3, 3, 1)] });
verificar('Completa: nada falta', f.integrantes === 0 && f.hogares === 0, JSON.stringify(f));
f = c.faltantesDeFicha({ hogaresEnVivienda: 1, familias: [familia(3, 1, 1), familia(2, 1, 1)] });
verificar('Integrantes: suma por familia (2 + 1)', f.integrantes === 3 && f.hogares === 0, JSON.stringify(f));
f = c.faltantesDeFicha({ hogaresEnVivienda: 3, familias: [familia(1, 1, 1), familia(1, 1, 1)] });
verificar('Hogares: se cuentan distintos, no familias (1 de 3)', f.hogares === 2, JSON.stringify(f));
f = c.faltantesDeFicha({ hogaresEnVivienda: 2, familias: [familia(1, 1, undefined), familia(1, 1, undefined)] });
verificar('Familias sin hogar elegido cuentan como hogar propio', f.hogares === 0, JSON.stringify(f));
f = c.faltantesDeFicha({ hogaresEnVivienda: 2, familias: [] });
verificar('Sin familias no se cuentan hogares', f.hogares === 0 && f.integrantes === 0, JSON.stringify(f));
verificar('estaCompleta', c.estaCompleta({ hogaresEnVivienda: 1, familias: [familia(2, 2, 1)] }) &&
  !c.estaCompleta({ hogaresEnVivienda: 1, familias: [familia(2, 1, 1)] }));

console.log('\n=== Anotar cuándo quedó completa ===');
(async function () {
  const consultas = [];
  const cliente = { query: async function (sql, params) { consultas.push({ sql: sql, params: params }); return { rows: [] }; } };
  const antes = { hogaresEnVivienda: 1, familias: [familia(3, 1, 1)] };
  const despues = { hogaresEnVivienda: 1, familias: [familia(3, 3, 1)] };

  let anotada = await c.anotarSiQuedoCompleta(cliente, 7, antes, despues, 100, 'disp');
  verificar('Incompleta → completa: se anota', anotada && consultas.length === 1 &&
    /INSERT INTO aud\.evento/.test(consultas[0].sql) && /'completitud'/.test(consultas[0].sql) &&
    consultas[0].params[0] === 7 && /faltaban 2 integrante/.test(consultas[0].params[1]));

  consultas.length = 0;
  anotada = await c.anotarSiQuedoCompleta(cliente, 7, antes, { hogaresEnVivienda: 1, familias: [familia(3, 2, 1)] }, 100, null);
  verificar('Sigue incompleta: no se anota', !anotada && consultas.length === 0);

  anotada = await c.anotarSiQuedoCompleta(cliente, 7, despues, despues, 100, null);
  verificar('Ya estaba completa: no se anota (no cambia su período)', !anotada && consultas.length === 0);

  anotada = await c.anotarSiQuedoCompleta(cliente, 7, null, despues, 100, null);
  verificar('Ficha nueva (sin «antes»): no se anota', !anotada && consultas.length === 0);

  console.log('\n=== SQL ===');
  verificar('La condición SQL mira integrantes y hogares',
    /numero_integrantes >/.test(c.SQL_FICHA_INCOMPLETA) && /hogares_en_vivienda >/.test(c.SQL_FICHA_INCOMPLETA));
  verificar('La fecha de completitud sale de aud.evento en hora de Colombia',
    /America\/Bogota/.test(c.SQL_COMPLETADA_EL) && /'completitud', 'integrantes'/.test(c.SQL_COMPLETADA_EL));

  console.log('\nPasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
})();
