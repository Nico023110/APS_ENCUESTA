/* =========================================================
   Encuesta_APS — Página de instalación (instalar.html)
   ---------------------------------------------------------
   Muestra los pasos del sistema del equipo y, en los navegadores
   que lo permiten, un botón que abre el diálogo de instalación.
   Al imprimir salen los dos sistemas (ver styles.css).
   ========================================================= */

(function () {
  'use strict';

  const CLAVE_ENCUESTAS = 'aps_encuestas';

  /* iOS puede tomar como inicio la página desde la que se agregó el ícono. Dentro
     de la aplicación instalada esta guía no tiene nada que hacer. */
  if (window.PWA && window.PWA.instalada()) {
    window.location.replace('/');
    return;
  }

  const opciones = document.querySelectorAll('[data-sistema]');
  const bloques = document.querySelectorAll('[data-pasos]');
  const botonInstalar = document.getElementById('btnInstalar');
  const avisoInstalada = document.getElementById('avisoInstalada');

  function elegirSistema(sistema) {
    opciones.forEach(function (opcion) {
      opcion.setAttribute('aria-pressed', String(opcion.dataset.sistema === sistema));
    });
    bloques.forEach(function (bloque) {
      bloque.classList.toggle('is-oculto', bloque.dataset.pasos !== sistema);
    });
  }

  opciones.forEach(function (opcion) {
    opcion.addEventListener('click', function () { elegirSistema(opcion.dataset.sistema); });
  });

  const sistema = window.PWA ? window.PWA.sistema() : 'otro';
  elegirSistema(sistema === 'ios' ? 'ios' : 'android');

  function marcarInstalada() {
    avisoInstalada.hidden = false;
    botonInstalar.hidden = true;
  }

  /* Chrome y Samsung Internet en Android: el diálogo de instalación se abre con
     este evento. Si no llega (iPhone, otro navegador, ya instalada), quedan los
     pasos escritos, que sirven igual. */
  let eventoInstalacion = null;

  window.addEventListener('beforeinstallprompt', function (evento) {
    evento.preventDefault();
    eventoInstalacion = evento;
    botonInstalar.hidden = false;
  });

  botonInstalar.addEventListener('click', function () {
    if (!eventoInstalacion) return;
    const evento = eventoInstalacion;
    eventoInstalacion = null;
    botonInstalar.hidden = true;
    evento.prompt();
    evento.userChoice.then(function (eleccion) {
      /* Si cierra el diálogo sin instalar, el navegador no vuelve a ofrecerlo en
         esta página: los pasos escritos siguen ahí. */
      if (eleccion.outcome === 'accepted') marcarInstalada();
    }).catch(function () { /* el navegador cerró el diálogo */ });
  });

  window.addEventListener('appinstalled', marcarInstalada);

  /* En iPhone y iPad la aplicación instalada tiene su propio almacenamiento: lo
     que está guardado en Safari no pasa a ella. Se avisa antes de que suceda. */
  function fichasSinSubirEnEsteNavegador() {
    try {
      const lista = JSON.parse(localStorage.getItem(CLAVE_ENCUESTAS) || '[]');
      return Array.isArray(lista) ? lista.filter(function (f) { return f && f.sincronizada !== true; }).length : 0;
    } catch (error) {
      return 0;
    }
  }

  const pendientes = fichasSinSubirEnEsteNavegador();
  if (sistema === 'ios' && pendientes > 0) {
    document.getElementById('avisoPendientesTexto').textContent =
      (pendientes === 1 ? 'Tiene 1 ficha sin subir' : 'Tiene ' + pendientes + ' fichas sin subir') +
      ' en este navegador. Antes de instalar, ábrala y toque «Sincronizar ahora»: la aplicación instalada no verá ' +
      'lo guardado aquí.';
    document.getElementById('avisoPendientes').hidden = false;
  }
})();
