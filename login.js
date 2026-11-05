/* =========================================================
   Encuesta_APS — Inicio de sesión (login.html)
   ---------------------------------------------------------
   Dos pasos en la misma tarjeta: credenciales y, sólo en el primer
   ingreso, creación de la contraseña propia. Al terminar guarda el perfil
   público en localStorage (sesion.js lo lee para abrir la app sin red) y
   pasa a index.html.

   Sin señal, o con el servidor caído, la contraseña se compara contra la
   copia que dejó el último ingreso con señal en este equipo (acceso_local.js).
   Eso sólo deja seguir capturando: para sincronizar hay que entrar con señal.

   Con la contraseña verificada se abren las fichas del dispositivo (boveda.js), y
   la llave pasa a la aplicación sin escribirse en ninguna parte. Si eso no se puede,
   la aplicación vuelve a pedir la contraseña.
   ========================================================= */

(function () {
  'use strict';

  const CLAVE_CACHE = 'aps_sesion_usuario';
  const CLAVES_DE_LA_SESION_ANTERIOR = ['aps_ultima_actividad', 'aps_pantalla_bloqueada'];
  const DESTINO = '/';
  const ACCESO_LOCAL = window.ACCESO_LOCAL;
  const BOVEDA = window.BOVEDA;

  /* Con una rayita de señal la petición se queda colgada: pasado esto se sigue
     como si no hubiera red. */
  const LIMITE_INGRESO_MS = 15000;
  const LIMITE_CONSULTA_MS = 10000;

  const formAcceso = document.getElementById('formAcceso');
  const formClave = document.getElementById('formClave');
  const avisoMotivo = document.getElementById('avisoMotivo');
  const errorAcceso = document.getElementById('errorAcceso');
  const errorClave = document.getElementById('errorClave');
  const campoClaveActual = document.getElementById('campoClaveActual');

  let usuario = null;
  let claveTemporalEnMemoria = '';

  /* ---------------------------------------------------------
     Utilidades
     --------------------------------------------------------- */

  function api(ruta, cuerpo, limiteMs) {
    const control = limiteMs && typeof AbortController === 'function' ? new AbortController() : null;
    const temporizador = control ? setTimeout(function () { control.abort(); }, limiteMs) : null;

    return fetch(ruta, {
      method: cuerpo ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: cuerpo
        ? { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }
        : { 'X-Requested-With': 'fetch' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: control ? control.signal : undefined
    }).then(function (respuesta) {
      return respuesta.json().catch(function () { return {}; }).then(function (datos) {
        clearTimeout(temporizador);
        return { ok: respuesta.ok, estado: respuesta.status, datos: datos };
      });
    }, function (error) {
      clearTimeout(temporizador);
      throw error;
    });
  }

  function mostrarError(elemento, texto) {
    elemento.textContent = texto || '';
    elemento.hidden = !texto;
  }

  function ocupado(boton, siOcupado, textoOcupado) {
    const etiqueta = boton.querySelector('[data-etiqueta]');
    if (!boton.dataset.etiquetaOriginal) boton.dataset.etiquetaOriginal = etiqueta.textContent;
    boton.disabled = siOcupado;
    boton.classList.toggle('is-ocupado', siOcupado);
    etiqueta.textContent = siOcupado ? textoOcupado : boton.dataset.etiquetaOriginal;
  }

  function guardarPerfil(perfil) {
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(perfil)); } catch (error) { /* sin almacenamiento */ }
  }

  function entrar(perfil) {
    guardarPerfil(perfil);
    /* Un ingreso recién hecho no abre bloqueado por la inactividad de antes. */
    try {
      CLAVES_DE_LA_SESION_ANTERIOR.forEach(function (clave) { localStorage.removeItem(clave); });
    } catch (error) { /* sin almacenamiento */ }
    return BOVEDA.entregar().then(function () { window.location.replace(DESTINO); });
  }

  /* El servidor acaba de confirmar esta contraseña: queda lista para verificar
     sin señal, y abiertas las fichas, antes de salir de la página, que interrumpiría
     las derivaciones. Corren a la vez: una después de la otra tardaría el doble. */
  function recordarYEntrar(clave, perfil, llaveCustodia) {
    const apertura = BOVEDA.prepararApertura(perfil.documento, clave);
    return ACCESO_LOCAL.recordar(perfil.documento, clave, perfil).then(function () {
      return apertura.abrir({ custodia: llaveCustodia });
    }).then(function () {
      return entrar(perfil);
    });
  }

  /* El formulario ya está a la vista y se puede haber empezado a escribir
     mientras se esperaba al servidor: no se le quita el foco a nadie. */
  function dejarEscribir() {
    if (!formAcceso.contains(document.activeElement)) mostrarPaso('acceso');
  }

  function mostrarPaso(paso) {
    formAcceso.hidden = paso !== 'acceso';
    formClave.hidden = paso !== 'clave';
    const formulario = paso === 'acceso' ? formAcceso : formClave;
    const primero = formulario.querySelector('input:not([hidden]):not([disabled])');
    /* Si ya se está escribiendo en el formulario el foco no se mueve: lo que siguiera
       tecleando caería en otro campo, y la contraseña podría quedar a la vista en el
       del documento. */
    if (primero) {
      setTimeout(function () {
        if (!formulario.contains(document.activeElement)) primero.focus();
      }, 40);
    }
  }

  /* Mostrar / ocultar contraseña */
  document.querySelectorAll('[data-ojo]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      const campo = document.getElementById(boton.dataset.ojo);
      const visible = campo.type === 'text';
      campo.type = visible ? 'password' : 'text';
      boton.setAttribute('aria-pressed', String(!visible));
      boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      boton.querySelector('i').className = visible ? 'ph ph-eye' : 'ph ph-eye-slash';
      campo.focus();
    });
  });

  /* ---------------------------------------------------------
     Recordar el documento (sólo el documento, nunca la clave) y la ayuda
     de «¿Olvidó su contraseña?», que aquí es una explicación, no un flujo.
     --------------------------------------------------------- */

  const CLAVE_DOCUMENTO = 'aps_documento_recordado';
  const recordar = document.getElementById('recordarDocumento');
  try {
    const guardado = localStorage.getItem(CLAVE_DOCUMENTO);
    if (guardado) {
      formAcceso.documento.value = guardado;
      recordar.checked = true;
    }
  } catch (error) { /* sin almacenamiento */ }

  function guardarDocumentoSiSePidio(documento) {
    try {
      if (recordar.checked) localStorage.setItem(CLAVE_DOCUMENTO, documento);
      else localStorage.removeItem(CLAVE_DOCUMENTO);
    } catch (error) { /* sin almacenamiento */ }
  }

  document.getElementById('btnOlvido').addEventListener('click', function () {
    const ayuda = document.getElementById('ayudaAcceso');
    ayuda.hidden = !ayuda.hidden;
  });

  /* ---------------------------------------------------------
     Motivo de llegada (?motivo=expirada | clave)
     --------------------------------------------------------- */

  const motivo = new URLSearchParams(window.location.search).get('motivo');
  if (motivo === 'expirada') {
    avisoMotivo.textContent = 'Su sesión terminó. Inicie sesión de nuevo para continuar.';
    avisoMotivo.hidden = false;
  }

  /* Cada persona sube sólo lo suyo. Quien acaba de cerrar sesión con fichas sin
     subir lo ve al salir. Sólo la cantidad: aquí todavía nadie ha dicho quién es. */
  const sinSubir = window.PWA ? window.PWA.fichasSinSubir() : 0;
  if (sinSubir > 0) {
    const avisoPendientes = document.getElementById('avisoPendientes');
    avisoPendientes.textContent = sinSubir === 1
      ? 'En este equipo hay 1 ficha sin subir. Sólo quien la capturó puede subirla: ingrese con su cuenta cuando ' +
        'tenga señal y toque «Sincronizar ahora».'
      : 'En este equipo hay ' + sinSubir + ' fichas sin subir. Sólo quien las capturó puede subirlas: ingrese con su ' +
        'cuenta cuando tenga señal y toque «Sincronizar ahora».';
    avisoPendientes.hidden = false;
  }

  /* Si ya hay sesión con clave temporal (por ejemplo, se recargó la página
     a mitad del primer ingreso), se salta directo al paso 2. Si hay sesión
     completa, no hay nada que hacer aquí. */
  if (ACCESO_LOCAL.hayCierrePendiente()) {
    /* Alguien cerró sesión sin señal y el servidor no se enteró: la cookie sigue
       viva, y preguntar por ella dejaría entrar sin contraseña. Se cierra primero. */
    api('/api/cerrar_sesion', {}, LIMITE_CONSULTA_MS).then(function (r) {
      if (r.ok) ACCESO_LOCAL.olvidarSesion();
    }).catch(function () { /* sigue pendiente: será con la próxima señal */ }).then(dejarEscribir);
  } else {
    api('/api/sesion', null, LIMITE_CONSULTA_MS).then(function (r) {
      if (!r.ok || !r.datos.usuario) {
        if (r.estado === 401) ACCESO_LOCAL.olvidarSesion();
        dejarEscribir();
        return;
      }
      usuario = r.datos.usuario;
      if (usuario.debeCambiarClave) {
        prepararCambioDeClave(true);
      } else {
        ACCESO_LOCAL.confirmar(usuario.documento, usuario);
        entrar(usuario);
      }
    }).catch(dejarEscribir);
  }

  /* ---------------------------------------------------------
     Paso 1: credenciales
     --------------------------------------------------------- */

  formAcceso.addEventListener('submit', function (evento) {
    evento.preventDefault();
    mostrarError(errorAcceso, '');

    const documento = formAcceso.documento.value.trim();
    const clave = formAcceso.clave.value;

    if (!/^[A-Za-z0-9]{5,16}$/.test(documento)) {
      mostrarError(errorAcceso, 'Escriba su número de documento sin puntos ni espacios.');
      formAcceso.documento.focus();
      return;
    }
    if (!clave) {
      mostrarError(errorAcceso, 'Escriba su contraseña.');
      formAcceso.clave.focus();
      return;
    }

    const boton = document.getElementById('btnIngresar');
    ocupado(boton, true, 'Verificando…');
    guardarDocumentoSiSePidio(documento);

    function rechazar(texto) {
      mostrarError(errorAcceso, texto);
      formAcceso.clave.value = '';
      formAcceso.clave.focus();
    }

    function verificarSinSenal() {
      const apertura = BOVEDA.prepararApertura(documento, clave);
      return ACCESO_LOCAL.verificar(documento, clave).then(function (resultado) {
        if (!resultado.ok) {
          rechazar(resultado.mensaje);
          return undefined;
        }
        return apertura.abrir().then(function () { return entrar(resultado.perfil); });
      });
    }

    const intento = window.navigator.onLine === false
      ? verificarSinSenal()
      : api('/api/iniciar_sesion', { documento: documento, clave: clave }, LIMITE_INGRESO_MS).then(function (r) {
        /* Un servidor caído es como no tener señal; un rechazo no. */
        if (r.estado >= 500) return verificarSinSenal();

        if (!r.ok || !r.datos.usuario) {
          /* Cuenta desactivada: tampoco vuelve a abrir sin señal en este equipo. */
          if (r.datos.codigo === 'inactivo') ACCESO_LOCAL.olvidar(documento);
          rechazar(r.datos.error || 'No fue posible iniciar sesión. Intente de nuevo.');
          return undefined;
        }

        usuario = r.datos.usuario;
        if (usuario.debeCambiarClave) {
          claveTemporalEnMemoria = clave;
          prepararCambioDeClave(false);
          return undefined;
        }
        return recordarYEntrar(clave, usuario, r.datos.llaveCustodia);
      }, verificarSinSenal);

    intento.catch(function () {
      mostrarError(errorAcceso, 'No fue posible iniciar sesión. Intente de nuevo.');
    }).then(function () { ocupado(boton, false); });
  });

  /* ---------------------------------------------------------
     Paso 2: crear contraseña propia
     --------------------------------------------------------- */

  function prepararCambioDeClave(pedirClaveActual) {
    document.getElementById('nombreUsuario').textContent = usuario.nombre;
    campoClaveActual.hidden = !pedirClaveActual;
    formClave.claveActual.required = pedirClaveActual;
    mostrarError(errorClave, '');
    revisarRequisitos();
    mostrarPaso('clave');
  }

  function requisitos() {
    const nueva = formClave.claveNueva.value;
    const repetida = formClave.claveRepetida.value;
    const documento = usuario ? String(usuario.documento).toLowerCase() : '';
    return {
      largo: nueva.length >= 10,
      letra: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nueva),
      numero: /[0-9]/.test(nueva),
      documento: nueva !== '' && (!documento || nueva.toLowerCase().indexOf(documento) === -1),
      igual: nueva !== '' && nueva === repetida
    };
  }

  function revisarRequisitos() {
    const estado = requisitos();
    Object.keys(estado).forEach(function (clave) {
      const item = formClave.querySelector('[data-requisito="' + clave + '"]');
      if (item) item.classList.toggle('is-cumplido', estado[clave]);
    });
    return Object.keys(estado).every(function (clave) { return estado[clave]; });
  }

  formClave.claveNueva.addEventListener('input', revisarRequisitos);
  formClave.claveRepetida.addEventListener('input', revisarRequisitos);

  formClave.addEventListener('submit', function (evento) {
    evento.preventDefault();
    mostrarError(errorClave, '');

    if (!revisarRequisitos()) {
      mostrarError(errorClave, 'Revise los requisitos marcados: todos deben cumplirse.');
      return;
    }

    const claveActual = campoClaveActual.hidden ? claveTemporalEnMemoria : formClave.claveActual.value;
    if (!claveActual) {
      mostrarError(errorClave, 'Escriba la contraseña temporal que recibió.');
      formClave.claveActual.focus();
      return;
    }

    const boton = document.getElementById('btnGuardarClave');
    ocupado(boton, true, 'Guardando…');

    api('/api/cambiar_clave', { claveActual: claveActual, claveNueva: formClave.claveNueva.value }).then(function (r) {
      if (r.estado === 401) {
        mostrarError(errorClave, 'Su sesión terminó. Inicie sesión de nuevo.');
        mostrarPaso('acceso');
        return;
      }
      if (!r.ok || !r.datos.usuario) {
        const detalle = Array.isArray(r.datos.requisitos) ? ' ' + r.datos.requisitos.join(' ') : '';
        mostrarError(errorClave, (r.datos.error || 'No fue posible guardar la contraseña.') + detalle);
        return;
      }
      claveTemporalEnMemoria = '';
      return recordarYEntrar(formClave.claveNueva.value, r.datos.usuario, r.datos.llaveCustodia);
    }).catch(function () {
      mostrarError(errorClave, 'Sin conexión con el servidor. Revise la red e intente de nuevo.');
    }).then(function () { ocupado(boton, false); });
  });

  document.getElementById('btnCancelarClave').addEventListener('click', function () {
    api('/api/cerrar_sesion', {}).catch(function () {}).then(function () {
      usuario = null;
      claveTemporalEnMemoria = '';
      formAcceso.reset();
      formClave.reset();
      mostrarPaso('acceso');
    });
  });
})();
