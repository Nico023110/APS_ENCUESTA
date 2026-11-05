/* =========================================================================
   Encuesta_APS — La aplicación instalada, desde la página
   -------------------------------------------------------------------------
   Lo carga cada página, antes que el resto. Hace cuatro cosas:

   1. Registra el service worker (sw.js), que guarda la aplicación para abrirla
      sin señal. Se registra también en login.html: el primer ingreso ya deja
      todo listo.
   2. Pide que el navegador no borre los datos de este sitio cuando le falte
      espacio: ahí están las fichas sin subir.
   3. Busca versión nueva al abrir, al volver la señal y al regresar a la
      aplicación, y avisa sin interrumpir: nada recarga la pantalla por su
      cuenta en mitad de una visita. La versión nueva queda aplicada la próxima
      vez que se abra aunque nadie toque el aviso.
   4. Dice en qué sistema está y si la aplicación ya está instalada, para la
      página de instalación y los enlaces a ella.
   ========================================================================= */

(function () {
  'use strict';

  const ESPERA_PRIMERA_BUSQUEDA_MS = 3000;
  const ENTRE_BUSQUEDAS_MS = 30 * 60 * 1000;
  const ESPERA_CAMBIO_DE_WORKER_MS = 3000;
  const CLAVE_LISTA_AVISADA = 'aps_pwa_lista_avisada';
  const CLAVE_ENCUESTAS = 'aps_encuestas';

  let ultimaBusqueda = 0;

  function instalada() {
    const pantalla = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    return Boolean(pantalla || window.navigator.standalone === true);
  }

  function sistema() {
    const agente = window.navigator.userAgent || '';
    if (/android/i.test(agente)) return 'android';
    /* iPadOS se presenta como Mac: lo delata la pantalla táctil. */
    if (/iphone|ipad|ipod/i.test(agente)) return 'ios';
    if (/macintosh/i.test(agente) && window.navigator.maxTouchPoints > 1) return 'ios';
    return 'otro';
  }

  function esTactil() {
    return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  /* ---------------------------------------------------------
     Service worker
     --------------------------------------------------------- */

  const soportaWorker = 'serviceWorker' in window.navigator && window.isSecureContext;

  function buscarVersionNueva(forzar) {
    if (!soportaWorker || window.navigator.onLine === false) return;
    const ahora = Date.now();
    if (!forzar && ahora - ultimaBusqueda < ENTRE_BUSQUEDAS_MS) return;
    ultimaBusqueda = ahora;

    window.navigator.serviceWorker.ready.then(function (registro) {
      /* El propio sw.js también se revisa: en una aplicación que vuelve de
         segundo plano no hay navegación que lo dispare. */
      registro.update().catch(function () { /* sin red */ });
      if (registro.active) registro.active.postMessage({ tipo: 'buscar-actualizacion' });
    });
  }

  function registrar() {
    if (!soportaWorker) return;

    window.navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(function (error) { console.warn('No fue posible preparar la aplicación para trabajar sin señal:', error); });

    window.navigator.serviceWorker.addEventListener('message', function (evento) {
      if (evento.data && evento.data.tipo === 'actualizacion-lista') mostrarAvisoDeVersion();
    });

    setTimeout(function () { buscarVersionNueva(true); }, ESPERA_PRIMERA_BUSQUEDA_MS);
    window.addEventListener('online', function () { buscarVersionNueva(true); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') buscarVersionNueva(false);
    });

    avisarQueQuedoLista();
  }

  /* Una sola vez y ya dentro de la aplicación: es la señal de que se puede salir a
     terreno, y la guía de instalación dice que se espere. Otra vez al abrirla desde
     el ícono: en Android comparte almacenamiento con el navegador, y quien ya la
     había usado ahí se quedaría esperando un aviso que no llega. */
  function avisarQueQuedoLista() {
    const clave = CLAVE_LISTA_AVISADA + (instalada() ? '_instalada' : '');
    window.navigator.serviceWorker.ready.then(function () {
      let avisada = false;
      try { avisada = localStorage.getItem(clave) === 'si'; } catch (error) { return; }
      if (avisada || typeof window.mostrarAvisoBreve !== 'function') return;
      try { localStorage.setItem(clave, 'si'); } catch (error) { return; }
      window.mostrarAvisoBreve('La aplicación quedó lista para trabajar sin señal en este equipo.', 'success');
    });
  }

  /* ---------------------------------------------------------
     Aviso de versión nueva
     --------------------------------------------------------- */

  /* Si también hay un worker nuevo esperando, se le da paso antes de recargar. Al
     recargar, el borrador se escribe solo en `pagehide` (captura_local.js) y vuelve
     al abrir. */
  function aplicarVersionNueva() {
    let recargando = false;
    const recargar = function () {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    };

    window.navigator.serviceWorker.getRegistration().then(function (registro) {
      if (!registro || !registro.waiting) { recargar(); return; }
      window.navigator.serviceWorker.addEventListener('controllerchange', recargar);
      setTimeout(recargar, ESPERA_CAMBIO_DE_WORKER_MS);
      registro.waiting.postMessage({ tipo: 'activar' });
    }).catch(recargar);
  }

  function mostrarAvisoDeVersion() {
    if (document.getElementById('avisoVersion') || !document.body) return;

    const aviso = document.createElement('div');
    aviso.id = 'avisoVersion';
    aviso.className = 'aviso-version';
    aviso.setAttribute('role', 'status');

    const texto = document.createElement('span');
    texto.className = 'aviso-version__texto';
    texto.textContent = 'Hay una versión nueva de la aplicación. Lo que lleva diligenciado no se pierde.';

    /* En mitad de una visita se deja para después: queda aplicada la próxima vez
       que se abra, y el aviso no tapa lo que hay abajo. */
    const despues = document.createElement('button');
    despues.type = 'button';
    despues.className = 'aviso-version__boton';
    despues.textContent = 'Más tarde';
    despues.addEventListener('click', function () { aviso.remove(); });

    const actualizar = document.createElement('button');
    actualizar.type = 'button';
    actualizar.className = 'aviso-version__boton aviso-version__boton--principal';
    actualizar.textContent = 'Actualizar';
    actualizar.addEventListener('click', aplicarVersionNueva);

    const acciones = document.createElement('div');
    acciones.className = 'aviso-version__acciones';
    acciones.appendChild(despues);
    acciones.appendChild(actualizar);

    aviso.appendChild(texto);
    aviso.appendChild(acciones);
    document.body.appendChild(aviso);
  }

  /* ---------------------------------------------------------
     Datos del dispositivo
     --------------------------------------------------------- */

  function pedirAlmacenamientoPersistente() {
    const almacen = window.navigator.storage;
    if (!almacen || typeof almacen.persist !== 'function') return;
    almacen.persisted().then(function (ya) {
      return ya ? true : almacen.persist();
    }).catch(function () { /* el navegador decide; no hay nada más que hacer */ });
  }

  /* Cuántas fichas no han subido en este navegador, de cualquier persona. Es lo
     único que se dice en el acceso y en la guía: ahí nadie ha dicho quién es. */
  function fichasSinSubir() {
    try {
      const lista = JSON.parse(localStorage.getItem(CLAVE_ENCUESTAS) || '[]');
      return Array.isArray(lista) ? lista.filter(function (f) { return f && f.sincronizada !== true; }).length : 0;
    } catch (error) {
      return 0;
    }
  }

  /* ---------------------------------------------------------
     Enlaces a la instalación
     --------------------------------------------------------- */

  /* Sólo en teléfono o tableta y mientras no esté instalada: en el computador
     se sigue usando desde el navegador. */
  function mostrarEnlacesDeInstalacion() {
    if (instalada() || !esTactil()) return;
    document.querySelectorAll('[data-enlace-instalar]').forEach(function (enlace) { enlace.hidden = false; });
  }

  window.PWA = {
    instalada: instalada,
    sistema: sistema,
    esTactil: esTactil,
    fichasSinSubir: fichasSinSubir,
    buscarVersionNueva: function () { buscarVersionNueva(true); },
    /* Resuelve cuando la aplicación ya está guardada en el dispositivo. */
    lista: function () {
      return soportaWorker ? window.navigator.serviceWorker.ready.then(function () { return true; }) : Promise.resolve(false);
    }
  };

  document.addEventListener('DOMContentLoaded', mostrarEnlacesDeInstalacion);
  window.addEventListener('load', function () {
    registrar();
    pedirAlmacenamientoPersistente();
  });
})();
