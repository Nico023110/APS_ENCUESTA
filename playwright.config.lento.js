/* =========================================================================
   Playwright — corrida lenta y con ventana, para mirar el proceso
   -------------------------------------------------------------------------
   Es la configuración normal con tres cambios: ventana abierta, pausa entre
   acciones y pausa entre teclas.

   Va en un archivo aparte y no en una bandera de la línea de comandos porque
   Playwright vuelve a cargar la configuración dentro del proceso de trabajo,
   donde `process.argv` ya no conserva lo que se escribió en la terminal. Un
   `--headed` sí abre la ventana —eso lo aplica el proceso principal— pero un
   `slowMo` leído de argv se pierde por el camino y la corrida sale igual de
   rápida que sin la bandera.

   Uso:
     npm run e2e                        ventana, ritmo de lectura
     PW_LENTITUD=400 npm run e2e        aún más despacio (bash)
     $env:PW_LENTITUD=400; npm run e2e  lo mismo en PowerShell
   ========================================================================= */

'use strict';

const base = require('./playwright.config');

/* Pausa entre acciones. 220 ms deja seguir el salto de un campo al siguiente
   sin volver eterna una ficha de tres integrantes. */
const LENTITUD = Number(process.env.PW_LENTITUD || 220);

module.exports = Object.assign({}, base, {
  use: Object.assign({}, base.use, {
    headless: false,
    launchOptions: Object.assign({}, base.use.launchOptions, { slowMo: LENTITUD })
  })
});
