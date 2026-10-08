/* =========================================================================
   Prueba del rechazo de códigos de ficha repetidos en /api/guardar_encuesta.
   -------------------------------------------------------------------------
   La ficha técnica APS124CCFP (variable 19) numera las visitas CF001,
   CF002… y reinicia el consecutivo con cada familia; en la base el código de
   la ficha es único. El endpoint no debe dejar que una visita nueva pise la
   ficha de otra vivienda que trae el mismo código.

   No necesita base de datos: la conexión y la sesión se sustituyen por dobles
   que responden sólo a la consulta de la ficha existente. Cualquier otra
   consulta significa que el endpoint siguió de largo hacia la escritura.

       node pruebas/colision_codigo.test.js
   ========================================================================= */

'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');

let pasadas = 0;
let fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

/* --- Dobles de la base y de la sesión ----------------------------------- */

let fichaEnBase = null;
let consultas = [];

const cliente = {
  query: async function (sql) {
    consultas.push(sql);
    if (/FROM aps\.ficha f/.test(sql)) return { rows: fichaEnBase ? [fichaEnBase] : [] };
    if (/^\s*ROLLBACK/.test(sql)) return { rows: [] };
    throw new Error('consulta fuera de la prueba');
  },
  release: function () {}
};

/* Usuario de otro equipo y sin equipo asignado: si el endpoint pasa la
   protección, se detiene en la autorización con un 403 predecible, sin
   intentar escribir nada. */
const usuario = { rol: 'enfermeria', equipoSaludId: 99, funcionarioId: 5, equipoCodigo: null, documento: '1144000000' };

function sustituir(relativa, exportaciones) {
  const ruta = require.resolve(path.join(RAIZ, relativa));
  require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: exportaciones };
}

sustituir('api/_db.js', { obtenerPool: function () { return { connect: async function () { return cliente; } }; } });
sustituir('api/_auth.js', { requerirSesion: async function () { return usuario; } });

const guardar = require(path.join(RAIZ, 'api', 'guardar_encuesta.js'));

async function enviar(cuerpo) {
  consultas = [];
  const respuesta = { estado: 200, cuerpo: null };
  const res = {
    status: function (codigo) { respuesta.estado = codigo; return this; },
    json: function (cuerpoRespuesta) { respuesta.cuerpo = cuerpoRespuesta; return this; }
  };
  const errorOriginal = console.error;
  console.error = function () {};
  try {
    await guardar({ method: 'POST', body: cuerpo }, res);
  } finally {
    console.error = errorOriginal;
  }
  return respuesta;
}

function esColision(respuesta) {
  return respuesta.estado === 400 &&
    Array.isArray(respuesta.cuerpo && respuesta.cuerpo.bloqueos) &&
    respuesta.cuerpo.bloqueos.some(function (b) { return b.codigo === 'RN-015' && b.ruta === 'codigoFicha'; });
}

const FICHA_DE_OTRA_VIVIENDA = {
  id: 1, equipo_salud_id: 7, responsable_id: 100, equipo_codigo: 'EBS001',
  tipo_id: 'CC', numero_id: '1144012345', nombre_completo: 'Responsable original',
  perfil_profesional: 'enfermeria', perfil_otro: null, hogar_codigo: 'H0003'
};

(async function () {
  console.log('\n=== Código de ficha repetido (ficha técnica, variable 19) ===');

  fichaEnBase = FICHA_DE_OTRA_VIVIENDA;
  let r = await enviar({ codigoFicha: 'CF001', idHogar: 'H0001', esCorreccion: false });
  verificar('Visita nueva con CF001 de otra vivienda => 400 RN-015 sobre el código de la ficha',
    esColision(r), r.estado + ' ' + JSON.stringify(r.cuerpo));
  verificar('  el mensaje dice que no se guardó y no revela la otra vivienda',
    esColision(r) && /administrador/.test(r.cuerpo.bloqueos[0].mensaje) &&
    r.cuerpo.bloqueos[0].mensaje.indexOf('H0003') === -1);
  verificar('  y no se intentó escribir nada', consultas.length === 1, consultas.length + ' consultas');

  r = await enviar({ codigoFicha: 'CF001', idHogar: 'H0001' });
  verificar('Sin la marca de corrección (cliente anterior) también se protege', esColision(r));

  r = await enviar({ codigoFicha: 'CF001', idHogar: 'H0001', esCorreccion: true });
  verificar('Una corrección que cambia el hogar pasa la protección (llega a la autorización)',
    !esColision(r) && r.estado === 403, r.estado + ' ' + JSON.stringify(r.cuerpo));

  r = await enviar({ codigoFicha: 'CF001', idHogar: 'H0003', esCorreccion: false });
  verificar('Reenviar la misma visita (mismo hogar) pasa la protección',
    !esColision(r) && r.estado === 403, r.estado + ' ' + JSON.stringify(r.cuerpo));

  fichaEnBase = null;
  r = await enviar({ codigoFicha: 'CF001', idHogar: 'H0001', esCorreccion: false });
  verificar('Un código que no existe en la base pasa la protección',
    !esColision(r) && r.estado === 403 && r.cuerpo.codigo === 'sin_equipo', r.estado + ' ' + JSON.stringify(r.cuerpo));

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
