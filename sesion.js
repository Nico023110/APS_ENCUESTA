/* =========================================================
   Encuesta_APS — Sesión en el navegador
   ---------------------------------------------------------
   Se carga en la cabecera de index.html, antes que el resto, y hace cuatro
   cosas:

   1. Puerta. Sin un perfil en caché manda a /login antes de pintar nada.
      El perfil (nombre, rol, equipo; nunca el token, que es HttpOnly) se
      guarda al iniciar sesión para poder abrir la aplicación sin red
      (RN-223): en terreno el servidor confirma la sesión cuando vuelve la
      señal, y si dice que ya no existe, se sale.
   2. fetch. Toda llamada a /api/ lleva la cabecera anti-CSRF y la cookie;
      un 401 cierra la sesión local y vuelve al inicio de sesión.
   3. Bloqueo por inactividad (RN-223.6). Tras 15 minutos sin tocar la
      pantalla se cubre la aplicación y se pide la contraseña de nuevo. La
      ficha en curso no se pierde: sigue debajo.
   4. Firma. Los ítems 10 y 12-14 (equipo y responsable) se escriben desde la
      sesión y quedan fijos; el servidor los impone igual, esto sólo evita que
      el encuestador los teclee.
   ========================================================================= */

(function () {
  'use strict';

  const CLAVE_CACHE = 'aps_sesion_usuario';
  const RUTA_LOGIN = '/login.html';
  const INACTIVIDAD_BLOQUEO_MS = 15 * 60 * 1000;
  const REVISION_INACTIVIDAD_MS = 30 * 1000;

  let usuario = leerCache();
  let ultimaActividad = Date.now();
  let bloqueada = false;

  /* ---------------------------------------------------------
     1. PUERTA
     --------------------------------------------------------- */

  function leerCache() {
    try {
      const crudo = localStorage.getItem(CLAVE_CACHE);
      if (!crudo) return null;
      const datos = JSON.parse(crudo);
      return datos && datos.id && datos.rol ? datos : null;
    } catch (error) {
      return null;
    }
  }

  function guardarCache(datos) {
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(datos)); } catch (error) { /* sin almacenamiento */ }
  }

  function borrarCache() {
    try { localStorage.removeItem(CLAVE_CACHE); } catch (error) { /* sin almacenamiento */ }
  }

  function irAlInicioDeSesion(motivo) {
    const destino = RUTA_LOGIN + (motivo ? '?motivo=' + encodeURIComponent(motivo) : '');
    document.documentElement.classList.add('sin-sesion');
    window.location.replace(destino);
  }

  if (!usuario) {
    irAlInicioDeSesion('');
    return;
  }

  if (usuario.debeCambiarClave) {
    irAlInicioDeSesion('clave');
    return;
  }

  document.documentElement.classList.add('con-sesion', 'nivel-' + usuario.nivel);

  /* ---------------------------------------------------------
     2. FETCH
     --------------------------------------------------------- */

  const fetchOriginal = window.fetch.bind(window);

  function esApiPropia(url) {
    try {
      const resuelta = new URL(url, window.location.origin);
      return resuelta.origin === window.location.origin && resuelta.pathname.indexOf('/api/') === 0;
    } catch (error) {
      return false;
    }
  }

  window.fetch = function (entrada, opciones) {
    const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url);
    if (!esApiPropia(url)) return fetchOriginal(entrada, opciones);

    const conf = Object.assign({}, opciones || {});
    const cabeceras = new Headers(conf.headers || (entrada instanceof Request ? entrada.headers : undefined));
    cabeceras.set('X-Requested-With', 'fetch');
    conf.headers = cabeceras;
    conf.credentials = 'same-origin';

    return fetchOriginal(entrada, conf).then(function (respuesta) {
      if (respuesta.status === 401) {
        cerrarLocalmente('expirada');
      } else if (respuesta.status === 403) {
        respuesta.clone().json().then(function (cuerpo) {
          if (cuerpo && cuerpo.codigo === 'clave_temporal') irAlInicioDeSesion('clave');
        }).catch(function () {});
      }
      return respuesta;
    });
  };

  function cerrarLocalmente(motivo) {
    borrarCache();
    irAlInicioDeSesion(motivo);
  }

  /* Confirmación con el servidor. Sin red se sigue con la caché. */
  function confirmarConServidor() {
    return window.fetch('/api/sesion').then(function (respuesta) {
      if (!respuesta.ok) return null;
      return respuesta.json();
    }).then(function (cuerpo) {
      if (cuerpo && cuerpo.usuario) {
        usuario = cuerpo.usuario;
        guardarCache(usuario);
        aplicarEnInterfaz();
      }
    }).catch(function () { /* sin red: la caché manda */ });
  }

  /* ---------------------------------------------------------
     3. BLOQUEO POR INACTIVIDAD
     --------------------------------------------------------- */

  function anotarActividad() {
    if (!bloqueada) ultimaActividad = Date.now();
  }

  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (evento) {
    window.addEventListener(evento, anotarActividad, { passive: true });
  });

  function revisarInactividad() {
    if (bloqueada) return;
    if (Date.now() - ultimaActividad >= INACTIVIDAD_BLOQUEO_MS) bloquear();
  }

  function bloquear() {
    const velo = document.getElementById('bloqueoSesion');
    if (!velo) return;
    bloqueada = true;
    velo.hidden = false;
    document.querySelectorAll('.app-header, .app-main').forEach(function (el) { el.setAttribute('inert', ''); });
    const nombre = velo.querySelector('[data-bloqueo="nombre"]');
    if (nombre) nombre.textContent = usuario.nombre;
    const clave = velo.querySelector('input[name="clave"]');
    if (clave) { clave.value = ''; setTimeout(function () { clave.focus(); }, 60); }
    mostrarErrorBloqueo('');
  }

  function desbloquear() {
    const velo = document.getElementById('bloqueoSesion');
    if (velo) velo.hidden = true;
    document.querySelectorAll('.app-header, .app-main').forEach(function (el) { el.removeAttribute('inert'); });
    bloqueada = false;
    ultimaActividad = Date.now();
  }

  function mostrarErrorBloqueo(texto) {
    const aviso = document.querySelector('#bloqueoSesion [data-bloqueo="error"]');
    if (!aviso) return;
    aviso.textContent = texto;
    aviso.hidden = !texto;
  }

  function reingresar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const clave = formulario.querySelector('input[name="clave"]').value;
    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;

    window.fetch('/api/iniciar_sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento: usuario.documento, clave: clave })
    }).then(function (respuesta) {
      return respuesta.json().catch(function () { return {}; }).then(function (cuerpo) {
        if (respuesta.ok && cuerpo.usuario) {
          usuario = cuerpo.usuario;
          guardarCache(usuario);
          desbloquear();
          return;
        }
        mostrarErrorBloqueo(cuerpo.error || 'No fue posible verificar la contraseña.');
      });
    }).catch(function () {
      mostrarErrorBloqueo('Sin conexión: no es posible verificar la contraseña ahora.');
    }).then(function () { boton.disabled = false; });
  }

  /* ---------------------------------------------------------
     4. INTERFAZ: cabecera, permisos y firma del formulario
     --------------------------------------------------------- */

  function iniciales(nombre) {
    return String(nombre || '').trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  }

  function pintarCabecera() {
    const contenedor = document.getElementById('appUsuario');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const chip = document.createElement('div');
    chip.className = 'app-usuario';

    const avatar = document.createElement('span');
    avatar.className = 'app-usuario__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = iniciales(usuario.nombre);

    const texto = document.createElement('span');
    texto.className = 'app-usuario__texto';
    const nombre = document.createElement('span');
    nombre.className = 'app-usuario__nombre';
    nombre.textContent = usuario.nombre;
    const detalle = document.createElement('span');
    detalle.className = 'app-usuario__detalle';
    detalle.textContent = usuario.rolEtiqueta + (usuario.equipoCodigo ? ' · ' + usuario.equipoCodigo : '');
    texto.appendChild(nombre);
    texto.appendChild(detalle);

    const salir = document.createElement('button');
    salir.type = 'button';
    salir.className = 'app-usuario__salir';
    salir.title = 'Cerrar sesión';
    salir.setAttribute('aria-label', 'Cerrar sesión');
    salir.innerHTML = '<i class="ph ph-sign-out" aria-hidden="true"></i>';
    salir.addEventListener('click', cerrarSesion);

    chip.appendChild(avatar);
    chip.appendChild(texto);
    chip.appendChild(salir);
    contenedor.appendChild(chip);
  }

  function cerrarSesion() {
    window.fetch('/api/cerrar_sesion', { method: 'POST' })
      .catch(function () {})
      .then(function () { cerrarLocalmente(''); });
  }

  const CAMPOS_FIRMA = ['equipoSaludId', 'responsableTipoId', 'responsableNumeroId', 'perfilProfesional', 'perfilProfesionalOtro'];

  function fijarCampo(formulario, nombre, valor) {
    const control = formulario.querySelector('[name="' + nombre + '"]');
    if (!control) return;
    if (valor !== null && valor !== undefined) control.value = valor;
    control.classList.add('is-sesion');
    if (control.tagName === 'SELECT') {
      control.setAttribute('tabindex', '-1');
      control.setAttribute('aria-readonly', 'true');
    } else {
      control.readOnly = true;
    }
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function aplicarEnFormulario(formulario) {
    if (!formulario || !usuario || usuario.nivel === 'administrador') return;
    fijarCampo(formulario, 'equipoSaludId', usuario.equipoCodigo || '');
    fijarCampo(formulario, 'responsableTipoId', usuario.tipoId || 'CC');
    fijarCampo(formulario, 'responsableNumeroId', usuario.documento);
    fijarCampo(formulario, 'perfilProfesional', usuario.perfilProfesional || usuario.rol);
    if (usuario.perfilOtro) fijarCampo(formulario, 'perfilProfesionalOtro', usuario.perfilOtro);

    const nota = formulario.querySelector('[data-sesion="nota"]');
    if (nota) {
      nota.hidden = false;
      (nota.querySelector('span') || nota).textContent =
        'Equipo y responsable tomados de su sesión: ' + usuario.nombre +
        (usuario.equipoCodigo ? ', ' + usuario.equipoCodigo : '') + '.';
    }
  }

  function aplicarEnInterfaz() {
    const raiz = document.documentElement.classList;
    Array.from(raiz).forEach(function (clase) { if (clase.indexOf('nivel-') === 0) raiz.remove(clase); });
    raiz.add('con-sesion', 'nivel-' + usuario.nivel);
    pintarCabecera();
    aplicarEnFormulario(document.getElementById('encuestaForm'));
  }

  function puede(permiso) {
    return !!usuario && Array.isArray(usuario.permisos) && usuario.permisos.indexOf(permiso) !== -1;
  }

  document.addEventListener('DOMContentLoaded', function () {
    aplicarEnInterfaz();
    const formularioBloqueo = document.querySelector('#bloqueoSesion form');
    if (formularioBloqueo) formularioBloqueo.addEventListener('submit', reingresar);
    const cambiar = document.querySelector('#bloqueoSesion [data-bloqueo="salir"]');
    if (cambiar) cambiar.addEventListener('click', cerrarSesion);
    setInterval(revisarInactividad, REVISION_INACTIVIDAD_MS);
    confirmarConServidor();
  });

  window.SESION = {
    usuario: function () { return usuario; },
    puede: puede,
    aplicarEnFormulario: aplicarEnFormulario,
    cerrar: cerrarSesion,
    bloquear: bloquear
  };
})();
