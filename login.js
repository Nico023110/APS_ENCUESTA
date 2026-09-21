/* =========================================================
   Encuesta_APS — Inicio de sesión (login.html)
   ---------------------------------------------------------
   Dos pasos en la misma tarjeta: credenciales y, sólo en el primer
   ingreso, creación de la contraseña propia. Al terminar guarda el perfil
   público en localStorage (sesion.js lo lee para abrir la app sin red) y
   pasa a index.html.
   ========================================================= */

(function () {
  'use strict';

  const CLAVE_CACHE = 'aps_sesion_usuario';
  const DESTINO = '/';

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

  function api(ruta, cuerpo) {
    return fetch(ruta, {
      method: cuerpo ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: cuerpo
        ? { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }
        : { 'X-Requested-With': 'fetch' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    }).then(function (respuesta) {
      return respuesta.json().catch(function () { return {}; }).then(function (datos) {
        return { ok: respuesta.ok, estado: respuesta.status, datos: datos };
      });
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
    window.location.replace(DESTINO);
  }

  function mostrarPaso(paso) {
    formAcceso.hidden = paso !== 'acceso';
    formClave.hidden = paso !== 'clave';
    const primero = (paso === 'acceso' ? formAcceso : formClave).querySelector('input:not([hidden]):not([disabled])');
    if (primero) setTimeout(function () { primero.focus(); }, 40);
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

  /* Si ya hay sesión con clave temporal (por ejemplo, se recargó la página
     a mitad del primer ingreso), se salta directo al paso 2. Si hay sesión
     completa, no hay nada que hacer aquí. */
  api('/api/sesion').then(function (r) {
    if (!r.ok || !r.datos.usuario) { mostrarPaso('acceso'); return; }
    usuario = r.datos.usuario;
    if (usuario.debeCambiarClave) {
      prepararCambioDeClave(true);
    } else {
      entrar(usuario);
    }
  }).catch(function () { mostrarPaso('acceso'); });

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

    api('/api/iniciar_sesion', { documento: documento, clave: clave }).then(function (r) {
      if (!r.ok || !r.datos.usuario) {
        mostrarError(errorAcceso, r.datos.error || 'No fue posible iniciar sesión. Intente de nuevo.');
        formAcceso.clave.value = '';
        formAcceso.clave.focus();
        return;
      }
      usuario = r.datos.usuario;
      if (usuario.debeCambiarClave) {
        claveTemporalEnMemoria = clave;
        prepararCambioDeClave(false);
      } else {
        entrar(usuario);
      }
    }).catch(function () {
      mostrarError(errorAcceso, 'Sin conexión con el servidor. Revise la red e intente de nuevo.');
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
      entrar(r.datos.usuario);
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
