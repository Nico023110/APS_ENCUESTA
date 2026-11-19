/* =========================================================================
   APS APP — Marcar las fichas guardadas cuyas familias ya se habían
   caracterizado (CF002…), RN-015 / RN-230
   -------------------------------------------------------------------------
   Uso:
     node bd/marcar_antecedentes.js              (ensayo: cuenta, no escribe)
     node bd/marcar_antecedentes.js --aplicar

     Contra la copia local:
     node -r ./bd/base_local.js bd/marcar_antecedentes.js [--aplicar]

   Las fichas nuevas lo calculan al guardarse (api/_antecedentes.js). Esto lo
   hace con las que ya estaban: por cada ficha, en orden de visita, busca a
   sus personas en la base anterior a la app y en fichas anteriores de la
   app, guarda el vínculo y pone el CF que corresponde. Todo en una
   transacción, y cada CF que cambia queda en aud.evento. Se puede repetir:
   lo que ya está bien no se toca. La salida sólo muestra cuentas y códigos
   de ficha, nunca datos de personas.

   Requiere las migraciones 20 a 22 (npm run bd:migrar).
   ========================================================================= */

'use strict';

const path = require('path');
require('dotenv').config({ path: [path.join(__dirname, '..', '.env.local'), path.join(__dirname, '..', '.env')], quiet: true });

const { Client } = require('pg');
const { opcionesConexion } = require(path.join(__dirname, '..', 'api', '_db.js'));
const { registrarAntecedentes, planDeAntecedentes, SQL_FAMILIAS_Y_ANTECEDENTES } =
  require(path.join(__dirname, '..', 'api', '_antecedentes.js'));

async function principal() {
  const aplicar = process.argv.indexOf('--aplicar') >= 0;
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!cadena) throw new Error('No hay DATABASE_URL.');
  console.log('\n  Base: ' + new URL(cadena).hostname + (aplicar ? '  (aplicando)' : '  (ensayo: no escribe)'));

  const cliente = new Client(opcionesConexion(cadena));
  await cliente.connect();
  try {
    const fichas = (await cliente.query(
      'SELECT id, codigo FROM aps.ficha ORDER BY fecha_diligenciamiento, id')).rows;
    if (aplicar) await cliente.query('BEGIN');

    const resumen = { fichas: fichas.length, familias: 0, conAntecedentes: 0, cambian: 0, porCf: {} };
    const marcadas = [];
    for (const ficha of fichas) {
      const plan = aplicar
        ? await registrarAntecedentes(cliente, ficha.id, null, 'marcar_antecedentes')
        : planDeAntecedentes((await cliente.query(SQL_FAMILIAS_Y_ANTECEDENTES, [ficha.id])).rows);
      plan.forEach(function (f) {
        resumen.familias++;
        if (f.antecedentes.length > 0) resumen.conAntecedentes++;
        if (f.cambia) {
          resumen.cambian++;
          resumen.porCf[f.codigoCf] = (resumen.porCf[f.codigoCf] || 0) + 1;
          marcadas.push(ficha.codigo + ' familia ' + f.consecutivo + ': ' + (f.antes.codigoCf || '—') + ' → ' + f.codigoCf);
        }
      });
    }

    if (aplicar) await cliente.query('COMMIT');
    console.log('  Fichas revisadas: ' + resumen.fichas + ' · familias: ' + resumen.familias);
    console.log('  Familias ya caracterizadas antes: ' + resumen.conAntecedentes);
    console.log('  CF que ' + (aplicar ? 'cambiaron' : 'cambiarían') + ': ' + resumen.cambian + '  ' + JSON.stringify(resumen.porCf));
    marcadas.forEach(function (m) { console.log('    ' + m); });
    if (!aplicar) console.log('\n  Ensayo: no se escribió nada. Para aplicarlo, agregue --aplicar.\n');
  } catch (error) {
    if (aplicar) await cliente.query('ROLLBACK').catch(function () {});
    throw error;
  } finally {
    await cliente.end();
  }
}

principal().catch(function (error) {
  console.error('\nERROR: ' + error.message + '\n');
  process.exit(1);
});
