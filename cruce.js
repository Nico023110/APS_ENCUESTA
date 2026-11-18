/* =========================================================================
   Encuesta_APS — Cruce de viviendas y personas («¿Ya fue caracterizada?»)
   -------------------------------------------------------------------------
   Para no repetir una caracterización hay que reconocer la misma vivienda o
   la misma persona aunque se hayan escrito distinto. Lo usan tres partes, y
   por eso vive en un solo archivo sin dependencias:

     - bd/cargar_base_previa.js, al cargar la base 2025 – primer semestre
       2026 (direcciones escritas a mano: «Cra 14 # 14-14», «cra97#45-111»);
     - api/base_previa.js y api/guardar_encuesta.js, en el servidor;
     - base_previa.js, en el teléfono, cuando se busca sin señal.

   claveDeDireccion(texto)
     La dirección urbana reducida a lo que la ubica: tipo de vía, número,
     letra, bis y cuadrante, # vía generadora - placa. Los complementos
     (apartamento, torre, piso) se ignoran: en un edificio, todas las
     viviendas comparten la clave, y eso es lo que se quiere avisar.
       «Cra 14 # 14-14»                       -> KR 14 # 14 - 14
       «CL 45 A BIS SUR # 27 B - 15 AP 302»   -> CL 45 A BIS SUR # 27 B - 15
     Tiene la misma forma que la dirección normalizada de la app
     (direccion.js) sin sus complementos. Lo que no se puede leer con
     seguridad —veredas, «casa 34», direcciones incompletas— da null: para
     eso está la búsqueda por cercanía.

   documentoDeCruce(numero)
     Sólo letras y dígitos, en mayúscula. Menos de 5 caracteres no
     identifica a nadie («1», «14» en la base anterior) y da null.

   distanciaEnMetros / coordenadaDeTexto
     La cercanía entre dos puntos, y la coordenada de la base anterior, que
     el Excel guardó sin el punto decimal (3443338 es 3.443338).
   ========================================================================= */

(function (raiz) {
  'use strict';

  const TIPOS_DE_VIA = [
    /* Primero los de dos palabras: «AV CALLE» no es «AV». */
    { codigo: 'AC', formas: ['AVENIDA CALLE', 'AV CALLE', 'AV CL', 'AV CLL', 'AVDA CALLE', 'AC'] },
    { codigo: 'AK', formas: ['AVENIDA CARRERA', 'AV CARRERA', 'AV KR', 'AV CRA', 'AV CR', 'AVDA CARRERA', 'AK'] },
    { codigo: 'CL', formas: ['CALLE', 'CALLES', 'CLL', 'CLLE', 'CL', 'CALL', 'CALE', 'CLE', 'CALLLE'] },
    { codigo: 'KR', formas: ['CARRERA', 'CARRRERA', 'CARERA', 'CRA', 'CRR', 'CR', 'KRA', 'KR', 'KRR', 'CRRA',
      'CARR', 'CARRE', 'CAR', 'K'] },
    { codigo: 'AV', formas: ['AVENIDA', 'AVDA', 'AV', 'AVE'] },
    { codigo: 'DG', formas: ['DIAGONAL', 'DIAG', 'DG', 'DIG'] },
    { codigo: 'TV', formas: ['TRANSVERSAL', 'TRANVERSAL', 'TRASVERSAL', 'TRANSV', 'TRANS', 'TRV', 'TV', 'TR'] },
    { codigo: 'CQ', formas: ['CIRCULAR', 'CQ'] },
    { codigo: 'CV', formas: ['CIRCUNVALAR', 'CV'] },
    { codigo: 'AU', formas: ['AUTOPISTA', 'AU'] },
    { codigo: 'PJ', formas: ['PASAJE', 'PJ', 'PSJ'] },
    { codigo: 'PT', formas: ['PEATONAL', 'PT'] },
    { codigo: 'VR', formas: ['VARIANTE', 'VR'] }
  ];

  const TIPO_POR_FORMA = new Map();
  TIPOS_DE_VIA.forEach(function (tipo) {
    tipo.formas.forEach(function (forma) { TIPO_POR_FORMA.set(forma, tipo.codigo); });
  });

  /* Cuadrantes escritos completos o con su inicial. La inicial sola sólo se
     toma como cuadrante donde no puede ser la letra de la vía: al final de
     la vía, justo antes del # o de la vía generadora. */
  const CUADRANTES = { OESTE: 'OESTE', SUR: 'SUR', NORTE: 'NORTE', ESTE: 'ESTE' };
  const INICIAL_DE_CUADRANTE = { O: 'OESTE', S: 'SUR' };

  function sinTildes(texto) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function fichas(texto) {
    let s = sinTildes(String(texto)).toUpperCase().replace(/ /g, ' ');
    s = s.replace(/[ªᵃ]/g, 'A').replace(/[º°]/g, ' ');
    /* «No.», «Nro», «Número» y la N suelta antes de un número son el #. */
    s = s.replace(/\bN(?:O|RO|UM|UMERO)?\b\.?(?=\s*\d)/g, ' # ');
    s = s.replace(/[.,;:]/g, ' ').replace(/#/g, ' # ').replace(/-/g, ' - ');
    /* «94a», «1oeste», «42aoeste»: se separan número, letra y cuadrante. */
    s = s.replace(/(\d)([A-Z])/g, '$1 $2').replace(/([A-Z])(\d)/g, '$1 $2');
    /* «AOESTE» es A OESTE; «OESTE» sigue siendo OESTE. */
    s = s.replace(/\b([A-Z])(OESTE|SUR|NORTE|ESTE|BIS)\b/g, function (palabra, letra, resto) {
      return CUADRANTES[palabra] ? palabra : letra + ' ' + resto;
    });
    return s.split(/\s+/).filter(Boolean);
  }

  function esNumeroDeVia(ficha) {
    return /^\d{1,3}$/.test(ficha || '');
  }

  function esLetra(ficha) {
    return /^[A-Z]$/.test(ficha || '');
  }

  /* Número, letra, bis (con su letra) y cuadrante de una vía, desde la
     posición `i`. Devuelve el texto y dónde quedó, o null. */
  function leerVia(f, i) {
    if (!esNumeroDeVia(f[i])) return null;
    const partes = [String(Number(f[i]))];
    i++;

    const terminaVia = function (j) { return f[j] === undefined || f[j] === '#' || f[j] === '-' || esNumeroDeVia(f[j]); };

    if (esLetra(f[i]) && !(INICIAL_DE_CUADRANTE[f[i]] && terminaVia(i + 1))) {
      partes.push(f[i]);
      i++;
    }
    if (f[i] === 'BIS') {
      partes.push('BIS');
      i++;
      if (esLetra(f[i]) && !(INICIAL_DE_CUADRANTE[f[i]] && terminaVia(i + 1))) {
        partes.push(f[i]);
        i++;
      }
    }
    if (CUADRANTES[f[i]]) {
      partes.push(CUADRANTES[f[i]]);
      i++;
    } else if (INICIAL_DE_CUADRANTE[f[i]] && terminaVia(i + 1)) {
      partes.push(INICIAL_DE_CUADRANTE[f[i]]);
      i++;
    }
    return { texto: partes.join(' '), siguiente: i };
  }

  /** @returns {string|null} p. ej. «KR 14 # 14 - 14». */
  function claveDeDireccion(texto) {
    if (texto === null || texto === undefined) return null;
    const f = fichas(texto);

    /* El tipo de vía puede no ir de primero («362 calle 10 # 34-44»): se
       toma el primero que aparezca, de dos palabras o de una. */
    for (let inicio = 0; inicio < f.length; inicio++) {
      const dos = f[inicio] + ' ' + (f[inicio + 1] || '');
      let tipo = TIPO_POR_FORMA.get(dos);
      let i = inicio + 2;
      if (!tipo) {
        tipo = TIPO_POR_FORMA.get(f[inicio]);
        i = inicio + 1;
      }
      if (!tipo) continue;

      const principal = leerVia(f, i);
      if (!principal) continue;
      i = principal.siguiente;
      if (f[i] === '#') i++;

      const generadora = leerVia(f, i);
      if (!generadora) continue;
      i = generadora.siguiente;
      /* La placa va tras un guion; a veces tras un espacio o un segundo #. */
      if (f[i] === '-' || f[i] === '#') i++;
      if (!esNumeroDeVia(f[i])) continue;

      return tipo + ' ' + principal.texto + ' # ' + generadora.texto + ' - ' + String(Number(f[i]));
    }
    return null;
  }

  /** @returns {string|null} el número de documento para cruzar, o null si no identifica. */
  function documentoDeCruce(numero) {
    if (numero === null || numero === undefined) return null;
    const limpio = sinTildes(String(numero)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return limpio.length >= 5 && limpio.length <= 20 ? limpio : null;
  }

  /* Haversine: sobra precisión para decenas de metros. */
  function distanciaEnMetros(lat1, lon1, lat2, lon2) {
    const radianes = Math.PI / 180;
    const dLat = (lat2 - lat1) * radianes;
    const dLon = (lon2 - lon1) * radianes;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * radianes) * Math.cos(lat2 * radianes) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* Cali: lo que cae fuera no es una vivienda de la E.S.E. Ladera, es un
     error de digitación. */
  const LIMITES_CALI = { latMin: 3.2, latMax: 3.7, lonMin: -76.8, lonMax: -76.4 };

  /* Con menos de 4 decimales el punto está a más de 10 m de la vivienda y
     «cerca de mí» traería casas que no son. */
  const DECIMALES_MINIMOS = 4;

  /**
   * La coordenada de la base anterior: el Excel la guardó sin el punto
   * decimal (3443338 = 3.443338; -76526951 = -76.526951). `enteros` es
   * cuántos dígitos van antes del punto: 1 para la latitud de Cali, 2 para
   * la longitud. Si ya trae el punto (o la coma), se lee tal cual.
   * @returns {number|null}
   */
  function coordenadaDeTexto(texto, enteros) {
    if (texto === null || texto === undefined) return null;
    const s = String(texto).trim().replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const negativo = s.charAt(0) === '-';
    const sinSigno = negativo ? s.slice(1) : s;
    let entero;
    let decimales;
    if (sinSigno.indexOf('.') >= 0) {
      entero = sinSigno.split('.')[0];
      decimales = sinSigno.split('.')[1];
    } else {
      entero = sinSigno.slice(0, enteros);
      decimales = sinSigno.slice(enteros);
    }
    if (entero.length !== enteros || decimales.length < DECIMALES_MINIMOS) return null;
    const valor = Number(entero + '.' + decimales.slice(0, 6));
    return negativo ? -valor : valor;
  }

  /** @returns {{latitud:number, longitud:number}|null} el par, sólo si cae en Cali. */
  function puntoEnCali(latitud, longitud) {
    const lat = Number(latitud);
    const lon = Number(longitud);
    if (!isFinite(lat) || !isFinite(lon)) return null;
    if (lat < LIMITES_CALI.latMin || lat > LIMITES_CALI.latMax) return null;
    if (lon < LIMITES_CALI.lonMin || lon > LIMITES_CALI.lonMax) return null;
    return { latitud: lat, longitud: lon };
  }

  const CRUCE = {
    claveDeDireccion: claveDeDireccion,
    documentoDeCruce: documentoDeCruce,
    distanciaEnMetros: distanciaEnMetros,
    coordenadaDeTexto: coordenadaDeTexto,
    puntoEnCali: puntoEnCali,
    LIMITES_CALI: LIMITES_CALI
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CRUCE;
  else raiz.CRUCE = CRUCE;
})(typeof window !== 'undefined' ? window : this);
