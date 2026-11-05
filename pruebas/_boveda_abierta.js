/* =========================================================================
   Una bóveda abierta y sin cifrar, para las pruebas de la aplicación
   -------------------------------------------------------------------------
   Lo que estas pruebas miran es qué hace la aplicación con las fichas, y siembran
   y leen `aps_encuestas` en claro. El cifrado se prueba aparte, con los archivos
   reales: pruebas/boveda.test.js y pruebas/e2e/pwa.spec.js.

   Se carga junto con los demás archivos, como un <script> más. En la aplicación no
   hay nada que haga de esto: sin boveda.js, app.js falla en vez de guardar en claro.
   ========================================================================= */

globalThis.BOVEDA = {
  disponible: function () { return true; },
  prepararApertura: function () { return { abrir: function () { return Promise.resolve({ ok: true }); } }; },
  abierta: function () { return true; },
  documento: function () { return null; },
  cerrar: function () {},
  retener: function () { return function () {}; },
  alAbrir: function (oyente) { oyente(true); },
  antesDeCerrar: function () {},

  abrirFichas: function (lista) { return lista; },
  sellarFichas: function (lista) { return lista; },
  esLegible: function () { return true; },
  faltaCifrar: function () { return false; },

  leerTexto: function (clave) { return localStorage.getItem(clave); },
  sellarTexto: function (clave, texto) { return { clave: clave, valor: texto }; },
  borrarTexto: function (clave) { localStorage.removeItem(clave); },
  pasarACifrado: function () { return true; },

  recuperarAnteriores: function () { return Promise.resolve(0); },
  confirmarRecuperacion: function () {},
  hayLlavesAnteriores: function () { return false; },
  tieneDeOtraLlave: function () { return false; },
  textosDeOtraLlave: function () { return []; },

  entregar: function () { return Promise.resolve(false); },
  hayEntregaEnCamino: function () { return false; },
  recibir: function () { return Promise.resolve(false); }
};
