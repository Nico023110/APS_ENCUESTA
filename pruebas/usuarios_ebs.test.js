/* =========================================================================
   Pruebas unitarias: una persona en uno o varios EBS (validarDatos de
   api/_usuarios.js). El principal va en «equipo» y los demás en «apoyo»;
   sin principal, todos van como apoyo (enfoque diferencial). No tocan la
   base ni el servidor.
       node pruebas/usuarios_ebs.test.js
   ========================================================================= */

'use strict';

const path = require('path');
const cuentas = require(path.join(__dirname, '..', 'api', '_usuarios.js'));

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

function falla(datos) {
  try { cuentas.validarDatos(datos, true); return null; } catch (e) { return e; }
}

const BASE = { documento: '1144099001', tipoId: 'CC', nombre: 'Persona de prueba', rol: 'enfermeria' };

console.log('\n=== Uno o varios EBS ===');

let d = cuentas.validarDatos(Object.assign({}, BASE, { equipo: 'EBS007' }), true);
verificar('un solo EBS: principal y sin otros', d.equipo === 'EBS007' && d.apoyo.length === 0, JSON.stringify(d));

d = cuentas.validarDatos(Object.assign({}, BASE, { equipo: 'EBS007', apoyo: ['EBS017', 'EBS006'] }), true);
verificar('varios EBS: el principal y los demás', d.equipo === 'EBS007' && d.apoyo.join(',') === 'EBS017,EBS006', JSON.stringify(d));

d = cuentas.validarDatos(Object.assign({}, BASE, { equipo: 'EBS007', apoyo: ['EBS007', 'EBS017', 'ebs017'] }), true);
verificar('el principal no se repite entre los demás, ni un EBS dos veces', d.apoyo.join(',') === 'EBS017', JSON.stringify(d.apoyo));

d = cuentas.validarDatos(Object.assign({}, BASE, { equipo: 'ebs007' }), true);
verificar('el código del principal se guarda en mayúsculas', d.equipo === 'EBS007', d.equipo);

d = cuentas.validarDatos(Object.assign({}, BASE, { apoyo: 'ebs006, ebs035; EBS064 EBS074' }), true);
verificar('en texto, minúsculas y separadores no parten el código (antes «ebs006» se cortaba en la «s»)',
  d.equipo === null && d.apoyo.join(',') === 'EBS006,EBS035,EBS064,EBS074', JSON.stringify(d.apoyo));

d = cuentas.validarDatos(Object.assign({}, BASE, { equipo: null, apoyo: ['EBS006', 'EBS035'] }), true);
verificar('sólo apoya (enfoque diferencial): sin principal', d.equipo === null && d.apoyo.length === 2, JSON.stringify(d));

let e = falla(Object.assign({}, BASE, { equipo: null, apoyo: [] }));
verificar('un rol que captura fichas sin ningún EBS se rechaza en el campo del equipo', e && e.campo === 'equipo', e && e.message);

e = falla(Object.assign({}, BASE, { equipo: 'EBS007', apoyo: ['EBS 01!'] }));
verificar('un código de EBS mal formado se rechaza', e && e.campo === 'apoyo', e && e.message);

d = cuentas.validarDatos(Object.assign({}, BASE, { rol: 'lider_ebs', equipo: null, apoyo: ['EBS006'], cargo: 'Zona Norte' }), true);
verificar('la coordinación no lleva EBS que apoya', d.apoyo.length === 0, JSON.stringify(d.apoyo));

const muchos = Array.from({ length: 31 }, function (_, i) { return 'EBS' + String(100 + i); });
e = falla(Object.assign({}, BASE, { equipo: 'EBS001', apoyo: muchos }));
verificar('más de 30 EBS para una persona se rechaza', e && e.campo === 'apoyo', e && e.message);

console.log('\nPasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas > 0 ? 1 : 0);
