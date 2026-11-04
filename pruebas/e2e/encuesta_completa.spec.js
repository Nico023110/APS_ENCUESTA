/* =========================================================================
   Una encuesta completa, de principio a fin, en un navegador de verdad
   -------------------------------------------------------------------------
       npm run e2e          (ventana visible, paso a paso)
       npm run e2e:rapido   (sin ventana)

   El recorrido vive en `diligenciar.js`, compartido con `encuesta_real.spec.js`.
   Aquí sólo van los datos de la ficha de prueba, la limpieza y el veredicto.

   ESTA FICHA NO SE QUEDA. Se borra antes y después de cada corrida: es una
   prueba, no un registro. Para grabar una encuesta de verdad está
   `npm run encuesta`.

   QUÉ SE COMPRUEBA

   1. Que todos los campos del recorrido se pudieron diligenciar.
   2. Que el navegador no lanzó excepciones ni errores de consola.
   3. Que la ficha cierra: sin incumplimientos de reglas ni impedimentos
      de cierre (RN-222).
   4. Que llega a la base por /api/guardar_encuesta.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });

const { test, expect } = require('@playwright/test');
const ayudas = require('./ayudas');
const flujo = require('./diligenciar');
const { FICHA, PERSONAS, limpiarBase } = require('./ficha_de_prueba');

test.describe.configure({ mode: 'serial' });

/* La ficha diligenciada se conserva en la base para poder revisarla en el
   historial. Para que la prueba se recoja sola, como antes, se corre con
   PW_LIMPIAR=1: limpia antes (por si una corrida anterior quedó a medias) y
   después. Ojo: con las fichas de prueba en la base, endpoint.test.js puede
   chocar contra las personas que referencian. */
if (process.env.PW_LIMPIAR === '1') {
  test.beforeAll(limpiarBase);
  test.afterAll(limpiarBase);
}

/* ---------------------------------------------------------
   La prueba
   --------------------------------------------------------- */

test('Se diligencia y guarda una encuesta completa', async function ({ page }, infoPrueba) {
  const diario = ayudas.crearDiario();
  ayudas.vigilar(page, diario);

  await flujo.diligenciarEncuesta(page, diario, FICHA, PERSONAS);

  const cierre = await flujo.cerrarYGuardar(page, diario, FICHA);

  await page.screenshot({
    path: infoPrueba.outputPath('cierre-de-la-ficha.png'),
    fullPage: true
  });

  /* El informe se imprime antes de cualquier aserción: si la prueba falla,
     el diagnóstico ya está en la salida y no hay que volver a correrla. */
  ayudas.imprimirInforme(diario);

  await infoPrueba.attach('informe-del-diligenciamiento.txt', {
    body: JSON.stringify(diario, null, 2),
    contentType: 'text/plain'
  });

  /* Las aserciones comparan listas de frases cortas, no los objetos del
     diario: un `toEqual` sobre los objetos completos entierra el hallazgo
     bajo cien líneas de diff. */
  expect(
    diario.consola.map(function (c) { return c.tipo + ' en «' + c.zona + '»: ' + c.texto; }),
    'el navegador reportó errores durante el diligenciamiento'
  ).toEqual([]);

  expect(
    diario.problemas.map(function (p) {
      return '«' + p.zona + '» ' + p.etiqueta + ': ' + p.motivo +
        (p.detalle ? ' — ' + p.detalle : '');
    }),
    'hubo campos que no se pudieron diligenciar o reglas incumplidas'
  ).toEqual([]);

  expect(
    diario.peticiones.map(function (r) { return r.estado + ' ' + r.url; }),
    'la aplicación hizo peticiones que fallaron'
  ).toEqual([]);

  expect(cierre.guardo, 'la encuesta no se pudo guardar; revise el informe de arriba')
    .toBe(true);

  /* Guardar escribe en la base: la petición sale al pulsar el botón, no en un
     paso de sincronización posterior. */
  expect(cierre.respuestaApi && cierre.respuestaApi.estado,
    'guardar no escribió la ficha en la base').toBe(200);
});
