/* =========================================================================
   Tableros de población en el servidor (api/_tablero.js), sin base
   -------------------------------------------------------------------------
       node pruebas/tablero_api.test.js

   Comprueba la validación de los filtros, que los valores de la petición
   viajan como parámetros y nunca dentro del SQL, que las opciones de los
   filtros se piden sin los demás filtros, y cómo se arma la respuesta a
   partir de las filas (totales, categorías con y sin sexo, comunas y
   territorios ordenados). La consulta contra una base real la cubre la
   prueba manual con la copia local.
   ========================================================================= */

'use strict';

const tablero = require('../api/_tablero.js');

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

async function principal() {
  console.log('\n=== 1. Validación de los filtros ===');
  const bien = tablero.validar({ desde: '2024-01-01', hasta: '2026-10-29', ebs: 'EBS007', comuna: '18', territorio: 't52' });
  verificar('acepta un período con filtros y normaliza el territorio',
    !bien.error && bien.ebs === 'EBS007' && bien.comuna === '18' && bien.territorio === 'T52', JSON.stringify(bien));
  verificar('sin filtros quedan en null', JSON.stringify(tablero.validar({ desde: '2026-01-01', hasta: '2026-01-31' })) ===
    JSON.stringify({ desde: '2026-01-01', hasta: '2026-01-31', ebs: null, comuna: null, territorio: null }));
  [
    [{ desde: '2026-02-30', hasta: '2026-03-01' }, 'fecha que no existe'],
    [{ desde: '2026-03-01' }, 'falta una fecha'],
    [{ desde: '2026-03-02', hasta: '2026-03-01' }, 'fechas al revés'],
    [{ desde: '2020-01-01', hasta: '2026-03-01' }, 'más de cinco años'],
    [{ desde: '2026-01-01', hasta: '2026-03-01', ebs: "EBS'; --" }, 'EBS con caracteres raros'],
    [{ desde: '2026-01-01', hasta: '2026-03-01', comuna: "1'; DROP" }, 'comuna con caracteres raros'],
    [{ desde: '2026-01-01', hasta: '2026-03-01', territorio: 'T48 OR 1=1' }, 'territorio que no es un código']
  ].forEach(function (caso) {
    verificar('rechaza: ' + caso[1], !!tablero.validar(caso[0]).error, JSON.stringify(tablero.validar(caso[0])));
  });
  verificar('cinco años exactos menos un día sí pasan', !tablero.validar({ desde: '2021-11-01', hasta: '2026-10-29' }).error);

  console.log('\n=== 2. La consulta: parámetros, nunca texto de la petición ===');
  const consultas = [];
  const pool = {
    query: function (sql, parametros) {
      consultas.push({ sql: sql, parametros: parametros });
      if (/primera/.test(sql) && /ultima/.test(sql)) return Promise.resolve({ rows: [{ primera: '2026-08-25', ultima: '2026-10-13' }] });
      if (/'territorio', sel\.territorio, min/.test(sql)) {
        return Promise.resolve({ rows: [
          { tipo: 'ebs', valor: 'EBS007', comuna: null }, { tipo: 'ebs', valor: 'EBS006', comuna: null },
          { tipo: 'comuna', valor: '20', comuna: null }, { tipo: 'comuna', valor: 'sin', comuna: null },
          { tipo: 'comuna', valor: '3', comuna: null }, { tipo: 'comuna', valor: 'Rural', comuna: null },
          { tipo: 'territorio', valor: 'T163', comuna: '1' }, { tipo: 'territorio', valor: 'T48', comuna: '3' },
          { tipo: 'territorio', valor: 'T55', comuna: 'Rural' }
        ] });
      }
      return Promise.resolve({ rows: [
        { dim: 'total', valor: 'viviendas', sexo: null, n: 12 },
        { dim: 'total', valor: 'personas', sexo: null, n: 23 },
        { dim: 'estrato', valor: 'bajo', sexo: null, n: 4 },
        { dim: 'estrato', valor: null, sexo: null, n: 1 },
        { dim: 'cursoVida', valor: 'adultez', sexo: 'mujer', n: 7 },
        { dim: 'cursoVida', valor: 'adultez', sexo: 'hombre', n: 5 }
      ] });
    }
  };
  const p = tablero.validar({ desde: '2024-01-01', hasta: '2026-10-29', ebs: 'EBS007', comuna: '18', territorio: 'T52' });
  const r = await tablero.consultarTablero(pool, p, 44);
  verificar('tres consultas: categorías, opciones y fechas', consultas.length === 3, consultas.length);
  verificar('los filtros van como parámetros, en orden, con el equipo del alcance al final',
    JSON.stringify(consultas[0].parametros) === JSON.stringify(['2024-01-01', '2026-10-29', 'EBS007', '18', 'T52', 44]),
    JSON.stringify(consultas[0].parametros));
  verificar('ningún valor de la petición aparece dentro del SQL',
    consultas.every(function (c) { return c.sql.indexOf('EBS007') === -1 && c.sql.indexOf('T52') === -1 && c.sql.indexOf('2024-01-01') === -1; }));
  verificar('las opciones de los filtros se piden sin los demás filtros (pero con el alcance)',
    JSON.stringify(consultas[1].parametros) === JSON.stringify(['2024-01-01', '2026-10-29', null, null, null, 44]),
    JSON.stringify(consultas[1].parametros));
  verificar('de cada vivienda, su visita más reciente y sólo con consentimiento',
    /DISTINCT ON \(f\.hogar_id\)/.test(consultas[0].sql) && /f\.consentimiento/.test(consultas[0].sql) &&
    /ORDER BY f\.hogar_id, f\.fecha_diligenciamiento DESC/.test(consultas[0].sql));
  verificar('no cuenta datos sensibles (orientación sexual, violencias)',
    consultas[0].sql.indexOf('orientacion_sexual') === -1 && consultas[0].sql.indexOf('modalidad_violencia') === -1);
  verificar('la comuna 18.1 de la E.S.E. se cuenta como la 18', /split_part\(m\.comuna, '\.', 1\)/.test(consultas[0].sql));

  console.log('\n=== 3. La respuesta ===');
  verificar('totales por nombre', r.totales.viviendas === 12 && r.totales.personas === 23, JSON.stringify(r.totales));
  verificar('una categoría sin sexo no trae el campo', JSON.stringify(r.dimensiones.estrato) === JSON.stringify([{ valor: 'bajo', n: 4 }]),
    JSON.stringify(r.dimensiones.estrato));
  verificar('  y una fila sin valor no se cuela', r.dimensiones.estrato.length === 1);
  verificar('una categoría por sexo sí lo trae', r.dimensiones.cursoVida.length === 2 && r.dimensiones.cursoVida[0].sexo === 'mujer');
  verificar('período, filtros y fechas de lo incluido',
    r.periodo.desde === '2024-01-01' && r.filtros.territorio === 'T52' && r.rango.primera === '2026-08-25' && r.rango.ultima === '2026-10-13');
  verificar('EBS en orden', r.opciones.ebs.join() === 'EBS006,EBS007', r.opciones.ebs.join());
  verificar('comunas en orden numérico, con nombre, y lo que no es número al final',
    r.opciones.comunas.map(function (c) { return c.valor + ':' + c.etiqueta; }).join() === '3:Comuna 3,20:Comuna 20,Rural:Zona rural,sin:Sin comuna',
    r.opciones.comunas.map(function (c) { return c.valor + ':' + c.etiqueta; }).join());
  verificar('territorios por número, con su comuna',
    r.opciones.territorios.map(function (t) { return t.valor + ':' + t.comuna; }).join() === 'T48:3,T55:Rural,T163:1',
    r.opciones.territorios.map(function (t) { return t.valor + ':' + t.comuna; }).join());

  const vacio = tablero.armarRespuesta(tablero.validar({ desde: '2026-01-01', hasta: '2026-01-31' }), [], [], undefined);
  verificar('sin fichas: totales vacíos, sin categorías y sin fechas',
    JSON.stringify(vacio.totales) === '{}' && JSON.stringify(vacio.dimensiones) === '{}' && vacio.rango.primera === null);

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
