/* =========================================================
   Encuesta_APS — Motor de reglas de negocio
   ---------------------------------------------------------
   Implementa las 162 reglas de REGLAS_DE_NEGOCIO.md v2.0.

   ESTRUCTURA
     1. Constantes y predicados de apoyo
     2. Helpers de dominio (edad, IMC, hacinamiento, gestación)
     3. Reglas de captura por ámbito (RN-000 a RN-140)
     4. Motor de validación
     5. Reglas de decisión clínica (RN-200 a RN-212)
     6. Reglas de cierre e integridad (RN-220 a RN-226)

   ÁMBITOS Y REPETICIÓN (RN-000)
     El instrumento es jerárquico, no plano. Las reglas se agrupan
     por ámbito y el motor las recorre según corresponda:

       ficha        1 por visita        valida(d)
       vivienda     1 por ficha         valida(d)
       saneamiento  1 por ficha         valida(d)
       familia      N por vivienda      valida(f, d)
       integrante   N por familia       valida(i, c, f, d)   c = contexto (edad, sexo…)
       plan         1 por nivel         valida(d)

   ACTIVACIÓN POR SECCIÓN
     El formulario actual sólo captura los ítems 1 a 38. Para que
     las reglas de los ítems 39 a 140 no bloqueen la captura antes
     de que la interfaz los incorpore, el motor evalúa únicamente
     las secciones presentes en los datos (ver `seccionesPresentes`).
     A medida que la UI crezca, las reglas entran en vigor solas.

   MODELO DE DATOS ESPERADO
     datos = {
       // ítems 1-20
       consentimiento, situacionInminente, departamentoCodigo, uzpe,
       municipioCodigo, areaUbicacion, territorio, microterritorio,
       divisionTerritorial, equipoSaludId, prestadorPrimario,
       responsableTipoId, responsableNumeroId, perfilProfesional,
       codigoFicha, fechaDiligenciamiento, entornoAbordaje,
       nombreInstitucion, cabezaFamilia, jovenesEnPaz,

       // ítems 21-38
       direccionNormalizada, latitud, longitud, ubicacionReferencia,
       idHogar, idFamilia, estrato, hogaresEnVivienda,
       personasEnVivienda, habitacionesVivienda, elementosParaDormir,
       tipoVivienda, materialTecho, riesgosAccidente[], vectores,
       factoresContaminacion[],

       // ítems 39-49
       actividadEconomica, animales[], perros, perrosVacunados,
       gatos, gatosVacunados, carnetAntirrabico, fuenteAgua,
       disposicionExcretas, aguasResiduales, residuosSolidos,

       // ítems 50-110 (repetibles)
       familias: [{ ...ítems 50-57, integrantes: [{ ...ítems 58-110 }] }],

       // ítems 111-140
       planVivienda, planFamilia (por familia), planPersona (por integrante)
     }
   ========================================================= */

'use strict';

/* =========================================================
   1. CONSTANTES Y PREDICADOS DE APOYO
   ========================================================= */

/* RN-033 — Umbrales DANE de hacinamiento (personas por habitación). */
const UMBRAL_HACINAMIENTO = 2;
const UMBRAL_HACINAMIENTO_CRITICO = 3;

/* RN-016 — Antigüedad máxima admitida de la fecha de diligenciamiento. */
const DIAS_MAXIMOS_FICHA = 30;

/* RN-114 / RN-124 / RN-136a — Forma de un código de procedimiento. Los 10.044
   códigos de `cat.cups` miden entre 6 y 9 caracteres alfanuméricos, con guion
   sólo en los NoCUPS. Que EXISTA lo comprueba el servidor contra la tabla:
   enumerar los diez mil en el navegador no es viable. */
const FORMATO_CODIGO_ACCION = /^[A-Za-z0-9-]{6,9}$/;

/* RN-200 — Niveles de prioridad de las alertas clínicas. */
const PRIORIDAD = {
  INMEDIATA: 'inmediata',
  PRIORITARIA: 'prioritaria',
  REGULAR: 'regular'
};

const ORDEN_PRIORIDAD = { regular: 1, prioritaria: 2, inmediata: 3 };

/* Plazo máximo de respuesta por nivel, en días (RN-200, RN-226). */
const PLAZO_DIAS_PRIORIDAD = { inmediata: 2, prioritaria: 3, regular: 30 };

/* Severidad de un incumplimiento: impide continuar o sólo advierte. */
const SEVERIDAD = { BLOQUEO: 'bloqueo', ADVERTENCIA: 'advertencia' };

/* Ámbitos de evaluación. */
const AMBITO = {
  FICHA: 'ficha',
  VIVIENDA: 'vivienda',
  SANEAMIENTO: 'saneamiento',
  FAMILIA: 'familia',
  INTEGRANTE: 'integrante',
  PLAN: 'plan'
};

function esVacio(valor) {
  return valor === null || valor === undefined || String(valor).trim() === '';
}

function listaVacia(valor) {
  return !Array.isArray(valor) || valor.length === 0;
}

function perteneceA(catalogo, valor) {
  return catalogo.some(function (opcion) { return opcion.valor === valor; });
}

function todosPertenecenA(catalogo, valores) {
  if (!Array.isArray(valores)) return false;
  return valores.every(function (valor) { return perteneceA(catalogo, valor); });
}

function opcionDe(catalogo, valor) {
  return catalogo.find(function (opcion) { return opcion.valor === valor; }) || null;
}

function contiene(lista, valor) {
  return Array.isArray(lista) && lista.indexOf(valor) !== -1;
}

/* Una selección múltiple con opción de exclusión es válida si trae la
   opción excluyente sola, o si trae una o más opciones sin ella. */
function seleccionMultipleValida(valores, valorExcluyente) {
  if (listaVacia(valores)) return false;
  if (contiene(valores, valorExcluyente)) return valores.length === 1;
  return true;
}

/* Devuelve true si la selección registra algo distinto de la exclusión. */
function tieneHallazgo(valores, valorExcluyente) {
  if (listaVacia(valores)) return false;
  return valores.some(function (valor) { return valor !== valorExcluyente; });
}

function esEntero(valor) {
  return typeof valor === 'number' && Number.isInteger(valor);
}

function esEnteroPositivo(valor) {
  return esEntero(valor) && valor > 0;
}

function esEnteroNoNegativo(valor) {
  return esEntero(valor) && valor >= 0;
}

function esNumeroPositivo(valor) {
  return typeof valor === 'number' && isFinite(valor) && valor > 0;
}

/* RN-058 a RN-061 — Nombres y apellidos: sólo letras, espacios y apóstrofos. */
function soloAlfabetico(valor) {
  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]+$/.test(String(valor).trim());
}

/* RN-013 / RN-063 — Formato de documento según el tipo seleccionado. */
function documentoValidoParaFormato(formato, numero) {
  if (esVacio(numero)) return false;
  const limpio = String(numero).trim();
  if (formato === 'temporal') return true; // MS y AS reciben identificador del sistema
  const patron = FORMATOS_DOCUMENTO[formato];
  return patron ? patron.test(limpio) : /^[A-Za-z0-9-]{5,16}$/.test(limpio);
}

/* RN-012 / RN-013 — El responsable sólo usa CC, CD, CE o PT. */
function documentoValidoParaTipo(tipo, numero) {
  return documentoValidoParaFormato(tipo === 'CC' ? 'numerico_6_10' : 'alfanumerico_5_16', numero);
}

/* RN-070 / RN-071 — Teléfono fijo (7) o móvil (10), sin secuencias falsas. */
function telefonoValido(valor) {
  if (esVacio(valor)) return false;
  const limpio = String(valor).replace(/\D/g, '');
  if (limpio.length !== 7 && limpio.length !== 10) return false;
  if (/^(\d)\1+$/.test(limpio)) return false;               // 3333333333
  if ('01234567890123456789'.indexOf(limpio) !== -1) return false; // consecutivos
  return true;
}

function parsearFecha(valor) {
  if (esVacio(valor)) return null;
  const texto = String(valor).trim().replace(/\//g, '-');
  const partes = texto.split('-');
  if (partes.length !== 3) return null;

  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  if (!isFinite(anio) || !isFinite(mes) || !isFinite(dia)) return null;

  const fecha = new Date(anio, mes - 1, dia);
  // Rechaza fechas imposibles como 2025-02-31, que Date normalizaría.
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null;
  }
  return fecha;
}

function esFechaValida(valor) {
  return parsearFecha(valor) !== null;
}

function hoySinHora() {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

function fechaNoFutura(valor) {
  const fecha = parsearFecha(valor);
  return fecha !== null && fecha.getTime() <= hoySinHora().getTime();
}

/**
 * Ninguna fecha capturada puede ser posterior al día en que se diligencia la
 * ficha. Contrastarla contra hoy no basta: RN-016 admite hasta 30 días de
 * antigüedad, así que una fecha situada entre la visita y hoy pasaba la
 * comprobación y dejaba, por ejemplo, a una persona naciendo después de haber
 * sido caracterizada.
 *
 * Si el ítem 16 está sin responder —o trae una fecha futura, que RN-016 ya
 * rechaza por su cuenta— la referencia vuelve a ser hoy.
 */
function fechaNoPosteriorA(valor, referencia) {
  const fecha = parsearFecha(valor);
  if (fecha === null) return false;

  const hoy = hoySinHora();
  const tope = parsearFecha(referencia);
  const limite = tope !== null && tope.getTime() <= hoy.getTime() ? tope : hoy;

  return fecha.getTime() <= limite.getTime();
}

function diferenciaEnDias(desde, hasta) {
  const a = parsearFecha(desde);
  const b = parsearFecha(hasta);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/* RN-064 — Edad en años, meses y días. La precisión en meses es
   obligatoria: de ella dependen RN-091 (<6 meses) y RN-097 (3-60 meses). */
function calcularEdad(fechaNacimiento, fechaReferencia) {
  const nacimiento = parsearFecha(fechaNacimiento);
  if (!nacimiento) return null;

  const referencia = parsearFecha(fechaReferencia) || hoySinHora();
  if (nacimiento.getTime() > referencia.getTime()) return null;

  let anios = referencia.getFullYear() - nacimiento.getFullYear();
  let meses = referencia.getMonth() - nacimiento.getMonth();
  let dias = referencia.getDate() - nacimiento.getDate();

  if (dias < 0) {
    meses -= 1;
    // Días del mes anterior a la fecha de referencia.
    dias += new Date(referencia.getFullYear(), referencia.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return { anios: anios, meses: meses, dias: dias, totalMeses: anios * 12 + meses };
}

/* =========================================================
   2. HELPERS DE DOMINIO
   ========================================================= */

/* RN-095 — Índice de masa corporal. */
function calcularImc(pesoKg, tallaCm) {
  if (!esNumeroPositivo(pesoKg) || !esNumeroPositivo(tallaCm)) return null;
  const tallaMetros = tallaCm / 100;
  return Math.round((pesoKg / (tallaMetros * tallaMetros)) * 100) / 100;
}

/* RN-032 y RN-033 — Personas por habitación y clasificación de hacinamiento.
   `calcularHacinamiento` de app.js resuelve la vista; esta función es la
   fuente de verdad de las reglas y añade el nivel crítico. */
function evaluarHacinamiento(personasEnVivienda, habitacionesVivienda) {
  if (!esEnteroPositivo(personasEnVivienda) || !esEnteroPositivo(habitacionesVivienda)) {
    return { personasPorHabitacion: null, hacinamiento: null, critico: false, prioridad: null };
  }

  const ratio = personasEnVivienda / habitacionesVivienda;
  const personasPorHabitacion = Math.round(ratio * 100) / 100;

  if (ratio <= UMBRAL_HACINAMIENTO) {
    return { personasPorHabitacion: personasPorHabitacion, hacinamiento: 'no', critico: false, prioridad: null };
  }

  const critico = ratio > UMBRAL_HACINAMIENTO_CRITICO;
  return {
    personasPorHabitacion: personasPorHabitacion,
    hacinamiento: 'si',
    critico: critico,
    prioridad: critico ? PRIORIDAD.PRIORITARIA : PRIORIDAD.REGULAR
  };
}

/* RN-085 / RN-205 — Gestación confirmada por el ítem 85 o declarada en el 77. */
function esGestante(integrante) {
  if (!integrante) return false;
  return integrante.gestacionActual === 'si' ||
         contiene(integrante.sujetoEspecialProteccion, SUJETO_GESTANTE);
}

/* Contexto derivado que consumen las reglas del integrante. */
function contextoIntegrante(integrante, datos) {
  const edad = calcularEdad(integrante.fechaNacimiento, datos.fechaDiligenciamiento);
  return {
    edad: edad,
    edadMeses: edad ? edad.totalMeses : null,
    edadAnios: edad ? edad.anios : null,
    sexo: integrante.sexo || null,
    gestante: esGestante(integrante),
    tipoId: opcionDe(CAT_TIPO_ID_INTEGRANTE, integrante.tipoId)
  };
}

function edadEntre(contexto, mesesMin, mesesMax) {
  if (contexto.edadMeses === null) return false;
  if (contexto.edadMeses < mesesMin) return false;
  return mesesMax === null || contexto.edadMeses <= mesesMax;
}

function esMayorDe(contexto, anios) {
  return contexto.edadMeses !== null && contexto.edadMeses >= anios * 12;
}

function nombreIntegrante(integrante, indice) {
  const nombre = [integrante.primerNombre, integrante.primerApellido]
    .filter(function (parte) { return !esVacio(parte); })
    .join(' ');
  return esVacio(nombre) ? 'Integrante ' + (indice + 1) : nombre;
}

/* RN-103 — ¿Tiene alguna condición de salud activa registrada? */
function tieneCondicionActiva(integrante) {
  return tieneHallazgo(integrante.enfermedadesNoTransmisibles, VALOR_NINGUNA) ||
         tieneHallazgo(integrante.condicionesTransmisibles, VALOR_NINGUNA) ||
         tieneHallazgo(integrante.zonaEndemica, VALOR_NINGUNA);
}

/* RN-089 — ¿Quedaron atenciones pendientes en los ítems 87 u 88? */
function tieneAtencionesPendientes(integrante) {
  return tieneHallazgo(integrante.atencionesPendientesRpms, VALOR_NINGUNA) ||
         tieneHallazgo(integrante.atencionesPendientesMaterno, VALOR_NINGUNA);
}

/* RN-078 / RN-206 — ¿Se registró alguna condición de violencia? */
function tieneViolencia(integrante) {
  if (listaVacia(integrante.sujetoEspecialProteccion)) return false;
  return integrante.sujetoEspecialProteccion.some(function (valor) {
    const opcion = opcionDe(CAT_SUJETO_ESPECIAL_PROTECCION, valor);
    return !!(opcion && opcion.violencia);
  });
}

/* =========================================================
   3. REGLAS DE CAPTURA
   Cada regla declara:
     codigo     identificador (RN-XXX)
     campo      nombre del campo al que se ancla el mensaje
     aplica     (opcional) condición para evaluarla
     valida     true si el dato cumple
     mensaje    texto mostrado al usuario (cadena o función)
     severidad  (opcional) 'advertencia' para no bloquear
   ========================================================= */

/* ---------------------------------------------------------
   3.1 BLOQUE 1 — Autorización y seguridad inicial (ítems 1-2)
   --------------------------------------------------------- */

const REGLAS_BLOQUE_1 = [
  {
    codigo: 'RN-001',
    campo: 'consentimiento',
    valida: function (d) { return d.consentimiento === 'si' || d.consentimiento === 'no'; },
    mensaje: 'Debe registrar el consentimiento informado antes de capturar datos (Ley 1581 de 2012).'
  },
  {
    codigo: 'RN-002',
    campo: 'situacionInminente',
    valida: function (d) { return perteneceA(CAT_SITUACION_INMINENTE, d.situacionInminente); },
    mensaje: 'Clasifique el estado de riesgo inmediato del entorno o de los individuos.'
  }
];

/* ---------------------------------------------------------
   3.2 BLOQUE 2 — Identificación geográfica y equipo (ítems 3-20)
   --------------------------------------------------------- */

const REGLAS_BLOQUE_2 = [
  {
    codigo: 'RN-003',
    campo: 'departamento',
    valida: function (d) { return d.departamentoCodigo === CAT_DEPARTAMENTO.codigo; },
    mensaje: 'El departamento debe ser Valle del Cauca (código 76).'
  },
  {
    codigo: 'RN-004',
    campo: 'uzpe',
    aplica: function (d) { return d.uzpe !== undefined; },
    valida: function (d) { return perteneceA(CAT_UZPE, d.uzpe); },
    mensaje: 'Seleccione la Unidad Zonal de Planeación y Evaluación (UZPE).'
  },
  {
    codigo: 'RN-005',
    campo: 'municipio',
    valida: function (d) { return d.municipioCodigo === CAT_MUNICIPIO.codigo; },
    mensaje: 'El municipio debe ser Santiago de Cali (código 76001).'
  },
  {
    // Coherencia jerárquica DIVIPOLA: el municipio pertenece al departamento.
    codigo: 'RN-005',
    campo: 'municipio',
    aplica: function (d) { return !esVacio(d.municipioCodigo) && !esVacio(d.departamentoCodigo); },
    valida: function (d) { return String(d.municipioCodigo).indexOf(String(d.departamentoCodigo)) === 0; },
    mensaje: 'El código del municipio debe iniciar con el código del departamento.'
  },
  {
    codigo: 'RN-006',
    campo: 'areaUbicacion',
    valida: function (d) { return perteneceA(CAT_AREA_UBICACION, d.areaUbicacion); },
    mensaje: 'Seleccione el área de ubicación de la vivienda.'
  },
  {
    codigo: 'RN-007',
    campo: 'territorio',
    valida: function (d) { return !esVacio(d.territorio) && !!CAT_TERRITORIOS[d.territorio]; },
    mensaje: 'Seleccione un territorio del catálogo.'
  },
  {
    // Los territorios rurales no son coherentes con un área urbana.
    codigo: 'RN-007',
    campo: 'territorio',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) { return !!CAT_TERRITORIOS[d.territorio] && !esVacio(d.areaUbicacion); },
    valida: function (d) {
      if (comunaDeTerritorio(d.territorio) !== 'Rural') return true;
      return d.areaUbicacion === 'rural' || d.areaUbicacion === 'centro_poblado';
    },
    mensaje: 'El territorio seleccionado es rural pero el área de ubicación es urbana. Verifique.'
  },
  {
    codigo: 'RN-008',
    campo: 'microterritorio',
    aplica: function (d) { return !!CAT_TERRITORIOS[d.territorio]; },
    valida: function (d) { return !!buscarMicroterritorio(d.territorio, d.microterritorio); },
    mensaje: 'Seleccione un microterritorio válido para el territorio elegido.'
  },
  {
    codigo: 'RN-009',
    campo: 'divisionTerritorial',
    valida: function (d) { return !esVacio(d.divisionTerritorial); },
    mensaje: 'Detalle la micro-localización: corregimiento, vereda, barrio, localidad o resguardo.'
  },
  {
    codigo: 'RN-010',
    campo: 'equipoSaludId',
    /* Sin guiones: RN-010 dice "alfanuméricos" y la base lo impone con
       ebs_formato_codigo (^[A-Za-z0-9]{3,20}$). El motor los admitía, así que
       un código con guión pasaba la validación y lo rechazaba PostgreSQL al
       sincronizar. */
    valida: function (d) { return /^[A-Za-z0-9]{3,20}$/.test(String(d.equipoSaludId || '').trim()); },
    mensaje: 'Obligatorio. Código alfanumérico del EBS de 3 a 20 caracteres, sin guiones ni espacios.'
  },
  {
    codigo: 'RN-011',
    campo: 'prestadorPrimario',
    valida: function (d) { return !esVacio(d.prestadorPrimario); },
    mensaje: 'Registre la IPS u organismo de adscripción del equipo.'
  },
  {
    codigo: 'RN-012',
    campo: 'responsableTipoId',
    valida: function (d) { return perteneceA(CAT_TIPO_ID_RESPONSABLE, d.responsableTipoId); },
    mensaje: 'Seleccione el tipo de documento del responsable (CC, CD, CE o PT).'
  },
  {
    codigo: 'RN-013',
    campo: 'responsableNumeroId',
    valida: function (d) { return documentoValidoParaTipo(d.responsableTipoId, d.responsableNumeroId); },
    mensaje: 'Número inválido para el tipo de documento seleccionado (CC: 6 a 10 dígitos; otros: 5 a 16 alfanuméricos).'
  },
  {
    codigo: 'RN-014',
    campo: 'perfilProfesional',
    valida: function (d) { return perteneceA(CAT_PERFIL_PROFESIONAL, d.perfilProfesional); },
    mensaje: 'Seleccione el perfil profesional de quien realiza la identificación.'
  },
  {
    codigo: 'RN-014',
    campo: 'perfilProfesionalOtro',
    aplica: function (d) { return d.perfilProfesional === 'otro'; },
    valida: function (d) { return !esVacio(d.perfilProfesionalOtro); },
    mensaje: 'Especifique el perfil profesional.'
  },
  {
    codigo: 'RN-015',
    campo: 'codigoFicha',
    aplica: function (d) { return d.codigoFicha !== undefined; },
    valida: function (d) { return !esVacio(d.codigoFicha); },
    mensaje: 'El código de la ficha lo genera el sistema y no puede quedar vacío.'
  },
  {
    codigo: 'RN-016',
    campo: 'fechaDiligenciamiento',
    aplica: function (d) { return d.fechaDiligenciamiento !== undefined; },
    valida: function (d) { return fechaNoFutura(d.fechaDiligenciamiento); },
    mensaje: 'Ingrese una fecha válida (AAAA/MM/DD) que no sea posterior a hoy.'
  },
  {
    /* RN-016, segunda mitad: la antigüedad máxima. `DIAS_MAXIMOS_FICHA` estaba
       declarada pero ninguna regla la usaba, de modo que el límite sólo lo
       aplicaba el disparador de la base. El encuestador se enteraba al
       sincronizar —o no se enteraba, porque el endpoint reescribía la fecha—
       en vez de al cerrar la ficha. */
    codigo: 'RN-016',
    campo: 'fechaDiligenciamiento',
    aplica: function (d) {
      return d.fechaDiligenciamiento !== undefined && fechaNoFutura(d.fechaDiligenciamiento);
    },
    valida: function (d) {
      const fecha = parsearFecha(d.fechaDiligenciamiento);
      if (fecha === null) return false;
      const dias = Math.floor((hoySinHora().getTime() - fecha.getTime()) / 86400000);
      return dias <= DIAS_MAXIMOS_FICHA;
    },
    mensaje: 'La ficha no puede tener más de ' + DIAS_MAXIMOS_FICHA +
      ' días de antigüedad. Sincronice las fichas pendientes o registre una fecha vigente.'
  },
  {
    codigo: 'RN-016',
    campo: 'fechaDiligenciamiento',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) { return esFechaValida(d.fechaDiligenciamiento); },
    valida: function (d) {
      const dias = diferenciaEnDias(d.fechaDiligenciamiento, formatearFechaIso(hoySinHora()));
      return dias === null || dias <= DIAS_MAXIMOS_FICHA;
    },
    mensaje: 'La ficha tiene más de ' + DIAS_MAXIMOS_FICHA + ' días sin sincronizar. Verifique la fecha.'
  },
  {
    codigo: 'RN-017',
    campo: 'entornoAbordaje',
    valida: function (d) { return perteneceA(CAT_ENTORNO, d.entornoAbordaje); },
    mensaje: 'Determine el entorno donde se realiza la identificación.'
  },
  {
    codigo: 'RN-018',
    campo: 'nombreInstitucion',
    aplica: function (d) { return ENTORNOS_CON_INSTITUCION.indexOf(d.entornoAbordaje) !== -1; },
    valida: function (d) { return !esVacio(d.nombreInstitucion); },
    mensaje: 'Obligatorio para entornos comunitario, institucional, educativo o laboral.'
  },
  {
    codigo: 'RN-019',
    campo: 'cabezaFamilia',
    valida: function (d) { return !esVacio(d.cabezaFamilia); },
    mensaje: 'Registre el nombre del líder o representante del entorno.'
  },
  {
    codigo: 'RN-020',
    campo: 'jovenesEnPaz',
    valida: function (d) { return perteneceA(CAT_SI_NO, d.jovenesEnPaz); },
    mensaje: 'Indique si algún habitante pertenece al programa Jóvenes en Paz.'
  }
];

/* Utilidad local: fecha del sistema en el formato que esperan las reglas. */
function formatearFechaIso(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}

/* ---------------------------------------------------------
   3.3 BLOQUE 3 — Vivienda y entorno (ítems 21-38)
   --------------------------------------------------------- */

const REGLAS_BLOQUE_3 = [
  {
    codigo: 'RN-021',
    campo: 'direccion',
    valida: function (d) { return !!(d.direccionNormalizada && d.direccionNormalizada.completa); },
    mensaje: function (d) {
      const faltantes = d.direccionNormalizada ? d.direccionNormalizada.faltantes : [];
      if (!faltantes || faltantes.length === 0) return 'Complete la dirección de la vivienda.';
      return 'Complete la dirección: falta ' + faltantes.join(', ') + '.';
    }
  },
  {
    codigo: 'RN-022',
    campo: 'latitud',
    aplica: function (d) { return !esVacio(d.latitudTexto) || d.latitud !== null; },
    valida: function (d) { return typeof d.latitud === 'number' && d.latitud >= -90 && d.latitud <= 90; },
    mensaje: 'Ingrese una latitud válida entre -90 y 90.'
  },
  {
    codigo: 'RN-022',
    campo: 'latitud',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) { return typeof d.latitud === 'number'; },
    valida: function (d) { return d.latitud >= BBOX_CALI.latMin && d.latitud <= BBOX_CALI.latMax; },
    mensaje: 'La latitud queda fuera del municipio de Santiago de Cali. Verifique la ubicación.'
  },
  {
    codigo: 'RN-023',
    campo: 'longitud',
    aplica: function (d) { return !esVacio(d.longitudTexto) || d.longitud !== null; },
    valida: function (d) { return typeof d.longitud === 'number' && d.longitud >= -180 && d.longitud <= 180; },
    mensaje: 'Ingrese una longitud válida entre -180 y 180.'
  },
  {
    codigo: 'RN-023',
    campo: 'longitud',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) { return typeof d.longitud === 'number'; },
    valida: function (d) { return d.longitud >= BBOX_CALI.lonMin && d.longitud <= BBOX_CALI.lonMax; },
    mensaje: 'La longitud queda fuera del municipio de Santiago de Cali. Verifique la ubicación.'
  },
  {
    // Latitud y longitud se registran siempre como par.
    codigo: 'RN-023',
    campo: 'longitud',
    valida: function (d) {
      const tieneLat = typeof d.latitud === 'number';
      const tieneLon = typeof d.longitud === 'number';
      return tieneLat === tieneLon;
    },
    mensaje: 'Las coordenadas se registran como par: complete latitud y longitud.'
  },
  {
    codigo: 'RN-024',
    campo: 'ubicacionReferencia',
    valida: function (d) { return !esVacio(d.ubicacionReferencia); },
    mensaje: 'Registre un punto de referencia que facilite la localización del hogar.'
  },
  {
    codigo: 'RN-025',
    campo: 'idHogar',
    aplica: function (d) { return d.idHogar !== undefined; },
    valida: function (d) { return !esVacio(d.idHogar); },
    mensaje: 'El identificador del hogar lo genera el sistema y no puede quedar vacío.'
  },
  {
    codigo: 'RN-026',
    campo: 'idFamilia',
    aplica: function (d) { return d.idFamilia !== undefined; },
    valida: function (d) { return !esVacio(d.idFamilia); },
    mensaje: 'El identificador de la familia lo genera el sistema y no puede quedar vacío.'
  },
  {
    codigo: 'RN-027',
    campo: 'estrato',
    valida: function (d) { return perteneceA(CAT_ESTRATO, d.estrato); },
    mensaje: 'Seleccione el estrato socioeconómico de la vivienda.'
  },
  {
    codigo: 'RN-028',
    campo: 'hogaresEnVivienda',
    aplica: function (d) { return d.hogaresEnVivienda !== undefined; },
    valida: function (d) { return esEnteroPositivo(d.hogaresEnVivienda); },
    mensaje: 'Ingrese el número de hogares familiares (entero mayor o igual a 1).'
  },
  {
    codigo: 'RN-029',
    campo: 'personasEnVivienda',
    valida: function (d) { return esEnteroPositivo(d.personasEnVivienda); },
    mensaje: 'Ingrese el número de personas de la vivienda (entero mayor a cero).'
  },
  {
    codigo: 'RN-029',
    campo: 'personasEnVivienda',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) { return esEnteroPositivo(d.personasEnVivienda); },
    valida: function (d) { return d.personasEnVivienda <= 20; },
    mensaje: 'Registró más de 20 personas en la vivienda. Confirme que el dato es correcto.'
  },
  {
    codigo: 'RN-030',
    campo: 'habitacionesVivienda',
    valida: function (d) { return esEnteroPositivo(d.habitacionesVivienda); },
    mensaje: 'Ingrese el número de habitaciones usadas para dormir (entero mayor a cero).'
  },
  {
    codigo: 'RN-031',
    campo: 'elementosParaDormir',
    aplica: function (d) { return d.elementosParaDormir !== undefined; },
    valida: function (d) { return esEnteroNoNegativo(d.elementosParaDormir); },
    mensaje: 'Ingrese la cantidad de elementos para dormir (entero mayor o igual a cero).'
  },
  {
    // Campo calculado: debe coincidir con el cociente de los ítems 29 y 30.
    codigo: 'RN-032',
    campo: 'personasPorHabitacion',
    aplica: function (d) {
      return d.personasPorHabitacion !== undefined &&
             esEnteroPositivo(d.personasEnVivienda) && esEnteroPositivo(d.habitacionesVivienda);
    },
    valida: function (d) {
      const esperado = evaluarHacinamiento(d.personasEnVivienda, d.habitacionesVivienda);
      return d.personasPorHabitacion === esperado.personasPorHabitacion;
    },
    mensaje: 'Las personas por habitación son un valor calculado y no editable.'
  },
  {
    // Campo derivado de RN-032 según el umbral DANE (> 2 personas por habitación).
    codigo: 'RN-033',
    campo: 'hacinamiento',
    aplica: function (d) {
      return d.hacinamiento !== undefined && d.hacinamiento !== null &&
             esEnteroPositivo(d.personasEnVivienda) && esEnteroPositivo(d.habitacionesVivienda);
    },
    valida: function (d) {
      const esperado = evaluarHacinamiento(d.personasEnVivienda, d.habitacionesVivienda);
      return d.hacinamiento === esperado.hacinamiento;
    },
    mensaje: 'La clasificación de hacinamiento se deriva automáticamente y no es editable.'
  },
  {
    codigo: 'RN-034',
    campo: 'tipoVivienda',
    valida: function (d) { return perteneceA(CAT_TIPO_VIVIENDA, d.tipoVivienda); },
    mensaje: 'Seleccione el tipo de vivienda.'
  },
  {
    codigo: 'RN-035',
    campo: 'materialTecho',
    valida: function (d) { return perteneceA(CAT_MATERIAL_TECHO, d.materialTecho); },
    mensaje: 'Seleccione el material predominante del techo.'
  },
  {
    codigo: 'RN-036',
    campo: 'riesgosAccidente',
    valida: function (d) { return seleccionMultipleValida(d.riesgosAccidente, VALOR_NINGUNO); },
    mensaje: 'Marque los escenarios de riesgo o seleccione "Ninguno" (que excluye las demás opciones).'
  },
  {
    codigo: 'RN-037',
    campo: 'vectores',
    valida: function (d) { return perteneceA(CAT_SI_NO_NA, d.vectores); },
    mensaje: 'Indique si existen criaderos o reservorios de vectores.'
  },
  {
    codigo: 'RN-038',
    campo: 'factoresContaminacion',
    valida: function (d) { return seleccionMultipleValida(d.factoresContaminacion, VALOR_NINGUNO); },
    mensaje: 'Marque los factores de contaminación o seleccione "Ninguno" (que excluye las demás opciones).'
  }
];

/* ---------------------------------------------------------
   3.4 BLOQUE 4 — Zoonosis y saneamiento (ítems 39-49)
   --------------------------------------------------------- */

const REGLAS_BLOQUE_4 = [
  {
    codigo: 'RN-039',
    campo: 'actividadEconomica',
    valida: function (d) { return perteneceA(CAT_SI_NO, d.actividadEconomica); },
    mensaje: 'Indique si al interior de la vivienda se realiza alguna actividad económica.'
  },
  {
    codigo: 'RN-040',
    campo: 'animales',
    valida: function (d) { return seleccionMultipleValida(d.animales, VALOR_NINGUNO); },
    mensaje: 'Señale los animales que conviven con la familia o seleccione "Ninguno".'
  },
  {
    codigo: 'RN-040',
    campo: 'animalesOtro',
    aplica: function (d) { return contiene(d.animales, 'otro'); },
    valida: function (d) { return !esVacio(d.animalesOtro); },
    mensaje: 'Especifique cuál es el otro animal que convive en la vivienda.'
  },
  {
    codigo: 'RN-041',
    campo: 'perros',
    aplica: function (d) { return contiene(d.animales, 'perros'); },
    valida: function (d) { return esEnteroPositivo(d.perros); },
    mensaje: 'Indique cuántos perros hay en la vivienda (entero mayor a cero).'
  },
  {
    codigo: 'RN-041',
    campo: 'perros',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) { return esEnteroPositivo(d.perros); },
    valida: function (d) { return d.perros <= 10; },
    mensaje: 'Más de 10 perros sugiere tenencia irregular o criadero no declarado. Verifique el ítem 39.'
  },
  {
    codigo: 'RN-042',
    campo: 'perrosVacunados',
    aplica: function (d) { return esEnteroPositivo(d.perros); },
    valida: function (d) { return esEnteroNoNegativo(d.perrosVacunados); },
    mensaje: 'Indique cuántos perros cuentan con vacuna antirrábica.'
  },
  {
    codigo: 'RN-042',
    campo: 'perrosVacunados',
    aplica: function (d) { return esEnteroPositivo(d.perros) && esEnteroNoNegativo(d.perrosVacunados); },
    valida: function (d) { return d.perrosVacunados <= d.perros; },
    mensaje: 'Los perros vacunados no pueden superar el total de perros de la vivienda.'
  },
  {
    codigo: 'RN-043',
    campo: 'gatos',
    aplica: function (d) { return contiene(d.animales, 'gatos'); },
    valida: function (d) { return esEnteroPositivo(d.gatos); },
    mensaje: 'Indique cuántos gatos hay en la vivienda (entero mayor a cero).'
  },
  {
    codigo: 'RN-043',
    campo: 'gatos',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) { return esEnteroPositivo(d.gatos); },
    valida: function (d) { return d.gatos <= 10; },
    mensaje: 'Más de 10 gatos sugiere tenencia irregular o criadero no declarado. Verifique el ítem 39.'
  },
  {
    codigo: 'RN-044',
    campo: 'gatosVacunados',
    aplica: function (d) { return esEnteroPositivo(d.gatos); },
    valida: function (d) { return esEnteroNoNegativo(d.gatosVacunados); },
    mensaje: 'Indique cuántos gatos cuentan con vacuna antirrábica.'
  },
  {
    codigo: 'RN-044',
    campo: 'gatosVacunados',
    aplica: function (d) { return esEnteroPositivo(d.gatos) && esEnteroNoNegativo(d.gatosVacunados); },
    valida: function (d) { return d.gatosVacunados <= d.gatos; },
    mensaje: 'Los gatos vacunados no pueden superar el total de gatos de la vivienda.'
  },
  {
    codigo: 'RN-045',
    campo: 'carnetAntirrabico',
    valida: function (d) {
      const hayMascotas = (d.perros || 0) + (d.gatos || 0) > 0;
      if (!hayMascotas) return d.carnetAntirrabico === VALOR_NO_APLICA || esVacio(d.carnetAntirrabico);
      return d.carnetAntirrabico === 'si' || d.carnetAntirrabico === 'no';
    },
    mensaje: 'Indique si los perros y gatos cuentan con carné de vacuna antirrábica con vigencia inferior a 3 años.'
  },
  {
    // Coherencia entre la cobertura declarada y la vigencia del carné.
    codigo: 'RN-045',
    campo: 'carnetAntirrabico',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (d) {
      const coberturaTotal = (d.perros || 0) === (d.perrosVacunados || 0) &&
                             (d.gatos || 0) === (d.gatosVacunados || 0);
      return coberturaTotal && (d.perros || 0) + (d.gatos || 0) > 0;
    },
    valida: function (d) { return d.carnetAntirrabico !== 'no'; },
    mensaje: 'Declaró cobertura antirrábica total pero el carné no está vigente. Confirme el dato.'
  },
  {
    codigo: 'RN-046',
    campo: 'fuenteAgua',
    valida: function (d) { return perteneceA(CAT_FUENTE_AGUA, d.fuenteAgua); },
    mensaje: 'Seleccione la principal fuente de abastecimiento de agua para consumo humano.'
  },
  {
    codigo: 'RN-047',
    campo: 'disposicionExcretas',
    valida: function (d) { return perteneceA(CAT_DISPOSICION_EXCRETAS, d.disposicionExcretas); },
    mensaje: 'Seleccione el sistema de disposición de excretas de la vivienda.'
  },
  {
    codigo: 'RN-048',
    campo: 'aguasResiduales',
    valida: function (d) { return perteneceA(CAT_AGUAS_RESIDUALES, d.aguasResiduales); },
    mensaje: 'Seleccione el sistema de disposición de aguas residuales domésticas.'
  },
  {
    codigo: 'RN-049',
    campo: 'residuosSolidos',
    valida: function (d) { return perteneceA(CAT_RESIDUOS_SOLIDOS, d.residuosSolidos); },
    mensaje: 'Seleccione la disposición final de los residuos sólidos ordinarios.'
  }
];

/* ---------------------------------------------------------
   3.5 BLOQUES 5 y 6 — Familia (ítems 50-57)
   Firma: valida(familia, datos)
   --------------------------------------------------------- */

const REGLAS_FAMILIA = [
  {
    codigo: 'RN-050',
    campo: 'tipoFamilia',
    valida: function (f) { return perteneceA(CAT_TIPO_FAMILIA, f.tipoFamilia); },
    mensaje: 'Seleccione el tipo de familia.'
  },
  {
    codigo: 'RN-051',
    campo: 'numeroIntegrantes',
    valida: function (f) { return esEnteroPositivo(f.numeroIntegrantes); },
    mensaje: 'Ingrese el número de personas que conforman la familia (entero mayor a cero).'
  },
  {
    // El bloque de integrantes se repite tantas veces como declare el ítem 51.
    codigo: 'RN-051',
    campo: 'numeroIntegrantes',
    aplica: function (f) { return esEnteroPositivo(f.numeroIntegrantes); },
    valida: function (f) {
      return Array.isArray(f.integrantes) && f.integrantes.length === f.numeroIntegrantes;
    },
    mensaje: function (f) {
      const capturados = Array.isArray(f.integrantes) ? f.integrantes.length : 0;
      return 'Declaró ' + f.numeroIntegrantes + ' integrantes y hay ' + capturados +
             ' caracterizados. Complete la sección 5 para cada uno.';
    }
  },
  {
    // Debe existir exactamente un responsable económico por familia.
    codigo: 'RN-051',
    campo: 'rolFamiliar',
    aplica: function (f) { return !listaVacia(f.integrantes); },
    valida: function (f) {
      const responsables = f.integrantes.filter(function (i) {
        return i.rolFamiliar === ROL_RESPONSABLE_ECONOMICO;
      });
      return responsables.length === 1;
    },
    mensaje: 'Debe existir exactamente un integrante con rol "Responsable económico de la familia".'
  },
  {
    // RN-070 — El contacto es obligatorio a nivel de familia, no de persona.
    codigo: 'RN-070',
    campo: 'telefono1',
    aplica: function (f) { return !listaVacia(f.integrantes); },
    valida: function (f) {
      if (f.sinContactoTelefonico === true) return true; // novedad registrada
      return f.integrantes.some(function (i) { return telefonoValido(i.telefono1); });
    },
    mensaje: 'Al menos un integrante debe registrar un teléfono válido, o debe registrarse la novedad "sin medio de contacto telefónico".'
  },
  {
    codigo: 'RN-052',
    campo: 'cuidadorPrincipal',
    valida: function (f) { return perteneceA(CAT_SI_NO, f.cuidadorPrincipal); },
    mensaje: 'Indique si se identifica un cuidador principal.'
  },
  {
    codigo: 'RN-053',
    campo: 'zarit',
    aplica: function (f) { return f.cuidadorPrincipal === 'si'; },
    valida: function (f) { return perteneceA(CAT_ZARIT, f.zarit); },
    mensaje: 'Aplique la escala Zarit y registre la clasificación del resultado.'
  },
  {
    codigo: 'RN-054',
    campo: 'situacionesRiesgo',
    valida: function (f) { return seleccionMultipleValida(f.situacionesRiesgo, VALOR_NINGUNA); },
    mensaje: 'Marque las situaciones familiares de riesgo o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-055',
    campo: 'practicasVinculo',
    valida: function (f) { return Array.isArray(f.practicasVinculo) && todosPertenecenA(CAT_PRACTICAS_VINCULO, f.practicasVinculo); },
    mensaje: 'Registre las prácticas que favorecen los vínculos familiares.'
  },
  {
    codigo: 'RN-056',
    campo: 'redesApoyo',
    valida: function (f) { return perteneceA(CAT_REDES_APOYO, f.redesApoyo); },
    mensaje: 'Seleccione el nivel de redes de apoyo social de la familia.'
  },
  {
    codigo: 'RN-057',
    campo: 'practicasCuidadoHogar',
    valida: function (f) { return Array.isArray(f.practicasCuidadoHogar) && todosPertenecenA(CAT_PRACTICAS_CUIDADO_HOGAR, f.practicasCuidadoHogar); },
    mensaje: 'Registre las prácticas de cuidado de la salud en el entorno hogar.'
  }
];

/* ---------------------------------------------------------
   3.6 BLOQUES 7 a 9 — Integrante (ítems 58-110)
   Firma: valida(integrante, contexto, familia, datos)
   --------------------------------------------------------- */

const REGLAS_INTEGRANTE = [
  /* --- Identificación (58-72) --- */
  {
    codigo: 'RN-058',
    campo: 'primerNombre',
    valida: function (i) { return !esVacio(i.primerNombre) && soloAlfabetico(i.primerNombre); },
    mensaje: 'El primer nombre es obligatorio y sólo admite caracteres alfabéticos.'
  },
  {
    codigo: 'RN-059',
    campo: 'segundoNombre',
    aplica: function (i) { return !esVacio(i.segundoNombre); },
    valida: function (i) { return soloAlfabetico(i.segundoNombre); },
    mensaje: 'El segundo nombre sólo admite caracteres alfabéticos.'
  },
  {
    codigo: 'RN-060',
    campo: 'primerApellido',
    valida: function (i) { return !esVacio(i.primerApellido) && soloAlfabetico(i.primerApellido); },
    mensaje: 'El primer apellido es obligatorio y sólo admite caracteres alfabéticos.'
  },
  {
    codigo: 'RN-061',
    campo: 'segundoApellido',
    aplica: function (i) { return !esVacio(i.segundoApellido); },
    valida: function (i) { return soloAlfabetico(i.segundoApellido); },
    mensaje: 'El segundo apellido sólo admite caracteres alfabéticos.'
  },
  {
    codigo: 'RN-062',
    campo: 'tipoId',
    valida: function (i) { return perteneceA(CAT_TIPO_ID_INTEGRANTE, i.tipoId); },
    mensaje: 'Seleccione el tipo de identificación del integrante.'
  },
  {
    codigo: 'RN-063',
    campo: 'numeroId',
    aplica: function (i, c) { return c.tipoId !== null; },
    valida: function (i, c) { return documentoValidoParaFormato(c.tipoId.formato, i.numeroId); },
    mensaje: function (i, c) {
      return 'Número inválido para el tipo ' + c.tipoId.valor + '. Verifique el formato exigido.';
    }
  },
  {
    // El documento debe ser único dentro de la familia.
    codigo: 'RN-063',
    campo: 'numeroId',
    aplica: function (i, c, f) { return !esVacio(i.numeroId) && !listaVacia(f.integrantes); },
    valida: function (i, c, f) {
      const repetidos = f.integrantes.filter(function (otro) {
        return otro.tipoId === i.tipoId && String(otro.numeroId) === String(i.numeroId);
      });
      return repetidos.length <= 1;
    },
    mensaje: 'Dos integrantes de la misma familia no pueden compartir tipo y número de documento.'
  },
  {
    codigo: 'RN-064',
    campo: 'fechaNacimiento',
    valida: function (i, c, f, d) {
      return fechaNoPosteriorA(i.fechaNacimiento, d && d.fechaDiligenciamiento);
    },
    mensaje: 'Ingrese una fecha de nacimiento válida (AAAA/MM/DD) que no sea posterior al día ' +
             'en que se diligencia la ficha.'
  },
  {
    codigo: 'RN-064',
    campo: 'fechaNacimiento',
    aplica: function (i, c) { return c.edadAnios !== null; },
    valida: function (i, c) { return c.edadAnios <= 120; },
    mensaje: 'La fecha de nacimiento implica una edad superior a 120 años.'
  },
  {
    // Coherencia tipo de documento / edad — MS y AS bloquean por definición.
    codigo: 'RN-064',
    campo: 'tipoId',
    aplica: function (i, c) { return c.tipoId !== null && c.tipoId.bloqueaEdad && c.edadMeses !== null; },
    valida: function (i, c) { return edadEntre(c, c.tipoId.edadMinMeses || 0, c.tipoId.edadMaxMeses); },
    mensaje: function (i, c) {
      return c.tipoId.valor === 'MS'
        ? 'El tipo MS (Menor sin Identificación) exige una edad menor de 18 años.'
        : 'El tipo AS (Adulto sin Identificación) exige una edad de 18 años o más.';
    }
  },
  {
    // Coherencia tipo/edad para NV, RC, TI y CC — sólo advierte (trámite pendiente).
    codigo: 'RN-064',
    campo: 'tipoId',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (i, c) {
      return c.tipoId !== null && !c.tipoId.bloqueaEdad &&
             c.tipoId.edadMinMeses !== null && c.edadMeses !== null;
    },
    valida: function (i, c) { return edadEntre(c, c.tipoId.edadMinMeses, c.tipoId.edadMaxMeses); },
    mensaje: function (i, c) {
      return 'El tipo ' + c.tipoId.valor + ' no corresponde a la edad calculada. Confirme si hay un trámite pendiente.';
    }
  },
  {
    codigo: 'RN-065',
    campo: 'nacionalidad',
    valida: function (i) { return perteneceA(CAT_NACIONALIDAD, i.nacionalidad); },
    mensaje: 'Seleccione la nacionalidad del integrante.'
  },
  {
    // Los documentos de extranjería exigen nacionalidad distinta de Colombia.
    codigo: 'RN-065',
    campo: 'nacionalidad',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (i, c) { return c.tipoId !== null && c.tipoId.exigeExtranjero; },
    valida: function (i) { return i.nacionalidad !== NACIONALIDAD_COLOMBIA; },
    mensaje: 'El tipo de documento corresponde a población extranjera pero la nacionalidad registrada es Colombia.'
  },
  {
    codigo: 'RN-066',
    campo: 'sexo',
    valida: function (i) { return perteneceA(CAT_SEXO, i.sexo); },
    mensaje: 'Seleccione el sexo del integrante.'
  },
  {
    codigo: 'RN-067',
    campo: 'genero',
    valida: function (i) { return perteneceA(CAT_GENERO, i.genero); },
    mensaje: 'Seleccione el género del integrante.'
  },
  {
    codigo: 'RN-068',
    campo: 'autoidentificacionGenero',
    valida: function (i) { return perteneceA(CAT_AUTOIDENTIFICACION_GENERO, i.autoidentificacionGenero); },
    mensaje: 'Registre cómo se identifica el integrante.'
  },
  {
    codigo: 'RN-068',
    campo: 'autoidentificacionGeneroOtro',
    aplica: function (i) { return i.autoidentificacionGenero === 'otro'; },
    valida: function (i) { return !esVacio(i.autoidentificacionGeneroOtro); },
    mensaje: 'Especifique cuál es la autoidentificación de género.'
  },
  {
    codigo: 'RN-069',
    campo: 'orientacionSexual',
    aplica: function (i, c) { return esMayorDe(c, 13); },
    valida: function (i) { return perteneceA(CAT_ORIENTACION_SEXUAL, i.orientacionSexual); },
    mensaje: 'Registre la orientación sexual (obligatoria desde los 13 años).'
  },
  {
    codigo: 'RN-069',
    campo: 'orientacionSexualOtro',
    aplica: function (i) { return i.orientacionSexual === 'otro'; },
    valida: function (i) { return !esVacio(i.orientacionSexualOtro); },
    mensaje: 'Especifique cuál es la orientación sexual.'
  },
  {
    codigo: 'RN-070',
    campo: 'telefono1',
    aplica: function (i) { return !esVacio(i.telefono1); },
    valida: function (i) { return telefonoValido(i.telefono1); },
    mensaje: 'Teléfono inválido. Use 10 dígitos para móvil o 7 para fijo, sin secuencias repetidas.'
  },
  {
    codigo: 'RN-071',
    campo: 'telefono2',
    aplica: function (i) { return !esVacio(i.telefono2); },
    valida: function (i) { return telefonoValido(i.telefono2) && String(i.telefono2) !== String(i.telefono1); },
    mensaje: 'El teléfono alternativo debe ser válido y distinto del teléfono 1.'
  },
  {
    codigo: 'RN-072',
    campo: 'rolFamiliar',
    valida: function (i) { return perteneceA(CAT_ROL_FAMILIAR, i.rolFamiliar); },
    mensaje: 'Seleccione el rol del integrante dentro de la familia.'
  },

  /* --- Socioeconómicas (73-80) --- */
  {
    codigo: 'RN-073',
    campo: 'ocupacion',
    aplica: function (i, c) { return esMayorDe(c, 15); },
    valida: function (i) { return !esVacio(i.ocupacion); },
    mensaje: 'Registre la ocupación (obligatoria desde los 15 años).'
  },
  {
    codigo: 'RN-074',
    campo: 'nivelEducativo',
    aplica: function (i, c) { return esMayorDe(c, 5); },
    valida: function (i) { return perteneceA(CAT_NIVEL_EDUCATIVO, i.nivelEducativo); },
    mensaje: 'Seleccione el nivel educativo (obligatorio desde los 5 años).'
  },
  {
    codigo: 'RN-074',
    campo: 'nivelEducativo',
    severidad: SEVERIDAD.ADVERTENCIA,
    aplica: function (i, c) { return c.edadAnios !== null && perteneceA(CAT_NIVEL_EDUCATIVO, i.nivelEducativo); },
    valida: function (i, c) {
      const nivel = opcionDe(CAT_NIVEL_EDUCATIVO, i.nivelEducativo);
      return c.edadAnios >= nivel.edadMinimaEsperada;
    },
    mensaje: 'El nivel educativo no es coherente con la edad calculada. Verifique el dato.'
  },
  {
    codigo: 'RN-075',
    campo: 'regimenAfiliacion',
    valida: function (i) { return perteneceA(CAT_REGIMEN_AFILIACION, i.regimenAfiliacion); },
    mensaje: 'Seleccione el régimen de afiliación al SGSSS.'
  },
  {
    codigo: 'RN-076',
    campo: 'eapb',
    aplica: function (i) {
      return !esVacio(i.regimenAfiliacion) && i.regimenAfiliacion !== REGIMEN_NO_AFILIADO;
    },
    valida: function (i) { return !esVacio(i.eapb); },
    mensaje: 'Registre la EAPB a la que está afiliado el integrante.'
  },
  {
    codigo: 'RN-077',
    campo: 'sujetoEspecialProteccion',
    valida: function (i) { return seleccionMultipleValida(i.sujetoEspecialProteccion, VALOR_NINGUNA); },
    mensaje: 'Marque las condiciones de especial protección o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-077',
    campo: 'sujetoEspecialProteccionOtro',
    aplica: function (i) { return contiene(i.sujetoEspecialProteccion, 'otro'); },
    valida: function (i) { return !esVacio(i.sujetoEspecialProteccionOtro); },
    mensaje: 'Especifique cuál es la otra condición de especial protección.'
  },
  {
    codigo: 'RN-078',
    campo: 'modalidadViolencia',
    aplica: function (i) { return contiene(i.sujetoEspecialProteccion, SUJETO_VIOLENCIA_GENERO); },
    valida: function (i) {
      return !listaVacia(i.modalidadViolencia) && todosPertenecenA(CAT_MODALIDAD_VIOLENCIA, i.modalidadViolencia);
    },
    mensaje: 'Registre la modalidad de la violencia de género e intrafamiliar.'
  },
  {
    codigo: 'RN-079',
    campo: 'pertenenciaEtnica',
    valida: function (i) { return perteneceA(CAT_PERTENENCIA_ETNICA, i.pertenenciaEtnica); },
    mensaje: 'Seleccione la pertenencia étnica.'
  },
  {
    codigo: 'RN-080',
    campo: 'puebloEtnico',
    aplica: function (i) {
      return !esVacio(i.pertenenciaEtnica) && i.pertenenciaEtnica !== ETNIA_NINGUNA;
    },
    valida: function (i) { return !esVacio(i.puebloEtnico); },
    mensaje: 'Registre el pueblo o comunidad étnica a la cual pertenece.'
  },

  /* --- Situación de salud (81-110) --- */
  {
    codigo: 'RN-081',
    campo: 'saberesAncestrales',
    valida: function (i) { return seleccionMultipleValida(i.saberesAncestrales, VALOR_NINGUNA); },
    mensaje: 'Registre las prácticas de saberes ancestrales o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-082',
    campo: 'discapacidad',
    valida: function (i) { return seleccionMultipleValida(i.discapacidad, SIN_DISCAPACIDAD); },
    mensaje: 'Registre el tipo de discapacidad o seleccione "Sin discapacidad".'
  },
  {
    codigo: 'RN-083',
    campo: 'certificacionRlcpd',
    valida: function (i) {
      const tieneDiscapacidad = tieneHallazgo(i.discapacidad, SIN_DISCAPACIDAD);
      if (!tieneDiscapacidad) return i.certificacionRlcpd === VALOR_NO_APLICA || esVacio(i.certificacionRlcpd);
      return i.certificacionRlcpd === 'si' || i.certificacionRlcpd === 'no';
    },
    mensaje: 'Indique si cuenta con certificación y registro de discapacidad (RLCPD).'
  },
  {
    codigo: 'RN-084',
    campo: 'intencionReproductiva',
    valida: function (i) { return perteneceA(CAT_SI_NO, i.intencionReproductiva); },
    mensaje: 'Indique la intención reproductiva a corto plazo.'
  },
  {
    codigo: 'RN-085',
    campo: 'gestacionActual',
    aplica: function (i, c) { return SEXOS_CON_CAPACIDAD_GESTAR.indexOf(c.sexo) !== -1; },
    valida: function (i) { return perteneceA(CAT_SI_NO, i.gestacionActual); },
    mensaje: 'Indique si hay gestación actual confirmada.'
  },
  {
    // RN-205 — La gestación en sexo "Hombre" sólo se admite con identidad de género diversa.
    codigo: 'RN-085',
    campo: 'gestacionActual',
    aplica: function (i, c) { return c.sexo === 'hombre' && i.gestacionActual === 'si'; },
    valida: function (i) {
      const opcion = opcionDe(CAT_AUTOIDENTIFICACION_GENERO, i.autoidentificacionGenero);
      return !!(opcion && opcion.diversa) && i.gestacionConfirmadaExplicitamente === true;
    },
    mensaje: 'La gestación en un integrante de sexo "Hombre" requiere identidad de género diversa y confirmación explícita.'
  },
  {
    codigo: 'RN-086',
    campo: 'practicasCuidado',
    valida: function (i) { return seleccionMultipleValida(i.practicasCuidado, VALOR_NINGUNA); },
    mensaje: 'Registre las prácticas rutinarias de cuidado de la salud o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-087',
    campo: 'atencionesPendientesRpms',
    valida: function (i) { return seleccionMultipleValida(i.atencionesPendientesRpms, VALOR_NINGUNA); },
    mensaje: 'Registre las atenciones pendientes de promoción y mantenimiento o seleccione "Ninguna".'
  },
  {
    // Sólo pueden marcarse atenciones exigibles para la edad y el sexo del integrante.
    codigo: 'RN-087',
    campo: 'atencionesPendientesRpms',
    aplica: function (i) { return !listaVacia(i.atencionesPendientesRpms); },
    valida: function (i, c) {
      return i.atencionesPendientesRpms.every(function (valor) {
        const atencion = opcionDe(CAT_ATENCIONES_RPMS, valor);
        return atencion !== null && atencionRpmsExigible(atencion, c.edadMeses, c.sexo, c.gestante);
      });
    },
    mensaje: 'Marcó una atención que no corresponde a la edad o el sexo del integrante.'
  },
  {
    codigo: 'RN-088',
    campo: 'atencionesPendientesMaterno',
    aplica: function (i, c) { return c.gestante; },
    valida: function (i) { return seleccionMultipleValida(i.atencionesPendientesMaterno, VALOR_NINGUNA); },
    mensaje: 'Registre las atenciones pendientes de la ruta materno perinatal o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-089',
    campo: 'barrerasAcceso',
    aplica: function (i) { return tieneAtencionesPendientes(i); },
    valida: function (i) { return seleccionMultipleValida(i.barrerasAcceso, VALOR_NINGUNA); },
    mensaje: 'Hay atenciones pendientes: registre el motivo por el cual no las ha recibido.'
  },
  {
    codigo: 'RN-090',
    campo: 'conocimientoDerecho',
    valida: function (i) {
      return Array.isArray(i.conocimientoDerecho) && todosPertenecenA(CAT_CONOCIMIENTO_DERECHO, i.conocimientoDerecho);
    },
    mensaje: 'Registre las prácticas para el ejercicio y exigibilidad del derecho a la salud.'
  },
  {
    codigo: 'RN-091',
    campo: 'lactanciaExclusiva',
    valida: function (i, c) {
      if (!edadEntre(c, 0, 5)) return i.lactanciaExclusiva === VALOR_NO_APLICA || esVacio(i.lactanciaExclusiva);
      return i.lactanciaExclusiva === 'si' || i.lactanciaExclusiva === 'no';
    },
    mensaje: 'En menores de 6 meses debe indicarse si recibe lactancia materna exclusiva.'
  },
  {
    codigo: 'RN-092',
    campo: 'peso',
    valida: function (i) { return esNumeroPositivo(i.peso); },
    mensaje: 'Registre el peso en kilogramos (valor mayor a cero).'
  },
  {
    codigo: 'RN-093',
    campo: 'talla',
    valida: function (i) { return esNumeroPositivo(i.talla); },
    mensaje: 'Registre la talla en centímetros (valor mayor a cero).'
  },
  {
    codigo: 'RN-094',
    campo: 'circunferenciaCintura',
    aplica: function (i, c) { return esMayorDe(c, 18); },
    valida: function (i) { return esNumeroPositivo(i.circunferenciaCintura); },
    mensaje: 'La circunferencia de cintura es obligatoria en personas de 18 años o más.'
  },
  {
    // El IMC es calculado: debe coincidir con peso y talla registrados.
    codigo: 'RN-095',
    campo: 'imc',
    aplica: function (i, c) {
      return esMayorDe(c, 5) && esNumeroPositivo(i.peso) && esNumeroPositivo(i.talla);
    },
    valida: function (i) {
      const esperado = calcularImc(i.peso, i.talla);
      if (esperado === null) return false;
      return typeof i.imc === 'number' && Math.abs(i.imc - esperado) < 0.05;
    },
    mensaje: 'El IMC no corresponde al peso y la talla registrados. Es un valor calculado, no editable.'
  },
  {
    codigo: 'RN-096',
    campo: 'clasificacionAntropometrica',
    valida: function (i) { return perteneceA(CAT_CLASIFICACION_ANTROPOMETRICA, i.clasificacionAntropometrica); },
    mensaje: 'Seleccione la clasificación antropométrica del estado nutricional.'
  },
  {
    codigo: 'RN-097',
    campo: 'signosDesnutricion',
    aplica: function (i, c) { return edadEntre(c, 3, 60); },
    valida: function (i) { return seleccionMultipleValida(i.signosDesnutricion, VALOR_NINGUNA); },
    mensaje: 'En niños de 3 meses a 5 años registre los signos físicos de desnutrición o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-098',
    campo: 'tensionSistolica',
    aplica: function (i, c) { return esMayorDe(c, 18); },
    valida: function (i) { return esNumeroPositivo(i.tensionSistolica) && esNumeroPositivo(i.tensionDiastolica); },
    mensaje: 'La tensión arterial (sistólica y diastólica) es obligatoria en personas de 18 años o más.'
  },
  {
    codigo: 'RN-098',
    campo: 'tensionSistolica',
    aplica: function (i) { return esNumeroPositivo(i.tensionSistolica) && esNumeroPositivo(i.tensionDiastolica); },
    valida: function (i) { return i.tensionSistolica > i.tensionDiastolica; },
    mensaje: 'La tensión sistólica debe ser mayor que la diastólica.'
  },
  {
    codigo: 'RN-098',
    campo: 'tensionSistolica',
    aplica: function (i) { return esNumeroPositivo(i.tensionSistolica) && esNumeroPositivo(i.tensionDiastolica); },
    valida: function (i) {
      return i.tensionSistolica >= 50 && i.tensionSistolica <= 300 &&
             i.tensionDiastolica >= 30 && i.tensionDiastolica <= 200;
    },
    mensaje: 'Valores fuera de rango: sistólica (50-300) y diastólica (30-200).'
  },
  {
    // La clasificación es derivada: debe coincidir con el cálculo AHA 2024.
    codigo: 'RN-099',
    campo: 'clasificacionTension',
    aplica: function (i) { return esNumeroPositivo(i.tensionSistolica) && esNumeroPositivo(i.tensionDiastolica); },
    valida: function (i) {
      return i.clasificacionTension === clasificarTensionArterial(i.tensionSistolica, i.tensionDiastolica);
    },
    mensaje: 'La clasificación de tensión arterial no corresponde a los valores registrados (AHA 2024).'
  },
  {
    codigo: 'RN-100',
    campo: 'enfermedadesNoTransmisibles',
    valida: function (i) { return seleccionMultipleValida(i.enfermedadesNoTransmisibles, VALOR_NINGUNA); },
    mensaje: 'Registre las enfermedades no transmisibles diagnosticadas o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-101',
    campo: 'condicionesTransmisibles',
    valida: function (i) { return seleccionMultipleValida(i.condicionesTransmisibles, VALOR_NINGUNA); },
    mensaje: 'Registre las condiciones de salud transmisible o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-102',
    campo: 'zonaEndemica',
    valida: function (i) { return seleccionMultipleValida(i.zonaEndemica, VALOR_NINGUNA); },
    mensaje: 'Registre los eventos de zona endémica o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-103',
    campo: 'adherenciaTratamiento',
    aplica: function (i) { return tieneCondicionActiva(i); },
    valida: function (i) { return perteneceA(CAT_SI_NO_NA, i.adherenciaTratamiento); },
    mensaje: 'Hay una condición de salud activa: indique si recibe atención y tratamiento.'
  },
  {
    codigo: 'RN-104',
    campo: 'motivoNoTratamiento',
    aplica: function (i) { return i.adherenciaTratamiento === 'no'; },
    valida: function (i) { return seleccionMultipleValida(i.motivoNoTratamiento, VALOR_NO_APLICA); },
    mensaje: 'Registre el motivo por el cual no ha recibido la atención.'
  },
  {
    codigo: 'RN-105',
    campo: 'riesgosSaludMentalJoven',
    aplica: function (i, c) { return edadEntre(c, 14 * 12, 28 * 12 + 11); },
    valida: function (i) { return seleccionMultipleValida(i.riesgosSaludMentalJoven, VALOR_NINGUNA); },
    mensaje: 'En personas entre 14 y 28 años registre los riesgos en salud mental o seleccione "Ninguna".'
  },
  {
    codigo: 'RN-106',
    campo: 'sintomatologiaDepresiva',
    aplica: function (i, c) { return esMayorDe(c, 14); },
    valida: function (i) { return seleccionMultipleValida(i.sintomatologiaDepresiva, VALOR_NINGUNO); },
    mensaje: 'Desde los 14 años aplique el tamizaje de sintomatología depresiva o seleccione "Ninguno".'
  },
  {
    codigo: 'RN-107',
    campo: 'ideacionSuicida',
    aplica: function (i, c) { return esMayorDe(c, 14); },
    valida: function (i) { return perteneceA(CAT_IDEACION_SUICIDA, i.ideacionSuicida) && i.ideacionSuicida !== VALOR_NO_APLICA; },
    mensaje: 'Desde los 14 años es obligatorio indagar sobre ideación o riesgo de suicidio.'
  },
  {
    codigo: 'RN-108',
    campo: 'consumoSpa',
    aplica: function (i, c) { return esMayorDe(c, 14); },
    valida: function (i) { return perteneceA(CAT_SI_NO, i.consumoSpa); },
    mensaje: function (i, c) {
      return edadEntre(c, 14 * 12, 17 * 12 + 11)
        ? 'En personas de 14 a 17 años pregunte si ha consumido alguna vez en su vida.'
        : 'Indique si ha tenido consumo de sustancias psicoactivas en los últimos tres meses.';
    }
  },
  {
    // Los puntajes son opcionales, pero deben ser numéricos y del instrumento que
    // corresponde a la edad (CRAFFT en adolescentes; AUDIT y ASSIST en adultos).
    codigo: 'RN-109',
    campo: 'puntajeCrafft',
    aplica: function (i) { return i.puntajeCrafft !== null && i.puntajeCrafft !== undefined && i.puntajeCrafft !== ''; },
    valida: function (i, c) {
      if (!esEnteroNoNegativo(i.puntajeCrafft)) return false;
      return edadEntre(c, UMBRALES_TAMIZAJE_SPA.crafft.edadMinMeses, UMBRALES_TAMIZAJE_SPA.crafft.edadMaxMeses);
    },
    mensaje: 'El CRAFFT se aplica a personas entre 14 y 17 años y su puntaje debe ser un entero.'
  },
  {
    codigo: 'RN-109',
    campo: 'puntajeAudit',
    aplica: function (i) { return i.puntajeAudit !== null && i.puntajeAudit !== undefined && i.puntajeAudit !== ''; },
    valida: function (i, c) {
      if (!esEnteroNoNegativo(i.puntajeAudit)) return false;
      return esMayorDe(c, 18);
    },
    mensaje: 'El AUDIT se aplica a personas de 18 años o más y su puntaje debe ser un entero.'
  },
  {
    codigo: 'RN-109',
    campo: 'puntajeAssist',
    aplica: function (i) { return i.puntajeAssist !== null && i.puntajeAssist !== undefined && i.puntajeAssist !== ''; },
    valida: function (i, c) {
      if (!esEnteroNoNegativo(i.puntajeAssist)) return false;
      return esMayorDe(c, 18);
    },
    mensaje: 'El ASSIST se aplica a personas de 18 años o más y su puntaje debe ser un entero.'
  },
  {
    codigo: 'RN-110',
    campo: 'limitacionCotidiana',
    valida: function (i) { return perteneceA(CAT_SI_NO, i.limitacionCotidiana); },
    mensaje: 'Indique si alguna situación de salud limitó sus actividades cotidianas en la última semana.'
  }
];

/* ---------------------------------------------------------
   3.7 BLOQUE 10 — Plan de cuidado (ítems 111-140)
   Las tres subsecciones son estructuralmente idénticas, así que
   las reglas de acciones y seguimientos se generan por fábrica.
   --------------------------------------------------------- */

function reglasDeAcciones(codigos) {
  return [
    {
      codigo: codigos.ejecutor,
      campo: 'ejecutor',
      valida: function (accion) {
        return perteneceA(CAT_TIPO_ID_EJECUTOR, accion.ejecutorTipoId) && !esVacio(accion.ejecutorNumeroId);
      },
      mensaje: 'Registre el tipo y número de identificación del integrante del EBS que ejecuta la acción.'
    },
    {
      /* El ejecutor de la acción se guarda en `aps.funcionario`, la misma
         tabla que el responsable de la ficha, y la restricción
         `func_formato_documento` le exige el mismo formato de RN-013. Aquí
         sólo se comprobaba que no estuviera vacío, así que un documento de
         cinco dígitos pasaba el cierre, entraba al historial y hacía estallar
         la transacción del servidor con un 500: el encuestador veía «no hubo
         respuesta del servidor» sobre un campo que nadie le había señalado. */
      codigo: codigos.ejecutor,
      campo: 'ejecutorNumeroId',
      aplica: function (accion) { return !esVacio(accion.ejecutorNumeroId); },
      valida: function (accion) {
        return documentoValidoParaTipo(accion.ejecutorTipoId, accion.ejecutorNumeroId);
      },
      mensaje: 'Número de documento inválido para el tipo seleccionado ' +
               '(CC: 6 a 10 dígitos; CD, CE y PT: 5 a 16 alfanuméricos).'
    },
    {
      codigo: codigos.accion,
      campo: 'codigoAccion',
      /* Aquí se comprueba la FORMA del código, no su existencia.

         Antes se exigía pertenecer a `CAT_ACCION_PLAN`, la lista corta de
         acciones de APS que descarga /api/catalogo_acciones. Servía cuando el
         campo era un desplegable de esas 64 opciones, pero el catálogo oficial
         tiene 10.044 procedimientos: comprobar contra la lista corta rechazaba
         como inválido cualquier CUPS legítimo que el profesional hubiera
         realizado, que es justo lo que el buscador vino a permitir.

         Enumerar los diez mil en el navegador no es alternativa —son varios
         megabytes en una visita domiciliaria—, así que la existencia la
         comprueba quien tiene la tabla delante: `api/_validacion.js` la
         contrasta contra `cat.cups` y devuelve un 400 que nombra el campo. En
         pantalla el aviso llega antes: el buscador muestra el nombre del
         procedimiento bajo el campo, y dice en el momento si el código no está
         en el catálogo.

         Los 10.044 códigos miden entre 6 y 9 caracteres alfanuméricos, con
         guion sólo en los NoCUPS. Es lo que se comprueba: descarta la prosa y
         el código a medio escribir sin rechazar ninguno de los válidos. */
      valida: function (accion) { return !esVacio(accion.codigoAccion); },
      mensaje: 'Registre el código CUPS o NoCUPS de la acción. Búsquelo escribiendo el código ' +
               'o el nombre del procedimiento.'
    },
    {
      /* Un código escrito pero mal formado no es lo mismo que uno ausente, y
         decirle «regístrelo» a quien ya escribió algo no ayuda: hay que
         mostrarle lo que escribió. */
      codigo: codigos.accion,
      campo: 'codigoAccion',
      aplica: function (accion) { return !esVacio(accion.codigoAccion); },
      valida: function (accion) {
        return FORMATO_CODIGO_ACCION.test(String(accion.codigoAccion).trim());
      },
      mensaje: function (accion) {
        return '«' + String(accion.codigoAccion).trim() + '» no tiene forma de código CUPS ni ' +
               'NoCUPS (6 a 9 caracteres). Búsquelo escribiendo el código o el nombre del ' +
               'procedimiento.';
      }
    },
    {
      codigo: codigos.respuesta,
      campo: 'tipoRespuesta',
      valida: function (accion) { return perteneceA(CAT_TIPO_RESPUESTA, accion.tipoRespuesta); },
      mensaje: 'Indique si la acción se ejecutó "En sitio" o fue "Derivada".'
    }
  ];
}

function reglasDeSeguimientos(codigos) {
  return [
    {
      codigo: codigos.responsable,
      campo: 'seguimientoEjecutor',
      valida: function (s) {
        return perteneceA(CAT_TIPO_ID_EJECUTOR, s.seguimientoTipoId) && !esVacio(s.seguimientoNumeroId);
      },
      mensaje: 'Registre la identificación del integrante del EBS responsable del seguimiento.'
    },
    {
      /* Mismo caso que el ejecutor de la acción: acaba en `aps.funcionario` y
         la base le exige el formato de RN-013. */
      codigo: codigos.responsable,
      campo: 'seguimientoNumeroId',
      aplica: function (s) { return !esVacio(s.seguimientoNumeroId); },
      valida: function (s) {
        return documentoValidoParaTipo(s.seguimientoTipoId, s.seguimientoNumeroId);
      },
      mensaje: 'Número de documento inválido para el tipo seleccionado ' +
               '(CC: 6 a 10 dígitos; CD, CE y PT: 5 a 16 alfanuméricos).'
    },
    {
      codigo: codigos.concertada,
      campo: 'accionConcertada',
      valida: function (s) { return !esVacio(s.accionConcertada); },
      mensaje: 'Documente la acción de cuidado concertada.'
    },
    {
      codigo: codigos.primero,
      campo: 'seg1',
      valida: function (s) {
        return esFechaValida(s.seg1Fecha) && perteneceA(CAT_ESTADO_SEGUIMIENTO, s.seg1Estado);
      },
      mensaje: 'Registre la fecha del primer seguimiento y su estado (C, CP o NC).'
    },
    {
      codigo: codigos.segundo,
      campo: 'seg2',
      aplica: function (s) { return !esVacio(s.seg2Fecha) || !esVacio(s.seg2Estado); },
      valida: function (s) {
        if (!esFechaValida(s.seg2Fecha) || !perteneceA(CAT_ESTADO_SEGUIMIENTO, s.seg2Estado)) return false;
        const dias = diferenciaEnDias(s.seg1Fecha, s.seg2Fecha);
        return dias !== null && dias > 0;
      },
      mensaje: 'El segundo seguimiento exige fecha válida posterior al primero y estado (C, CP o NC).'
    }
  ];
}

/* Definición de los tres planes con sus llaves heredadas y códigos de regla. */
const PLANES = [
  {
    nombre: 'planVivienda',
    etiqueta: 'Cuidado de la vivienda',
    llaves: [
      { codigo: 'RN-111', campo: 'codigoEbs', origen: 'equipoSaludId', etiqueta: 'código de EBS' },
      { codigo: 'RN-112', campo: 'codigoVivienda', origen: 'idHogar', etiqueta: 'código de vivienda' }
    ],
    codigosAccion: { ejecutor: 'RN-113', accion: 'RN-114', respuesta: 'RN-115' },
    codigosSeguimiento: { responsable: 'RN-116', concertada: 'RN-117', primero: 'RN-118', segundo: 'RN-119' }
  },
  {
    nombre: 'planFamilia',
    etiqueta: 'Cuidado de la familia',
    llaves: [
      { codigo: 'RN-120', campo: 'codigoEbs', origen: 'equipoSaludId', etiqueta: 'código de EBS' },
      { codigo: 'RN-121', campo: 'codigoVivienda', origen: 'idHogar', etiqueta: 'código de vivienda' },
      { codigo: 'RN-122', campo: 'codigoFamilia', origen: 'idFamilia', etiqueta: 'código de familia' }
    ],
    codigosAccion: { ejecutor: 'RN-123', accion: 'RN-124', respuesta: 'RN-125' },
    codigosSeguimiento: { responsable: 'RN-126', concertada: 'RN-127', primero: 'RN-128', segundo: 'RN-129' }
  },
  {
    nombre: 'planPersona',
    etiqueta: 'Cuidado de la persona',
    llaves: [
      { codigo: 'RN-130', campo: 'codigoEbs', origen: 'equipoSaludId', etiqueta: 'código de EBS' },
      { codigo: 'RN-131', campo: 'codigoVivienda', origen: 'idHogar', etiqueta: 'código de vivienda' },
      { codigo: 'RN-132', campo: 'codigoFamilia', origen: 'idFamilia', etiqueta: 'código de familia' },
      // RN-133 y RN-134: la persona intervenida debe ser un integrante ya
      // registrado en la sección 5, no una digitación libre.
      { codigo: 'RN-133', campo: 'tipoIdIntegrante', origen: 'tipoId', desdeContenedor: true, etiqueta: 'tipo de documento del integrante' },
      { codigo: 'RN-134', campo: 'numeroIdIntegrante', origen: 'numeroId', desdeContenedor: true, etiqueta: 'número de documento del integrante' }
    ],
    codigosAccion: { ejecutor: 'RN-135', accion: 'RN-136a', respuesta: 'RN-136b' },
    codigosSeguimiento: { responsable: 'RN-137', concertada: 'RN-138', primero: 'RN-139', segundo: 'RN-140' }
  }
];

/* =========================================================
   4. MOTOR DE VALIDACIÓN
   ========================================================= */

/* Detecta qué secciones del instrumento están presentes en los datos.
   Evita que las reglas de los ítems aún no capturados por la interfaz
   bloqueen la captura de los que sí lo están. */
function seccionesPresentes(datos) {
  return {
    ficha: true,
    vivienda: true,
    saneamiento: datos.fuenteAgua !== undefined || datos.actividadEconomica !== undefined,
    familia: Array.isArray(datos.familias) && datos.familias.length > 0,
    plan: datos.planVivienda !== undefined
  };
}

function mensajeDe(regla, args) {
  return typeof regla.mensaje === 'function' ? regla.mensaje.apply(null, args) : regla.mensaje;
}

function severidadDe(regla) {
  return regla.severidad || SEVERIDAD.BLOQUEO;
}

/* Evalúa un conjunto de reglas sobre unos argumentos y acumula los
   incumplimientos en `salida`. */
function evaluarConjunto(reglas, args, contexto, salida) {
  reglas.forEach(function (regla) {
    if (regla.aplica && !regla.aplica.apply(null, args)) return;
    if (regla.valida.apply(null, args)) return;

    salida.push({
      codigo: regla.codigo,
      campo: regla.campo,
      ruta: contexto.ruta ? contexto.ruta + '.' + regla.campo : regla.campo,
      mensaje: mensajeDe(regla, args),
      severidad: severidadDe(regla),
      ambito: contexto.ambito,
      referencia: contexto.referencia || null
    });
  });
}

function evaluarPlan(plan, contenedor, datos, contexto, salida) {
  const instancia = contenedor[plan.nombre];
  if (!instancia) return;

  // Llaves heredadas: deben coincidir exactamente con su origen (RN-111 a RN-134).
  plan.llaves.forEach(function (llave) {
    let esperado;
    if (llave.desdeContenedor) {
      esperado = contenedor[llave.origen];          // RN-133 / RN-134
    } else if (llave.origen === 'idFamilia') {
      /* RN-122 y RN-132 comparan contra la llave de la familia (RN-026), no
         contra el ítem 26 de la ficha, que es sólo un número de referencia.

         El plan de la familia cuelga de la familia y la encuentra en el
         contenedor; el de la persona cuelga del integrante, que no lleva ese
         código, así que se toma de la familia que lo contiene. Sin ese salto,
         RN-132 exigía el ítem 26 y ninguna ficha con plan de persona podía
         cerrarse. */
      const familia = contexto.familia || contenedor;
      esperado = familia.idFamilia || datos.idFamilia;
    } else {
      esperado = datos[llave.origen];
    }
    if (esVacio(esperado)) return;

    if (String(instancia[llave.campo] || '') !== String(esperado)) {
      salida.push({
        codigo: llave.codigo,
        campo: llave.campo,
        ruta: contexto.ruta + '.' + llave.campo,
        mensaje: 'El ' + llave.etiqueta + ' debe heredarse sin modificación (esperado: ' + esperado + ').',
        severidad: SEVERIDAD.BLOQUEO,
        ambito: AMBITO.PLAN,
        referencia: contexto.referencia || null
      });
    }
  });

  const reglasAccion = reglasDeAcciones(plan.codigosAccion);
  (instancia.acciones || []).forEach(function (accion, indice) {
    evaluarConjunto(reglasAccion, [accion, instancia, datos], {
      ruta: contexto.ruta + '.acciones[' + indice + ']',
      ambito: AMBITO.PLAN,
      referencia: contexto.referencia
    }, salida);
  });

  const reglasSeguimiento = reglasDeSeguimientos(plan.codigosSeguimiento);
  (instancia.seguimientos || []).forEach(function (seguimiento, indice) {
    evaluarConjunto(reglasSeguimiento, [seguimiento, instancia, datos], {
      ruta: contexto.ruta + '.seguimientos[' + indice + ']',
      ambito: AMBITO.PLAN,
      referencia: contexto.referencia
    }, salida);
  });
}

/* Recorre todas las reglas aplicables y devuelve los incumplimientos.
   RN-001: sin consentimiento la captura queda bloqueada, así que no
   tiene sentido evaluar el resto del formulario. */
function evaluarTodo(datos) {
  // El recorrido de familias e integrantes materializa el modelo de
  // cardinalidad de 'RN-000': cada bloque repetible se evalúa por instancia.
  if (datos.consentimiento === 'no') {
    return [{
      codigo: 'RN-001',
      campo: 'consentimiento',
      ruta: 'consentimiento',
      mensaje: 'Sin consentimiento informado no es posible registrar la captura de datos.',
      severidad: SEVERIDAD.BLOQUEO,
      ambito: AMBITO.FICHA,
      referencia: null
    }];
  }

  const secciones = seccionesPresentes(datos);
  const salida = [];

  evaluarConjunto(REGLAS_BLOQUE_1, [datos], { ambito: AMBITO.FICHA }, salida);
  evaluarConjunto(REGLAS_BLOQUE_2, [datos], { ambito: AMBITO.FICHA }, salida);
  evaluarConjunto(REGLAS_BLOQUE_3, [datos], { ambito: AMBITO.VIVIENDA }, salida);

  if (secciones.saneamiento) {
    evaluarConjunto(REGLAS_BLOQUE_4, [datos], { ambito: AMBITO.SANEAMIENTO }, salida);
  }

  if (secciones.familia) {
    // RN-028 — Tantas familias caracterizadas como declara el ítem 28.
    if (esEnteroPositivo(datos.hogaresEnVivienda) && datos.familias.length !== datos.hogaresEnVivienda) {
      salida.push({
        codigo: 'RN-028',
        campo: 'hogaresEnVivienda',
        ruta: 'hogaresEnVivienda',
        mensaje: 'Declaró ' + datos.hogaresEnVivienda + ' hogares y hay ' + datos.familias.length +
                 ' familias caracterizadas.',
        severidad: SEVERIDAD.BLOQUEO,
        ambito: AMBITO.VIVIENDA,
        referencia: null
      });
    }

    // RN-029 — Las personas de la vivienda no pueden ser menos que los integrantes.
    const totalIntegrantes = datos.familias.reduce(function (suma, familia) {
      return suma + (Array.isArray(familia.integrantes) ? familia.integrantes.length : 0);
    }, 0);
    if (esEnteroPositivo(datos.personasEnVivienda) && totalIntegrantes > datos.personasEnVivienda) {
      salida.push({
        codigo: 'RN-029',
        campo: 'personasEnVivienda',
        ruta: 'personasEnVivienda',
        mensaje: 'Hay ' + totalIntegrantes + ' integrantes caracterizados y sólo ' +
                 datos.personasEnVivienda + ' personas declaradas en la vivienda.',
        severidad: SEVERIDAD.BLOQUEO,
        ambito: AMBITO.VIVIENDA,
        referencia: null
      });
    }

    datos.familias.forEach(function (familia, indiceFamilia) {
      const rutaFamilia = 'familias[' + indiceFamilia + ']';
      const referenciaFamilia = 'Familia ' + (indiceFamilia + 1);

      evaluarConjunto(REGLAS_FAMILIA, [familia, datos], {
        ruta: rutaFamilia, ambito: AMBITO.FAMILIA, referencia: referenciaFamilia
      }, salida);

      (familia.integrantes || []).forEach(function (integrante, indiceIntegrante) {
        const contexto = contextoIntegrante(integrante, datos);
        evaluarConjunto(REGLAS_INTEGRANTE, [integrante, contexto, familia, datos], {
          ruta: rutaFamilia + '.integrantes[' + indiceIntegrante + ']',
          ambito: AMBITO.INTEGRANTE,
          referencia: referenciaFamilia + ' · ' + nombreIntegrante(integrante, indiceIntegrante)
        }, salida);

        if (secciones.plan) {
          evaluarPlan(PLANES[2], integrante, datos, {
            ruta: rutaFamilia + '.integrantes[' + indiceIntegrante + '].planPersona',
            referencia: referenciaFamilia + ' · ' + nombreIntegrante(integrante, indiceIntegrante),
            /* RN-132: el integrante no lleva el código de su familia. */
            familia: familia
          }, salida);
        }
      });

      if (secciones.plan) {
        evaluarPlan(PLANES[1], familia, datos, {
          ruta: rutaFamilia + '.planFamilia',
          referencia: referenciaFamilia
        }, salida);
      }
    });
  }

  if (secciones.plan) {
    evaluarPlan(PLANES[0], datos, datos, { ruta: 'planVivienda', referencia: null }, salida);
  }

  return salida;
}

/**
 * Devuelve los incumplimientos que impiden continuar.
 * Mantiene el contrato original: {codigo, campo, mensaje}, más `ruta`,
 * `severidad`, `ambito` y `referencia` como información adicional.
 */
function validarReglas(datos) {
  return evaluarTodo(datos).filter(function (item) {
    return item.severidad === SEVERIDAD.BLOQUEO;
  });
}

/** Devuelve las advertencias: no bloquean, pero exigen confirmación. */
function evaluarAdvertencias(datos) {
  return evaluarTodo(datos).filter(function (item) {
    return item.severidad === SEVERIDAD.ADVERTENCIA;
  });
}

/**
 * RN-002 — Determina si la situación registrada exige atención prioritaria.
 */
function requiereAtencionPrioritaria(valorSituacion) {
  const opcion = opcionDe(CAT_SITUACION_INMINENTE, valorSituacion);
  return !!(opcion && opcion.prioritaria);
}

/* =========================================================
   5. REGLAS DE DECISIÓN CLÍNICA (RN-200 a RN-212)
   Convierten los hallazgos en alertas con nivel de prioridad,
   plan de destino y obligación de canalización.
   ========================================================= */

function prioridadMayor(a, b) {
  if (!a) return b;
  if (!b) return a;
  return ORDEN_PRIORIDAD[a] >= ORDEN_PRIORIDAD[b] ? a : b;
}

/* RN-200 — Eleva una prioridad un nivel (usado por las reglas de concurrencia). */
function elevarPrioridad(prioridad) {
  if (prioridad === PRIORIDAD.REGULAR) return PRIORIDAD.PRIORITARIA;
  if (prioridad === PRIORIDAD.PRIORITARIA) return PRIORIDAD.INMEDIATA;
  return prioridad;
}

/* 'RN-200' — Toda alerta se construye con nivel de prioridad, plan de destino
   y plazo máximo de respuesta. El plazo se deriva del nivel, no se digita. */
function crearAlerta(codigo, prioridad, titulo, descripcion, opciones) {
  const extra = opciones || {};
  return {
    codigo: codigo,
    prioridad: prioridad,
    titulo: titulo,
    descripcion: descripcion,
    plan: extra.plan || 'persona',        // vivienda | familia | persona
    ruta: extra.ruta || null,
    referencia: extra.referencia || null,
    notificaSivigila: extra.notificaSivigila === true,
    bloqueaSincronizacion: extra.bloqueaSincronizacion === true,
    plazoDias: PLAZO_DIAS_PRIORIDAD[prioridad] || null
  };
}

/* --- RN-201 — Urgencia vital detectada al inicio --- */
function alertasUrgenciaVital(datos) {
  if (!requiereAtencionPrioritaria(datos.situacionInminente)) return [];
  const etiqueta = etiquetaDeCatalogo(CAT_SITUACION_INMINENTE, datos.situacionInminente);
  return [crearAlerta(
    'RN-201', PRIORIDAD.INMEDIATA,
    'Urgencia vital en el entorno',
    'Se identificó: ' + etiqueta + '. Suspenda la captura, active la ruta de urgencias (línea 123, traslado u organismo de socorro) y registre la conducta adoptada.',
    { plan: 'vivienda', ruta: 'situacionInminente' }
  )];
}

/* --- RN-211 — Riesgo del entorno y la vivienda --- */
function alertasEntorno(datos) {
  const alertas = [];
  const hacinamiento = evaluarHacinamiento(datos.personasEnVivienda, datos.habitacionesVivienda);

  if (hacinamiento.hacinamiento === 'si') {
    alertas.push(crearAlerta(
      'RN-211', hacinamiento.prioridad,
      hacinamiento.critico ? 'Hacinamiento crítico' : 'Hacinamiento',
      'La vivienda registra ' + hacinamiento.personasPorHabitacion + ' personas por habitación. ' +
      'Riesgo de transmisión respiratoria (TB, ERA): registre intervención en el plan de la vivienda.',
      { plan: 'vivienda', ruta: 'hacinamiento' }
    ));
  }

  const agua = opcionDe(CAT_FUENTE_AGUA, datos.fuenteAgua);
  if (agua && agua.noSegura) {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.PRIORITARIA,
      'Agua no apta para consumo humano',
      'Fuente registrada: ' + agua.etiqueta + '. Canalice a tratamiento del agua y vigilancia sanitaria.',
      { plan: 'vivienda', ruta: 'fuenteAgua' }
    ));
  }

  const excretas = opcionDe(CAT_DISPOSICION_EXCRETAS, datos.disposicionExcretas);
  if (excretas && excretas.critica) {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.PRIORITARIA,
      'Disposición inadecuada de excretas',
      'Sistema registrado: ' + excretas.etiqueta + '. Canalice a saneamiento básico.',
      { plan: 'vivienda', ruta: 'disposicionExcretas' }
    ));
  }

  const residuales = opcionDe(CAT_AGUAS_RESIDUALES, datos.aguasResiduales);
  if (residuales && residuales.critica) {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.REGULAR,
      'Disposición inadecuada de aguas residuales',
      'Sistema registrado: ' + residuales.etiqueta + '.',
      { plan: 'vivienda', ruta: 'aguasResiduales' }
    ));
  }

  const residuos = opcionDe(CAT_RESIDUOS_SOLIDOS, datos.residuosSolidos);
  if (residuos && residuos.critica) {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.REGULAR,
      'Disposición inadecuada de residuos sólidos',
      'Manejo registrado: ' + residuos.etiqueta + '.',
      { plan: 'vivienda', ruta: 'residuosSolidos' }
    ));
  }

  if (datos.vectores === 'si') {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.PRIORITARIA,
      'Criaderos o reservorios de vectores',
      'Registre acción de control vectorial en el plan de cuidado de la vivienda.',
      { plan: 'vivienda', ruta: 'vectores' }
    ));
  }

  if (datos.materialTecho === 'fibrocemento_con_asbesto') {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.PRIORITARIA,
      'Techo con asbesto',
      'La cubierta contiene asbesto. Canalice a valoración de riesgo ambiental.',
      { plan: 'vivienda', ruta: 'materialTecho' }
    ));
  } else if (datos.materialTecho === 'desechos' || datos.materialTecho === 'palma_paja') {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.REGULAR,
      'Cubierta en material precario',
      'Material del techo: ' + etiquetaDeCatalogo(CAT_MATERIAL_TECHO, datos.materialTecho) + '.',
      { plan: 'vivienda', ruta: 'materialTecho' }
    ));
  }

  // Los riesgos locativos sólo elevan prioridad si hay menores de 5 o mayores de 70.
  if (tieneHallazgo(datos.riesgosAccidente, VALOR_NINGUNO) && hayPoblacionVulnerableLocativa(datos)) {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.PRIORITARIA,
      'Riesgos de accidente con población vulnerable',
      'La vivienda registra riesgos locativos y habitan menores de 5 años o personas mayores de 70.',
      { plan: 'vivienda', ruta: 'riesgosAccidente' }
    ));
  }

  // RN-042 / RN-044 / RN-045 — Déficit de cobertura antirrábica.
  const perrosSinVacuna = (datos.perros || 0) - (datos.perrosVacunados || 0);
  const gatosSinVacuna = (datos.gatos || 0) - (datos.gatosVacunados || 0);
  if (perrosSinVacuna > 0 || gatosSinVacuna > 0 || datos.carnetAntirrabico === 'no') {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.REGULAR,
      'Riesgo de rabia por mascota no inmunizada',
      'Sin vacuna antirrábica vigente: ' + Math.max(perrosSinVacuna, 0) + ' perro(s) y ' +
      Math.max(gatosSinVacuna, 0) + ' gato(s). Canalice a jornada de vacunación antirrábica.',
      { plan: 'vivienda', ruta: 'carnetAntirrabico' }
    ));
  }

  // RN-031 — Déficit de elementos para dormir.
  if (esEnteroNoNegativo(datos.elementosParaDormir) && esEnteroPositivo(datos.personasEnVivienda) &&
      datos.elementosParaDormir < datos.personasEnVivienda / 2) {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.REGULAR,
      'Déficit de elementos para dormir',
      'Hay ' + datos.elementosParaDormir + ' elementos para ' + datos.personasEnVivienda + ' personas.',
      { plan: 'vivienda', ruta: 'elementosParaDormir' }
    ));
  }

  // Regla de concurrencia: tres o más hallazgos elevan el entorno a alto riesgo.
  if (alertas.length >= 3) {
    alertas.push(crearAlerta(
      'RN-211', PRIORIDAD.PRIORITARIA,
      'Entorno de alto riesgo sanitario',
      'La vivienda acumula ' + alertas.length + ' hallazgos ambientales. Programe visita de seguimiento dentro de 30 días.',
      { plan: 'vivienda', ruta: 'vivienda' }
    ));
  }

  return alertas;
}

function hayPoblacionVulnerableLocativa(datos) {
  if (!Array.isArray(datos.familias)) return false;
  return datos.familias.some(function (familia) {
    return (familia.integrantes || []).some(function (integrante) {
      const contexto = contextoIntegrante(integrante, datos);
      return edadEntre(contexto, 0, 59) || esMayorDe(contexto, 70);
    });
  });
}

/* --- RN-212 — Sobrecarga del cuidador --- */
function alertasFamilia(familia, datos, referencia, ruta) {
  const alertas = [];

  if (familia.cuidadorPrincipal === 'si') {
    const zarit = opcionDe(CAT_ZARIT, familia.zarit);
    if (zarit && zarit.prioridad) {
      let prioridad = zarit.prioridad;

      // La sobrecarga intensa se eleva si el cuidador presenta síntomas o ideación.
      if (familia.zarit === 'intensa' && cuidadorConRiesgoMental(familia, datos)) {
        prioridad = PRIORIDAD.INMEDIATA;
      }

      alertas.push(crearAlerta(
        'RN-212', prioridad,
        'Sobrecarga del cuidador',
        zarit.etiqueta + '. Canalice a apoyo psicosocial y evalúe relevo del cuidado.',
        { plan: 'familia', ruta: ruta + '.zarit', referencia: referencia }
      ));
    }

    // Protección de la persona cuidada: sobrecarga intensa + abandono o negligencia.
    if (familia.zarit === 'intensa' && contiene(familia.situacionesRiesgo, 'abandono')) {
      alertas.push(crearAlerta(
        'RN-206', PRIORIDAD.PRIORITARIA,
        'Riesgo de negligencia hacia la persona cuidada',
        'Concurre sobrecarga intensa del cuidador con situación de abandono. Active la ruta de violencias.',
        { plan: 'familia', ruta: ruta + '.situacionesRiesgo', referencia: referencia, notificaSivigila: true }
      ));
    }
  }

  return alertas;
}

function cuidadorConRiesgoMental(familia, datos) {
  return (familia.integrantes || []).some(function (integrante) {
    return integrante.ideacionSuicida === IDEACION_CON_RIESGO ||
           tieneHallazgo(integrante.sintomatologiaDepresiva, VALOR_NINGUNO);
  });
}

/* --- Alertas del individuo (RN-202 a RN-210) --- */
function alertasIntegrante(integrante, contexto, familia, datos, referencia, ruta) {
  const alertas = [];

  /* RN-202 — Riesgo de suicidio. Única alerta que bloquea la sincronización. */
  if (integrante.ideacionSuicida === IDEACION_CON_RIESGO) {
    let descripcion = 'No deje sola a la persona. Contacte la línea de salud mental y derive a valoración por psicología o psiquiatría el mismo día. Notificación obligatoria a SIVIGILA.';
    if (contiene(familia.situacionesRiesgo, 'antecedente_suicidio')) {
      descripcion += ' La familia registra antecedentes de intento o muerte por suicidio: extienda la intervención al núcleo.';
    }
    alertas.push(crearAlerta(
      'RN-202', PRIORIDAD.INMEDIATA, 'Riesgo de suicidio', descripcion,
      { ruta: ruta + '.ideacionSuicida', referencia: referencia, notificaSivigila: true, bloqueaSincronizacion: true }
    ));
  }

  /* RN-203 — Tensión arterial. */
  const clasificacionTension = opcionDe(CAT_CLASIFICACION_TENSION, integrante.clasificacionTension);
  if (clasificacionTension && clasificacionTension.prioridad) {
    let prioridad = clasificacionTension.prioridad;

    // Hipertenso ya diagnosticado y sin adherencia: sube un nivel.
    const esCardiovascular = (integrante.enfermedadesNoTransmisibles || []).some(function (valor) {
      const opcion = opcionDe(CAT_ENFERMEDADES_NO_TRANSMISIBLES, valor);
      return !!(opcion && opcion.cardiovascular);
    });
    if (esCardiovascular && integrante.adherenciaTratamiento === 'no') {
      prioridad = elevarPrioridad(prioridad);
    }

    alertas.push(crearAlerta(
      'RN-203', prioridad,
      integrante.clasificacionTension === 'crisis' ? 'Crisis hipertensiva' : 'Tensión arterial alterada',
      clasificacionTension.etiqueta,
      { ruta: ruta + '.clasificacionTension', referencia: referencia }
    ));
  }

  /* RN-204 — Estado nutricional. */
  const antropometria = opcionDe(CAT_CLASIFICACION_ANTROPOMETRICA, integrante.clasificacionAntropometrica);
  if (antropometria && antropometria.prioridad) {
    let prioridad = antropometria.prioridad;
    let descripcion = antropometria.etiqueta;

    // Cualquier signo físico en menores de 5 años eleva a inmediata.
    const haySignos = tieneHallazgo(integrante.signosDesnutricion, VALOR_NINGUNA);
    if (haySignos && edadEntre(contexto, 0, 60)) {
      prioridad = PRIORIDAD.INMEDIATA;
      descripcion += ' Con signos físicos de desnutrición aguda en menor de 5 años.';
    }
    if (contiene(integrante.signosDesnutricion, 'edema')) {
      prioridad = PRIORIDAD.INMEDIATA;
      descripcion += ' El edema indica desnutrición aguda severa: remisión hospitalaria inmediata.';
    }

    alertas.push(crearAlerta(
      'RN-204', prioridad, 'Alteración del estado nutricional', descripcion,
      {
        ruta: ruta + '.clasificacionAntropometrica',
        referencia: referencia,
        notificaSivigila: prioridad === PRIORIDAD.INMEDIATA && edadEntre(contexto, 0, 60)
      }
    ));
  }

  /* RN-205 — Gestación. */
  if (contexto.gestante) {
    let prioridad = PRIORIDAD.PRIORITARIA;
    const motivos = [];

    if (contexto.edadAnios !== null && contexto.edadAnios < 15) { prioridad = PRIORIDAD.INMEDIATA; motivos.push('gestante menor de 15 años'); }
    if (contiene(integrante.atencionesPendientesMaterno, 'control_prenatal')) {
      prioridad = PRIORIDAD.INMEDIATA; motivos.push('sin controles prenatales');
    }
    if (clasificacionTension && clasificacionTension.prioridad) { prioridad = PRIORIDAD.INMEDIATA; motivos.push('hipertensión'); }
    if (antropometria && antropometria.prioridad) { prioridad = PRIORIDAD.INMEDIATA; motivos.push('alteración nutricional'); }
    if (!listaVacia(integrante.modalidadViolencia)) { prioridad = PRIORIDAD.INMEDIATA; motivos.push('violencia registrada'); }

    alertas.push(crearAlerta(
      'RN-205', prioridad, 'Gestación confirmada',
      'Active la Ruta Integral de Atención Materno Perinatal.' +
      (motivos.length ? ' Factores que elevan la prioridad: ' + motivos.join(', ') + '.' : ''),
      { ruta: ruta + '.gestacionActual', referencia: referencia }
    ));

    // Gestante menor de 14 años: presunción legal de delito sexual.
    if (contexto.edadAnios !== null && contexto.edadAnios < 14) {
      alertas.push(crearAlerta(
        'RN-206', PRIORIDAD.INMEDIATA, 'Presunto delito sexual',
        'Gestante menor de 14 años: presunción legal de no consentimiento. Active la ruta de violencia sexual y reporte al ICBF.',
        { ruta: ruta + '.gestacionActual', referencia: referencia, notificaSivigila: true }
      ));
    }
  }

  /* RN-206 — Violencias. */
  if (tieneViolencia(integrante) || contiene(familia.situacionesRiesgo, 'violencia')) {
    let prioridad = PRIORIDAD.PRIORITARIA;
    const motivos = [];

    if (contiene(integrante.modalidadViolencia, MODALIDAD_VIOLENCIA_SEXUAL)) {
      prioridad = PRIORIDAD.INMEDIATA; motivos.push('modalidad sexual');
    }
    const esMenor = contexto.edadAnios !== null && contexto.edadAnios < 18;
    if (esMenor) { prioridad = PRIORIDAD.INMEDIATA; motivos.push('víctima menor de 18 años'); }

    alertas.push(crearAlerta(
      'RN-206', prioridad, 'Víctima de violencia',
      'Active la Ruta de Atención Integral para Víctimas de Violencias (atención en las primeras 72 horas). ' +
      (esMenor ? 'Reporte obligatorio al ICBF por presunta vulneración de derechos. ' : '') +
      'No indague en presencia del presunto agresor.' +
      (motivos.length ? ' Motivos de prioridad: ' + motivos.join(', ') + '.' : ''),
      { ruta: ruta + '.modalidadViolencia', referencia: referencia, notificaSivigila: true }
    ));
  }

  /* RN-207 — Sintomatología depresiva y ansiosa. */
  const sintomas = (integrante.sintomatologiaDepresiva || []).filter(function (valor) {
    return valor !== VALOR_NINGUNO;
  });
  if (sintomas.length > 0) {
    let prioridad = sintomas.length >= 2 ? PRIORIDAD.PRIORITARIA : PRIORIDAD.REGULAR;

    if (integrante.ideacionSuicida === IDEACION_CON_RIESGO) {
      prioridad = PRIORIDAD.INMEDIATA;
    }
    const tieneTrastorno = contiene(integrante.enfermedadesNoTransmisibles, 'trastorno_mental');
    if (tieneTrastorno && integrante.adherenciaTratamiento === 'no') {
      prioridad = elevarPrioridad(prioridad);
    }

    alertas.push(crearAlerta(
      'RN-207', prioridad, 'Sintomatología depresiva o ansiosa',
      sintomas.length + ' síntoma(s) sostenido(s) por más de dos semanas. Canalice a valoración por psicología.',
      { ruta: ruta + '.sintomatologiaDepresiva', referencia: referencia }
    ));
  }

  /* RN-208 — Enfermedades transmisibles de notificación obligatoria. */
  (integrante.condicionesTransmisibles || []).forEach(function (valor) {
    const condicion = opcionDe(CAT_CONDICIONES_TRANSMISIBLES, valor);
    if (!condicion || valor === VALOR_NINGUNA) return;

    let descripcion = condicion.etiqueta + '.';
    if (condicion.contactos) {
      descripcion += ' Estudio de contactos obligatorio: genere tamizaje para todos los integrantes de la vivienda.';
    }
    if (condicion.vectorial) {
      descripcion += ' Cruce con el ítem 37 y registre acción de control vectorial en el plan de la vivienda.';
    }

    alertas.push(crearAlerta(
      'RN-208', condicion.prioridad, 'Evento de interés en salud pública', descripcion,
      { ruta: ruta + '.condicionesTransmisibles', referencia: referencia, notificaSivigila: condicion.notifica === true }
    ));
  });

  (integrante.zonaEndemica || []).forEach(function (valor) {
    const evento = opcionDe(CAT_ZONA_ENDEMICA, valor);
    if (!evento || valor === VALOR_NINGUNA) return;
    alertas.push(crearAlerta(
      'RN-208', evento.prioridad, 'Evento endémico', evento.etiqueta + '.',
      { ruta: ruta + '.zonaEndemica', referencia: referencia, notificaSivigila: evento.notifica === true }
    ));
  });

  /* RN-209 — Ausencia de afiliación al SGSSS. */
  if (integrante.regimenAfiliacion === REGIMEN_NO_AFILIADO) {
    // Si concurre cualquier alerta clínica, la afiliación no puede diferir la atención.
    const hayAlertaClinica = alertas.some(function (alerta) {
      return ['RN-202', 'RN-203', 'RN-204', 'RN-205', 'RN-206', 'RN-207', 'RN-208'].indexOf(alerta.codigo) !== -1;
    });
    const prioridad = hayAlertaClinica ? PRIORIDAD.INMEDIATA : PRIORIDAD.PRIORITARIA;

    let descripcion = 'Registre acción de gestión de afiliación con verificación en el primer seguimiento.';
    if (hayAlertaClinica) {
      descripcion += ' Concurre una alerta clínica: la atención inicial de urgencias es obligatoria por ley con independencia del aseguramiento.';
    }
    if (contexto.tipoId && contexto.tipoId.sinDocumento) {
      descripcion += ' La persona carece de documento: canalice primero a Registraduría.';
    }

    alertas.push(crearAlerta(
      'RN-209', prioridad, 'Persona no afiliada al SGSSS', descripcion,
      { ruta: ruta + '.regimenAfiliacion', referencia: referencia }
    ));
  }

  /* RN-063 — Barrera de identificación. */
  if (contexto.tipoId && contexto.tipoId.sinDocumento) {
    alertas.push(crearAlerta(
      'RN-209', PRIORIDAD.PRIORITARIA, 'Barrera de identificación',
      'Persona sin documento de identidad (' + contexto.tipoId.valor + '). Canalice a Registraduría: es condición previa para la afiliación.',
      { ruta: ruta + '.tipoId', referencia: referencia }
    ));
  }

  /* RN-210 — Barreras de acceso efectivo. */
  const barreras = (integrante.barrerasAcceso || []).concat(integrante.motivoNoTratamiento || []);
  const tiposBarrera = {};
  barreras.forEach(function (valor) {
    if (valor === VALOR_NINGUNA || valor === VALOR_NO_APLICA) return;
    const barrera = opcionDe(CAT_BARRERAS_ACCESO, valor) || opcionDe(CAT_MOTIVO_NO_TRATAMIENTO, valor);
    if (!barrera || !barrera.tipo) return;
    tiposBarrera[barrera.tipo] = prioridadMayor(tiposBarrera[barrera.tipo], barrera.prioridad);
  });

  Object.keys(tiposBarrera).forEach(function (tipo) {
    alertas.push(crearAlerta(
      'RN-210', tiposBarrera[tipo], 'Barrera de acceso (' + tipo + ')',
      GESTION_POR_BARRERA[tipo] || 'Registre la gestión correspondiente.',
      { ruta: ruta + '.barrerasAcceso', referencia: referencia }
    ));
  });

  /* RN-109 — Consumo problemático de SPA por encima del umbral. */
  const tamizajes = [
    { campo: 'puntajeCrafft', config: UMBRALES_TAMIZAJE_SPA.crafft },
    { campo: 'puntajeAudit', config: UMBRALES_TAMIZAJE_SPA.audit },
    { campo: 'puntajeAssist', config: UMBRALES_TAMIZAJE_SPA.assist }
  ];
  tamizajes.forEach(function (tamizaje) {
    const puntaje = integrante[tamizaje.campo];
    if (!esEnteroNoNegativo(puntaje) || puntaje < tamizaje.config.umbral) return;
    alertas.push(crearAlerta(
      'RN-207', PRIORIDAD.PRIORITARIA, 'Consumo problemático de SPA',
      tamizaje.config.etiqueta + ' con puntaje ' + puntaje + ' (umbral ' + tamizaje.config.umbral +
      '). Derive a valoración por salud mental.',
      { ruta: ruta + '.' + tamizaje.campo, referencia: referencia }
    ));
  });

  /* RN-074 — Desescolarización en edad escolar. */
  if (integrante.nivelEducativo === 'ninguno' && edadEntre(contexto, 5 * 12, 17 * 12 + 11)) {
    alertas.push(crearAlerta(
      'RN-210', PRIORIDAD.REGULAR, 'Desescolarización',
      'Persona en edad escolar sin nivel educativo alcanzado. Canalice a la Secretaría de Educación.',
      { ruta: ruta + '.nivelEducativo', referencia: referencia }
    ));
  }

  /* RN-073 — Posible trabajo infantil o adolescente. */
  if (!esVacio(integrante.ocupacion) && edadEntre(contexto, 15 * 12, 17 * 12 + 11)) {
    alertas.push(crearAlerta(
      'RN-210', PRIORIDAD.REGULAR, 'Posible trabajo adolescente',
      'Adolescente con ocupación registrada. Verifique las condiciones de protección laboral (Ley 1098 de 2006).',
      { ruta: ruta + '.ocupacion', referencia: referencia }
    ));
  }

  /* RN-083 — Discapacidad sin certificación RLCPD. */
  if (tieneHallazgo(integrante.discapacidad, SIN_DISCAPACIDAD) && integrante.certificacionRlcpd === 'no') {
    alertas.push(crearAlerta(
      'RN-210', PRIORIDAD.REGULAR, 'Discapacidad sin certificar',
      'Canalice a certificación y registro de discapacidad (RLCPD).',
      { ruta: ruta + '.certificacionRlcpd', referencia: referencia }
    ));
  }

  return alertas;
}

const GESTION_POR_BARRERA = {
  administrativa: 'Gestión ante la EAPB con número de radicado.',
  aseguramiento: 'Gestión de afiliación al SGSSS (ver RN-209).',
  geografica: 'Programe atención extramural o telesalud.',
  informacion: 'Educación en salud sobre derechos y gratuidad de las intervenciones.',
  cultural: 'Canalice con enfoque diferencial.',
  dependencia: 'Programe atención domiciliaria.'
};

/**
 * RN-200 a RN-212 — Evalúa todas las reglas de decisión clínica.
 * Devuelve las alertas ordenadas de mayor a menor prioridad.
 */
function evaluarAlertas(datos) {
  if (datos.consentimiento === 'no') return [];

  let alertas = alertasUrgenciaVital(datos).concat(alertasEntorno(datos));

  (datos.familias || []).forEach(function (familia, indiceFamilia) {
    const rutaFamilia = 'familias[' + indiceFamilia + ']';
    const referenciaFamilia = 'Familia ' + (indiceFamilia + 1);

    alertas = alertas.concat(alertasFamilia(familia, datos, referenciaFamilia, rutaFamilia));

    (familia.integrantes || []).forEach(function (integrante, indiceIntegrante) {
      const contexto = contextoIntegrante(integrante, datos);
      const referencia = referenciaFamilia + ' · ' + nombreIntegrante(integrante, indiceIntegrante);
      const ruta = rutaFamilia + '.integrantes[' + indiceIntegrante + ']';
      alertas = alertas.concat(alertasIntegrante(integrante, contexto, familia, datos, referencia, ruta));
    });
  });

  // RN-208 — La tuberculosis convierte a todos los convivientes en contactos.
  alertas = alertas.concat(alertasContactosTuberculosis(datos));

  return alertas.sort(function (a, b) {
    return ORDEN_PRIORIDAD[b.prioridad] - ORDEN_PRIORIDAD[a.prioridad];
  });
}

function alertasContactosTuberculosis(datos) {
  const hayCaso = (datos.familias || []).some(function (familia) {
    return (familia.integrantes || []).some(function (integrante) {
      return contiene(integrante.condicionesTransmisibles, CONDICION_TUBERCULOSIS);
    });
  });
  if (!hayCaso) return [];

  const hacinamiento = evaluarHacinamiento(datos.personasEnVivienda, datos.habitacionesVivienda);
  const prioridad = hacinamiento.hacinamiento === 'si' ? PRIORIDAD.PRIORITARIA : PRIORIDAD.REGULAR;
  const alertas = [];

  (datos.familias || []).forEach(function (familia, indiceFamilia) {
    (familia.integrantes || []).forEach(function (integrante, indiceIntegrante) {
      if (contiene(integrante.condicionesTransmisibles, CONDICION_TUBERCULOSIS)) return;
      alertas.push(crearAlerta(
        'RN-208', prioridad, 'Contacto de tuberculosis',
        'Convive con un caso de tuberculosis. Genere acción de tamizaje.' +
        (hacinamiento.hacinamiento === 'si' ? ' El hacinamiento eleva la prioridad.' : ''),
        {
          ruta: 'familias[' + indiceFamilia + '].integrantes[' + indiceIntegrante + ']',
          referencia: 'Familia ' + (indiceFamilia + 1) + ' · ' + nombreIntegrante(integrante, indiceIntegrante)
        }
      ));
    });
  });

  return alertas;
}

/* =========================================================
   6. REGLAS DE CIERRE E INTEGRIDAD (RN-220 a RN-226)
   ========================================================= */

/* Cuenta las acciones registradas en un plan, incluidas las marcadas
   expresamente como "No procede" (RN-220). */
function accionesRegistradas(plan) {
  if (!plan) return 0;
  return (plan.acciones || []).filter(function (accion) {
    return !esVacio(accion.codigoAccion);
  }).length;
}

/**
 * RN-220 — Toda alerta debe producir al menos una acción en el plan que
 * le corresponde. Devuelve las alertas que quedaron sin respuesta.
 */
function verificarTrazabilidadAlertas(datos, alertas) {
  const listaAlertas = alertas || evaluarAlertas(datos);
  const sinAccion = [];

  const hayAccionVivienda = accionesRegistradas(datos.planVivienda) > 0;

  listaAlertas.forEach(function (alerta) {
    let atendida = false;

    if (alerta.plan === 'vivienda') {
      atendida = hayAccionVivienda;
    } else if (alerta.plan === 'familia') {
      atendida = (datos.familias || []).some(function (familia) {
        return accionesRegistradas(familia.planFamilia) > 0;
      });
    } else {
      atendida = (datos.familias || []).some(function (familia) {
        return (familia.integrantes || []).some(function (integrante) {
          return accionesRegistradas(integrante.planPersona) > 0;
        });
      });
    }

    // Se conserva la alerta original y se marca la regla de trazabilidad
    // incumplida, para que el resumen de cierre pueda citar ambas.
    if (!atendida) {
      sinAccion.push(Object.assign({}, alerta, { reglaTrazabilidad: 'RN-220' }));
    }
  });

  return sinAccion;
}

/**
 * RN-221 — Semaforización del riesgo familiar.
 * Agrega las alertas de la vivienda y de cada familia en una clasificación
 * que determina la periodicidad del seguimiento.
 */
function clasificarRiesgoFamiliar(datos, alertas) {
  const listaAlertas = alertas || evaluarAlertas(datos);

  const inmediatas = listaAlertas.filter(function (a) { return a.prioridad === PRIORIDAD.INMEDIATA; }).length;
  const prioritarias = listaAlertas.filter(function (a) { return a.prioridad === PRIORIDAD.PRIORITARIA; }).length;
  const regulares = listaAlertas.filter(function (a) { return a.prioridad === PRIORIDAD.REGULAR; }).length;

  const conteo = { inmediatas: inmediatas, prioritarias: prioritarias, regulares: regulares };

  if (inmediatas > 0 || prioritarias >= 3) {
    return Object.assign({ regla: 'RN-221', nivel: 'alto', etiqueta: 'Riesgo alto',
      diasSeguimiento: 30, gestorDeCaso: true }, conteo);
  }
  if (prioritarias > 0) {
    return Object.assign({ regla: 'RN-221', nivel: 'medio', etiqueta: 'Riesgo medio',
      diasSeguimiento: 90, gestorDeCaso: false }, conteo);
  }
  if (regulares > 0) {
    return Object.assign({ regla: 'RN-221', nivel: 'bajo', etiqueta: 'Riesgo bajo',
      diasSeguimiento: 180, gestorDeCaso: false }, conteo);
  }
  return Object.assign({ regla: 'RN-221', nivel: 'sin_riesgo', etiqueta: 'Sin riesgo identificado',
    diasSeguimiento: 365, gestorDeCaso: false }, conteo);
}

/**
 * RN-226 — Verifica los plazos de los seguimientos del plan de cuidado
 * frente al nivel de prioridad de la alerta que los originó.
 */
function validarSeguimientos(datos, alertas) {
  const listaAlertas = alertas || evaluarAlertas(datos);
  const prioridadMaxima = listaAlertas.reduce(function (acumulado, alerta) {
    return prioridadMayor(acumulado, alerta.prioridad);
  }, null);

  const hallazgos = [];
  if (!prioridadMaxima) return hallazgos;

  const plazo = PLAZO_DIAS_PRIORIDAD[prioridadMaxima];

  function revisar(plan, ruta, referencia) {
    if (!plan) return;
    (plan.seguimientos || []).forEach(function (seguimiento, indice) {
      const dias = diferenciaEnDias(datos.fechaDiligenciamiento, seguimiento.seg1Fecha);
      if (dias !== null && dias > plazo) {
        hallazgos.push({
          codigo: 'RN-226',
          ruta: ruta + '.seguimientos[' + indice + '].seg1Fecha',
          referencia: referencia,
          mensaje: 'El primer seguimiento excede el plazo de ' + plazo + ' días exigido por la prioridad ' +
                   prioridadMaxima + '.'
        });
      }

      // Un NC sobre una alerta urgente reactiva la alerta original.
      const esUrgente = prioridadMaxima === PRIORIDAD.INMEDIATA || prioridadMaxima === PRIORIDAD.PRIORITARIA;
      if (esUrgente && (seguimiento.seg1Estado === 'NC' || seguimiento.seg2Estado === 'NC')) {
        hallazgos.push({
          codigo: 'RN-226',
          ruta: ruta + '.seguimientos[' + indice + '].seg2Estado',
          referencia: referencia,
          mensaje: 'Incumplimiento (NC) sobre una acción derivada de alerta ' + prioridadMaxima +
                   '. Reformule la acción concertada o escale el caso a la EAPB.'
        });
      }
    });
  }

  revisar(datos.planVivienda, 'planVivienda', null);
  (datos.familias || []).forEach(function (familia, indiceFamilia) {
    const referencia = 'Familia ' + (indiceFamilia + 1);
    revisar(familia.planFamilia, 'familias[' + indiceFamilia + '].planFamilia', referencia);
    (familia.integrantes || []).forEach(function (integrante, indiceIntegrante) {
      revisar(
        integrante.planPersona,
        'familias[' + indiceFamilia + '].integrantes[' + indiceIntegrante + '].planPersona',
        referencia + ' · ' + nombreIntegrante(integrante, indiceIntegrante)
      );
    });
  });

  return hallazgos;
}

/**
 * RN-222 — Validación de completitud para el cierre de la ficha.
 * Reúne los ocho impedimentos definidos por la regla y devuelve un
 * resumen agrupado, apto para presentarse antes de sincronizar.
 */
function validarCierre(datos) {
  const impedimentos = [];

  // 1. Consentimiento (RN-001)
  if (datos.consentimiento !== 'si') {
    impedimentos.push({
      codigo: 'RN-001', bloque: 'Autorización',
      mensaje: 'No se registró el consentimiento informado.'
    });
  }

  // 2. Campos obligatorios de vivienda y entorno
  const incumplimientos = validarReglas(datos);
  incumplimientos.forEach(function (item) {
    impedimentos.push({
      codigo: item.codigo,
      bloque: item.ambito,
      ruta: item.ruta,
      referencia: item.referencia,
      mensaje: item.mensaje
    });
  });

  // 3. Familias declaradas sin caracterizar (RN-028)
  if (esEnteroPositivo(datos.hogaresEnVivienda)) {
    const familiasCapturadas = Array.isArray(datos.familias) ? datos.familias.length : 0;
    if (familiasCapturadas < datos.hogaresEnVivienda) {
      impedimentos.push({
        codigo: 'RN-028', bloque: 'Vivienda',
        mensaje: 'Faltan ' + (datos.hogaresEnVivienda - familiasCapturadas) + ' familia(s) por caracterizar.'
      });
    }
  }

  // 4. Integrantes declarados sin caracterizar (RN-051)
  (datos.familias || []).forEach(function (familia, indice) {
    const capturados = Array.isArray(familia.integrantes) ? familia.integrantes.length : 0;
    if (esEnteroPositivo(familia.numeroIntegrantes) && capturados < familia.numeroIntegrantes) {
      impedimentos.push({
        codigo: 'RN-051', bloque: 'Familia',
        referencia: 'Familia ' + (indice + 1),
        mensaje: 'Faltan ' + (familia.numeroIntegrantes - capturados) + ' integrante(s) por caracterizar.'
      });
    }
  });

  // 5. Alertas inmediatas sin conducta registrada (RN-220)
  const alertas = evaluarAlertas(datos);
  const sinAccion = verificarTrazabilidadAlertas(datos, alertas);
  sinAccion
    .filter(function (alerta) { return alerta.prioridad === PRIORIDAD.INMEDIATA; })
    .forEach(function (alerta) {
      impedimentos.push({
        codigo: alerta.codigo, bloque: 'Plan de cuidado',
        referencia: alerta.referencia,
        mensaje: 'Alerta INMEDIATA sin conducta registrada: ' + alerta.titulo + '.'
      });
    });

  // 6. Georreferenciación pendiente sin motivo (RN-022)
  const sinCoordenadas = typeof datos.latitud !== 'number' || typeof datos.longitud !== 'number';
  if (sinCoordenadas && esVacio(datos.motivoSinGeorreferenciacion)) {
    impedimentos.push({
      codigo: 'RN-022', bloque: 'Vivienda',
      mensaje: 'Georreferenciación pendiente: capture las coordenadas o registre el motivo de imposibilidad.'
    });
  }

  // 7. Ausencia de contacto telefónico sin novedad (RN-070)
  (datos.familias || []).forEach(function (familia, indice) {
    if (listaVacia(familia.integrantes)) return;
    const tieneContacto = familia.integrantes.some(function (i) { return telefonoValido(i.telefono1); });
    if (!tieneContacto && familia.sinContactoTelefonico !== true) {
      impedimentos.push({
        codigo: 'RN-070', bloque: 'Familia',
        referencia: 'Familia ' + (indice + 1),
        mensaje: 'Sin medio de contacto telefónico y sin la novedad correspondiente registrada.'
      });
    }
  });

  // 8. Alerta que bloquea la sincronización (RN-202)
  const bloqueantes = sinAccion.filter(function (alerta) { return alerta.bloqueaSincronizacion; });
  bloqueantes.forEach(function (alerta) {
    impedimentos.push({
      codigo: alerta.codigo, bloque: 'Salud mental',
      referencia: alerta.referencia,
      mensaje: 'La ficha no puede sincronizarse sin registrar la conducta ante riesgo de suicidio.'
    });
  });

  return {
    regla: 'RN-222',
    puedeCerrar: impedimentos.length === 0,
    impedimentos: impedimentos,
    alertas: alertas,
    riesgoFamiliar: clasificarRiesgoFamiliar(datos, alertas),
    seguimientos: validarSeguimientos(datos, alertas)
  };
}
