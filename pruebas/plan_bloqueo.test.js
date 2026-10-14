/* Prueba de api/_plan_bloqueo.js (RN-228): qué cuenta como completar lo que
   falta del plan de cuidado y qué como cambiar lo registrado. Es una función
   pura: no necesita base ni servidor. */

const { cambiosEnPlanRegistrado, esDelPlan } = require('../api/_plan_bloqueo');

let ok = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const copia = (x) => JSON.parse(JSON.stringify(x));

const ACCION = { ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: 'NC-FAM-01', tipoRespuesta: 'en_sitio' };
const SEGUIMIENTO = {
  seguimientoTipoId: 'CC', seguimientoNumeroId: '1144012345', accionConcertada: 'Control en un mes',
  seg1Fecha: '2026-10-14', seg1Estado: 'C', seg2Fecha: null, seg2Estado: null
};

function ficha() {
  return {
    planVivienda: { acciones: [copia(ACCION)], seguimientos: [copia(SEGUIMIENTO)] },
    familias: [{
      planFamilia: { acciones: [copia(ACCION)], seguimientos: [] },
      integrantes: [
        { primerNombre: 'ANA', tipoId: 'CC', numeroId: '900000101', planPersona: { acciones: [copia(ACCION)], seguimientos: [] } },
        { primerNombre: 'JUAN', tipoId: 'CC', numeroId: '900000102' }
      ]
    }]
  };
}

const cambios = (cambiar) => {
  const nueva = ficha();
  cambiar(nueva);
  return cambiosEnPlanRegistrado(ficha(), nueva);
};

console.log('\n=== 1. Completar lo que falta no es cambiar ===');
check('La misma ficha => sin cambios', cambios(() => {}).length === 0);
check('Agregar una acción => sin cambios', cambios((f) => { f.planVivienda.acciones.push(Object.assign({}, ACCION, { codigoAccion: 'NC-FAM-02' })); }).length === 0);
check('Agregar un seguimiento => sin cambios', cambios((f) => { f.planVivienda.seguimientos.push(Object.assign({}, SEGUIMIENTO, { accionConcertada: 'Otro' })); }).length === 0);
check('Completar el 2.º seguimiento vacío => sin cambios', cambios((f) => {
  f.planVivienda.seguimientos[0].seg2Fecha = '2026-11-14';
  f.planVivienda.seguimientos[0].seg2Estado = 'C';
}).length === 0);
check('Un plan nuevo para otro integrante => sin cambios', cambios((f) => {
  f.familias[0].integrantes[1].planPersona = { acciones: [copia(ACCION)], seguimientos: [] };
}).length === 0);
check('Una fila vacía en medio no cuenta como acción', cambios((f) => {
  f.planVivienda.acciones.unshift({ ejecutorTipoId: '', ejecutorNumeroId: '', codigoAccion: '' });
}).length === 0);
check('Vacío, espacios y null valen lo mismo', cambios((f) => {
  f.planVivienda.acciones[0].institucionDestino = '   ';
}).length === 0);
check('Una fecha con hora se compara por su día', cambios((f) => {
  f.planVivienda.seguimientos[0].seg1Fecha = '2026-10-14T05:00:00.000Z';
}).length === 0);

console.log('\n=== 2. Cambiar o quitar lo registrado ===');
let c = cambios((f) => { f.planVivienda.acciones[0].codigoAccion = 'NC-FAM-02'; });
check('Cambiar el código de una acción registrada => bloqueo RN-228', c.length === 1 && c[0].codigo === 'RN-228');
check('  señala el campo exacto', c[0] && c[0].ruta === 'planVivienda.acciones[0].codigoAccion', c[0] && c[0].ruta);
check('Quitar una acción registrada => bloqueo', cambios((f) => { f.planVivienda.acciones = []; }).length === 1);
check('Cambiar el responsable de un seguimiento => bloqueo', cambios((f) => {
  f.planVivienda.seguimientos[0].seguimientoNumeroId = '1144099001';
}).length === 1);
c = cambios((f) => { f.planVivienda.seguimientos[0].seg1Estado = 'NC'; });
check('Cambiar el 1.er seguimiento registrado => bloqueo', c.length === 1 && /primer seguimiento/.test(c[0].mensaje), JSON.stringify(c));
check('Borrar el 1.er seguimiento registrado => bloqueo', cambios((f) => {
  f.planVivienda.seguimientos[0].seg1Fecha = null;
  f.planVivienda.seguimientos[0].seg1Estado = null;
}).length === 1);
check('Quitar el plan de una familia con algo registrado => bloqueo', cambios((f) => { delete f.familias[0].planFamilia; }).length === 1);
check('Cambiar la acción del plan de una persona => bloqueo con su ruta', (function () {
  const r = cambios((f) => { f.familias[0].integrantes[0].planPersona.acciones[0].tipoRespuesta = 'derivada'; });
  return r.length === 1 && r[0].ruta === 'familias[0].integrantes[0].planPersona.acciones[0].tipoRespuesta';
})());

console.log('\n=== 3. A quién pertenece cada plan ===');
check('La persona se reconoce por su documento aunque cambie de lugar', cambios((f) => {
  f.familias[0].integrantes.reverse();
}).length === 0);
check('Si se corrigió su documento, por su lugar', cambios((f) => {
  f.familias[0].integrantes[0].numeroId = '900000199';
}).length === 0);
check('Sin plan anterior no hay nada registrado que proteger',
  cambiosEnPlanRegistrado({ familias: [] }, ficha()).length === 0);
check('Sin ficha anterior (ficha nueva) => sin cambios', cambiosEnPlanRegistrado(null, ficha()).length === 0);

console.log('\n=== 4. Rutas del plan ===');
check('planVivienda, planFamilia y planPersona son del plan',
  esDelPlan('planVivienda.acciones[0].codigoAccion') && esDelPlan('familias[0].planFamilia.acciones[0].x') &&
  esDelPlan('familias[0].integrantes[1].planPersona.seguimientos[0].seg1Fecha'));
check('El resto de la ficha no', !esDelPlan('estrato') && !esDelPlan('familias[0].integrantes[0].peso') && !esDelPlan(null));

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + ok + '   Fallidas: ' + fail);
process.exit(fail > 0 ? 1 : 0);
