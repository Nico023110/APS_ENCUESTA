/* =========================================================================
   Encuesta_APS — Verificar la contraseña sin señal (RN-223.6)
   -------------------------------------------------------------------------
   La contraseña la verifica el servidor. Sin señal no hay servidor, y sin esto
   la aplicación se bloqueaba a los 20 minutos y no se podía volver a entrar
   hasta encontrar cobertura, con la visita a medias.

   Cuando el servidor confirma una contraseña, se deja en el dispositivo una
   derivación de ella (PBKDF2-SHA-256, sal propia) y, sin señal, se compara
   contra esa derivación. La contraseña nunca se guarda.

   LO QUE ESTO NO ES

   - No abre nada en el servidor: sin una sesión válida, la API sigue diciendo
     401, y para sincronizar hay que entrar con señal. Esto sólo deja seguir
     capturando en el dispositivo.
   - No es una segunda autoridad: con señal manda siempre el servidor.

   DE QUIÉN ES LA COOKIE

   La sesión va en una cookie que el JavaScript no puede leer. Si A cierra sesión
   sin señal, su cookie sigue viva hasta que el servidor se entere; si en ese
   momento B entrara sin señal, al volver la red sus fichas se subirían firmadas
   por A. Por eso aquí se anota de quién es la sesión del dispositivo: sin señal
   sólo entra su dueño, y un cierre que no alcanzó a llegar al servidor queda
   anotado para hacerlo apenas haya red, antes de dejar entrar a nadie.

   LÍMITES

   - Sirve durante VIGENCIA_MS desde la última vez que el servidor confirmó el
     acceso. Una cuenta desactivada deja de abrir sin señal a más tardar ahí, y
     apenas haya señal, de inmediato.
   - Tras MAX_FALLOS intentos seguidos se espera ESPERA_MS, igual que en el
     servidor.
   - Quien extraiga el almacenamiento del teléfono podría probar contraseñas por
     fuerza bruta contra la derivación, sin límite. Por eso el costo alto: cada
     intento vale ~600 000 rondas (lo que recomienda OWASP para PBKDF2-SHA-256).
   ========================================================================= */

(function () {
  'use strict';

  const PREFIJO = 'aps_acceso_local_';
  const CLAVE_DUENO = 'aps_dueno_sesion';
  const CLAVE_CIERRE_PENDIENTE = 'aps_cierre_pendiente';
  const VERSION = 1;
  const ITERACIONES = 600000;
  const BITS = 256;
  const LARGO_SAL = 16;
  const VIGENCIA_DIAS = 7;
  const VIGENCIA_MS = VIGENCIA_DIAS * 24 * 60 * 60 * 1000;
  const MAX_FALLOS = 5;
  const ESPERA_MS = 15 * 60 * 1000;

  function disponible() {
    return Boolean(window.crypto && window.crypto.subtle && window.crypto.getRandomValues && window.TextEncoder);
  }

  function aBase64(bytes) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));
  }

  function deBase64(texto) {
    return Uint8Array.from(atob(texto), function (c) { return c.charCodeAt(0); });
  }

  /* Misma normalización que el servidor (api/_auth.js). */
  function derivar(clave, sal, iteraciones) {
    const crudo = new TextEncoder().encode(String(clave).normalize('NFKC'));
    return window.crypto.subtle.importKey('raw', crudo, 'PBKDF2', false, ['deriveBits']).then(function (llave) {
      return window.crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, llave, BITS);
    });
  }

  function iguales(a, b) {
    const x = new Uint8Array(a);
    const y = new Uint8Array(b);
    if (x.length !== y.length) return false;
    let diferencia = 0;
    for (let i = 0; i < x.length; i++) diferencia |= x[i] ^ y[i];
    return diferencia === 0;
  }

  function llaveDe(documento) {
    return PREFIJO + String(documento || '').trim();
  }

  function leer(documento) {
    try {
      const crudo = localStorage.getItem(llaveDe(documento));
      if (!crudo) return null;
      const copia = JSON.parse(crudo);
      return copia && copia.version === VERSION && copia.hash && copia.sal && copia.perfil ? copia : null;
    } catch (error) {
      return null;
    }
  }

  function escribir(documento, copia) {
    try {
      localStorage.setItem(llaveDe(documento), JSON.stringify(copia));
      return true;
    } catch (error) {
      console.warn('No fue posible guardar la verificación sin señal:', error);
      return false;
    }
  }

  function olvidar(documento) {
    try { localStorage.removeItem(llaveDe(documento)); } catch (error) { /* sin almacenamiento */ }
  }

  function leerMarca(clave) {
    try { return localStorage.getItem(clave); } catch (error) { return null; }
  }

  function escribirMarca(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (error) { /* sin almacenamiento */ }
  }

  function borrarMarca(clave) {
    try { localStorage.removeItem(clave); } catch (error) { /* sin almacenamiento */ }
  }

  /** El servidor dejó en la cookie una sesión de este documento. */
  function anotarSesion(documento) {
    escribirMarca(CLAVE_DUENO, String(documento));
    borrarMarca(CLAVE_CIERRE_PENDIENTE);
  }

  /** En el dispositivo ya no hay una sesión viva: el servidor la cerró o la dio por vencida. */
  function olvidarSesion() {
    borrarMarca(CLAVE_DUENO);
    borrarMarca(CLAVE_CIERRE_PENDIENTE);
  }

  /**
   * El servidor acaba de confirmar esta contraseña: se deja lista para verificar
   * sin señal. Nunca rechaza: si no se puede, se sigue con señal como siempre.
   */
  function recordar(documento, clave, perfil) {
    if (documento) anotarSesion(documento);
    if (!disponible() || !documento || !clave || !perfil) return Promise.resolve(false);
    const sal = window.crypto.getRandomValues(new Uint8Array(LARGO_SAL));
    return derivar(clave, sal, ITERACIONES).then(function (derivada) {
      return escribir(documento, {
        version: VERSION,
        sal: aBase64(sal),
        iteraciones: ITERACIONES,
        hash: aBase64(derivada),
        confirmadoEn: Date.now(),
        fallos: 0,
        bloqueadoHasta: 0,
        perfil: perfil
      });
    }).catch(function (error) {
      console.warn('No fue posible preparar la verificación sin señal:', error);
      return false;
    });
  }

  /** El servidor confirmó la sesión: corre la vigencia y se pone al día el perfil. */
  function confirmar(documento, perfil) {
    anotarSesion(documento);
    const copia = leer(documento);
    if (!copia) return;
    copia.confirmadoEn = Date.now();
    copia.fallos = 0;
    copia.bloqueadoHasta = 0;
    if (perfil) copia.perfil = perfil;
    escribir(documento, copia);
  }

  /**
   * Compara contra la copia del dispositivo.
   * @returns {Promise<{ok:true,perfil:object}|{ok:false,codigo:string,mensaje:string}>}
   */
  function verificar(documento, clave) {
    const copia = disponible() ? leer(documento) : null;

    if (!copia) {
      return Promise.resolve({
        ok: false,
        codigo: 'sin_copia',
        mensaje: 'Sin conexión. Este equipo todavía no puede verificar esa cuenta: ingrese una vez con señal ' +
          'para poder trabajar sin ella.'
      });
    }

    const dueno = leerMarca(CLAVE_DUENO);
    if (dueno && dueno !== String(documento).trim()) {
      return Promise.resolve({
        ok: false,
        codigo: 'otra_sesion',
        mensaje: 'Sin conexión, y en este equipo sigue abierta la sesión de otra persona. Para cambiar de usuario ' +
          'hace falta señal.'
      });
    }

    if (Date.now() - copia.confirmadoEn > VIGENCIA_MS) {
      return Promise.resolve({
        ok: false,
        codigo: 'vencida',
        mensaje: 'Sin conexión, y hace más de ' + VIGENCIA_DIAS + ' días que este equipo no confirma su acceso con ' +
          'el servidor. Conéctese a internet para continuar. Sus fichas siguen guardadas aquí.'
      });
    }

    if (copia.bloqueadoHasta && copia.bloqueadoHasta > Date.now()) {
      const minutos = Math.max(1, Math.ceil((copia.bloqueadoHasta - Date.now()) / 60000));
      return Promise.resolve({
        ok: false,
        codigo: 'bloqueada',
        mensaje: 'Demasiados intentos fallidos. Intente de nuevo en ' + minutos + ' minuto(s).'
      });
    }

    return derivar(clave, deBase64(copia.sal), copia.iteraciones).then(function (derivada) {
      if (iguales(derivada, deBase64(copia.hash))) {
        copia.fallos = 0;
        copia.bloqueadoHasta = 0;
        escribir(documento, copia);
        /* Su dueño volvió a entrar: la sesión sigue siendo suya y no hay nada que cerrar. */
        borrarMarca(CLAVE_CIERRE_PENDIENTE);
        return { ok: true, perfil: copia.perfil };
      }

      copia.fallos = (copia.fallos || 0) + 1;
      if (copia.fallos >= MAX_FALLOS) {
        copia.fallos = 0;
        copia.bloqueadoHasta = Date.now() + ESPERA_MS;
      }
      escribir(documento, copia);
      return { ok: false, codigo: 'clave', mensaje: 'Documento o contraseña incorrectos.' };
    });
  }

  window.ACCESO_LOCAL = {
    disponible: disponible,
    recordar: recordar,
    confirmar: confirmar,
    verificar: verificar,
    olvidar: olvidar,
    anotarSesion: anotarSesion,
    olvidarSesion: olvidarSesion,
    anotarCierrePendiente: function () { escribirMarca(CLAVE_CIERRE_PENDIENTE, 'si'); },
    hayCierrePendiente: function () { return leerMarca(CLAVE_CIERRE_PENDIENTE) === 'si'; }
  };
})();
