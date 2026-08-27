/* =========================================================================
   Playwright — registro de una encuesta real
   -------------------------------------------------------------------------
   La configuración normal ignora `encuesta_real.spec.js`, porque ese guion
   deja una ficha permanente en la base y no debe correr con las pruebas.
   Ésta hace lo contrario: sólo corre ese guion.

   Va con ventana y a ritmo de lectura, como la corrida lenta: quien registra
   una visita quiere ver lo que se está escribiendo.

   Uso:
     npm run encuesta                    con ventana, a ritmo de lectura
     PW_VENTANA=0 npm run encuesta       sin ventana y a toda velocidad
     PW_LENTITUD=400 npm run encuesta    más despacio todavía
   ========================================================================= */

'use strict';

const base = require('./playwright.config');

const LENTITUD = Number(process.env.PW_LENTITUD || 180);

module.exports = Object.assign({}, base, {
  testIgnore: undefined,
  testMatch: '**/encuesta_real.spec.js',

  use: Object.assign({}, base.use, {
    headless: process.env.PW_VENTANA === '0',
    launchOptions: Object.assign({}, base.use.launchOptions, {
      slowMo: process.env.PW_VENTANA === '0' ? 0 : LENTITUD
    })
  })
});
