/* =========================================================================
   Pruebas unitarias: lo que le falta a una ficha (api/_completitud.js) y
   cada visita en el archivo plano (api/_visitas.js). Desde el 2026-11-19 la
   ficha va al plano aunque le falten integrantes; la visita que los completa
   (CF002…) va en su mes con la ficha completa, con su fecha y su responsable.
   No tocan la base.
       node pruebas/completitud.test.js
   ========================================================================= */

'use strict';

const path = require('path');
const c = require(path.join(__dirname, '..', 'api', '_completitud.js'));
const v = require(path.join(__dirname, '..', 'api', '_visitas.js'));

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

console.log('\n=== SQL ===');
verificar('La condición SQL mira integrantes y hogares',
  /numero_integrantes >/.test(c.SQL_FICHA_INCOMPLETA) && /hogares_en_vivienda >/.test(c.SQL_FICHA_INCOMPLETA));
verificar('Ya no decide el período del plano (sin «completitud» en aud.evento)',
  c.anotarSiQuedoCompleta === undefined && c.SQL_COMPLETADA_EL === undefined);

console.log('\n=== Cada visita en el archivo plano (api/_visitas.js) ===');
const integrante = function (doc, visita) { return { tipoId: 'CC', numeroId: doc, visitaNumero: visita }; };
const leida = {
  id: '7',
  meta: { consecutivoVivienda: 5 },
  encuesta: {
    codigoFicha: 'F-7', fechaDiligenciamiento: '2026-10-10',
    responsableTipoId: 'CC', responsableNumeroId: '111', perfilProfesional: 'auxiliar_enfermeria', perfilProfesionalOtro: null,
    familias: [
      { numeroIntegrantes: 5, integrantes: [integrante('1', 1), integrante('2', 1), integrante('3', 2), integrante('4', 2), integrante('5', 3)] },
      { numeroIntegrantes: 1, integrantes: [integrante('6', undefined)] }
    ]
  }
};
const responsable = { tipo_id: 'CC', numero_id: '222', perfil_profesional: 'enfermeria', perfil_otro: null };
const documentos = function (enVisita, fi) {
  return enVisita.encuesta.familias[fi].integrantes.map(function (i) { return i.numeroId; }).join(',');
};

let enVisita = v.fichaEnLaVisita(leida, { numero: 1, fecha: '2026-10-10' }, null);
verificar('Visita 1: sólo quienes se caracterizaron en ella, con la fecha y el responsable de la ficha',
  documentos(enVisita, 0) === '1,2' && enVisita.encuesta.familias[1].integrantes.length === 1 &&
  enVisita.encuesta.fechaDiligenciamiento === '2026-10-10' && enVisita.encuesta.responsableNumeroId === '111' &&
  enVisita.encuesta.visitaNumero === undefined,
  documentos(enVisita, 0));
verificar('Integrante sin número de visita (anterior a la regla) cuenta como de la visita 1',
  documentos(enVisita, 1) === '6');

enVisita = v.fichaEnLaVisita(leida, { numero: 2, fecha: '2026-11-19' }, responsable);
verificar('Visita 2: la ficha completa hasta ella, con la fecha y el responsable de esa visita',
  documentos(enVisita, 0) === '1,2,3,4' && documentos(enVisita, 1) === '6' &&
  enVisita.encuesta.fechaDiligenciamiento === '2026-11-19' && enVisita.encuesta.responsableNumeroId === '222' &&
  enVisita.encuesta.perfilProfesional === 'enfermeria' && enVisita.encuesta.visitaNumero === 2,
  documentos(enVisita, 0));
verificar('Visita 3: todas sus personas', documentos(v.fichaEnLaVisita(leida, { numero: 3, fecha: '2026-12-01' }, responsable), 0) ===
  '1,2,3,4,5');
verificar('Sin responsable encontrado conserva el de la ficha (no deja las variables 27 a 29 vacías)',
  v.fichaEnLaVisita(leida, { numero: 2, fecha: '2026-11-19' }, null).encuesta.responsableNumeroId === '111');
verificar('No modifica la ficha leída (sirve para otra visita del mismo archivo)',
  leida.encuesta.familias[0].integrantes.length === 5 && leida.encuesta.fechaDiligenciamiento === '2026-10-10' &&
  leida.encuesta.responsableNumeroId === '111');
verificar('Conserva el meta de la ficha (consecutivo de la vivienda para las variables 123 y 124)',
  enVisita.meta.consecutivoVivienda === 5 && enVisita.visita === 2);

verificar('SQL: una visita por vivienda en el período, la más reciente, de fichas cerradas con consentimiento',
  /DISTINCT ON \(t\.hogar_id\)/.test(v.SQL_VISITAS_DEL_PERIODO) && /aps\.visita_ficha/.test(v.SQL_VISITAS_DEL_PERIODO) &&
  /t\.fecha DESC, t\.numero DESC/.test(v.SQL_VISITAS_DEL_PERIODO) && /consentimiento/.test(v.SQL_VISITAS_DEL_PERIODO) &&
  /'cerrada', 'sincronizada'/.test(v.SQL_VISITAS_DEL_PERIODO));
verificar('SQL: una ficha con integrantes por caracterizar también entra',
  !/numero_integrantes|hogares_en_vivienda/.test(v.SQL_VISITAS_DEL_PERIODO));

(async function () {
  const consultas = [];
  const cliente = {
    query: async function (sql, params) {
      consultas.push(params);
      return { rows: [{ id: 9, tipo_id: 'CC', numero_id: '222' }] };
    }
  };
  const porId = await v.responsablesDeVisitas(cliente, [
    { numero: 1, responsable_id: null }, { numero: 2, responsable_id: 9 }, { numero: 3, responsable_id: 9 }]);
  verificar('Responsables: sólo de las visitas 2 en adelante, sin repetir',
    consultas.length === 1 && consultas[0][0].join(',') === '9' && porId.get('9').numero_id === '222');
  consultas.length = 0;
  await v.responsablesDeVisitas(cliente, [{ numero: 1, responsable_id: null }]);
  verificar('Sin segundas visitas no consulta', consultas.length === 0);

  console.log('\nPasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
})();
