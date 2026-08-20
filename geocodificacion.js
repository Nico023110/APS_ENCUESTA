/* =========================================================
   Encuesta_APS — Geocodificación de la dirección (ítems 22 y 23)
   ---------------------------------------------------------
   Obtiene latitud y longitud a partir de la dirección diligenciada
   en el ítem 21.

   ESTRATEGIA
   El servicio de geocodificación resuelve la vía, pero devuelve el
   primer tramo que encuentra en todo el municipio: "Carrera 8" puede
   caer en la Comuna 3 aunque la vivienda esté en la Comuna 20.
   Por eso se consultan dos cosas por separado y se contrastan:

     1. la VÍA   (ítem 21) -> coordenada precisa pero posiblemente del
                              tramo equivocado;
     2. el ANCLA (ítem 9)  -> barrio, vereda o corregimiento; menos
                              precisa pero territorialmente confiable.

   Si ambas coinciden dentro de un radio razonable se usa la vía
   (precisión de vía). Si discrepan, o si la vía no resuelve, se usa
   el ancla (precisión de sector) y se advierte al encuestador.

   NOTA SOBRE DATOS PERSONALES
   A este servicio solo se envía la vía y el barrio. Nunca se envían
   nombres, documentos ni ningún otro dato del titular.

   Depende de: catalogos.js, direccion.js
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   1. CONFIGURACIÓN
   --------------------------------------------------------- */

const GEO_PROVEEDOR = {
  nombre: 'Nominatim (OpenStreetMap)',
  base: 'https://nominatim.openstreetmap.org/search'
};

// Distancia máxima admitida entre la vía y el barrio para considerar
// que el resultado de la vía corresponde al tramo correcto.
const GEO_UMBRAL_COHERENCIA_KM = 3;

const GEO_TIEMPO_ESPERA_MS = 12000;

// El servicio pide no superar una consulta por segundo.
const GEO_PAUSA_ENTRE_CONSULTAS_MS = 1100;

// El ancla territorial se repite entre encuestas del mismo barrio.
const cacheGeocodificacion = new Map();

/* ---------------------------------------------------------
   2. FUNCIONES PURAS (no dependen de la red)
   --------------------------------------------------------- */

const RADIO_TIERRA_KM = 6371;

function aRadianes(grados) {
  return grados * Math.PI / 180;
}

function distanciaKm(lat1, lon1, lat2, lon2) {
  const dLat = aRadianes(lat2 - lat1);
  const dLon = aRadianes(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convierte una respuesta cruda del servicio en un candidato utilizable,
 * descartando lo que caiga fuera del municipio.
 */
function interpretarRespuesta(resultados) {
  if (!Array.isArray(resultados) || resultados.length === 0) return null;

  for (let i = 0; i < resultados.length; i++) {
    const item = resultados[i];
    const latitud = parseFloat(item.lat);
    const longitud = parseFloat(item.lon);
    if (Number.isNaN(latitud) || Number.isNaN(longitud)) continue;
    if (coordenadasDentroDeCali(latitud, longitud) !== true) continue;

    return {
      latitud: latitud,
      longitud: longitud,
      descripcion: item.display_name || null,
      tipo: item.type || null
    };
  }

  return null;
}

/**
 * Decide la coordenada definitiva a partir de los dos candidatos.
 * Función pura: es el núcleo de la estrategia y se prueba sin red.
 */
function elegirCoordenada(candidatoVia, candidatoAncla) {
  if (!candidatoVia && !candidatoAncla) {
    return {
      encontrada: false,
      precision: null,
      mensaje: 'No fue posible ubicar la dirección en el mapa. Capture las coordenadas con el GPS o digítelas.'
    };
  }

  if (candidatoVia && !candidatoAncla) {
    return {
      encontrada: true,
      latitud: candidatoVia.latitud,
      longitud: candidatoVia.longitud,
      precision: 'via',
      referencia: candidatoVia.descripcion,
      mensaje: 'Coordenadas obtenidas de la vía. No se pudo verificar contra el barrio del ítem 9.'
    };
  }

  if (!candidatoVia && candidatoAncla) {
    return {
      encontrada: true,
      latitud: candidatoAncla.latitud,
      longitud: candidatoAncla.longitud,
      precision: 'sector',
      referencia: candidatoAncla.descripcion,
      mensaje: 'No se ubicó la vía exacta. Se usó el centro del barrio o corregimiento; verifique en terreno.'
    };
  }

  const separacion = distanciaKm(
    candidatoVia.latitud, candidatoVia.longitud,
    candidatoAncla.latitud, candidatoAncla.longitud
  );

  if (separacion <= GEO_UMBRAL_COHERENCIA_KM) {
    return {
      encontrada: true,
      latitud: candidatoVia.latitud,
      longitud: candidatoVia.longitud,
      precision: 'via',
      referencia: candidatoVia.descripcion,
      separacionKm: Math.round(separacion * 100) / 100,
      mensaje: 'Coordenadas obtenidas de la dirección y verificadas contra el barrio del ítem 9.'
    };
  }

  const separacionRedondeada = Math.round(separacion * 10) / 10;

  return {
    encontrada: true,
    latitud: candidatoAncla.latitud,
    longitud: candidatoAncla.longitud,
    precision: 'sector',
    referencia: candidatoAncla.descripcion,
    separacionKm: separacionRedondeada,
    mensaje: 'La vía encontrada queda a ' + separacionRedondeada + ' km del barrio indicado, ' +
      'por lo que corresponde a otro tramo. Se usó el centro del barrio; verifique en terreno.'
  };
}

const ETIQUETA_PRECISION = {
  via: 'vía',
  sector: 'barrio o sector'
};

/* ---------------------------------------------------------
   3. CONSULTAS AL SERVICIO
   --------------------------------------------------------- */

function urlEstructurada(via) {
  const parametros = new URLSearchParams({
    format: 'json',
    limit: '3',
    country: 'Colombia',
    state: CAT_DEPARTAMENTO.nombre,
    city: CAT_MUNICIPIO.nombre,
    street: via
  });
  return GEO_PROVEEDOR.base + '?' + parametros.toString();
}

function urlLibre(texto) {
  const parametros = new URLSearchParams({
    format: 'json',
    limit: '3',
    countrycodes: 'co',
    q: texto + ', ' + CAT_MUNICIPIO.nombre + ', ' + CAT_DEPARTAMENTO.nombre + ', Colombia'
  });
  return GEO_PROVEEDOR.base + '?' + parametros.toString();
}

function esperar(milisegundos) {
  if (milisegundos <= 0) return Promise.resolve();
  return new Promise(function (resolver) { setTimeout(resolver, milisegundos); });
}

// Momento a partir del cual se puede lanzar la siguiente consulta.
let proximaConsultaDisponibleEn = 0;

/**
 * Consulta el servicio respetando dos cosas: la caché (para no repetir
 * lo ya resuelto) y el límite de una consulta por segundo del proveedor.
 * Una búsqueda totalmente cacheada no espera nada.
 */
function consultar(url) {
  if (cacheGeocodificacion.has(url)) {
    return Promise.resolve(cacheGeocodificacion.get(url));
  }

  const ahora = Date.now();
  const espera = Math.max(0, proximaConsultaDisponibleEn - ahora);
  proximaConsultaDisponibleEn = ahora + espera + GEO_PAUSA_ENTRE_CONSULTAS_MS;

  return esperar(espera).then(function () {
    const controlador = new AbortController();
    const temporizador = setTimeout(function () { controlador.abort(); }, GEO_TIEMPO_ESPERA_MS);

    return fetch(url, { signal: controlador.signal, headers: { Accept: 'application/json' } })
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error('El servicio respondió ' + respuesta.status);
        return respuesta.json();
      })
      .then(function (datos) {
        const candidato = interpretarRespuesta(datos);
        cacheGeocodificacion.set(url, candidato);
        return candidato;
      })
      .finally(function () { clearTimeout(temporizador); });
  });
}

/* ---------------------------------------------------------
   4. PUNTO DE ENTRADA
   --------------------------------------------------------- */

/**
 * @param {string} via   texto natural de la vía (ítem 21)
 * @param {string} ancla barrio, vereda o corregimiento (ítem 9)
 */
function geocodificarDireccion(via, ancla) {
  const textoVia = (via || '').trim();
  const textoAncla = (ancla || '').trim();

  if (textoVia === '' && textoAncla === '') {
    return Promise.resolve({
      encontrada: false,
      precision: null,
      mensaje: 'Diligencie la dirección o el barrio antes de buscar las coordenadas.'
    });
  }

  // El ancla se consulta primero: es la referencia contra la cual se valida la vía.
  const promesaAncla = textoAncla === ''
    ? Promise.resolve(null)
    : consultar(urlLibre(textoAncla)).catch(function () { return null; });

  return promesaAncla.then(function (candidatoAncla) {
    if (textoVia === '') return elegirCoordenada(null, candidatoAncla);

    return consultar(urlEstructurada(textoVia))
      .then(function (candidatoVia) {
        // Segundo intento con consulta libre: cubre las vías que la
        // búsqueda estructurada no resuelve.
        return candidatoVia || consultar(urlLibre(textoVia));
      })
      .catch(function () { return null; })
      .then(function (candidatoVia) { return elegirCoordenada(candidatoVia, candidatoAncla); });
  });
}

/**
 * La geolocalización del navegador y `fetch` a un servicio externo
 * exigen un origen seguro. Abrir el archivo con doble clic (file://)
 * los deja inoperantes en Chrome y Edge.
 */
function origenEsSeguro() {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext === true && window.location.protocol !== 'file:';
}
