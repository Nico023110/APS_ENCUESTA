/* =========================================================================
   Encuesta_APS — ¿Ya fue caracterizada? (panel de Inicio)
   -------------------------------------------------------------------------
   Antes de ir a una vivienda, se busca si ya la caracterizaron para no
   repetir el trabajo: en la base anterior a la app (2025 – primer semestre
   de 2026) y en las fichas de la app. Por documento de alguien del hogar,
   por dirección o por cercanía (el GPS del teléfono). Sólo avisa: quien
   visita decide, porque puede ser un seguimiento o la casa vecina.

   CON Y SIN SEÑAL

   Con señal busca en el servidor (api/base_previa.js), en toda la base. Sin
   señal, o si el servidor no responde, busca en una copia de toda la base
   (cualquier EBS y territorio) que el teléfono guarda: se descarga al abrir
   la aplicación con señal, cada 12 horas, y se guarda cifrada con la llave de
   la persona (boveda.js) en IndexedDB, donde cabe sin quitarle espacio a las
   fichas. En claro sólo quedan de quién es, cuándo se bajó y cuántas
   viviendas trae: lo que hace falta para decirlo en pantalla.

   Lo que se pinta viene del servidor o de la copia: siempre con textContent.

   Depende de: cruce.js, sesion.js (SESION y fetch con cabecera anti-CSRF),
   boveda.js (BOVEDA).
   ========================================================================= */

(function () {
  'use strict';

  const RUTA = '/api/base_previa';
  const CONTEXTO = 'base_previa';
  const NOMBRE_BD = 'aps_base_previa';
  const ALMACEN = 'copias';
  const VIGENCIA_MS = 12 * 60 * 60 * 1000;
  /* 2: toda la base (antes, sólo los territorios de sus EBS); 3: con la fecha
     de subida al sistema. Una copia de otra versión se reemplaza al abrir con
     señal, sin esperar las 12 horas. */
  const VERSION_COPIA = 3;
  const ESPERA_BUSQUEDA_MS = 8000;
  const RADIO = 30;
  const RADIO_AMPLIO = 100;
  const MAXIMO = 25;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const AYUDAS = {
    documento: 'Número de documento de cualquier persona del hogar, sin puntos.',
    direccion: 'Como la dice la placa: «Cra 14 # 14-14», «Calle 1 Oeste # 50-20».',
    cercania: 'Usa el GPS del teléfono: busca viviendas a menos de ' + RADIO + ' m de donde está.'
  };
  const MARCAS = {
    documento: 'Número de documento de alguien del hogar',
    direccion: 'Dirección de la vivienda'
  };

  let copia = null;
  let actualizando = null;
  let ultimaBusqueda = null;

  class ErrorVisible extends Error {}

  /* ---------------------------------------------------------
     1. LA COPIA EN EL TELÉFONO (IndexedDB)
     --------------------------------------------------------- */

  function abrirBd() {
    return new Promise(function (resolver, rechazar) {
      if (typeof indexedDB === 'undefined') { rechazar(new Error('Este navegador no guarda datos sin señal.')); return; }
      let pedido;
      try { pedido = indexedDB.open(NOMBRE_BD, 1); } catch (error) { rechazar(error); return; }
      pedido.onupgradeneeded = function () {
        if (!pedido.result.objectStoreNames.contains(ALMACEN)) {
          pedido.result.createObjectStore(ALMACEN, { keyPath: 'documento' });
        }
      };
      pedido.onsuccess = function () { resolver(pedido.result); };
      pedido.onerror = function () { rechazar(pedido.error); };
    });
  }

  function operar(modo, accion) {
    return abrirBd().then(function (bd) {
      return new Promise(function (resolver, rechazar) {
        const transaccion = bd.transaction(ALMACEN, modo);
        const pedido = accion(transaccion.objectStore(ALMACEN));
        transaccion.oncomplete = function () { bd.close(); resolver(pedido ? pedido.result : undefined); };
        transaccion.onerror = transaccion.onabort = function () {
          bd.close();
          rechazar(transaccion.error || new Error('No se pudo guardar la copia.'));
        };
      });
    });
  }

  function leerRegistro(documento) {
    return operar('readonly', function (almacen) { return almacen.get(documento); }).catch(function () { return null; });
  }

  function escribirRegistro(registro) {
    return operar('readwrite', function (almacen) { return almacen.put(registro); });
  }

  function usuario() {
    return window.SESION && typeof SESION.usuario === 'function' ? SESION.usuario() : null;
  }

  function documentoActual() {
    const u = usuario();
    return u && u.documento ? String(u.documento) : null;
  }

  function puedeBuscar() {
    return Boolean(window.SESION && typeof SESION.puede === 'function' && SESION.puede('base_previa.consultar'));
  }

  function bovedaAbierta() {
    return Boolean(window.BOVEDA && BOVEDA.abierta());
  }

  /* Índices para buscar en la copia como busca el servidor. */
  function indexar(datos, meta) {
    const porDocumento = new Map();
    const porClave = new Map();
    (datos.documentos || []).forEach(function (d) {
      const lista = porDocumento.get(d[1]) || [];
      lista.push(d[0]);
      porDocumento.set(d[1], lista);
    });
    (datos.viviendas || []).forEach(function (v, i) {
      if (!v[6]) return;
      const lista = porClave.get(v[6]) || [];
      lista.push(i);
      porClave.set(v[6], lista);
    });
    return { meta: meta, viviendas: datos.viviendas || [], porDocumento: porDocumento, porClave: porClave };
  }

  function metaDe(registro) {
    return {
      documento: registro.documento,
      generada: registro.generada,
      viviendas: registro.viviendas || 0,
      motivo: registro.motivo || null
    };
  }

  function abrirCopia() {
    const documento = documentoActual();
    if (copia && copia.meta.documento === documento) return Promise.resolve(copia);
    if (!documento || !bovedaAbierta()) return Promise.resolve(null);
    return leerRegistro(documento).then(function (registro) {
      if (!registro || !registro.sellado) return null;
      const texto = BOVEDA.abrirDato(CONTEXTO, registro.sellado);
      if (texto === null) return null;
      copia = indexar(JSON.parse(texto), metaDe(registro));
      return copia;
    }).catch(function () { return null; });
  }

  /**
   * Baja la copia si no hay o si tiene más de 12 horas (o si se pide). Sin
   * señal, sin EBS o con la bóveda cerrada no hace nada. Nunca falla hacia
   * afuera: la búsqueda con señal no la necesita.
   */
  function actualizarCopia(opciones) {
    const forzar = Boolean(opciones && opciones.forzar);
    if (actualizando) return actualizando;
    const documento = documentoActual();
    if (!documento || !puedeBuscar() || !bovedaAbierta() || navigator.onLine === false) {
      return Promise.resolve(null);
    }

    pintarEstadoCopia({ ocupada: true });
    actualizando = leerRegistro(documento).then(function (registro) {
      const edad = registro ? Date.now() - Date.parse(registro.generada) : Infinity;
      if (registro && registro.version === VERSION_COPIA && edad < VIGENCIA_MS && !forzar) return registro;

      return fetch(RUTA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'copia' })
      }).then(function (respuesta) {
        if (!respuesta.ok) throw new Error('El servidor respondió ' + respuesta.status);
        return respuesta.json();
      }).then(function (datos) {
        /* Mientras bajaba pudo cerrarse la sesión o entrar otra persona. */
        if (documentoActual() !== documento || !bovedaAbierta()) return null;
        const nuevo = {
          documento: documento,
          version: VERSION_COPIA,
          generada: datos.generada || new Date().toISOString(),
          viviendas: Array.isArray(datos.viviendas) ? datos.viviendas.length : 0,
          motivo: datos.disponible ? null : (datos.motivo || 'sin_copia'),
          sellado: datos.disponible
            ? BOVEDA.sellarDato(CONTEXTO, JSON.stringify({ viviendas: datos.viviendas, documentos: datos.documentos }))
            : null
        };
        return escribirRegistro(nuevo).then(function () {
          copia = datos.disponible ? indexar(datos, metaDe(nuevo)) : null;
          return nuevo;
        });
      });
    }).catch(function (error) {
      console.warn('No se pudo preparar la copia para buscar sin señal:', error.message);
      return null;
    }).then(function (resultado) {
      actualizando = null;
      pintarEstadoCopia();
      return resultado;
    });
    return actualizando;
  }

  /* ---------------------------------------------------------
     2. BUSCAR
     --------------------------------------------------------- */

  /** Lo mismo que valida el servidor, para avisar sin ir a la red. */
  function prepararBusqueda(modo, texto, punto, radio) {
    if (modo === 'documento') {
      const documento = CRUCE.documentoDeCruce(texto);
      if (!documento) throw new ErrorVisible('Escriba el número de documento completo, sin puntos (5 caracteres o más).');
      return { modo: modo, documento: documento };
    }
    if (modo === 'direccion') {
      const clave = CRUCE.claveDeDireccion(texto);
      if (!clave) {
        throw new ErrorVisible('No se pudo leer la dirección. Escríbala como «Cra 14 # 14-14»: tipo de vía, número, # número - placa. ' +
          'Para veredas o casas sin nomenclatura use «Cerca de mí».');
      }
      return { modo: modo, clave: clave, escrito: String(texto).slice(0, 160) };
    }
    if (modo === 'cercania') {
      const enCali = punto ? CRUCE.puntoEnCali(punto.latitud, punto.longitud) : null;
      if (!enCali) throw new ErrorVisible('La ubicación del teléfono no está en Cali o no llegó. Inténtelo de nuevo al aire libre.');
      return { modo: modo, punto: enCali, radio: Math.min(RADIO_AMPLIO, Math.max(RADIO, Math.round(radio || RADIO))) };
    }
    throw new ErrorVisible('Elija cómo buscar.');
  }

  function ordenar(lista, b) {
    if (b.modo === 'cercania') {
      lista.sort(function (a, c) { return a.distancia - c.distancia || String(c.fecha || '').localeCompare(String(a.fecha || '')); });
    } else {
      lista.sort(function (a, c) { return String(c.fecha || '').localeCompare(String(a.fecha || '')); });
    }
    return {
      modo: b.modo,
      buscado: b.modo === 'documento' ? b.documento : b.modo === 'direccion' ? b.clave : null,
      radio: b.radio || null,
      total: lista.length,
      truncado: lista.length > MAXIMO,
      resultados: lista.slice(0, MAXIMO)
    };
  }

  /** La misma búsqueda del servidor, sobre la copia. */
  function buscarEnCopia(c, b) {
    let indices;
    if (b.modo === 'documento') indices = c.porDocumento.get(b.documento) || [];
    else if (b.modo === 'direccion') indices = c.porClave.get(b.clave) || [];
    else indices = c.viviendas.map(function (v, i) { return i; });

    const vistos = new Set();
    const lista = [];
    indices.forEach(function (i) {
      if (vistos.has(i)) return;
      vistos.add(i);
      const v = c.viviendas[i];
      const r = {
        origen: v[0] === 1 ? 'app' : 'previa', fecha: v[1], territorio: v[2], microterritorio: v[3], lugar: v[4],
        direccion: v[5], equipo: v[9], equipoNombre: v[10], responsable: v[11], familias: v[12], personas: v[13],
        referencia: v[14], estado: v[15] || null, subida: v[16] || null
      };
      if (b.modo === 'cercania') {
        if (v[7] === null || v[8] === null) return;
        r.distancia = Math.round(CRUCE.distanciaEnMetros(b.punto.latitud, b.punto.longitud, v[7], v[8]));
        if (r.distancia > b.radio) return;
      }
      lista.push(r);
    });
    return ordenar(lista, b);
  }

  function buscarSinSenal(b) {
    return abrirCopia().then(function (c) {
      if (!c) {
        throw new ErrorVisible(navigator.onLine === false
          ? 'No hay internet, y este teléfono todavía no tiene viviendas guardadas para buscar sin internet. Abra la aplicación una vez con internet.'
          : 'El servidor no respondió, y este teléfono no tiene viviendas guardadas para buscar sin internet. Inténtelo de nuevo.');
      }
      return Object.assign({ fuente: 'copia', copia: c.meta }, buscarEnCopia(c, b));
    });
  }

  function cuerpoDe(b) {
    if (b.modo === 'documento') return { accion: 'buscar', modo: b.modo, documento: b.documento };
    if (b.modo === 'direccion') return { accion: 'buscar', modo: b.modo, direccion: b.escrito };
    return { accion: 'buscar', modo: b.modo, latitud: b.punto.latitud, longitud: b.punto.longitud, radio: b.radio };
  }

  /** Con señal, el servidor; si no responde (o sin señal), la copia. */
  function buscar(b) {
    if (navigator.onLine === false) return buscarSinSenal(b);
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    const tope = control ? setTimeout(function () { control.abort(); }, ESPERA_BUSQUEDA_MS) : null;
    return fetch(RUTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoDe(b)),
      signal: control ? control.signal : undefined
    }).then(function (respuesta) {
      clearTimeout(tope);
      return respuesta.json().catch(function () { return {}; }).then(function (datos) {
        if (respuesta.ok) return Object.assign({ fuente: 'servidor' }, datos);
        /* Lo que el servidor sí contestó (dato mal escrito, sin permiso,
           tope, base aún sin cargar) se dice tal cual; sólo lo que no
           contestó pasa a la copia del teléfono. */
        if (respuesta.status === 400 || respuesta.status === 403 || respuesta.status === 429 ||
            (respuesta.status === 503 && datos.codigo === 'sin_base')) {
          throw new ErrorVisible(datos.error || 'No se pudo buscar.');
        }
        return buscarSinSenal(b);
      });
    }, function () {
      clearTimeout(tope);
      return buscarSinSenal(b);
    });
  }

  function ubicacionActual() {
    return new Promise(function (resolver, rechazar) {
      if (!navigator.geolocation) { rechazar(new ErrorVisible('Este teléfono no da su ubicación.')); return; }
      navigator.geolocation.getCurrentPosition(function (posicion) {
        resolver({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precision: posicion.coords.accuracy
        });
      }, function (error) {
        rechazar(new ErrorVisible(error && error.code === 1
          ? 'La aplicación no tiene permiso para usar la ubicación. Actívelo en el navegador y vuelva a intentarlo.'
          : 'No se pudo obtener la ubicación. Inténtelo de nuevo al aire libre.'));
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    });
  }

  /* ---------------------------------------------------------
     3. PANTALLA
     --------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function elemento(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined && texto !== null) nodo.textContent = texto;
    return nodo;
  }

  function icono(nombre) {
    const i = elemento('i', 'ph ' + nombre);
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function fechaLegible(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? Number(m[3]) + ' ' + MESES[Number(m[2]) - 1] + ' ' + m[1] : 'sin fecha';
  }

  /* «2026-11-05 10:42» → «5 nov 2026, 10:42». */
  function fechaHoraLegible(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(texto || ''));
    if (!m) return '';
    return Number(m[3]) + ' ' + MESES[Number(m[2]) - 1] + ' ' + m[1] + (m[4] ? ', ' + m[4] + ':' + m[5] : '');
  }

  function fechaYHora(iso) {
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return '';
    const hora = String(fecha.getHours()).padStart(2, '0') + ':' + String(fecha.getMinutes()).padStart(2, '0');
    return fecha.getDate() + ' ' + MESES[fecha.getMonth()] + ', ' + hora;
  }

  function miles(n) {
    return Number(n || 0).toLocaleString('es-CO');
  }

  function plural(n, uno, varios) {
    return n + ' ' + (n === 1 ? uno : varios);
  }

  function modoElegido() {
    const marcado = document.querySelector('input[name="modoBusquedaPrevia"]:checked');
    return marcado ? marcado.value : 'documento';
  }

  /* Lo que dice la ayuda bajo el campo: en dirección, cómo la va a buscar. */
  function pintarAyuda() {
    const modo = modoElegido();
    const ayuda = $('ayudaBusquedaPrevia');
    const campo = $('textoBusquedaPrevia');
    const fila = $('filaTextoBusquedaPrevia');
    const boton = $('btnBuscarPrevia');
    if (!ayuda || !campo) return;
    fila.hidden = modo === 'cercania';
    boton.querySelector('span').textContent = modo === 'cercania' ? 'Buscar cerca de mí' : 'Buscar';
    /* Casi todos los documentos son sólo números: el teclado numérico ahorra
       tiempo en la puerta de la casa. */
    campo.setAttribute('inputmode', modo === 'documento' ? 'numeric' : 'text');
    campo.setAttribute('aria-label', MARCAS[modo] || '');
    campo.placeholder = modo === 'documento' ? '1143…' : modo === 'direccion' ? 'Cra 14 # 14-14' : '';

    ayuda.textContent = AYUDAS[modo];
    if (modo === 'direccion' && campo.value.trim()) {
      const clave = CRUCE.claveDeDireccion(campo.value);
      ayuda.textContent = clave ? 'Se buscará como ' + clave + '.' : AYUDAS.direccion;
    }
  }

  function limpiarResultado() {
    const zona = $('resultadoBusquedaPrevia');
    if (zona) zona.replaceChildren();
  }

  function pintarAviso(mensaje, espera) {
    const zona = $('resultadoBusquedaPrevia');
    zona.replaceChildren();
    const aviso = elemento('div', 'previa-resumen ' + (espera ? 'previa-resumen--espera' : 'previa-resumen--error'));
    aviso.appendChild(icono(espera ? 'ph-crosshair' : 'ph-info'));
    aviso.appendChild(elemento('p', 'previa-resumen__texto', mensaje));
    zona.appendChild(aviso);
  }

  function pintarError(mensaje) {
    pintarAviso(mensaje, false);
  }

  const POR_QUE = {
    documento: function (r) { return 'Mismo documento' + (r.tipoDocumento ? ' (' + r.tipoDocumento + ')' : ''); },
    direccion: function () { return 'Misma dirección'; },
    cercania: function (r) { return 'A ' + r.distancia + ' m'; }
  };

  function tarjeta(r, modo) {
    const item = elemento('li', 'previa-item');
    /* Primero cuándo y por qué coincidió; debajo, de dónde viene. */
    const cabecera = elemento('div', 'previa-item__cabecera');
    cabecera.appendChild(elemento('span', 'previa-item__fecha', 'Caracterizada el ' + fechaLegible(r.fecha)));
    cabecera.appendChild(elemento('span', 'previa-chip previa-chip--coincide', POR_QUE[modo](r)));
    item.appendChild(cabecera);
    item.appendChild(elemento('span', 'previa-chip previa-chip--' + (r.origen === 'app' ? 'app' : 'previa'),
      r.origen === 'app' ? 'Ficha de la app' : 'Base 2025 – 1.er sem. 2026'));

    const lugar = [r.territorio, r.microterritorio, r.lugar].filter(Boolean).join(' · ');
    if (lugar) item.appendChild(elemento('p', 'previa-item__lugar', lugar));
    item.appendChild(elemento('p', 'previa-item__direccion', r.direccion || 'Sin dirección escrita'));

    const datos = elemento('dl', 'previa-item__datos');
    const dato = function (titulo, valor) {
      if (valor === null || valor === undefined || valor === '') return;
      const par = elemento('div', 'previa-item__dato');
      par.appendChild(elemento('dt', null, titulo));
      par.appendChild(elemento('dd', null, valor));
      datos.appendChild(par);
    };
    dato('EBS', [r.equipo, r.equipoNombre].filter(Boolean).join(' · '));
    dato('Caracterizó', r.responsable);
    if (r.personas !== null && r.personas !== undefined) {
      dato('Personas', plural(r.personas, 'persona', 'personas') +
        (r.familias ? ' en ' + plural(r.familias, 'familia', 'familias') : ''));
    }
    /* Cuándo llegó al sistema: puede ser días después de la visita. */
    if (r.subida) dato('Subida', fechaHoraLegible(r.subida));
    if (r.estado && r.estado !== 'Cerrada') dato('Visita', r.estado);
    dato('Referencia', r.referencia);
    item.appendChild(datos);
    return item;
  }

  function pintarResultado(resultado) {
    const zona = $('resultadoBusquedaPrevia');
    zona.replaceChildren();

    const encontrada = resultado.total > 0;
    const resumen = elemento('div', 'previa-resumen ' + (encontrada ? 'previa-resumen--encontrada' : 'previa-resumen--libre'));
    resumen.appendChild(icono(encontrada ? 'ph-warning-circle' : 'ph-check-circle'));
    const textos = elemento('div', 'previa-resumen__textos');
    if (encontrada) {
      textos.appendChild(elemento('strong', 'previa-resumen__titulo', 'Ya fue caracterizada'));
      textos.appendChild(elemento('p', 'previa-resumen__texto',
        plural(resultado.total, 'coincidencia', 'coincidencias') + (resultado.truncado ? ' (se muestran las ' + MAXIMO + ' más recientes)' : '') +
        '. Revise antes de diligenciar otra ficha: puede ser un seguimiento o la casa vecina.'));
    } else {
      textos.appendChild(elemento('strong', 'previa-resumen__titulo', 'No aparece caracterizada'));
      textos.appendChild(elemento('p', 'previa-resumen__texto', resultado.modo === 'cercania'
        ? 'No hay viviendas caracterizadas a menos de ' + resultado.radio + ' m, ni en la base 2025 – primer semestre 2026 ni en la app.'
        : 'Ni en la base 2025 – primer semestre 2026 ni en la app.' +
          (resultado.modo === 'direccion' ? ' Si la dirección se escribió distinto, pruebe con el documento o con «Cerca de mí».' : '')));
    }
    resumen.appendChild(textos);
    zona.appendChild(resumen);

    if (encontrada) {
      const lista = elemento('ul', 'previa-lista');
      resultado.resultados.forEach(function (r) { lista.appendChild(tarjeta(r, resultado.modo)); });
      zona.appendChild(lista);
    }

    if (resultado.modo === 'cercania' && resultado.radio < RADIO_AMPLIO) {
      const ampliar = elemento('button', 'btn btn--ghost previa-ampliar');
      ampliar.type = 'button';
      ampliar.appendChild(icono('ph-arrows-out-simple'));
      ampliar.appendChild(elemento('span', null, 'Ampliar a ' + RADIO_AMPLIO + ' m'));
      ampliar.addEventListener('click', function () {
        if (ultimaBusqueda) ejecutar(Object.assign({}, ultimaBusqueda, { radio: RADIO_AMPLIO }));
      });
      zona.appendChild(ampliar);
    }

    const fuente = elemento('p', 'previa-fuente');
    if (resultado.fuente === 'copia') {
      const m = resultado.copia || {};
      fuente.textContent = 'Sin internet: se buscó en las viviendas guardadas en este teléfono' +
        (m.generada ? ' (actualizadas el ' + fechaYHora(m.generada) + ')' : '') +
        '. No incluye lo registrado después.';
      fuente.classList.add('previa-fuente--copia');
    } else {
      fuente.textContent = 'Se buscó en toda la base' + (resultado.buscado && resultado.modo === 'direccion' ? ', como ' + resultado.buscado : '') + '.';
    }
    zona.appendChild(fuente);
  }

  function ocupar(si) {
    const boton = $('btnBuscarPrevia');
    const panel = $('panelYaCaracterizada');
    if (boton) boton.disabled = si;
    if (panel) panel.setAttribute('aria-busy', si ? 'true' : 'false');
  }

  function ejecutar(pedido) {
    ultimaBusqueda = pedido;
    ocupar(true);
    let b;
    try {
      b = prepararBusqueda(pedido.modo, pedido.texto, pedido.punto, pedido.radio);
    } catch (error) {
      ocupar(false);
      pintarError(error.message);
      return Promise.resolve();
    }
    return buscar(b).then(pintarResultado, function (error) {
      pintarError(error instanceof ErrorVisible ? error.message : 'No se pudo buscar. Inténtelo de nuevo.');
    }).then(function () { ocupar(false); });
  }

  function alBuscar(evento) {
    evento.preventDefault();
    const modo = modoElegido();
    if (modo !== 'cercania') {
      ejecutar({ modo: modo, texto: $('textoBusquedaPrevia').value });
      return;
    }
    ocupar(true);
    pintarAviso('Buscando su ubicación…', true);
    ubicacionActual().then(function (punto) {
      /* Con un GPS impreciso, el círculo crece hasta su margen (máximo 100 m). */
      const radio = Math.min(RADIO_AMPLIO, Math.max(RADIO, Math.round(punto.precision || RADIO)));
      return ejecutar({ modo: modo, punto: punto, radio: radio });
    }, function (error) {
      ocupar(false);
      pintarError(error.message);
    });
  }

  function pintarEstadoCopia(estado) {
    const nodo = $('estadoCopiaPrevia');
    if (!nodo) return;
    const texto = nodo.querySelector('.previa-copia__texto');
    const boton = $('btnActualizarCopiaPrevia');
    if (estado && estado.ocupada) {
      texto.textContent = 'Guardando en este teléfono las viviendas ya caracterizadas, para poder buscar sin internet…';
      boton.hidden = true;
      return;
    }
    const documento = documentoActual();
    if (!documento) return;
    leerRegistro(documento).then(function (registro) {
      if (actualizando) return;
      boton.hidden = navigator.onLine === false;
      if (!registro) {
        texto.textContent = 'Todavía no hay viviendas guardadas en este teléfono para buscar sin internet.' +
          (navigator.onLine === false ? ' Se guardan la próxima vez que abra la aplicación con internet.' : '');
        return;
      }
      if (!registro.sellado) {
        texto.textContent = 'Todavía no hay viviendas caracterizadas en la base, así que no hay nada que guardar para buscar sin internet.';
        return;
      }
      texto.textContent = 'Para buscar sin internet, este teléfono guardó las ' + miles(registro.viviendas) +
        ' viviendas ya caracterizadas (de todos los EBS y territorios). Última actualización: ' + fechaYHora(registro.generada) + '.';
    });
  }

  function inicializar() {
    const panel = $('panelYaCaracterizada');
    if (!panel || panel.dataset.listo) return;
    if (!puedeBuscar()) { panel.hidden = true; return; }
    panel.dataset.listo = 'si';
    panel.hidden = false;

    $('formYaCaracterizada').addEventListener('submit', alBuscar);
    document.querySelectorAll('input[name="modoBusquedaPrevia"]').forEach(function (radio) {
      radio.addEventListener('change', function () { limpiarResultado(); pintarAyuda(); });
    });
    $('textoBusquedaPrevia').addEventListener('input', pintarAyuda);
    $('btnActualizarCopiaPrevia').addEventListener('click', function () { actualizarCopia({ forzar: true }); });
    pintarAyuda();
    pintarEstadoCopia();

    if (window.BOVEDA) {
      BOVEDA.alAbrir(function () { actualizarCopia(); });
      BOVEDA.antesDeCerrar(function () { copia = null; });
    }
    window.addEventListener('online', function () { actualizarCopia(); pintarEstadoCopia(); });
    window.addEventListener('offline', function () { pintarEstadoCopia(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
  else inicializar();

  window.BASE_PREVIA = {
    actualizarCopia: actualizarCopia,
    _paraPruebas: {
      prepararBusqueda: prepararBusqueda,
      buscarEnCopia: buscarEnCopia,
      indexar: indexar,
      pintarResultado: pintarResultado,
      fechaLegible: fechaLegible,
      fechaHoraLegible: fechaHoraLegible,
      inicializar: inicializar,
      ErrorVisible: ErrorVisible
    }
  };
})();
