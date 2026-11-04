/* =========================================================================
   Playwright — La aplicación instalada y sin señal
   -------------------------------------------------------------------------
       npm run e2e:pwa
       npm run e2e:pwa -- --project=android-chromium

   Corre SIEMPRE contra la copia local `aps_encuesta`: bd/base_local.js se
   precarga aquí y en el servidor, y la prueba se niega a seguir si la base no
   está en localhost. `playwright.config.js` no sirve para esto: su servidor
   arranca con .env.local, que apunta a Neon.

   El banco de pruebas (pwa_banco.js) copia la aplicación a una carpeta temporal
   y la sirve detrás de un proxy propio, para poder cortar la red, dejarla colgada
   o publicar una «versión nueva» de verdad, sin tocar los archivos del proyecto.

   Los perfiles emulan teléfonos, pero no son teléfonos: WebKit en Windows es el
   motor de Safari, no iOS. Ver el informe en pruebas/e2e/README.md.
   ========================================================================= */

'use strict';

require('./bd/base_local.js');

/* Aquí no se mira el tecleo: se comprueba que funcione sin señal. */
process.env.PW_TECLA = process.env.PW_TECLA || '0';

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './pruebas/e2e',
  testMatch: 'pwa.spec.js',

  /* El recorrido incluye una ficha completa de tres integrantes. */
  timeout: 15 * 60 * 1000,
  expect: { timeout: 15 * 1000 },

  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [['list']],
  outputDir: 'pruebas/e2e/resultados/pwa',

  use: {
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    video: 'off',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10 * 1000
  },

  projects: [
    { name: 'android-chromium', use: Object.assign({}, devices['Pixel 7']) },
    { name: 'ios-webkit', use: Object.assign({}, devices['iPhone 14']) }
  ]
});
