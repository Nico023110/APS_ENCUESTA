/* =========================================================================
   Encuesta_APS — Las fichas, cifradas en el dispositivo (RN-223.1, RN-224.2)
   -------------------------------------------------------------------------
   Lo que una persona deja en el teléfono no se puede leer sin su contraseña: ni
   abriendo la aplicación ni extrayendo el almacenamiento.

   LAS LLAVES

   Cada persona tiene en este dispositivo una llave de datos al azar, que es la
   que cifra sus fichas. Queda guardada dos veces, envuelta (aps_boveda_<documento>):

   - con una llave que sale de su contraseña (PBKDF2-SHA-256, sal propia): es lo
     que la abre a diario, con señal o sin ella.
   - con la llave de custodia que el servidor entrega sólo al verificar la
     contraseña (api/_auth.js): es lo que permite recuperar las fichas sin subir de
     quien la olvidó. El administrador la restablece, la persona entra con señal y
     la llave de datos se vuelve a envolver con la contraseña nueva. Las fichas no
     se tocan.

   Sin envolver, la llave de datos sólo existe en la memoria de la página y se
   borra al bloquear. Una página nueva no la tiene, así que abrir siempre pide la
   contraseña. La excepción es el instante entre el acceso y la aplicación, que son
   dos páginas: pasa por la memoria del service worker, sin tocar el disco (ver
   entregar), y si no se puede, se pide la contraseña otra vez.

   SÍNCRONO, A PROPÓSITO

   Las fichas se cifran con una librería síncrona (vendor/noble-ciphers) y no con
   WebCrypto, que es asíncrona. Con WebCrypto, escribir quedaría para después: una
   ficha dada por guardada se perdería si la aplicación se cierra en ese instante,
   el borrador que se escribe al salir de la página nunca llegaría a escribirse, y
   «no hay espacio» llegaría cuando ya se dijo otra cosa. Cifrar 1,66 MB tarda 77 ms
   con la CPU 6 veces más lenta que la de un computador de oficina. WebCrypto queda
   para derivar la llave al entrar, que ya es un momento de espera.

   QUÉ QUEDA EN CLARO

   De cada ficha, sólo de quién es y si ya subió (app.js: un «sobre»): lo que hace
   falta para contar pendientes, avisar de lo ajeno y soltar copias ya subidas sin
   la llave de nadie. Cifrar una por una es lo que permite una sola lista con fichas
   de varias personas.

   LO QUE ESTO NO ES

   - No protege de quien conoce la contraseña, ni de quien la adivine: extraído el
     almacenamiento, se puede probar contraseñas sin límite. Por eso el costo alto
     (el mismo de acceso_local.js).
   - Mientras está abierta, lo que hay en pantalla y en memoria está en claro. Un
     texto de JavaScript no se puede borrar de la memoria: sólo se suelta.
   - Quien entra no puede cifrar lo de otra persona: lo de antes de esta versión,
     de quien no ha vuelto a entrar, sigue en claro hasta que entre.
   ========================================================================= */

(function () {
  'use strict';

  const PREFIJO_META = 'aps_boveda_';
  const PREFIJO_CIFRADO = 'aps_cifrado_';
  const SEPARADOR_APARTADO = '__llave_';
  const MARCA_ENTREGA = 'aps_llave_en_camino';
  const VERSION = 1;
  const FORMATO = 'aps1';
  const CONTEXTO_FICHA = 'ficha';

  const ITERACIONES = 600000;
  const BITS = 256;
  const LARGO_LLAVE = 32;
  const LARGO_SAL = 16;
  const LARGO_NONCE = 24;
  const LARGO_ID = 4;

  /* Cuánto se espera al service worker: si tarda, se pide la contraseña y ya. El
     primero es más largo porque en el primer ingreso puede estar terminando de
     instalarse, y escribir la contraseña dos veces es peor que un segundo más. */
  const ESPERA_AL_ENTREGAR_MS = 3000;
  const ESPERA_AL_RECIBIR_MS = 1500;
  const ESPERA_RESPUESTA_MS = 1000;

  /* Lo que el dispositivo puede volver a pedir al servidor. Lo último que se suelta
     si no cabe ni la llave envuelta: sin ella no se puede entrar, y sin entrar no se
     pueden subir las fichas que están llenando el dispositivo. */
  const CACHES_PRESCINDIBLES = ['aps_cups_resueltos', 'aps_catalogo_acciones', 'aps_catalogos_dinamicos'];

  let documento = null;
  let idLlave = null;
  let llave = null;
  const llavesAnteriores = new Map();

  /* Sellado → texto de las fichas abiertas, para no descifrar en cada lectura: las
     vistas leen la lista en cada filtro y en cada render. Se suelta al cerrar. */
  let cacheFichas = new Map();

  let retenciones = 0;
  let cierrePendiente = false;
  const oyentesAlAbrir = [];
  const oyentesAntesDeCerrar = [];

  /* ---------------------------------------------------------
     1. BYTES Y TEXTO
     --------------------------------------------------------- */

  function disponible() {
    return Boolean(window.crypto && window.crypto.subtle && window.crypto.getRandomValues &&
      typeof NOBLE_XCHACHA === 'function');
  }

  function aleatorio(largo) {
    return window.crypto.getRandomValues(new Uint8Array(largo));
  }

  function aBytes(texto) {
    return new TextEncoder().encode(texto);
  }

  function aBase64(bytes) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));
  }

  function deBase64(texto) {
    return Uint8Array.from(atob(texto), function (c) { return c.charCodeAt(0); });
  }

  function aHexadecimal(bytes) {
    return Array.prototype.map.call(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }

  /* El almacenamiento cuenta caracteres, no bytes, y base64 sólo mete 6 bits en cada
     uno: lo cifrado ocuparía un tercio más que el texto en claro, en un espacio que
     ya es poco. Aquí van 15 bits por carácter, en U+0100..U+80FF, un tramo sin
     sustitutos ni caracteres de control. Medido contra el cupo real: en Chromium cabe
     casi el doble que en claro; en WebKit, que cobra doble a todo lo que no sea
     latino, un 6 % menos, y con base64 sería un 25 % menos en los dos. */
  const BASE_DENSA = 0x0100;
  const BITS_POR_CARACTER = 15;
  const MASCARA = (1 << BITS_POR_CARACTER) - 1;
  const TRAMO_DE_CARACTERES = 8192;

  function aDenso(bytes) {
    const codigos = new Uint16Array(Math.ceil(bytes.length * 8 / BITS_POR_CARACTER));
    let acumulado = 0;
    let bits = 0;
    let j = 0;
    for (let i = 0; i < bytes.length; i++) {
      acumulado = (acumulado << 8) | bytes[i];
      bits += 8;
      if (bits >= BITS_POR_CARACTER) {
        bits -= BITS_POR_CARACTER;
        codigos[j++] = BASE_DENSA + (acumulado >>> bits);
        acumulado &= (1 << bits) - 1;
      }
    }
    if (bits > 0) codigos[j++] = BASE_DENSA + (acumulado << (BITS_POR_CARACTER - bits));

    let texto = '';
    for (let i = 0; i < codigos.length; i += TRAMO_DE_CARACTERES) {
      texto += String.fromCharCode.apply(null, codigos.subarray(i, i + TRAMO_DE_CARACTERES));
    }
    return texto;
  }

  function deDenso(texto, largo) {
    const bytes = new Uint8Array(largo);
    let acumulado = 0;
    let bits = 0;
    let j = 0;
    for (let i = 0; i < texto.length && j < largo; i++) {
      const valor = texto.charCodeAt(i) - BASE_DENSA;
      if (valor < 0 || valor > MASCARA) throw new Error('carácter fuera del tramo');
      acumulado = (acumulado << BITS_POR_CARACTER) | valor;
      bits += BITS_POR_CARACTER;
      while (bits >= 8 && j < largo) {
        bits -= 8;
        bytes[j++] = (acumulado >>> bits) & 0xff;
      }
      acumulado &= (1 << bits) - 1;
    }
    if (j !== largo) throw new Error('texto más corto de lo que dice');
    return bytes;
  }

  /* ---------------------------------------------------------
     2. SELLAR Y ABRIR
     ---------------------------------------------------------
     aps1.<id de la llave>.<cuántos bytes>.<nonce y cifrado, densos>

     El nonce es al azar y de 24 bytes: no hay riesgo de repetirlo por muchas veces
     que se escriba. Lo autenticado incluye de quién es y qué es, así que mover un
     sellado a otra persona o a otro sitio no abre. */

  function autenticado(contexto) {
    return aBytes('aps-boveda-v1|' + documento + '|' + contexto);
  }

  function partesDe(sellado) {
    if (typeof sellado !== 'string') return null;
    const a = sellado.indexOf('.');
    const b = sellado.indexOf('.', a + 1);
    const c = sellado.indexOf('.', b + 1);
    if (a === -1 || b === -1 || c === -1 || sellado.slice(0, a) !== FORMATO) return null;
    return { id: sellado.slice(a + 1, b), largo: parseInt(sellado.slice(b + 1, c), 10), datos: sellado.slice(c + 1) };
  }

  function llaveDeId(id) {
    if (id === idLlave) return llave;
    return llavesAnteriores.get(id) || null;
  }

  function abrirSellado(contexto, sellado) {
    const partes = partesDe(sellado);
    const llaveDelSello = partes ? llaveDeId(partes.id) : null;
    if (!llaveDelSello) return null;
    try {
      const bytes = deDenso(partes.datos, partes.largo);
      const claro = NOBLE_XCHACHA(llaveDelSello, bytes.subarray(0, LARGO_NONCE), autenticado(contexto))
        .decrypt(bytes.subarray(LARGO_NONCE));
      return new TextDecoder().decode(claro);
    } catch (error) {
      /* Sin el contenido: un sellado dañado se conserva, y no se dice qué tiene. */
      console.error('Un dato guardado en el dispositivo no se pudo abrir: está dañado.');
      return null;
    }
  }

  /* Lo que no se puede volver a leer no se escribe: quedaría en el lugar de lo que
     sí se podía. */
  function sellar(contexto, texto) {
    if (!llave) throw errorDeBovedaCerrada();
    const nonce = aleatorio(LARGO_NONCE);
    const cifrado = NOBLE_XCHACHA(llave, nonce, autenticado(contexto)).encrypt(aBytes(texto));
    const bytes = new Uint8Array(nonce.length + cifrado.length);
    bytes.set(nonce);
    bytes.set(cifrado, nonce.length);
    const sellado = [FORMATO, idLlave, bytes.length, aDenso(bytes)].join('.');
    if (abrirSellado(contexto, sellado) !== texto) throw new Error('El cifrado no se pudo comprobar.');
    return sellado;
  }

  function errorDeBovedaCerrada() {
    const error = new Error('Las fichas están bloqueadas: falta la contraseña.');
    error.name = 'BovedaCerrada';
    return error;
  }

  /* ---------------------------------------------------------
     3. FICHAS (app.js)
     --------------------------------------------------------- */

  function textoDeFicha(sellada) {
    if (cacheFichas.has(sellada)) return cacheFichas.get(sellada);
    const texto = abrirSellado(CONTEXTO_FICHA, sellada);
    if (texto !== null) cacheFichas.set(sellada, texto);
    return texto;
  }

  /**
   * Las fichas legibles de esta lista, como objetos nuevos: quien las recibe las
   * modifica. Sin la llave no hay ninguna; lo que aún esté en claro (de una versión
   * anterior) se devuelve tal cual. Lo que no se puede abrir no aparece: sigue en la
   * lista sin tocarse (ver esLegible).
   */
  function abrirFichas(lista) {
    if (!llave) return [];
    const vigentes = new Map();
    const salida = [];
    lista.forEach(function (entrada) {
      if (!entrada.sellada) {
        salida.push(entrada);
        return;
      }
      const texto = textoDeFicha(entrada.sellada);
      if (texto === null) return;
      vigentes.set(entrada.sellada, texto);
      salida.push(JSON.parse(texto));
    });
    cacheFichas = vigentes;
    return salida;
  }

  /**
   * El sobre de cada ficha. Una que no cambió conserva su sellado: una lista de cien
   * fichas no se vuelve a cifrar entera cada vez que se agrega una.
   * @throws BovedaCerrada sin la llave, antes de escribir nada.
   */
  function sellarFichas(lista) {
    if (!llave) throw errorDeBovedaCerrada();
    const porTexto = new Map();
    cacheFichas.forEach(function (texto, sellada) {
      if (partesDe(sellada).id === idLlave) porTexto.set(texto, sellada);
    });

    return lista.map(function (ficha) {
      if (ficha.sellada) return ficha;
      const texto = JSON.stringify(ficha);
      const sellada = porTexto.get(texto) || sellar(CONTEXTO_FICHA, texto);
      cacheFichas.set(sellada, texto);
      return { capturadaPor: documento, sincronizada: ficha.sincronizada === true, sellada: sellada };
    });
  }

  /** ¿Se puede leer con lo que hay en memoria? Sin la llave, nada. */
  function esLegible(entrada) {
    if (!llave) return false;
    return !entrada.sellada || textoDeFicha(entrada.sellada) !== null;
  }

  /** Está en claro, o cifrada con una llave anterior que ya se pudo abrir. */
  function faltaCifrar(entrada) {
    if (!llave) return false;
    if (!entrada.sellada) return true;
    const partes = partesDe(entrada.sellada);
    return Boolean(partes) && partes.id !== idLlave && llavesAnteriores.has(partes.id);
  }

  /* ---------------------------------------------------------
     4. TEXTOS: borradores y fichas sin terminar (captura_local.js)
     ---------------------------------------------------------
     Bajo un nombre distinto del de antes: una versión anterior que encontrara aquí
     algo cifrado creería que está dañado y lo borraría. */

  function claveCifrada(clave) {
    return PREFIJO_CIFRADO + String(clave).replace(/^aps_/, '');
  }

  /* Con una llave nueva (ver abrirCon) lo que estaba cifrado con la anterior se aparta
     en vez de pisarse, por si la persona recuerda su contraseña anterior. */
  function apartarSiEsDeOtraLlave(real) {
    const crudo = localStorage.getItem(real);
    const partes = crudo === null ? null : partesDe(crudo);
    if (!partes || partes.id === idLlave) return;
    localStorage.removeItem(real);
    try {
      localStorage.setItem(real + SEPARADOR_APARTADO + partes.id, crudo);
    } catch (error) {
      localStorage.setItem(real, crudo);
      throw error;
    }
  }

  /** El texto guardado en `clave`, o null si no hay, si está cerrada o si no se puede abrir. */
  function leerTexto(clave) {
    if (!llave) return null;
    let crudo = null;
    try { crudo = localStorage.getItem(claveCifrada(clave)); } catch (error) { /* sin almacenamiento */ }
    return crudo === null ? null : abrirSellado(clave, crudo);
  }

  /**
   * Lo que hay que escribir para guardar este texto, sin escribirlo: quien llama sabe
   * qué hacer si no cabe (captura_local.js suelta copias ya subidas y reintenta), y
   * así no se vuelve a cifrar en cada intento.
   * @returns {{clave:string, valor:string}}
   * @throws BovedaCerrada sin la llave.
   */
  function sellarTexto(clave, texto) {
    const valor = sellar(clave, texto);
    const real = claveCifrada(clave);
    apartarSiEsDeOtraLlave(real);
    return { clave: real, valor: valor };
  }

  /** Borra lo guardado en `clave`. Sin la llave no toca nada: podría ser de otra llave. */
  function borrarTexto(clave) {
    if (!llave) return;
    const real = claveCifrada(clave);
    apartarSiEsDeOtraLlave(real);
    localStorage.removeItem(real);
  }

  /**
   * Lo que quedó en claro en `clave`, de una versión anterior, pasa a cifrado. Si ya
   * había algo cifrado (una pestaña con la versión anterior siguió escribiendo),
   * `fusionar(claro, cifrado)` dice qué texto queda. Si no cabe, sigue como estaba.
   * @returns {boolean} false si sigue en claro.
   */
  function pasarACifrado(clave, fusionar) {
    if (!llave) return false;
    const claro = localStorage.getItem(clave);
    if (claro === null) return true;

    const cifrado = leerTexto(clave);
    const sello = sellarTexto(clave, cifrado === null ? claro : fusionar(claro, cifrado));
    try {
      localStorage.setItem(sello.clave, sello.valor);
      localStorage.removeItem(clave);
      return true;
    } catch (error) {
      /* No caben los dos a la vez, y cifrado ocupa menos o casi lo mismo. Va en el
         mismo instante: si tampoco cabe, lo que había vuelve a su sitio. */
      localStorage.removeItem(clave);
      try {
        localStorage.setItem(sello.clave, sello.valor);
        return true;
      } catch (error2) {
        localStorage.setItem(clave, claro);
        return false;
      }
    }
  }

  function clavesApartadas(real) {
    const prefijo = real + SEPARADOR_APARTADO;
    const claves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const nombre = localStorage.key(i);
      if (nombre && nombre.indexOf(prefijo) === 0) claves.push(nombre);
    }
    return claves;
  }

  /** ¿Hay algo en `clave` cifrado con una llave anterior? */
  function tieneDeOtraLlave(clave) {
    if (!llave) return false;
    const real = claveCifrada(clave);
    const crudo = localStorage.getItem(real);
    const partes = crudo === null ? null : partesDe(crudo);
    return clavesApartadas(real).length > 0 || Boolean(partes && partes.id !== idLlave);
  }

  /**
   * Los textos de `clave` de llaves anteriores que ya se pudieron abrir. Se retiran
   * uno por uno con `retirar()`, después de ponerlos a salvo.
   * @returns {Array<{texto:string, retirar:function}>}
   */
  function textosDeOtraLlave(clave) {
    if (!llave) return [];
    const real = claveCifrada(clave);
    apartarSiEsDeOtraLlave(real);
    const salida = [];
    clavesApartadas(real).forEach(function (nombre) {
      const texto = abrirSellado(clave, localStorage.getItem(nombre));
      if (texto === null) return;
      salida.push({ texto: texto, retirar: function () { localStorage.removeItem(nombre); } });
    });
    return salida;
  }

  /* ---------------------------------------------------------
     5. ABRIR Y CERRAR
     --------------------------------------------------------- */

  function llaveMeta(doc) {
    return PREFIJO_META + doc;
  }

  function leerMeta(doc) {
    try {
      const copia = JSON.parse(localStorage.getItem(llaveMeta(doc)));
      return copia && copia.version === VERSION && copia.id && copia.sal && copia.envuelta ? copia : null;
    } catch (error) {
      return null;
    }
  }

  function guardarMeta(doc, meta) {
    const texto = JSON.stringify(meta);
    const prescindibles = CACHES_PRESCINDIBLES.slice();
    for (;;) {
      try {
        localStorage.setItem(llaveMeta(doc), texto);
        return;
      } catch (error) {
        /* app.js, si está cargado: en la página de acceso no. */
        let libero = false;
        try { libero = typeof soltarCopiaYaSubida === 'function' && soltarCopiaYaSubida(); } catch (e) { /* tampoco */ }
        if (libero) continue;
        if (prescindibles.length === 0) throw error;
        localStorage.removeItem(prescindibles.shift());
      }
    }
  }

  /* Misma normalización que el servidor (api/_auth.js) y que acceso_local.js. */
  function derivar(clave, sal, iteraciones) {
    return window.crypto.subtle.importKey(
      'raw', aBytes(String(clave).normalize('NFKC')), 'PBKDF2', false, ['deriveBits']
    ).then(function (base) {
      return window.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, base, BITS);
    }).then(function (bits) {
      return new Uint8Array(bits);
    });
  }

  function aadDeContrasena(doc) {
    return aBytes('aps-boveda-v1|contrasena|' + doc);
  }

  function aadDeCustodia(doc) {
    return aBytes('aps-boveda-v1|custodia|' + doc);
  }

  function envolver(datos, llaveExterior, aad) {
    const nonce = aleatorio(LARGO_NONCE);
    const cifrado = NOBLE_XCHACHA(llaveExterior, nonce, aad).encrypt(datos);
    const bytes = new Uint8Array(nonce.length + cifrado.length);
    bytes.set(nonce);
    bytes.set(cifrado, nonce.length);
    return aBase64(bytes);
  }

  function desenvolver(envuelta, llaveExterior, aad) {
    try {
      const bytes = deBase64(envuelta);
      return NOBLE_XCHACHA(llaveExterior, bytes.subarray(0, LARGO_NONCE), aad).decrypt(bytes.subarray(LARGO_NONCE));
    } catch (error) {
      return null;
    }
  }

  /* El servidor la manda en base64url (api/_auth.js). */
  function bytesDeCustodia(texto) {
    if (typeof texto !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(texto)) return null;
    return deBase64(texto.replace(/-/g, '+').replace(/_/g, '/') + '=');
  }

  function idNuevo() {
    return aHexadecimal(aleatorio(LARGO_ID));
  }

  function borrarDeLaMemoria() {
    if (llave) llave.fill(0);
    llave = null;
    idLlave = null;
    documento = null;
    llavesAnteriores.forEach(function (bytes) { bytes.fill(0); });
    llavesAnteriores.clear();
    cacheFichas = new Map();
  }

  function instalar(doc, id, bytes) {
    borrarDeLaMemoria();
    documento = doc;
    idLlave = id;
    llave = bytes;
    cierrePendiente = false;
    oyentesAlAbrir.forEach(function (oyente) { oyente(); });
  }

  async function abrirCon(doc, clave, derivada, salUsada, iteracionesUsadas, opciones) {
    const custodia = opciones ? bytesDeCustodia(opciones.custodia) : null;
    try {
      return await abrirConLlavesDePaso(doc, clave, derivada, salUsada, iteracionesUsadas, custodia);
    } finally {
      derivada.fill(0);
      if (custodia) custodia.fill(0);
    }
  }

  async function abrirConLlavesDePaso(doc, clave, derivada, salUsada, iteracionesUsadas, custodia) {
    const meta = leerMeta(doc);

    /* Nunca antes en este dispositivo. */
    if (!meta) {
      const nueva = aleatorio(LARGO_LLAVE);
      const creada = {
        version: VERSION,
        id: idNuevo(),
        sal: salUsada,
        iteraciones: iteracionesUsadas,
        envuelta: envolver(nueva, derivada, aadDeContrasena(doc)),
        custodia: custodia ? envolver(nueva, custodia, aadDeCustodia(doc)) : null,
        anteriores: []
      };
      /* Primero queda guardada: sin esto, lo que se cifrara no se podría abrir nunca. */
      guardarMeta(doc, creada);
      instalar(doc, creada.id, nueva);
      return { ok: true, creada: true };
    }

    /* Otra pestaña pudo crearla mientras se derivaba, con su propia sal. */
    const exterior = meta.sal === salUsada && meta.iteraciones === iteracionesUsadas
      ? derivada
      : await derivar(clave, deBase64(meta.sal), meta.iteraciones);

    let datos = desenvolver(meta.envuelta, exterior, aadDeContrasena(doc));
    let recuperada = false;
    let llaveNueva = false;

    /* La contraseña cambió (restablecimiento) y el servidor ya la verificó. */
    if (!datos && custodia && meta.custodia) {
      datos = desenvolver(meta.custodia, custodia, aadDeCustodia(doc));
      if (datos) {
        meta.envuelta = envolver(datos, exterior, aadDeContrasena(doc));
        recuperada = true;
      }
    }

    /* Sin custodia que sirva (no había señal al crearla, o el servidor no tiene el
       secreto). Nada de lo que hay se toca: queda con su llave, y se abre si la
       persona recuerda la contraseña anterior (recuperarAnteriores). */
    if (!datos) {
      meta.anteriores = (meta.anteriores || []).concat([
        { id: meta.id, sal: meta.sal, iteraciones: meta.iteraciones, envuelta: meta.envuelta }
      ]);
      datos = aleatorio(LARGO_LLAVE);
      meta.id = idNuevo();
      meta.envuelta = envolver(datos, exterior, aadDeContrasena(doc));
      meta.custodia = null;
      llaveNueva = true;
    }

    if (custodia) meta.custodia = envolver(datos, custodia, aadDeCustodia(doc));

    if (custodia || recuperada || llaveNueva) {
      try {
        guardarMeta(doc, meta);
      } catch (error) {
        /* Una llave nueva sin guardar no sirve. Lo demás se puede repetir al siguiente
           ingreso: lo guardado sigue abriendo como antes. */
        if (llaveNueva) throw error;
        console.warn('No fue posible actualizar la llave guardada:', error);
      }
    }

    instalar(doc, meta.id, datos);
    return { ok: true, recuperada: recuperada, llaveNueva: llaveNueva };
  }

  /**
   * Empieza a derivar la llave de una vez y no abre nada todavía: quien llama abre
   * cuando la contraseña esté verificada. Así las dos derivaciones (la de aquí y la de
   * acceso_local.js) corren a la vez, y entrar no tarda el doble.
   * @returns {{abrir: function({custodia:string}=): Promise<{ok:boolean, codigo:string=}>}}
   */
  function prepararApertura(doc, clave) {
    const limpio = String(doc || '').trim();
    if (!disponible() || !limpio) {
      return { abrir: function () { return Promise.resolve({ ok: false, codigo: 'no_disponible' }); } };
    }

    const meta = leerMeta(limpio);
    const sal = meta ? deBase64(meta.sal) : aleatorio(LARGO_SAL);
    const iteraciones = meta ? meta.iteraciones : ITERACIONES;
    const derivada = derivar(clave, sal, iteraciones);
    derivada.catch(function () { /* se atiende al abrir, si se llega a abrir */ });

    return {
      abrir: function (opciones) {
        return derivada.then(function (bytes) {
          return abrirCon(limpio, clave, bytes, aBase64(sal), iteraciones, opciones);
        }).catch(function (error) {
          console.warn('No fue posible abrir las fichas de este dispositivo:', error);
          return { ok: false, codigo: 'fallo' };
        });
      }
    };
  }

  /**
   * Borra la llave de la memoria. Antes avisa, para que se escriba lo que haga falta.
   * Con una subida en curso, espera a que termine (ver retener).
   */
  function cerrar() {
    if (!llave) return;
    if (retenciones > 0) {
      cierrePendiente = true;
      return;
    }
    cierrePendiente = false;
    oyentesAntesDeCerrar.forEach(function (oyente) {
      try { oyente(); } catch (error) { console.error('Falló un paso previo al bloqueo:', error); }
    });
    borrarDeLaMemoria();
  }

  /**
   * La pantalla se puede bloquear con algo en camino: al volver la respuesta del
   * servidor hay que anotar que la ficha subió. Mientras tanto la llave sigue en
   * memoria; lo que devuelve es con qué soltarla.
   */
  function retener() {
    retenciones++;
    let suelta = false;
    return function soltar() {
      if (suelta) return;
      suelta = true;
      retenciones--;
      if (retenciones === 0 && cierrePendiente) cerrar();
    };
  }

  /** Corre al abrir, cada vez; con `true` la primera. Si ya está abierta, corre ya. */
  function alAbrir(oyente) {
    let primera = true;
    const envoltura = function () {
      const esPrimera = primera;
      primera = false;
      try { oyente(esPrimera); } catch (error) { console.error('Falló un paso al abrir las fichas:', error); }
    };
    oyentesAlAbrir.push(envoltura);
    if (llave) envoltura();
  }

  function antesDeCerrar(oyente) {
    oyentesAntesDeCerrar.push(oyente);
  }

  /* ---------------------------------------------------------
     6. LO QUE QUEDÓ CON UNA LLAVE ANTERIOR
     --------------------------------------------------------- */

  /**
   * Prueba una contraseña anterior contra las llaves viejas. Las que abra quedan en
   * memoria: abrirFichas y textosDeOtraLlave ya las leen. Falta volver a cifrar con
   * la llave de hoy, y después confirmarRecuperacion.
   * @returns {Promise<number>} cuántas abrió.
   */
  async function recuperarAnteriores(clave) {
    const meta = llave ? leerMeta(documento) : null;
    if (!meta) return 0;
    const doc = documento;
    let abiertas = 0;
    for (const anterior of meta.anteriores || []) {
      if (llavesAnteriores.has(anterior.id)) continue;
      const exterior = await derivar(clave, deBase64(anterior.sal), anterior.iteraciones);
      const datos = desenvolver(anterior.envuelta, exterior, aadDeContrasena(doc));
      exterior.fill(0);
      if (datos && llave) {
        llavesAnteriores.set(anterior.id, datos);
        abiertas++;
      }
    }
    return abiertas;
  }

  /** Lo de esas llaves ya está cifrado con la de hoy: ya no hacen falta. */
  function confirmarRecuperacion() {
    const meta = llave ? leerMeta(documento) : null;
    if (!meta) return;
    meta.anteriores = (meta.anteriores || []).filter(function (anterior) { return !llavesAnteriores.has(anterior.id); });
    guardarMeta(documento, meta);
    llavesAnteriores.forEach(function (bytes) { bytes.fill(0); });
    llavesAnteriores.clear();
    cacheFichas.forEach(function (texto, sellada) {
      if (partesDe(sellada).id !== idLlave) cacheFichas.delete(sellada);
    });
  }

  function hayLlavesAnteriores() {
    const meta = llave ? leerMeta(documento) : null;
    return Boolean(meta && meta.anteriores && meta.anteriores.length > 0);
  }

  /* ---------------------------------------------------------
     7. DEL ACCESO A LA APLICACIÓN
     ---------------------------------------------------------
     Son dos páginas, y la memoria de una no llega a la otra. Pedir la contraseña dos
     veces seguidas no es opción, y escribir la llave en el dispositivo, aunque fuera
     un segundo, es justo lo que aquí no se hace. El service worker sobrevive a la
     navegación: se la guarda en memoria unos segundos y se la da a la primera página
     que la pida (sw.js). La marca de sessionStorage no dice más que «hay que esperarla»,
     para no enseñar la contraseña un instante y quitarla. */

  function trabajadorActivo(limiteMs) {
    const servicio = window.navigator && window.navigator.serviceWorker;
    if (!servicio) return Promise.resolve(null);
    return Promise.race([
      servicio.ready.then(function (registro) { return registro.active || null; }),
      new Promise(function (resolver) { setTimeout(function () { resolver(null); }, limiteMs); })
    ]);
  }

  function preguntar(trabajador, mensaje) {
    return new Promise(function (resolver) {
      const canal = new MessageChannel();
      const terminar = function (respuesta) {
        clearTimeout(temporizador);
        canal.port1.close();
        resolver(respuesta);
      };
      const temporizador = setTimeout(function () { terminar(null); }, ESPERA_RESPUESTA_MS);
      canal.port1.onmessage = function (evento) { terminar(evento.data); };
      trabajador.postMessage(mensaje, [canal.port2]);
    });
  }

  /** @returns {Promise<boolean>} si la siguiente página la podrá recibir. */
  function entregar() {
    if (!llave) return Promise.resolve(false);
    const mensaje = { tipo: 'llave-dejar', documento: documento, id: idLlave, llave: llave.slice() };
    return trabajadorActivo(ESPERA_AL_ENTREGAR_MS).then(function (trabajador) {
      return trabajador ? preguntar(trabajador, mensaje) : null;
    }).then(function (respuesta) {
      mensaje.llave.fill(0);
      if (!respuesta || respuesta.ok !== true) return false;
      sessionStorage.setItem(MARCA_ENTREGA, 'si');
      return true;
    }).catch(function () {
      return false;
    });
  }

  function hayEntregaEnCamino() {
    try { return sessionStorage.getItem(MARCA_ENTREGA) === 'si'; } catch (error) { return false; }
  }

  /** @returns {Promise<boolean>} si quedó abierta. Si no, hay que pedir la contraseña. */
  function recibir(doc) {
    const limpio = String(doc || '').trim();
    if (!hayEntregaEnCamino() || !disponible()) return Promise.resolve(false);
    try { sessionStorage.removeItem(MARCA_ENTREGA); } catch (error) { /* sin almacenamiento */ }

    return trabajadorActivo(ESPERA_AL_RECIBIR_MS).then(function (trabajador) {
      return trabajador ? preguntar(trabajador, { tipo: 'llave-tomar' }) : null;
    }).then(function (recibida) {
      if (!recibida || recibida.documento !== limpio || !recibida.llave || recibida.llave.length !== LARGO_LLAVE) return false;
      /* Tiene que ser la vigente: entre medias pudo cambiar en otra pestaña. */
      const meta = leerMeta(limpio);
      if (!meta || meta.id !== recibida.id) return false;
      instalar(limpio, recibida.id, new Uint8Array(recibida.llave));
      return true;
    }).catch(function () {
      return false;
    });
  }

  window.BOVEDA = {
    disponible: disponible,
    prepararApertura: prepararApertura,
    abierta: function () { return llave !== null; },
    documento: function () { return documento; },
    cerrar: cerrar,
    retener: retener,
    alAbrir: alAbrir,
    antesDeCerrar: antesDeCerrar,

    abrirFichas: abrirFichas,
    sellarFichas: sellarFichas,
    esLegible: esLegible,
    faltaCifrar: faltaCifrar,

    leerTexto: leerTexto,
    sellarTexto: sellarTexto,
    borrarTexto: borrarTexto,
    pasarACifrado: pasarACifrado,

    recuperarAnteriores: recuperarAnteriores,
    confirmarRecuperacion: confirmarRecuperacion,
    hayLlavesAnteriores: hayLlavesAnteriores,
    tieneDeOtraLlave: tieneDeOtraLlave,
    textosDeOtraLlave: textosDeOtraLlave,

    entregar: entregar,
    hayEntregaEnCamino: hayEntregaEnCamino,
    recibir: recibir
  };
})();
