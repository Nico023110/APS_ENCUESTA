/* =========================================================================
   Pruebas unitarias: familias ya caracterizadas antes (api/_antecedentes.js).
   Si alguna persona de la familia ya estaba en la base anterior o en otra
   ficha anterior de la app, la familia va en su segunda visita (CF002…). No
   tocan la base: el cliente es falso.
       node pruebas/antecedentes.test.js
   ========================================================================= */

'use strict';

const path = require('path');
const a = require(path.join(__dirname, '..', 'api', '_antecedentes.js'));

let pasadas = 0;
let fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const previa = { origen: 'base_previa', referencia: '4128', fichaId: null, fecha: '2025-09-23', ebs: 'EBS004', territorio: 'T78', personas: 1 };
const deLaApp = { origen: 'app', referencia: 'F-1', fichaId: 9, fecha: '2026-10-20', ebs: 'EBS035', territorio: 'T78', personas: 2 };
const fila = function (extra) {
  return Object.assign({ id: 11, consecutivo: 1, codigo_cf: 'CF001', visitas_anteriores: 0, visita: 1, antecedentes: [] }, extra);
};

console.log('\n=== CF según las visitas anteriores ===');
verificar('textoCf', a.textoCf(1) === 'CF001' && a.textoCf(2) === 'CF002' && a.textoCf(12) === 'CF012' && a.textoCf(0) === 'CF001');

let plan = a.planDeAntecedentes([fila()]);
verificar('Sin antecedentes: sigue en CF001 y no cambia nada', plan[0].codigoCf === 'CF001' && plan[0].cambia === false &&
  plan[0].visitasAnteriores === 0);
plan = a.planDeAntecedentes([fila({ antecedentes: [previa] })]);
verificar('Una caracterización anterior (base 2025–2026): CF002', plan[0].codigoCf === 'CF002' && plan[0].cambia === true &&
  plan[0].visitasAnteriores === 1);
plan = a.planDeAntecedentes([fila({ antecedentes: [previa, deLaApp] })]);
verificar('En la base anterior y en otra ficha de la app: CF003', plan[0].codigoCf === 'CF003' && plan[0].visitasAnteriores === 2);
plan = a.planDeAntecedentes([fila({ antecedentes: [previa], visita: 2, codigo_cf: 'CF002', visitas_anteriores: 0 })]);
verificar('Con una segunda visita de la ficha (completar integrantes) y una anterior: CF003',
  plan[0].codigoCf === 'CF003' && plan[0].cambia === true);
plan = a.planDeAntecedentes([fila({ codigo_cf: 'CF002', visitas_anteriores: 1 })]);
verificar('Si una corrección deja a la familia sin antecedentes, vuelve a CF001', plan[0].codigoCf === 'CF001' && plan[0].cambia === true);
plan = a.planDeAntecedentes([fila({ codigo_cf: 'CF002', visitas_anteriores: 1, antecedentes: [previa] })]);
verificar('Ya marcada igual: no cambia (se puede repetir)', plan[0].cambia === false);
verificar('Texto del antecedente', a.textoDeAntecedente(previa) === 'base anterior, vivienda 4128 (2025-09-23, EBS004)' &&
  a.textoDeAntecedente(deLaApp) === 'ficha F-1 (2026-10-20, EBS035)');

console.log('\n=== Consulta ===');
const sql = a.SQL_FAMILIAS_Y_ANTECEDENTES;
verificar('Cruza por número de documento en la base anterior y en la app',
  /hist\.persona hp\s+ON hp\.numero_id = pe\.numero/.test(sql) && /upper\(po\.numero_id\) = pe\.numero/.test(sql));
verificar('Las fichas de la app: otras y anteriores (por fecha y, a igual fecha, por id)',
  /fo\.id <> esta\.id/.test(sql) && /fo\.fecha_diligenciamiento < esta\.fecha_diligenciamiento/.test(sql) &&
  /fo\.id < esta\.id/.test(sql));
verificar('Cuenta la visita de la ficha (completar integrantes)', /aps\.visita_ficha/.test(sql));

(async function () {
  console.log('\n=== Guardar ===');
  function clienteFalso(filas) {
    const consultas = [];
    return {
      consultas: consultas,
      query: async function (texto, params) {
        consultas.push({ sql: texto, params: params });
        if (/WITH esta AS/.test(texto)) return { rows: filas };
        return { rows: [], rowCount: 0 };
      }
    };
  }

  let cliente = clienteFalso([fila(), fila({ id: 12, consecutivo: 2 })]);
  await a.registrarAntecedentes(cliente, 5, 7, 'disp');
  verificar('Sin coincidencias: una sola consulta, no escribe', cliente.consultas.length === 1);

  cliente = clienteFalso([fila({ antecedentes: [previa] }), fila({ id: 12, consecutivo: 2 })]);
  const resultado = await a.registrarAntecedentes(cliente, 5, 7, 'disp');
  const sqls = cliente.consultas.map(function (c) { return c.sql; });
  verificar('Con coincidencias: rehace el vínculo, cambia el CF y lo anota en la auditoría',
    sqls.some(function (s) { return /DELETE FROM aps\.familia_antecedente/.test(s); }) &&
    sqls.some(function (s) { return /INSERT INTO aps\.familia_antecedente/.test(s); }) &&
    sqls.some(function (s) { return /UPDATE aps\.familia_ficha/.test(s); }) &&
    sqls.some(function (s) { return /INSERT INTO aud\.evento/.test(s) && /'codigo_cf'/.test(s); }),
    JSON.stringify(sqls.map(function (s) { return s.trim().slice(0, 40); })));
  const actualizacion = cliente.consultas.find(function (c) { return /UPDATE aps\.familia_ficha/.test(c.sql); });
  verificar('Sólo actualiza la familia que cambia, a CF002 con 1 visita anterior',
    actualizacion.params[0].join(',') === '11' && actualizacion.params[1].join(',') === '1' &&
    actualizacion.params[2].join(',') === 'CF002');
  const auditoria = cliente.consultas.find(function (c) { return /INSERT INTO aud\.evento/.test(c.sql); });
  verificar('La auditoría dice de dónde venía: CF001 → CF002 y la vivienda anterior',
    auditoria.params[2].join(',') === 'CF001' && /^CF002: ya caracterizada antes en base anterior, vivienda 4128/.test(auditoria.params[3][0]) &&
    auditoria.params[4] === 7);
  verificar('Devuelve el plan por familia, en su orden', resultado.length === 2 && resultado[0].codigoCf === 'CF002' &&
    resultado[1].codigoCf === 'CF001');
  verificar('Todo con parámetros: ningún documento ni referencia pegados al SQL',
    cliente.consultas.every(function (c) { return c.sql.indexOf('4128') < 0; }));

  console.log('\nPasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
})();
