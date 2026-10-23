/* =========================================================================
   Prueba de /api/productividad contra la base y el servidor.
   -------------------------------------------------------------------------
   Requiere el servidor arriba y la base que diga DATABASE_URL (la de
   .env.local, o la copia local si se arranca con -r ./bd/base_local.js):

       node -r ./bd/base_local.js pruebas/productividad_bd.test.js

   Con PUERTO se elige el puerto del servidor (5173 por defecto). Sólo lee
   fichas; escribe lo mismo que cualquier inicio de sesión (la sesión del
   usuario de prueba) y asegura dos usuarios de prueba: un líder de zona y la
   enfermera de siempre. Comprueba los permisos, que se rechaza lo que no
   es válido, y que en cada agrupación los grupos suman el total; que los
   filtros sólo restan, y que por persona aparece en cero quien no tiene
   fichas.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const RAIZ = require('path').join(__dirname, '..');
const { Client } = require('pg');
const { asegurarUsuarioDePrueba, iniciarSesionDePrueba } = require(RAIZ + '/pruebas/_sesion_prueba');

const BASE = 'http://localhost:' + (process.env.PUERTO || 5173);
const LIDER = { documento: '1144099023', nombre: 'Prueba Líder Productividad', rol: 'lider_ebs', equipo: null, clave: 'ClavePrueba2026' };
const ENFERMERA = { documento: '1144099001', clave: 'ClavePrueba2026' };
const AGRUPACIONES = ['ebs', 'comuna', 'territorio', 'barrio', 'persona', 'dia', 'semana', 'mes'];
const COLUMNAS = ['fichas', 'hogares', 'familias', 'personas', 'planPendiente', 'incompletas', 'sinConsentimiento',
  'integrantesPendientes'];

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

function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function principal() {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL, ssl: /localhost/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  await cliente.connect();
  await asegurarUsuarioDePrueba(cliente, LIDER);
  await asegurarUsuarioDePrueba(cliente, ENFERMERA);
  await cliente.end();

  const lider = await iniciarSesionDePrueba(BASE, LIDER);
  const enfermera = await iniciarSesionDePrueba(BASE, ENFERMERA);
  const pedir = async function (sesion, consulta) {
    const r = await fetch(BASE + '/api/productividad?' + new URLSearchParams(consulta).toString(), { headers: sesion.cabeceras });
    return { estado: r.status, cuerpo: await r.json().catch(function () { return {}; }) };
  };

  const hoy = new Date();
  const PERIODO = { desde: iso(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate() + 1)), hasta: iso(hoy) };

  console.log('\n=== 1. Permisos y validación ===');
  verificar('sin sesión: 401', (await fetch(BASE + '/api/productividad?desde=2026-01-01&hasta=2026-01-31')).status === 401);
  const sinPermiso = await pedir(enfermera, PERIODO);
  verificar('enfermería no tiene productividad.ver: 403', sinPermiso.estado === 403, sinPermiso.estado);
  for (const [nombre, consulta] of [
    ['fecha inexistente', { desde: '2026-02-30', hasta: '2026-03-01' }],
    ['fechas al revés', { desde: '2026-03-02', hasta: '2026-03-01' }],
    ['más de un año', { desde: '2024-01-01', hasta: '2026-01-01' }],
    ['agrupación inventada', Object.assign({ agrupar: 'f.id; DROP TABLE x' }, PERIODO)],
    ['EBS con comillas', Object.assign({ ebs: "x' OR '1'='1" }, PERIODO)],
    ['persona no numérica', Object.assign({ persona: '1 OR 1=1' }, PERIODO)]
  ]) {
    const r = await pedir(lider, consulta);
    verificar('rechaza ' + nombre + ' con 400', r.estado === 400 && typeof r.cuerpo.error === 'string', r.estado + ' ' + JSON.stringify(r.cuerpo));
  }

  console.log('\n=== 2. Cada agrupación suma el total ===');
  let porEbs = null;
  for (const agrupar of AGRUPACIONES) {
    const r = await pedir(lider, Object.assign({ agrupar: agrupar }, PERIODO));
    if (r.estado !== 200) { verificar(agrupar + ': responde 200', false, r.estado + ' ' + JSON.stringify(r.cuerpo)); continue; }
    if (agrupar === 'ebs') porEbs = r.cuerpo;
    const sumas = COLUMNAS.filter(function (c) {
      const suma = r.cuerpo.filas.reduce(function (s, f) { return s + f[c]; }, 0);
      return suma !== r.cuerpo.totales[c];
    });
    verificar(agrupar + ': los grupos suman el total (' + r.cuerpo.totales.fichas + ' fichas)', sumas.length === 0, sumas.join(', '));
    const claves = r.cuerpo.filas.map(function (f) { return String(f.clave); });
    verificar(agrupar + ': sin grupos repetidos', new Set(claves).size === claves.length);
  }

  if (porEbs) {
    const dias = porEbs.porDia.reduce(function (s, d) { return s + d.fichas; }, 0);
    verificar('las fichas por día suman el total', dias === porEbs.totales.fichas, dias + ' vs ' + porEbs.totales.fichas);
    verificar('no trae datos de la población (sólo cuentas y el personal)',
      !/numeroId|primerNombre|direccion|telefono/i.test(JSON.stringify(porEbs)));

    console.log('\n=== 3. Los filtros sólo restan ===');
    const ebs = porEbs.opciones.ebs[0];
    if (ebs) {
      const r = await pedir(lider, Object.assign({ agrupar: 'persona', ebs: ebs }, PERIODO));
      const fila = porEbs.filas.find(function (f) { return f.clave === ebs; });
      verificar('filtrar por un EBS da sus fichas', r.estado === 200 && fila && r.cuerpo.totales.fichas === fila.fichas,
        (fila && fila.fichas) + ' vs ' + r.cuerpo.totales.fichas);
    }
    const comuna = porEbs.opciones.comunas[0];
    if (comuna) {
      const r = await pedir(lider, Object.assign({ agrupar: 'ebs', comuna: comuna.valor }, PERIODO));
      verificar('filtrar por comuna no suma más que el total', r.estado === 200 && r.cuerpo.totales.fichas <= porEbs.totales.fichas);
    }
    const persona = porEbs.opciones.personas[0];
    if (persona) {
      const r = await pedir(lider, Object.assign({ agrupar: 'dia', persona: persona.valor }, PERIODO));
      verificar('filtrar por persona no suma más que el total', r.estado === 200 && r.cuerpo.totales.fichas <= porEbs.totales.fichas &&
        r.cuerpo.totales.fichas > 0);
    }
  }

  console.log('\n=== 4. Quien no tiene fichas aparece en cero ===');
  const vacio = await pedir(lider, { agrupar: 'persona', desde: '2000-01-01', hasta: '2000-01-31' });
  verificar('un período sin fichas: totales en cero', vacio.estado === 200 && vacio.cuerpo.totales.fichas === 0);
  verificar('y por persona aparece el personal activo, en cero',
    vacio.cuerpo.filas.length > 0 && vacio.cuerpo.filas.every(function (f) { return f.fichas === 0; }) &&
    vacio.cuerpo.filas.some(function (f) { return f.etiqueta === 'Prueba Enfermería'; }), vacio.cuerpo.filas.length);
  const vacioEbs = await pedir(lider, { agrupar: 'ebs', desde: '2000-01-01', hasta: '2000-01-31' });
  verificar('y por EBS, los equipos con personal activo', vacioEbs.cuerpo.filas.some(function (f) { return f.clave === 'EBS12'; }));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
