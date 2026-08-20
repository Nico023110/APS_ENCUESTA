/* =========================================================
   Encuesta_APS — Normalización de dirección (ítem 21 / RN-021)
   ---------------------------------------------------------
   La dirección se captura por componentes y se compone en dos
   representaciones:

     canonica -> cadena estandarizada en mayúsculas, apta para
                 almacenamiento, cruce entre fuentes y consulta
                 a un servicio de geocodificación.
     legible  -> cadena en lenguaje natural que se muestra al
                 encuestador para que confirme lo diligenciado.

   Ejemplos:
     Urbana  canónica: CL 45 A BIS SUR # 27 B - 15 AP 302
             legible : Calle 45 A Bis Sur # 27 B - 15, Apartamento 302
     Rural   canónica: VIA CALI - BUENAVENTURA KM 18 FINCA LA ESPERANZA
             legible : Vía Cali - Buenaventura, Km 18, Finca La Esperanza

   Depende de: catalogos.js
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   1. UTILIDADES DE TEXTO
   --------------------------------------------------------- */

function limpiarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim().replace(/\s+/g, ' ');
}

function mayusculas(valor) {
  return limpiarTexto(valor).toLocaleUpperCase('es-CO');
}

// Une fragmentos ignorando los vacíos.
function unir(fragmentos, separador) {
  return fragmentos
    .map(limpiarTexto)
    .filter(function (fragmento) { return fragmento !== ''; })
    .join(separador === undefined ? ' ' : separador);
}

const NOMBRE_CUADRANTE = { N: 'NORTE', S: 'SUR', E: 'ESTE', O: 'OESTE' };

function nombreCuadrante(codigo) {
  return NOMBRE_CUADRANTE[codigo] || '';
}

// "Calle (CL)" -> "Calle";  "Conjunto / Unidad residencial (CO)" -> "Conjunto"
function nombreDeCatalogo(catalogo, valor) {
  const etiqueta = etiquetaDeCatalogo(catalogo, valor);
  if (!etiqueta) return '';
  return String(etiqueta)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .split('/')[0]
    .trim();
}

function capitalizar(texto) {
  const limpio = limpiarTexto(texto);
  if (limpio === '') return '';
  return limpio.charAt(0).toLocaleUpperCase('es-CO') + limpio.slice(1);
}

/* ---------------------------------------------------------
   2. COMPLEMENTOS (apartamento, torre, unidad, interior…)
   --------------------------------------------------------- */

function complementosValidos(complementos) {
  if (!Array.isArray(complementos)) return [];
  return complementos.filter(function (complemento) {
    return complemento && limpiarTexto(complemento.tipo) !== '' && limpiarTexto(complemento.valor) !== '';
  });
}

function complementosCanonicos(complementos) {
  return complementosValidos(complementos).map(function (complemento) {
    return mayusculas(complemento.tipo) + ' ' + mayusculas(complemento.valor);
  });
}

function complementosLegibles(complementos) {
  return complementosValidos(complementos).map(function (complemento) {
    return nombreDeCatalogo(CAT_COMPLEMENTO, complemento.tipo) + ' ' + limpiarTexto(complemento.valor);
  });
}

/* ---------------------------------------------------------
   3. DIRECCIÓN URBANA
   Estructura: <vía principal> # <vía generadora> - <placa> <complementos>
   --------------------------------------------------------- */

const CAMPOS_URBANOS_OBLIGATORIOS = [
  { campo: 'viaTipo', etiqueta: 'tipo de vía' },
  { campo: 'viaNumero', etiqueta: 'número de la vía' },
  { campo: 'genNumero', etiqueta: 'número de la vía generadora' },
  { campo: 'placa', etiqueta: 'placa' }
];

function faltantesUrbana(d) {
  return CAMPOS_URBANOS_OBLIGATORIOS
    .filter(function (item) { return limpiarTexto(d[item.campo]) === ''; })
    .map(function (item) { return item.etiqueta; });
}

function normalizarDireccionUrbana(d) {
  const faltantes = faltantesUrbana(d);

  const viaPrincipalCanonica = unir([
    mayusculas(d.viaTipo),
    mayusculas(d.viaNumero),
    mayusculas(d.viaLetra),
    d.viaBis ? 'BIS' : '',
    mayusculas(d.viaLetraBis),
    nombreCuadrante(d.viaCuadrante)
  ]);

  const viaGeneradoraCanonica = unir([
    mayusculas(d.genNumero),
    mayusculas(d.genLetra),
    nombreCuadrante(d.genCuadrante)
  ]);

  const complementos = complementosCanonicos(d.complementos);

  const canonica = unir([
    viaPrincipalCanonica,
    viaGeneradoraCanonica ? '# ' + viaGeneradoraCanonica : '',
    limpiarTexto(d.placa) ? '- ' + mayusculas(d.placa) : '',
    complementos.join(' ')
  ]);

  const viaPrincipalLegible = unir([
    nombreDeCatalogo(CAT_TIPO_VIA, d.viaTipo),
    limpiarTexto(d.viaNumero),
    mayusculas(d.viaLetra),
    d.viaBis ? 'Bis' : '',
    mayusculas(d.viaLetraBis),
    capitalizar(nombreCuadrante(d.viaCuadrante).toLocaleLowerCase('es-CO'))
  ]);

  const viaGeneradoraLegible = unir([
    limpiarTexto(d.genNumero),
    mayusculas(d.genLetra),
    capitalizar(nombreCuadrante(d.genCuadrante).toLocaleLowerCase('es-CO'))
  ]);

  const nucleoLegible = unir([
    viaPrincipalLegible,
    viaGeneradoraLegible ? '# ' + viaGeneradoraLegible : '',
    limpiarTexto(d.placa) ? '- ' + limpiarTexto(d.placa) : ''
  ]);

  const legible = unir([nucleoLegible].concat(complementosLegibles(d.complementos)), ', ');

  return { canonica: canonica, legible: legible, faltantes: faltantes, completa: faltantes.length === 0 };
}

/* ---------------------------------------------------------
   4. DIRECCIÓN RURAL
   Estructura: <vía> <km> <predio> <sector> <complementos>
   --------------------------------------------------------- */

function normalizarDireccionRural(d) {
  const faltantes = [];

  if (limpiarTexto(d.ruralViaTipo) === '') faltantes.push('tipo de vía rural');

  const tieneReferencia = limpiarTexto(d.ruralViaNombre) !== '' ||
    limpiarTexto(d.ruralPredioNombre) !== '' ||
    limpiarTexto(d.ruralSector) !== '';

  if (!tieneReferencia) {
    faltantes.push('al menos el nombre de la vía, el predio o el sector');
  }

  const kilometro = limpiarTexto(d.ruralKm);

  const via = limpiarTexto(d.ruralViaTipo) === 'SN'
    ? 'SIN NOMENCLATURA'
    : unir([mayusculas(d.ruralViaTipo), mayusculas(d.ruralViaNombre)]);

  const predio = unir([mayusculas(d.ruralPredioTipo), mayusculas(d.ruralPredioNombre)]);
  const sector = limpiarTexto(d.ruralSector) ? 'SECTOR ' + mayusculas(d.ruralSector) : '';

  const canonica = unir([
    via,
    kilometro ? 'KM ' + kilometro : '',
    predio,
    sector,
    complementosCanonicos(d.complementos).join(' ')
  ]);

  const viaLegible = limpiarTexto(d.ruralViaTipo) === 'SN'
    ? 'Sin nomenclatura vial'
    : unir([nombreDeCatalogo(CAT_TIPO_VIA_RURAL, d.ruralViaTipo), limpiarTexto(d.ruralViaNombre)]);

  const predioLegible = unir([
    nombreDeCatalogo(CAT_TIPO_PREDIO_RURAL, d.ruralPredioTipo),
    limpiarTexto(d.ruralPredioNombre)
  ]);

  const partesLegibles = [
    viaLegible,
    kilometro ? 'Km ' + kilometro : '',
    predioLegible,
    limpiarTexto(d.ruralSector) ? 'Sector ' + limpiarTexto(d.ruralSector) : ''
  ].concat(complementosLegibles(d.complementos));

  return {
    canonica: canonica,
    legible: unir(partesLegibles, ', '),
    faltantes: faltantes,
    completa: faltantes.length === 0
  };
}

/* ---------------------------------------------------------
   5. PUNTO DE ENTRADA
   --------------------------------------------------------- */

function normalizarDireccion(d) {
  if (!d || !d.modo) {
    return { canonica: '', legible: '', faltantes: ['modo de nomenclatura'], completa: false };
  }
  return d.modo === 'rural' ? normalizarDireccionRural(d) : normalizarDireccionUrbana(d);
}

/**
 * Texto en lenguaje natural de la vía, para consultar al geocodificador.
 *
 * Difiere de la forma canónica en tres cosas, verificadas contra el
 * comportamiento real del servicio:
 *   - expande las abreviaturas (CL -> Calle), que el geocodificador no interpreta;
 *   - omite los complementos (apartamento, torre, interior), que no aportan
 *     a la ubicación y reducen las coincidencias;
 *   - omite el barrio, porque incluirlo junto a la vía anula el resultado.
 *     El barrio se consulta por separado como ancla territorial.
 */
function textoViaParaGeocodificar(d) {
  if (!d || !d.modo) return '';

  if (d.modo === 'rural') {
    if (limpiarTexto(d.ruralViaTipo) === 'SN' || limpiarTexto(d.ruralViaTipo) === '') return '';
    return unir([
      nombreDeCatalogo(CAT_TIPO_VIA_RURAL, d.ruralViaTipo),
      limpiarTexto(d.ruralViaNombre),
      limpiarTexto(d.ruralKm) ? 'Km ' + limpiarTexto(d.ruralKm) : ''
    ]);
  }

  const viaPrincipal = unir([
    nombreDeCatalogo(CAT_TIPO_VIA, d.viaTipo),
    limpiarTexto(d.viaNumero),
    mayusculas(d.viaLetra),
    d.viaBis ? 'Bis' : '',
    mayusculas(d.viaLetraBis),
    capitalizar(nombreCuadrante(d.viaCuadrante).toLocaleLowerCase('es-CO'))
  ]);

  const viaGeneradora = unir([limpiarTexto(d.genNumero), mayusculas(d.genLetra)]);

  return unir([
    viaPrincipal,
    viaGeneradora ? '# ' + viaGeneradora : '',
    limpiarTexto(d.placa) ? '- ' + limpiarTexto(d.placa) : ''
  ]);
}

/**
 * Ancla territorial: barrio, vereda o corregimiento del ítem 9.
 * Se consulta por separado y sirve para validar o reemplazar el
 * resultado de la vía.
 */
function textoAnclaParaGeocodificar(divisionTerritorial, componentes) {
  const sector = componentes && componentes.modo === 'rural' ? limpiarTexto(componentes.ruralSector) : '';
  return limpiarTexto(divisionTerritorial) || sector;
}

/**
 * Cadena legible que se almacena junto al registro, como constancia
 * de qué se envió a geocodificar.
 */
function construirConsultaGeocodificacion(componentes, divisionTerritorial) {
  return unir([
    textoViaParaGeocodificar(componentes),
    textoAnclaParaGeocodificar(divisionTerritorial, componentes),
    CAT_MUNICIPIO.nombre,
    CAT_DEPARTAMENTO.nombre,
    'Colombia'
  ], ', ');
}

/* ---------------------------------------------------------
   6. VALIDACIÓN GEOGRÁFICA
   --------------------------------------------------------- */

function coordenadasDentroDeCali(latitud, longitud) {
  if (latitud === null || longitud === null || latitud === undefined || longitud === undefined) return null;
  return latitud >= BBOX_CALI.latMin && latitud <= BBOX_CALI.latMax &&
         longitud >= BBOX_CALI.lonMin && longitud <= BBOX_CALI.lonMax;
}
