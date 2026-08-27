/* =========================================================================
   Playwright — configuración para las pruebas de navegador real
   -------------------------------------------------------------------------
   Las pruebas de `pruebas/*.test.js` corren sobre JSDOM: ven el DOM pero no
   el navegador. Esta configuración levanta Chromium de verdad contra el
   servidor local, para observar el diligenciamiento como lo vive la persona
   encuestadora y capturar lo que JSDOM no puede: controles tapados, campos
   deshabilitados, errores de consola y respuestas de la API.

   Uso:
     npm run e2e            ventana visible, paso a paso (para mirar)
     npm run e2e:rapido     sin ventana (para integración continua)
     npm run e2e:informe    abre el informe HTML de la última corrida

   La corrida que se mira usa `playwright.config.lento.js`, que hereda de
   ésta y añade ventana y pausa entre acciones.

   Variables:
     PW_TECLA=n     milisegundos entre tecla y tecla al escribir (por
                    defecto 45; se aplica en las dos configuraciones)
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const { defineConfig } = require('@playwright/test');

const PUERTO = process.env.PUERTO || 5173;
const BASE = 'http://localhost:' + PUERTO;

/* Sin pausa: esta configuración es la rápida. La corrida que se mira va por
   `playwright.config.lento.js`, que hereda de ésta y añade ventana y pausa. */
const LENTITUD = Number(process.env.PW_LENTITUD || 0);

module.exports = defineConfig({
  testDir: './pruebas/e2e',

  /* `encuesta_real.spec.js` deja una ficha permanente en la base. No es una
     prueba y no debe correr sola: se pide a propósito con `npm run encuesta`,
     que usa `playwright.config.encuesta.js`. */
  testIgnore: '**/encuesta_real.spec.js',

  /* Una ficha completa son ~250 interacciones; con la pausa de observación
     el diligenciamiento solo ya ronda el minuto. */
  timeout: 10 * 60 * 1000,
  expect: { timeout: 10 * 1000 },

  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'pruebas/e2e/informe', open: 'never' }]
  ],
  outputDir: 'pruebas/e2e/resultados',

  use: {
    baseURL: BASE,
    launchOptions: { slowMo: LENTITUD, args: ['--window-size=1500,1000'] },
    viewport: { width: 1440, height: 900 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',

    /* El vídeo siempre: es el entregable, se mire o no el resultado.
       La traza sólo al fallar: guarda una captura y un volcado del DOM por
       cada acción y pasa de los 140 MB en una ficha de tres integrantes,
       peso que no se justifica en una corrida que salió bien. */
    video: 'on',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',

    actionTimeout: 15 * 1000,

    /* El formulario pide GPS (ítem 22). Se concede y se fija una posición
       de Cali para que la captura desde el dispositivo no cuelgue. */
    permissions: ['geolocation'],
    geolocation: { latitude: 3.451647, longitude: -76.531985 }
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ],

  webServer: {
    command: 'node servidor.js',
    url: BASE + '/index.html',
    reuseExistingServer: true,
    timeout: 60 * 1000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
