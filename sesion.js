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
   3. Bloqueo por inactividad (RN-223.6). Tras 20 minutos sin tocar la
      pantalla se cubre la aplicación, se borra de la memoria la llave de las
      fichas (boveda.js) y se pide la contraseña de nuevo. Sin señal, la
      contraseña se verifica contra la copia del dispositivo (acceso_local.js).
      La ficha en curso no se pierde: sigue debajo. Una página nueva no tiene la
      llave, así que abrir la aplicación siempre la pide, salvo recién ingresada.
   4. Firma. Los ítems 10 y 12-14 (equipo y responsable) se escriben desde la
      sesión y quedan fijos; el servidor los impone igual, esto sólo evita que
      el encuestador los teclee.
   ========================================================================= */

(function () {
  'use strict';

  const CLAVE_CACHE = 'aps_sesion_usuario';
  const RUTA_LOGIN = '/login.html';
  const INACTIVIDAD_BLOQUEO_MS = 20 * 60 * 1000;
  const REVISION_INACTIVIDAD_MS = 30 * 1000;

  /* Cuánto se le espera al servidor antes de seguir como si no hubiera señal.
     Con una rayita de cobertura navigator.onLine dice que hay red y la petición
     se queda colgada varios minutos: quien está en la vivienda no puede esperar
     a que el sistema se rinda, y la ficha se conserva igual. Un reenvío no
     duplica nada: el servidor reconoce la ficha por su código. Lo demás (los
     reportes, que tardan) no lleva límite. */
  const LIMITE_API_MS = {
    '/api/guardar_encuesta': 45000,
    '/api/listar_fichas': 20000,
    '/api/sesion': 15000,
    '/api/cerrar_sesion': 8000,
    '/api/catalogo_acciones': 20000,
    '/api/catalogo_dinamico': 20000,
    '/api/buscar_cups': 10000
  };
  const LIMITE_DESBLOQUEO_MS = 10000;

  let usuario = leerCache();
  let ultimaActividad = Date.now();
  let bloqueada = true;

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

  /* Antes de pintar nada: lo que hay en pantalla no se ve hasta tener la llave de
     las fichas, y una página nueva no la tiene (ver abrirAlCargar). */
  document.documentElement.classList.add('pantalla-bloqueada');

  /* ---------------------------------------------------------
     2. FETCH
     --------------------------------------------------------- */

  const fetchOriginal = window.fetch.bind(window);

  function rutaDe(url) {
    try {
      const resuelta = new URL(url, window.location.origin);
      return resuelta.origin === window.location.origin ? resuelta.pathname : null;
    } catch (error) {
      return null;
    }
  }

  function esApiPropia(url) {
    const ruta = rutaDe(url);
    return ruta !== null && ruta.indexOf('/api/') === 0;
  }

  /* Pone tope de tiempo a una petición, respetando la señal que ya traiga (la
     búsqueda de CUPS cancela la anterior). Devuelve con qué soltar el tope. */
  function ponerLimite(conf, limiteMs) {
    if (!limiteMs || typeof AbortController !== 'function') return function () {};

    const control = new AbortController();
    const propia = conf.signal;
    if (propia) {
      if (propia.aborted) control.abort(propia.reason);
      else propia.addEventListener('abort', function () { control.abort(propia.reason); }, { once: true });
    }
    conf.signal = control.signal;

    /* Con otro nombre que el de una cancelación: el buscador de CUPS calla las
       cancelaciones, y esto sí es «no hubo respuesta». */
    const temporizador = setTimeout(function () {
      const error = new Error('El servidor no respondió a tiempo');
      error.name = 'TimeoutError';
      control.abort(error);
    }, limiteMs);
    return function () { clearTimeout(temporizador); };
  }

  window.fetch = function (entrada, opciones) {
    const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url);
    if (!esApiPropia(url)) return fetchOriginal(entrada, opciones);

    const conf = Object.assign({}, opciones || {});
    const cabeceras = new Headers(conf.headers || (entrada instanceof Request ? entrada.headers : undefined));
    cabeceras.set('X-Requested-With', 'fetch');
    conf.headers = cabeceras;
    conf.credentials = 'same-origin';
    const soltarLimite = ponerLimite(conf, LIMITE_API_MS[rutaDe(url)]);

    return fetchOriginal(entrada, conf).then(function (respuesta) {
      soltarLimite();
      if (respuesta.status === 401) {
        if (window.ACCESO_LOCAL) window.ACCESO_LOCAL.olvidarSesion();
        cerrarLocalmente('expirada');
      } else if (respuesta.status === 403) {
        respuesta.clone().json().then(function (cuerpo) {
          if (cuerpo && cuerpo.codigo === 'clave_temporal') irAlInicioDeSesion('clave');
        }).catch(function () {});
      }
      return respuesta;
    }, function (error) {
      soltarLimite();
      throw error;
    });
  };

  /* El listado de fichas se pide ya, desde la cabecera, y no cuando el
     navegador termina de descargar y procesar el resto de los scripts: Inicio
     lo necesita primero, y así la red trabaja mientras tanto. app.js lo toma
     en su primera lectura (refrescarFichasDelServidor); pasa por el fetch de
     arriba, con su cabecera anti-CSRF y su manejo del 401. */
  let listadoAnticipado = navigator.onLine === false ? null : window.fetch('/api/listar_fichas');
  if (listadoAnticipado) listadoAnticipado.catch(function () { /* app.js lo atiende al tomarlo */ });

  function tomarListadoAnticipado() {
    const pedido = listadoAnticipado;
    listadoAnticipado = null;
    return pedido;
  }

  function cerrarLocalmente(motivo) {
    borrarCache();
    if (window.BOVEDA) window.BOVEDA.cerrar();
    irAlInicioDeSesion(motivo);
  }

  /* Confirmación con el servidor. Sin red se sigue con la caché. */
  function confirmarConServidor() {
    return window.fetch('/api/sesion').then(function (respuesta) {
      if (!respuesta.ok) return null;
      return respuesta.json();
    }).then(function (cuerpo) {
      if (cuerpo && cuerpo.usuario) {
        /* La sesión de otra persona no se adopta en silencio: lo que se guardara
           de aquí en adelante saldría firmado por ella. */
        if (String(cuerpo.usuario.documento) !== String(usuario.documento)) {
          cerrarSesion();
          return;
        }
        usuario = cuerpo.usuario;
        guardarCache(usuario);
        if (window.ACCESO_LOCAL) window.ACCESO_LOCAL.confirmar(usuario.documento, usuario);
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

  /* En segundo plano los temporizadores se duermen: al volver a la aplicación
     se revisa ya, no al siguiente tic, para no dejar ver la ficha unos segundos. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') return;
    revisarQueSigueSiendoSuSesion();
    revisarInactividad();
  });
  window.addEventListener('pageshow', function () {
    revisarQueSigueSiendoSuSesion();
    revisarInactividad();
  });

  /* La cookie y el perfil guardado son de todo el navegador. Si en otra pestaña se
     cerró la sesión o entró otra persona, ésta seguiría mostrando las fichas de
     quien ya no está y, al sincronizar, las subiría con la sesión nueva. */
  function revisarQueSigueSiendoSuSesion() {
    const guardado = leerCache();
    if (!guardado || String(guardado.documento) !== String(usuario.documento)) irAlInicioDeSesion('');
  }

  window.addEventListener('storage', function (evento) {
    if (evento.key === CLAVE_CACHE || evento.key === null) revisarQueSigueSiendoSuSesion();
  });

  const TEXTOS_DEL_VELO = {
    bloqueo: { titulo: 'Sesión bloqueada por inactividad', intro: 'La ficha en curso sigue abajo, tal como la dejó.' },
    apertura: { titulo: 'Sus fichas están protegidas', intro: 'Lo guardado en este equipo se abre con su contraseña.' }
  };

  function ponerTextosDelVelo(velo, textos) {
    const titulo = velo.querySelector('[data-bloqueo="titulo"]');
    const intro = velo.querySelector('[data-bloqueo="intro"]');
    if (titulo) titulo.textContent = textos.titulo;
    if (intro) intro.textContent = textos.intro;
  }

  /* Lo último antes de cubrir la pantalla es soltar la llave de las fichas: la ficha
     en curso se escribe cifrada justo antes (captura_local.js). */
  function bloquear(motivo) {
    const velo = document.getElementById('bloqueoSesion');
    if (!velo) return;
    bloqueada = true;
    if (window.BOVEDA) window.BOVEDA.cerrar();
    ponerTextosDelVelo(velo, motivo === 'apertura' ? TEXTOS_DEL_VELO.apertura : TEXTOS_DEL_VELO.bloqueo);
    velo.hidden = false;
    document.documentElement.classList.add('pantalla-bloqueada');
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
    document.documentElement.classList.remove('pantalla-bloqueada');
    document.querySelectorAll('.app-header, .app-main').forEach(function (el) { el.removeAttribute('inert'); });
    bloqueada = false;
    ultimaActividad = Date.now();
    /* Es la que abre las fichas: no se queda en un campo escondido. */
    const clave = velo && velo.querySelector('input[name="clave"]');
    if (clave) clave.value = '';
  }

  /* Recién ingresada, la llave viene en camino desde el acceso (boveda.js): se espera
     sin enseñar la contraseña. En cualquier otro caso, una página nueva no tiene con
     qué abrir las fichas, y se pide de una vez. */
  function abrirAlCargar() {
    const boveda = window.BOVEDA;
    if (boveda && boveda.abierta()) {
      desbloquear();
    } else if (boveda && boveda.hayEntregaEnCamino()) {
      boveda.recibir(usuario.documento).then(function (recibida) {
        if (recibida) desbloquear();
        else bloquear('apertura');
      });
    } else {
      bloquear('apertura');
    }
  }

  /* La contraseña ya está verificada. Sin la llave de las fichas no se destapa nada:
     no habría qué mostrar, y lo que se capturara no se podría guardar. */
  function abrirFichasYEntrar(apertura, opciones) {
    return apertura.abrir(opciones).then(function (resultado) {
      if (resultado.ok) {
        desbloquear();
        return;
      }
      mostrarErrorBloqueo(resultado.codigo === 'no_disponible'
        ? 'Este navegador no permite proteger las fichas. Abra la aplicación por su dirección https, en un navegador ' +
          'actualizado.'
        : 'No fue posible abrir las fichas de este equipo. Lo guardado sigue aquí: avise al administrador.');
    });
  }

  function mostrarErrorBloqueo(texto) {
    const aviso = document.querySelector('#bloqueoSesion [data-bloqueo="error"]');
    if (!aviso) return;
    aviso.textContent = texto;
    aviso.hidden = !texto;
  }

  /* Sin servidor, contra la copia del dispositivo (acceso_local.js): sólo deja
     seguir capturando. Al volver la señal, la API dirá si la sesión sigue viva. */
  function verificarEnElDispositivo(clave) {
    if (!window.ACCESO_LOCAL) {
      mostrarErrorBloqueo('Sin conexión: no es posible verificar la contraseña ahora.');
      return Promise.resolve();
    }
    /* Las dos derivaciones a la vez: una después de la otra tardaría el doble. */
    const apertura = window.BOVEDA.prepararApertura(usuario.documento, clave);
    return window.ACCESO_LOCAL.verificar(usuario.documento, clave).then(function (resultado) {
      if (resultado.ok) return abrirFichasYEntrar(apertura);
      mostrarErrorBloqueo(resultado.mensaje);
      return undefined;
    });
  }

  function verificarConElServidor(clave) {
    const conf = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      credentials: 'same-origin',
      body: JSON.stringify({ documento: usuario.documento, clave: clave })
    };
    const soltarLimite = ponerLimite(conf, LIMITE_DESBLOQUEO_MS);

    /* Sin pasar por window.fetch: ahí un 401 cierra la sesión, y aquí sólo quiere
       decir que la contraseña está mal escrita. */
    return fetchOriginal('/api/iniciar_sesion', conf).then(function (respuesta) {
      soltarLimite();
      /* Un servidor caído es como no tener señal; un rechazo no. */
      if (respuesta.status >= 500) return verificarEnElDispositivo(clave);

      return respuesta.json().catch(function () { return {}; }).then(function (cuerpo) {
        if (!respuesta.ok || !cuerpo.usuario) {
          mostrarErrorBloqueo(cuerpo.error || 'No fue posible verificar la contraseña.');
          return;
        }
        usuario = cuerpo.usuario;
        guardarCache(usuario);
        /* Una contraseña temporal no abre ni envuelve nada: sirve para crear la
           definitiva, y las fichas se pasan a ésa (login.js). */
        if (usuario.debeCambiarClave) {
          irAlInicioDeSesion('clave');
          return undefined;
        }
        const apertura = window.BOVEDA.prepararApertura(usuario.documento, clave);
        const recordada = window.ACCESO_LOCAL
          ? window.ACCESO_LOCAL.recordar(usuario.documento, clave, usuario)
          : Promise.resolve();
        return recordada.then(function () {
          return abrirFichasYEntrar(apertura, { custodia: cuerpo.llaveCustodia });
        });
      });
    }, function () {
      soltarLimite();
      return verificarEnElDispositivo(clave);
    });
  }

  function reingresar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const clave = formulario.querySelector('input[name="clave"]').value;
    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;
    mostrarErrorBloqueo('');

    const verificacion = window.navigator.onLine === false
      ? verificarEnElDispositivo(clave)
      : verificarConElServidor(clave);

    verificacion.catch(function () {
      mostrarErrorBloqueo('No fue posible verificar la contraseña. Intente de nuevo.');
    }).then(function () { boton.disabled = false; });
  }

  /* ---------------------------------------------------------
     4. INTERFAZ: cabecera, permisos y firma del formulario
     --------------------------------------------------------- */

  function iniciales(nombre) {
    return String(nombre || '').trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  }

  /* El chip es un botón que despliega el menú del usuario: las acciones
     dependen de los permisos (la vista de usuarios con usuarios.ver —«Crear
     usuarios» para la coordinación, que crea pero no modifica—, Reportes con
     productividad.ver o reporte.generar) y Cerrar sesión va siempre al final. */
  function pintarCabecera() {
    const contenedor = document.getElementById('appUsuario');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'app-usuario';
    chip.setAttribute('aria-haspopup', 'menu');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-controls', 'menuUsuario');
    chip.title = 'Opciones de ' + usuario.nombre;

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
    detalle.textContent = usuario.rolEtiqueta + equiposDeLaCabecera();
    texto.appendChild(nombre);
    texto.appendChild(detalle);

    const flecha = document.createElement('span');
    flecha.className = 'app-usuario__flecha';
    flecha.setAttribute('aria-hidden', 'true');
    flecha.innerHTML = '<i class="ph ph-caret-down"></i>';

    chip.appendChild(avatar);
    chip.appendChild(texto);
    chip.appendChild(flecha);

    const menu = document.createElement('div');
    menu.className = 'app-menu';
    menu.id = 'menuUsuario';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const cabecera = document.createElement('div');
    cabecera.className = 'app-menu__cabecera';
    cabecera.innerHTML = '<span class="app-menu__nombre"></span><span class="app-menu__detalle"></span>';
    cabecera.querySelector('.app-menu__nombre').textContent = usuario.nombre;
    cabecera.querySelector('.app-menu__detalle').textContent = usuario.rolEtiqueta +
      equiposDeLaCabecera() + ' · ' + usuario.tipoId + ' ' + usuario.documento;
    menu.appendChild(cabecera);

    const opciones = [];
    if (puede('usuarios.ver')) {
      opciones.push({ icono: 'ph-users-three', texto: puede('usuarios.modificar') ? 'Modificar usuarios' : 'Crear usuarios', accion: function () {
        if (window.USUARIOS) window.USUARIOS.abrir();
      } });
    }
    /* Un solo apartado para los tableros, la productividad y las descargas:
       su menú lateral (tableros.js) lleva a cada uno. */
    if (puede('productividad.ver') || puede('reporte.generar')) {
      opciones.push({ icono: 'ph-chart-bar', texto: 'Reportes', accion: function () {
        if (window.REPORTES) window.REPORTES.abrir();
      } });
    }
    /* En teléfono o tableta, mientras no esté instalada. */
    if (window.PWA && !window.PWA.instalada() && window.PWA.esTactil()) {
      opciones.push({ icono: 'ph-download-simple', texto: 'Instalar la aplicación', accion: function () {
        window.location.assign('/instalar');
      } });
    }
    opciones.push({ icono: 'ph-lock-key', texto: 'Bloquear pantalla', accion: bloquear });
    opciones.push({ icono: 'ph-sign-out', texto: 'Cerrar sesión', accion: cerrarSesion, peligro: true });

    opciones.forEach(function (op) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'app-menu__item' + (op.peligro ? ' app-menu__item--peligro' : '');
      item.setAttribute('role', 'menuitem');
      item.innerHTML = '<i class="ph ' + op.icono + '" aria-hidden="true"></i><span></span>';
      item.querySelector('span').textContent = op.texto;
      item.addEventListener('click', function () { cerrarMenu(); op.accion(); });
      menu.appendChild(item);
    });

    function abrirMenu() {
      menu.hidden = false;
      chip.setAttribute('aria-expanded', 'true');
      const primero = menu.querySelector('.app-menu__item');
      if (primero) primero.focus();
    }
    function cerrarMenu() {
      menu.hidden = true;
      chip.setAttribute('aria-expanded', 'false');
    }

    chip.addEventListener('click', function () { if (menu.hidden) abrirMenu(); else cerrarMenu(); });
    document.addEventListener('click', function (evento) {
      if (!menu.hidden && !contenedor.contains(evento.target)) cerrarMenu();
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && !menu.hidden) { cerrarMenu(); chip.focus(); }
    });

    contenedor.appendChild(chip);
    contenedor.appendChild(menu);
  }

  function cerrarSesion() {
    window.fetch('/api/cerrar_sesion', { method: 'POST' }).then(function (respuesta) {
      if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
      if (window.ACCESO_LOCAL) window.ACCESO_LOCAL.olvidarSesion();
    }).catch(function () {
      /* Sin señal el servidor no se entera y la cookie sigue viva: con señal, el
         acceso la cierra antes de dejar entrar a nadie (login.js). */
      if (window.ACCESO_LOCAL) window.ACCESO_LOCAL.anotarCierrePendiente();
    }).then(function () { cerrarLocalmente(''); });
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

  /* La coordinación no pertenece a un EBS: lidera zonas con varios. Sin
     equipo propio, el ítem 10 queda abierto para indicar el EBS de la visita,
     con la lista de los registrados (app.js); el servidor exige que exista. */
  function equiposDeLaCabecera() {
    const apoyo = Array.isArray(usuario.equiposApoyoCodigos) ? usuario.equiposApoyoCodigos : [];
    return (usuario.equipoCodigo ? ' · ' + usuario.equipoCodigo : '') +
      (apoyo.length > 0 ? ' · Apoya a ' + apoyo.join(', ') : '');
  }

  function eligeEquipoDeLaFicha() {
    return !usuario.equipoCodigo && usuario.nivel === 'coordinacion';
  }

  /* Quien apoya a varios EBS sin pertenecer a ellos (enfoque diferencial)
     elige en el ítem 10 el de la visita entre los suyos; con uno solo, ese
     queda fijo. El servidor rechaza cualquier otro. */
  function equiposQueApoya() {
    if (usuario.nivel === 'coordinacion') return [];
    const apoyo = Array.isArray(usuario.equiposApoyoCodigos) ? usuario.equiposApoyoCodigos : [];
    if (apoyo.length === 0) return [];
    return (usuario.equipoCodigo ? [usuario.equipoCodigo] : []).concat(apoyo.filter(function (c) {
      return c !== usuario.equipoCodigo;
    }));
  }

  function abrirCampoDeEquipo(formulario, lista, ejemplo) {
    const control = formulario.querySelector('[name="equipoSaludId"]');
    if (!control) return;
    control.readOnly = false;
    control.classList.remove('is-sesion');
    control.setAttribute('list', lista || 'listaEquiposEbs');
    control.setAttribute('autocomplete', 'off');
    control.placeholder = 'EBS de esta visita, ej. ' + (ejemplo || 'EBS001');
  }

  function listaDeApoyo(equipos) {
    let lista = document.getElementById('listaEquiposApoyo');
    if (!lista) {
      lista = document.createElement('datalist');
      lista.id = 'listaEquiposApoyo';
      document.body.appendChild(lista);
    }
    lista.innerHTML = '';
    equipos.forEach(function (codigo) {
      const opcion = document.createElement('option');
      opcion.value = codigo;
      lista.appendChild(opcion);
    });
    return lista.id;
  }

  function aplicarEnFormulario(formulario) {
    if (!formulario || !usuario || usuario.nivel === 'administrador') return;
    const apoyo = equiposQueApoya();
    if (eligeEquipoDeLaFicha()) abrirCampoDeEquipo(formulario);
    else if (apoyo.length > 1) abrirCampoDeEquipo(formulario, listaDeApoyo(apoyo), apoyo[0]);
    else fijarCampo(formulario, 'equipoSaludId', apoyo[0] || usuario.equipoCodigo || '');
    fijarCampo(formulario, 'responsableTipoId', usuario.tipoId || 'CC');
    fijarCampo(formulario, 'responsableNumeroId', usuario.documento);
    fijarCampo(formulario, 'perfilProfesional', usuario.perfilProfesional || usuario.rol);
    if (usuario.perfilOtro) fijarCampo(formulario, 'perfilProfesionalOtro', usuario.perfilOtro);

    const nota = formulario.querySelector('[data-sesion="nota"]');
    if (nota) {
      nota.hidden = false;
      (nota.querySelector('span') || nota).textContent = eligeEquipoDeLaFicha()
        ? 'Responsable tomado de su sesión: ' + usuario.nombre + '. Como lidera una zona, indique en el ítem 10 ' +
          'el EBS de esta visita.'
        : apoyo.length > 1
          ? 'Responsable tomado de su sesión: ' + usuario.nombre + '. Indique en el ítem 10 el EBS al que apoya en ' +
            'esta visita: ' + apoyo.join(', ') + '.'
          : 'Equipo y responsable tomados de su sesión: ' + usuario.nombre +
            (apoyo[0] || usuario.equipoCodigo ? ', ' + (apoyo[0] || usuario.equipoCodigo) : '') + '.';
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
    abrirAlCargar();
    setInterval(revisarInactividad, REVISION_INACTIVIDAD_MS);
    confirmarConServidor();
  });

  window.SESION = {
    usuario: function () { return usuario; },
    puede: puede,
    aplicarEnFormulario: aplicarEnFormulario,
    cerrar: cerrarSesion,
    bloquear: bloquear,
    tomarListadoAnticipado: tomarListadoAnticipado
  };
})();
