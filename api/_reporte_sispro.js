/* =========================================================================
   Encuesta_APS — Archivo plano APS124CCFP para PISIS (módulo interno)
   -------------------------------------------------------------------------
   Convierte fichas leídas de la base (_ficha_completa.leerFichasCompletas)
   en el archivo del anexo técnico SI-APS, versión 7 (junio de 2026):

     registro tipo 1   control: entidad que reporta, período y conteo;
     registro tipo 2   uno por familia: entorno, EBS, vivienda y familia;
     registro tipo 3   uno por integrante.

   Es una función pura sobre datos ya leídos: no toca la base ni la red, así
   que se prueba sin servidor (pruebas/reporte_sispro.test.js).

   De dónde sale cada variable:
     - Las 129 preguntas que añadió el anexo (anexo.js) declaran su registro
       y su variable: su columna se arma sola, con su catálogo y su
       condición. Si la pregunta no aplica, va su `siOculta` o vacía.
     - El resto son ítems del instrumento, escritos aquí uno por uno
       (VARIABLES_TIPO_2 y VARIABLES_TIPO_3), o identificadores derivados.
     - Cómo va cada una (tipo, longitud, obligatoriedad) sale del diccionario
       generado desde el propio anexo (_diccionario_sispro.js).
   Al cargar se comprueba que las 125 + 119 variables tengan definición.

   Nada se inventa para cuadrar el archivo: un dato que falta o que no tiene
   código en el anexo sale vacío y queda en el resumen de incidencias, para
   que se corrija la ficha y no el archivo.
   ========================================================================= */

'use strict';

const { obtenerMotor } = require('./_validacion');
const DICCIONARIO = require('./_diccionario_sispro');

const SEPARADOR = '|';
const FIN_DE_REGISTRO = '\r\n';

/* Tipo de fuente 124 (DTS y E.S.E. beneficiarias de recursos) y tema CCFP. */
const PREFIJO_ARCHIVO = 'APS124CCFP';

/* El consecutivo de registro (variable 1 de los tipos 2 y 3) «inicia en 1
   para el primer registro de detalle»: se numera cada tipo desde 1, con los
   registros agrupados por tipo (todos los tipo 2 y luego todos los tipo 3). */
const MAX_EJEMPLOS_POR_INCIDENCIA = 5;

/* ---------------------------------------------------------
   1. Formato de los valores
   --------------------------------------------------------- */

function vacio(valor) {
  return valor === null || valor === undefined || valor === '' ||
    (Array.isArray(valor) && valor.length === 0);
}

function comoLista(valor) {
  if (Array.isArray(valor)) return valor.filter(function (v) { return !vacio(v); });
  return vacio(valor) ? [] : [valor];
}

/* Mayúsculas, sin tildes (la Ñ queda N), sólo ASCII imprimible y sin
   comillas ni pipes: el pipe es el separador del archivo. NFKD además
   vuelve letra los ordinales de las direcciones («5ª» → «5A»). */
function textoPlano(valor) {
  return String(valor)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[|"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function entero(valor) {
  if (vacio(valor)) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function decimales(valor, cifras) {
  if (vacio(valor)) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n.toFixed(cifras) : null;
}

/* Coordenada con la mayor precisión que quepa en la longitud del campo. */
function coordenada(valor, maximo) {
  if (vacio(valor)) return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  for (let cifras = 6; cifras >= 0; cifras--) {
    const texto = n.toFixed(cifras);
    if (texto.length <= maximo) return texto;
  }
  return n.toFixed(0);
}

function soloDigitos(valor) {
  if (vacio(valor)) return null;
  const digitos = String(valor).replace(/\D/g, '');
  return digitos === '' ? null : digitos;
}

const FORMATO_POR_TIPO = {
  N: /^\d+(,\d+)*$/,
  D: /^-?\d+(\.\d+)?$/,
  F: /^\d{4}-\d{2}-\d{2}$/,
  A: /^[A-Z0-9,\-]+$/
};

/**
 * Pone un valor en el formato de su variable.
 * @returns { texto, problemas: [] }
 */
function formatear(definicion, bruto, tipoReal) {
  const tipo = tipoReal || definicion.tipo;
  const problemas = [];
  if (vacio(bruto)) return { texto: '', problemas: problemas };

  let texto = Array.isArray(bruto) ? bruto.map(String).join(',') : String(bruto);

  /* Ningún valor, venga de donde venga, puede partir el registro. T y A
     pasan por textoPlano (que quita tildes antes de filtrar); a los demás
     tipos se les quita aquí lo que no sea ASCII imprimible y el separador. */
  if (tipo !== 'T' && tipo !== 'A') texto = texto.replace(/[^\x20-\x7E]|\|/g, ' ');

  if (tipo === 'T') {
    texto = textoPlano(texto);
    if (texto.length > definicion.max) {
      texto = texto.slice(0, definicion.max).trim();
      problemas.push('Texto recortado a ' + definicion.max + ' caracteres');
    }
    return { texto: texto, problemas: problemas };
  }

  if (tipo === 'A') texto = textoPlano(texto).replace(/\s+/g, '');
  if (FORMATO_POR_TIPO[tipo] && !FORMATO_POR_TIPO[tipo].test(texto)) {
    problemas.push('Formato inválido para el tipo ' + tipo);
  }
  if (texto.length > definicion.max) {
    problemas.push('Supera la longitud máxima de ' + definicion.max);
  }
  return { texto: texto, problemas: problemas };
}

/* ---------------------------------------------------------
   2. Del modelo de la ficha a los códigos del anexo
   --------------------------------------------------------- */

/* Resultado de una variable: el valor ya codificado y las respuestas que no
   tienen código en el anexo (opciones retiradas, textos de fichas viejas). */
function R(valor, sinCodigo) {
  return { v: valor, sinCodigo: sinCodigo || [] };
}

function crearCodificadores(m) {
  function catalogo(nombre) {
    const lista = m[nombre];
    if (!Array.isArray(lista)) throw new Error('El motor no expone el catálogo ' + nombre);
    return lista;
  }

  function resolver(cat) {
    return typeof cat === 'string' ? catalogo(cat) : cat;
  }

  function codigoDe(cat, valor) {
    const lista = comoLista(valor);
    if (lista.length === 0) return R(null);
    const codigo = m.codigoSispro(resolver(cat), lista[0]);
    return codigo === null ? R(null, [lista[0]]) : R(codigo);
  }

  function codigosDe(cat, valores) {
    const opciones = resolver(cat);
    const codigos = [];
    const faltan = [];
    comoLista(valores).forEach(function (valor) {
      const codigo = m.codigoSispro(opciones, valor);
      if (codigo === null) faltan.push(valor);
      else if (codigos.indexOf(codigo) === -1) codigos.push(codigo);
    });
    codigos.sort(function (a, b) { return Number(a) - Number(b); });
    return R(codigos, faltan);
  }

  return { catalogo: catalogo, codigoDe: codigoDe, codigosDe: codigosDe };
}

/* Territorio (variable 6): «TXX» con XX de 01 a 98. «T99 está reservado; si
   los territorios superan el T98 se continúa con U01, U02…» y luego con V.
   Los territorios del Distrito van de T01 a T110. */
function territorioSispro(codigo) {
  const m = /^T(\d+)$/.exec(String(codigo || ''));
  if (!m) return codigo || null;
  const n = Number(m[1]);
  if (n <= 98) return 'T' + String(n).padStart(2, '0');
  const serie = Math.floor((n - 99) / 98);
  const resto = ((n - 99) % 98) + 1;
  return String.fromCharCode('U'.charCodeAt(0) + serie) + String(resto).padStart(2, '0');
}

function relleno(numero, cifras) {
  return numero === null || numero === undefined ? null : String(numero).padStart(cifras, '0');
}

/* ---------------------------------------------------------
   3. Variables de los ítems del instrumento
   ---------------------------------------------------------
   Cada una es { valor(ctx) → R, noAplica?, condicional?, tipo? }:
     noAplica     código que el anexo da a «No aplica». El formulario deja
                  vacío un ítem que no aplica (por la edad, por ejemplo) y
                  las reglas impiden cerrar la ficha con uno que sí aplica
                  sin responder: vacío en una ficha guardada es «no aplica».
     condicional  el anexo la marca obligatoria, pero sólo para una parte
                  de la población (edad, sexo): vacía no es incidencia.
     tipo         cuando el código oficial no es del tipo que dice el anexo
                  (EAPB: «N» en el anexo, alfanumérico en SGDCodigoEAPB).
   --------------------------------------------------------- */

function variablesTipo2(m, c) {
  const e = function (ctx) { return ctx.encuesta; };
  const f = function (ctx) { return ctx.familia; };

  return {
    0: { valor: function () { return R('2'); } },
    1: { valor: function (ctx) { return R(ctx.consecutivo); } },
    2: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO', e(ctx).consentimiento); } },
    3: { valor: function (ctx) { return R(e(ctx).departamentoCodigo); } },
    4: { valor: function (ctx) { return R(ctx.parametros.subregion); } },
    5: { valor: function (ctx) { return R(e(ctx).municipioCodigo); } },
    6: { valor: function (ctx) { return R(territorioSispro(e(ctx).territorio)); } },
    7: { valor: function (ctx) { return R(e(ctx).microterritorio); } },
    9: { valor: function (ctx) { return R(e(ctx).divisionTerritorial); } },
    10: { valor: function (ctx) { return c.codigoDe('CAT_AREA_UBICACION', e(ctx).areaUbicacion); } },
    11: { valor: function (ctx) { return R(e(ctx).ubicacionReferencia); } },
    12: { valor: function (ctx) { return R(coordenada(e(ctx).longitud, 10)); } },
    13: { valor: function (ctx) { return R(coordenada(e(ctx).latitud, 10)); } },
    14: { valor: function (ctx) { return R(e(ctx).direccion); } },
    16: { valor: function (ctx) { return c.codigoDe('CAT_ESTRATO', e(ctx).estrato); } },
    17: { valor: function (ctx) { return R(entero(e(ctx).hogaresEnVivienda)); } },
    18: { valor: function (ctx) { return R(entero(e(ctx).personasEnVivienda)); } },
    19: { valor: function (ctx) { return R(entero(e(ctx).habitacionesVivienda)); } },
    20: {
      valor: function (ctx) {
        const guardado = ctx.meta.personasPorHabitacion;
        if (guardado !== null && guardado !== undefined) return R(entero(guardado));
        const personas = entero(e(ctx).personasEnVivienda);
        const habitaciones = entero(e(ctx).habitacionesVivienda);
        return R(personas !== null && habitaciones ? Math.round(personas / habitaciones) : null);
      }
    },
    21: {
      valor: function (ctx) {
        const h = ctx.meta.hacinamiento;
        return R(h === null || h === undefined ? null : (h ? '1' : '2'));
      }
    },
    22: { valor: function (ctx) { return R(entero(e(ctx).elementosParaDormir)); } },
    23: { valor: function (ctx) { return c.codigosDe('CAT_SITUACION_INMINENTE', e(ctx).situacionInminente); } },
    25: { valor: function (ctx) { return R(e(ctx).equipoSaludId); } },
    26: {
      valor: function (ctx) {
        const prestador = c.catalogo('CAT_PRESTADOR').find(function (p) { return p.valor === e(ctx).prestadorPrimario; });
        return R(prestador && prestador.nit ? prestador.nit : ctx.parametros.nitPrestador);
      }
    },
    27: { valor: function (ctx) { return c.codigoDe('CAT_TIPO_ID_RESPONSABLE', e(ctx).responsableTipoId); } },
    28: { valor: function (ctx) { return R(e(ctx).responsableNumeroId); } },
    29: {
      valor: function (ctx) {
        const perfil = e(ctx).perfilProfesional;
        if (perfil === 'otro' && !vacio(e(ctx).perfilProfesionalOtro)) return R(e(ctx).perfilProfesionalOtro);
        const opcion = c.catalogo('CAT_PERFIL_PROFESIONAL').find(function (o) { return o.valor === perfil; });
        return R(opcion ? opcion.etiqueta : perfil);
      }
    },
    30: { valor: function (ctx) { return R(e(ctx).fechaDiligenciamiento); } },
    31: { valor: function (ctx) { return c.codigoDe('CAT_TIPO_VIVIENDA', e(ctx).tipoVivienda); } },
    32: { valor: function (ctx) { return c.codigosDe('CAT_RIESGOS_ACCIDENTE', e(ctx).riesgosAccidente); } },
    33: { valor: function (ctx) { return c.codigosDe('CAT_FACTORES_CONTAMINACION', e(ctx).factoresContaminacion); } },
    40: { valor: function (ctx) { return c.codigoDe('CAT_MATERIAL_TECHO', e(ctx).materialTecho); } },
    50: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO', e(ctx).actividadEconomica); } },
    53: { valor: function (ctx) { return c.codigosDe('CAT_FUENTE_AGUA', e(ctx).fuenteAgua); } },
    58: { valor: function (ctx) { return c.codigosDe('CAT_DISPOSICION_EXCRETAS', e(ctx).disposicionExcretas); } },
    59: { valor: function (ctx) { return c.codigosDe('CAT_AGUAS_RESIDUALES', e(ctx).aguasResiduales); } },
    62: { valor: function (ctx) { return c.codigosDe('CAT_RESIDUOS_SOLIDOS', e(ctx).residuosSolidos); } },
    84: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO_NA', e(ctx).vectores); }, noAplica: '3' },
    92: { valor: function (ctx) { return c.codigosDe('CAT_ANIMALES', e(ctx).animales); } },
    93: { valor: function (ctx) { return R(entero(e(ctx).perros)); } },
    94: { valor: function (ctx) { return R(entero(e(ctx).perrosVacunados)); } },
    95: { valor: function (ctx) { return R(entero(e(ctx).gatos)); } },
    96: { valor: function (ctx) { return R(entero(e(ctx).gatosVacunados)); } },
    /* Variable 103: única, con dos opciones que son las dos primeras de la 87
       (medidas de control de vectores). Se deriva de ella en vez de volver a
       preguntar; si la familia no marcó ninguna de las dos, queda vacía. */
    103: {
      valor: function (ctx) {
        const medidas = comoLista(ctx.lector.lista('medidasControlVectores'));
        if (medidas.indexOf('residuos_higienicos') !== -1) return R('1');
        if (medidas.indexOf('evita_luz_blanca') !== -1) return R('2');
        return R(null);
      },
      condicional: true
    },
    /* Variable 110: «debe coincidir con la cantidad de registros tipo 3». */
    110: { valor: function (ctx) { return R((f(ctx).integrantes || []).length); } },
    112: { valor: function (ctx) { return c.codigoDe('CAT_TIPO_FAMILIA', f(ctx).tipoFamilia); } },
    114: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO', f(ctx).cuidadorPrincipal); } },
    116: { valor: function (ctx) { return c.codigosDe('CAT_SITUACIONES_RIESGO_FAMILIAR', f(ctx).situacionesRiesgo); } },
    117: { valor: function (ctx) { return c.codigosDe('CAT_PRACTICAS_VINCULO', f(ctx).practicasVinculo); } },
    118: { valor: function (ctx) { return c.codigoDe('CAT_REDES_APOYO', f(ctx).redesApoyo); } },
    119: { valor: function (ctx) { return c.codigosDe('CAT_PRACTICAS_CUIDADO_HOGAR', f(ctx).practicasCuidadoHogar); } },
    123: { valor: function (ctx) { return R(ctx.idVivienda); } },
    124: { valor: function (ctx) { return R(ctx.idFamilia); } }
  };
}

function variablesTipo3(m, c) {
  const i = function (ctx) { return ctx.integrante; };
  const edad = function (ctx) { return ctx.contexto.edadMeses; };

  return {
    0: { valor: function () { return R('3'); } },
    1: { valor: function (ctx) { return R(ctx.consecutivo); } },
    2: { valor: function (ctx) { return R(i(ctx).primerNombre); } },
    3: { valor: function (ctx) { return R(i(ctx).segundoNombre); } },
    4: { valor: function (ctx) { return R(i(ctx).primerApellido); } },
    5: { valor: function (ctx) { return R(i(ctx).segundoApellido); } },
    6: { valor: function (ctx) { return c.codigoDe('CAT_TIPO_ID_INTEGRANTE', i(ctx).tipoId); } },
    7: { valor: function (ctx) { return R(i(ctx).numeroId); } },
    8: { valor: function (ctx) { return R(i(ctx).fechaNacimiento); } },
    9: { valor: function (ctx) { return c.codigoDe('CAT_PAIS', i(ctx).nacionalidad); } },
    11: { valor: function (ctx) { return c.codigoDe('CAT_SEXO', i(ctx).sexo); } },
    12: { valor: function (ctx) { return c.codigoDe('CAT_GENERO', i(ctx).genero); } },
    13: { valor: function (ctx) { return c.codigoDe('CAT_AUTOIDENTIFICACION_GENERO', i(ctx).autoidentificacionGenero); } },
    14: { valor: function (ctx) { return c.codigoDe('CAT_ORIENTACION_SEXUAL', i(ctx).orientacionSexual); } },
    15: { valor: function (ctx) { return R(soloDigitos(i(ctx).telefono1)); } },
    16: { valor: function (ctx) { return R(soloDigitos(i(ctx).telefono2)); } },
    17: { valor: function (ctx) { return c.codigoDe('CAT_ROL_FAMILIAR', i(ctx).rolFamiliar); } },
    /* Variable 18: código CIUO. Sin ocupación registrada en un menor de 15
       años va 9998 («sin ocupación»), el mismo código que ofrece el ítem 73. */
    18: {
      valor: function (ctx) {
        if (vacio(i(ctx).ocupacion) && edad(ctx) !== null && edad(ctx) < 180) return R(m.OCUPACION_SIN_OCUPACION);
        return c.codigoDe('CAT_OCUPACION_CIUO', i(ctx).ocupacion);
      }
    },
    19: { valor: function (ctx) { return c.codigoDe('CAT_NIVEL_EDUCATIVO', i(ctx).nivelEducativo); } },
    20: { valor: function (ctx) { return c.codigoDe('CAT_REGIMEN_AFILIACION', i(ctx).regimenAfiliacion); } },
    21: { valor: function (ctx) { return c.codigoDe('CAT_EAPB', i(ctx).eapb); }, tipo: 'A' },
    22: { valor: function (ctx) { return c.codigosDe('CAT_SUJETO_ESPECIAL_PROTECCION', i(ctx).sujetoEspecialProteccion); } },
    23: { valor: function (ctx) { return c.codigosDe('CAT_MODALIDAD_VIOLENCIA', i(ctx).modalidadViolencia); } },
    24: { valor: function (ctx) { return c.codigoDe('CAT_PERTENENCIA_ETNICA', i(ctx).pertenenciaEtnica); } },
    25: { valor: function (ctx) { return R(i(ctx).puebloEtnico); } },
    26: { valor: function (ctx) { return c.codigosDe('CAT_SABERES_ANCESTRALES', i(ctx).saberesAncestrales); } },
    27: { valor: function (ctx) { return c.codigosDe('CAT_CONOCIMIENTO_DERECHO', i(ctx).conocimientoDerecho); } },
    28: { valor: function (ctx) { return c.codigosDe('CAT_PRACTICAS_CUIDADO', i(ctx).practicasCuidado); } },
    29: { valor: function (ctx) { return c.codigosDe('CAT_ATENCIONES_RPMS', i(ctx).atencionesPendientesRpms); } },
    30: { valor: function (ctx) { return c.codigosDe('CAT_DISCAPACIDAD', i(ctx).discapacidad); } },
    31: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO_NA', i(ctx).certificacionRlcpd); }, noAplica: '3' },
    32: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO', i(ctx).intencionReproductiva); }, condicional: true },
    33: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO', i(ctx).gestacionActual); }, condicional: true },
    34: { valor: function (ctx) { return c.codigosDe('CAT_ATENCIONES_MATERNO', i(ctx).atencionesPendientesMaterno); }, noAplica: '9' },
    /* Variable 35: sin atenciones pendientes el formulario no pregunta el
       motivo; se reporta «Ninguna» (15), la opción de exclusión de la lista. */
    35: { valor: function (ctx) { return c.codigosDe('CAT_BARRERAS_ACCESO', i(ctx).barrerasAcceso); }, noAplica: '15' },
    36: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO_NA', i(ctx).lactanciaExclusiva); }, noAplica: '3' },
    37: { valor: function (ctx) { return R(decimales(i(ctx).peso, 1)); } },
    38: { valor: function (ctx) { return R(decimales(i(ctx).talla, 1)); } },
    39: {
      valor: function (ctx) { return R(edad(ctx) !== null && edad(ctx) >= 60 ? decimales(i(ctx).imc, 1) : null); },
      condicional: true
    },
    40: {
      valor: function (ctx) { return R(edad(ctx) !== null && edad(ctx) >= 216 ? entero(i(ctx).circunferenciaCintura) : null); },
      condicional: true
    },
    41: { valor: function (ctx) { return c.codigosDe('CAT_SIGNOS_DESNUTRICION', i(ctx).signosDesnutricion); }, noAplica: '9' },
    42: { valor: function (ctx) { return c.codigoDe('CAT_CLASIFICACION_ANTROPOMETRICA', i(ctx).clasificacionAntropometrica); } },
    44: {
      valor: function (ctx) { return R(edad(ctx) !== null && edad(ctx) >= 216 ? entero(i(ctx).tensionSistolica) : null); },
      condicional: true
    },
    45: {
      valor: function (ctx) { return R(edad(ctx) !== null && edad(ctx) >= 216 ? entero(i(ctx).tensionDiastolica) : null); },
      condicional: true
    },
    46: { valor: function (ctx) { return c.codigoDe('CAT_CLASIFICACION_TENSION', i(ctx).clasificacionTension); }, noAplica: '6' },
    52: { valor: function (ctx) { return c.codigosDe('CAT_SINTOMATOLOGIA_DEPRESIVA', i(ctx).sintomatologiaDepresiva); }, noAplica: '5' },
    53: { valor: function (ctx) { return c.codigoDe('CAT_IDEACION_SUICIDA', i(ctx).ideacionSuicida); }, noAplica: '3' },
    54: { valor: function (ctx) { return c.codigosDe('CAT_RIESGOS_SALUD_MENTAL_JOVEN', i(ctx).riesgosSaludMentalJoven); } },
    55: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO', i(ctx).limitacionCotidiana); } },
    58: { valor: function (ctx) { return c.codigosDe('CAT_CONDICIONES_TRANSMISIBLES', i(ctx).condicionesTransmisibles); } },
    59: { valor: function (ctx) { return c.codigosDe('CAT_ENFERMEDADES_NO_TRANSMISIBLES', i(ctx).enfermedadesNoTransmisibles); } },
    60: { valor: function (ctx) { return c.codigoDe('CAT_ZONA_ENDEMICA', i(ctx).zonaEndemica); } },
    61: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO_NA', i(ctx).adherenciaTratamiento); }, noAplica: '3' },
    62: { valor: function (ctx) { return c.codigosDe('CAT_MOTIVO_NO_TRATAMIENTO', i(ctx).motivoNoTratamiento); }, noAplica: '15' },
    63: { valor: function (ctx) { return c.codigoDe('CAT_SI_NO_NA', i(ctx).consumoSpa); }, noAplica: '3' },
    67: { valor: function (ctx) { return R(entero(i(ctx).puntajeAssist)); } },
    68: { valor: function (ctx) { return R(entero(i(ctx).puntajeAudit)); } },
    69: { valor: function (ctx) { return R(entero(i(ctx).puntajeCrafft)); } },
    /* Variables 71 y 72: no se preguntan; salen del sexo, la edad y el ítem 85. */
    71: { valor: function (ctx) { return R(m.enEdadFertil(ctx.lector) ? '1' : '2'); } },
    72: { valor: function (ctx) { return R(i(ctx).gestacionActual === 'si' ? '1' : '2'); } },
    117: { valor: function (ctx) { return R(ctx.idFamilia); } },
    118: {
      valor: function (ctx) {
        const tipo = m.codigoSispro(c.catalogo('CAT_TIPO_ID_INTEGRANTE'), i(ctx).tipoId);
        if (vacio(ctx.idFamilia) || vacio(tipo) || vacio(i(ctx).numeroId)) return R(null);
        return R(ctx.idFamilia + tipo + String(i(ctx).numeroId));
      }
    }
  };
}

/* ---------------------------------------------------------
   4. Variables de las preguntas del anexo (anexo.js)
   --------------------------------------------------------- */

function variableDesdeAnexo(m, c, pregunta) {
  return {
    valor: function (ctx) {
      const r = ctx.lector;
      const visible = m.esVisibleAnexo(pregunta, r);
      let valor;
      if (visible) valor = pregunta.tipo === 'multiple' ? r.lista(pregunta.clave) : r.v(pregunta.clave);
      else valor = typeof pregunta.siOculta === 'function' ? pregunta.siOculta(r) : null;

      const catalogo = pregunta.catalogo ? m.catalogoDePregunta(pregunta) : null;
      let resultado;
      if (catalogo) resultado = pregunta.tipo === 'multiple' ? c.codigosDe(catalogo, valor) : c.codigoDe(catalogo, valor);
      else if (pregunta.tipo === 'entero') resultado = R(entero(valor));
      else if (pregunta.formato === 'telefono') resultado = R(soloDigitos(valor));
      else resultado = R(valor);

      /* Obligatoria sólo si aplica y el anexo la exige; las «advertencia»
         (listas sin opción de exclusión) pueden ir vacías. */
      resultado.requerido = visible && pregunta.requerido === 'bloqueo';
      return resultado;
    }
  };
}

function definicionesDe(m, c, registro, manuales, total) {
  const definiciones = {};
  m.PREGUNTAS_ANEXO.forEach(function (pregunta) {
    if (pregunta.registro === registro) definiciones[pregunta.variable] = variableDesdeAnexo(m, c, pregunta);
  });
  Object.keys(manuales).forEach(function (n) { definiciones[n] = manuales[n]; });

  for (let n = 0; n < total; n++) {
    if (!definiciones[n]) throw new Error('Registro tipo ' + registro + ': la variable ' + n + ' no tiene definición');
  }
  return definiciones;
}

let definicionesCache = null;

function obtenerDefiniciones() {
  if (definicionesCache) return definicionesCache;
  const m = obtenerMotor();
  const c = crearCodificadores(m);

  const tipo2 = definicionesDe(m, c, 2, variablesTipo2(m, c), DICCIONARIO.TIPO_2.length);
  /* Variable 24: sin situación que atender, el anexo la pide igual (es
     obligatoria); se reporta «NO APLICA» en vez de dejarla vacía. */
  const observaciones = tipo2[24];
  tipo2[24] = {
    valor: function (ctx) {
      const resultado = observaciones.valor(ctx);
      if (vacio(resultado.v) && !resultado.requerido) return Object.assign(R('NO APLICA'), { requerido: false });
      return resultado;
    }
  };

  definicionesCache = {
    motor: m,
    tipo2: tipo2,
    tipo3: definicionesDe(m, c, 3, variablesTipo3(m, c), DICCIONARIO.TIPO_3.length)
  };
  return definicionesCache;
}

/* ---------------------------------------------------------
   5. Armado del archivo
   --------------------------------------------------------- */

function crearIncidencias() {
  const porClave = new Map();
  return {
    agregar: function (tipo, definicion, problema, codigoFicha) {
      const clave = tipo + '|' + definicion.n + '|' + problema;
      if (!porClave.has(clave)) {
        porClave.set(clave, {
          tipoRegistro: tipo, variable: definicion.n, nombre: definicion.nombre,
          problema: problema, cantidad: 0, fichas: []
        });
      }
      const entrada = porClave.get(clave);
      entrada.cantidad++;
      if (codigoFicha && entrada.fichas.length < MAX_EJEMPLOS_POR_INCIDENCIA && entrada.fichas.indexOf(codigoFicha) === -1) {
        entrada.fichas.push(codigoFicha);
      }
    },
    lista: function () {
      return Array.from(porClave.values()).sort(function (a, b) {
        return a.tipoRegistro - b.tipoRegistro || a.variable - b.variable || b.cantidad - a.cantidad;
      });
    }
  };
}

/* El resumen no lleva datos personales: una respuesta sin código se nombra
   sólo si tiene forma de código de catálogo ('NV', 'OT', 'tecnica_laboral');
   un texto libre de una ficha vieja (la ocupación escrita) no se repite. */
function respuestaParaResumen(valor) {
  const texto = String(valor);
  return /^[A-Za-z0-9_-]{1,30}$/.test(texto) ? '«' + texto + '»' : 'escrita como texto libre';
}

function armarRegistro(tipo, diccionario, definiciones, ctx, incidencias) {
  const codigoFicha = ctx.encuesta.codigoFicha;
  return diccionario.map(function (definicion) {
    const entrada = definiciones[definicion.n];
    const resultado = entrada.valor(ctx);

    resultado.sinCodigo.forEach(function (valor) {
      incidencias.agregar(tipo, definicion, 'La respuesta ' + respuestaParaResumen(valor) + ' no tiene código en el anexo', codigoFicha);
    });

    let valor = resultado.v;
    if (vacio(valor) && entrada.noAplica && resultado.sinCodigo.length === 0) valor = entrada.noAplica;

    const requerido = resultado.requerido !== undefined
      ? resultado.requerido
      : definicion.requerido && !entrada.condicional;
    if (vacio(valor) && requerido && resultado.sinCodigo.length === 0) {
      incidencias.agregar(tipo, definicion, 'Obligatoria y vacía', codigoFicha);
    }

    const formateado = formatear(definicion, valor, entrada.tipo);
    formateado.problemas.forEach(function (problema) {
      incidencias.agregar(tipo, definicion, problema, codigoFicha);
    });
    return formateado.texto;
  }).join(SEPARADOR);
}

function registroDeControl(entidad, desde, hasta, totalDetalle) {
  return ['1', entidad.tipo, entidad.numero, desde, hasta, String(totalDetalle)].join(SEPARADOR);
}

function nombreDeArchivo(entidad, hasta) {
  return PREFIJO_ARCHIVO + String(hasta).replace(/-/g, '') + entidad.tipo +
    String(entidad.numero).padStart(12, '0') + '.TXT';
}

/**
 * Arma el archivo plano.
 * @param opciones.fichas      [{ encuesta, meta }] de leerFichasCompletas
 * @param opciones.desde       AAAA-MM-DD, inicio del período
 * @param opciones.hasta       AAAA-MM-DD, fecha de corte
 * @param opciones.entidad     { tipo: 'NI', numero: NIT sin dígito de verificación }
 * @param opciones.subregion   código de 3 dígitos de la subregión (variable 4) o null
 * @param opciones.nitPrestador NIT a usar si el prestador de la ficha no trae el suyo
 * @returns { nombreArchivo, contenido, resumen }
 */
function construirReporte(opciones) {
  const def = obtenerDefiniciones();
  const m = def.motor;
  const incidencias = crearIncidencias();
  const parametros = {
    subregion: opciones.subregion || null,
    nitPrestador: opciones.nitPrestador || null
  };

  const tipo2 = [];
  const tipo3 = [];
  const integrantesVistos = new Map();

  (opciones.fichas || []).forEach(function (leida) {
    const encuesta = leida.encuesta;
    const meta = leida.meta || {};
    const fechaFicha = encuesta.fechaDiligenciamiento;

    const consecutivoVivienda = relleno(meta.consecutivoVivienda, 4);
    const partesVivienda = [encuesta.departamentoCodigo, parametros.subregion, encuesta.municipioCodigo,
      territorioSispro(encuesta.territorio), encuesta.microterritorio];
    const idVivienda = consecutivoVivienda === null || partesVivienda.some(vacio)
      ? null
      : partesVivienda.join('') + 'H' + consecutivoVivienda;

    (encuesta.familias || []).forEach(function (familia, indice) {
      const metaFamilia = (meta.familias || [])[indice] || {};
      const consecutivoFamilia = relleno(metaFamilia.consecutivo, 4);
      const idFamilia = idVivienda === null || consecutivoFamilia === null ? null : idVivienda + 'F' + consecutivoFamilia;

      tipo2.push(armarRegistro(2, DICCIONARIO.TIPO_2, def.tipo2, {
        encuesta: encuesta, familia: familia, meta: meta, parametros: parametros,
        consecutivo: tipo2.length + 1, idVivienda: idVivienda, idFamilia: idFamilia,
        lector: m.lectorDeRespuestas([familia, encuesta], { fechaFicha: fechaFicha })
      }, incidencias));

      (familia.integrantes || []).forEach(function (integrante) {
        const contexto = m.contextoIntegrante(integrante, encuesta);
        const ctx = {
          encuesta: encuesta, familia: familia, integrante: integrante, contexto: contexto,
          parametros: parametros, consecutivo: tipo3.length + 1, idFamilia: idFamilia,
          lector: m.lectorDeRespuestas([integrante, familia, encuesta], {
            edadMeses: contexto.edadMeses, sexo: contexto.sexo, gestante: contexto.gestante, fechaFicha: fechaFicha
          })
        };
        tipo3.push(armarRegistro(3, DICCIONARIO.TIPO_3, def.tipo3, ctx, incidencias));

        /* Variable 118: identificador único del integrante. */
        const llave = String(integrante.tipoId) + '|' + String(integrante.numeroId);
        if (integrantesVistos.has(llave)) {
          incidencias.agregar(3, DICCIONARIO.TIPO_3[118], 'Integrante repetido en el período', encuesta.codigoFicha);
        }
        integrantesVistos.set(llave, true);
      });
    });
  });

  const entidad = opciones.entidad;
  const lineas = [registroDeControl(entidad, opciones.desde, opciones.hasta, tipo2.length + tipo3.length)]
    .concat(tipo2, tipo3);

  const listaIncidencias = incidencias.lista();
  return {
    nombreArchivo: nombreDeArchivo(entidad, opciones.hasta),
    contenido: lineas.join(FIN_DE_REGISTRO) + FIN_DE_REGISTRO,
    resumen: {
      registros: { tipo2: tipo2.length, tipo3: tipo3.length, total: tipo2.length + tipo3.length },
      incidencias: {
        total: listaIncidencias.reduce(function (s, x) { return s + x.cantidad; }, 0),
        detalle: listaIncidencias
      }
    }
  };
}

module.exports = {
  construirReporte,
  nombreDeArchivo,
  territorioSispro,
  textoPlano,
  formatear,
  coordenada,
  obtenerDefiniciones
};
