/* =========================================================================
   Encuesta_APS — Variables del anexo técnico SI-APS
   -------------------------------------------------------------------------
   Anexo técnico del reporte APS124CCFP (PISIS / SISPRO), versión 7, junio
   de 2026. El anexo define el archivo plano con el que la E.S.E. reporta la
   caracterización al Ministerio: 125 variables por familia (registro tipo 2)
   y 119 por integrante (registro tipo 3). El instrumento impreso con el que
   se construyó la aplicación cubría una parte; las demás se declaran aquí.

   UNA SOLA DECLARACIÓN, SEIS CONSUMIDORES
   Cada pregunta se escribe una vez y de esta lista salen:
     1. el formulario       formulario.js pinta los campos en su grupo
     2. la visibilidad      cuándo se muestra (edad, sexo, respuesta previa)
     3. las reglas          reglas.js genera obligatoriedad y dominio
     4. la base             bd/gen_anexo.js genera columnas y tablas puente
     5. el guardado         api/guardar_encuesta.js escribe sin SQL a mano
     6. el reporte          api/_reporte_sispro.js arma el archivo plano
   Así una pregunta no puede existir en el formulario y faltar en la base,
   que es lo que pasa cuando cada capa mantiene su propia lista.

   CAMPOS DE CADA PREGUNTA
     clave       nombre en el modelo de la ficha y en el `name` del control
     nivel       ficha | vivienda | familia | integrante
     registro    2 (vivienda y familia) o 3 (integrante) del archivo plano
     variable    número de la variable en ese registro
     grupo       dónde se pinta: el `data-anexo-grupo` de index.html
     tipo        unica | multiple | texto | entero | fecha
     catalogo    lista de catalogos.js (unica y multiple)
     control     radio | select (sólo unica; por defecto radio)
     max, min    largo máximo del texto; rango del entero
     visible(r)  cuándo aplica la pregunta; por defecto siempre
     requerido   'bloqueo' | 'advertencia' | false, sólo cuando es visible
     siOculta(r) valor interno que se reporta cuando la pregunta no se
                 mostró («No aplica» del anexo). Sin él, se reporta vacío.
     tabla       tabla de la base; por defecto la del nivel
     ayuda       texto de apoyo bajo la pregunta

   `r` es un lector de respuestas (ver `lectorDeRespuestas`): r.v(clave),
   r.lista(clave), r.tiene(clave, valor), r.edadMeses, r.sexo, r.gestante.
   Funciona igual sobre el modelo (reglas, servidor, reporte) y sobre el
   formulario (formulario.js construye uno equivalente leyendo el DOM).
   ========================================================================= */

'use strict';

/* ---------------------------------------------------------
   Lector de respuestas sobre el modelo
   --------------------------------------------------------- */

/**
 * `capas` va de lo particular a lo general: [integrante, familia, datos].
 * Las claves son únicas en todo el instrumento, así que buscar hacia arriba
 * no puede confundir una respuesta de la vivienda con una del integrante.
 */
function lectorDeRespuestas(capas, contexto) {
  const niveles = (capas || []).filter(function (c) { return c && typeof c === 'object'; });
  const extra = contexto || {};

  function leer(clave) {
    for (let i = 0; i < niveles.length; i++) {
      if (Object.prototype.hasOwnProperty.call(niveles[i], clave)) return niveles[i][clave];
    }
    return undefined;
  }

  const lector = {
    v: function (clave) {
      const valor = leer(clave);
      if (Array.isArray(valor)) return valor.length ? valor[0] : null;
      return valor === undefined || valor === '' ? null : valor;
    },
    lista: function (clave) {
      const valor = leer(clave);
      if (Array.isArray(valor)) return valor;
      return valor === undefined || valor === null || valor === '' ? [] : [valor];
    },
    tiene: function (clave, valor) { return lector.lista(clave).indexOf(valor) !== -1; },
    /** ¿Se marcó algo distinto de la opción de exclusión? */
    algunoSalvo: function (clave, excluyente) {
      return lector.lista(clave).some(function (v) { return v !== excluyente; });
    },
    edadMeses: extra.edadMeses === undefined ? null : extra.edadMeses,
    sexo: extra.sexo || null,
    gestante: extra.gestante === true,
    fechaFicha: extra.fechaFicha || null
  };
  return lector;
}

/* Mujer (o intersexual) de 10 a 54 años: la población de la ruta materna. */
function enEdadFertil(r) {
  return SEXOS_CON_CAPACIDAD_GESTAR.indexOf(r.sexo) !== -1 &&
    r.edadMeses !== null && r.edadMeses >= 120 && r.edadMeses <= 659;
}

function mayorDeAnios(r, anios) {
  return r.edadMeses !== null && r.edadMeses >= anios * 12;
}

/* El evento obstétrico ya ocurrió (parto o cesárea): abre el puerperio. */
function eventoObstetricoOcurrido(r) {
  const fecha = r.v('fechaEventoObstetrico');
  if (!fecha) return false;
  const tope = r.fechaFicha || new Date().toISOString().slice(0, 10);
  return String(fecha) <= String(tope);
}

/* Visible cuando la pregunta madre trae «otro» (su «¿cuál?»). */
function conOtro(clave) {
  return function (r) { return r.tiene(clave, 'otro'); };
}

function esSi(clave) {
  return function (r) { return r.v(clave) === 'si'; };
}

/* ---------------------------------------------------------
   Grupos del formulario: título de la tarjeta y del bloque
   --------------------------------------------------------- */
const GRUPOS_ANEXO = {
  'situacion':              'Situación inminente',
  'ubicacion':              'Ubicación de la vivienda',
  'vivienda-contacto':      'Contacto de la vivienda',
  'vivienda-condiciones':   'Ambientes y servicios de la vivienda',
  'acceso':                 'Acceso a la vivienda y desplazamiento',
  'actividad':              'Actividad económica en la vivienda',
  'animales':               'Tenencia de animales',
  'agua':                   'Suministro y almacenamiento de agua',
  'residuos-almacenamiento':'Almacenamiento de residuos sólidos',
  'residuos':               'Manejo de residuos',
  'aire':                   'Calidad del aire y energía',
  'vectores':               'Vectores y animales ponzoñosos',
  'quimicos':               'Productos químicos en el hogar',
  'familia-alias':          'Identificación de la familia',
  'familia-zarit':          'Escala ZARIT',
  'familia-apgar':          'APGAR familiar',
  'familia-practicas':      'Prácticas ante enfermedades respiratorias',
  'integrante-migracion':   'Estatus migratorio',
  'integrante-lavado':      'Higiene de manos',
  'integrante-eventos':     'Eventos de salud del último mes',
  'integrante-diagnostico': 'Diagnóstico',
  'integrante-tabaco':      'Consumo de tabaco',
  'integrante-materno':     'Salud materna y perinatal',
  'integrante-laboral':     'Historial laboral',
  'integrante-asbesto':     'Exposición a asbesto'
};

/* ---------------------------------------------------------
   Las preguntas
   --------------------------------------------------------- */
const PREGUNTAS_ANEXO = [

  /* ================= Registro tipo 2 — ficha y vivienda ================= */

  { clave: 'observacionesSituacion', nivel: 'ficha', registro: 2, variable: 24, grupo: 'situacion',
    etiqueta: 'Observaciones de la situación atendida', tipo: 'texto', max: 200,
    ayuda: 'Describa la situación encontrada y la conducta adoptada.',
    visible: function (r) { return r.algunoSalvo('situacionInminente', VALOR_NO_APLICA); },
    requerido: 'bloqueo' },

  { clave: 'tipoUbicacion', nivel: 'ficha', tabla: 'hogar', registro: 2, variable: 8, grupo: 'ubicacion',
    etiqueta: 'Tipo de ubicación de la vivienda', tipo: 'unica', catalogo: 'CAT_TIPO_UBICACION', control: 'select',
    requerido: 'bloqueo' },

  { clave: 'telefonoVivienda', nivel: 'vivienda', registro: 2, variable: 15, grupo: 'vivienda-contacto',
    etiqueta: 'Teléfono de la vivienda', tipo: 'texto', max: 10, formato: 'telefono',
    ayuda: '10 dígitos. Opcional.', requerido: false },

  /* --- Ambientes y servicios (variables 34 a 37 y 41 a 43) --- */
  { clave: 'ambientesLuzNatural', nivel: 'vivienda', registro: 2, variable: 34, grupo: 'vivienda-condiciones',
    etiqueta: 'Ambientes de la vivienda con luz natural', tipo: 'multiple', catalogo: 'CAT_AMBIENTES_VIVIENDA',
    requerido: 'bloqueo' },
  { clave: 'ambientesVentilacion', nivel: 'vivienda', registro: 2, variable: 35, grupo: 'vivienda-condiciones',
    etiqueta: 'Ambientes de la vivienda con ventilación natural o artificial', tipo: 'multiple',
    catalogo: 'CAT_AMBIENTES_VIVIENDA', requerido: 'bloqueo' },
  { clave: 'elementosVivienda', nivel: 'vivienda', registro: 2, variable: 36, grupo: 'vivienda-condiciones',
    etiqueta: 'Elementos que hay en la vivienda', tipo: 'multiple', catalogo: 'CAT_ELEMENTOS_VIVIENDA',
    ayuda: 'El anexo no trae una opción «ninguno»: si no hay ninguno, déjelo sin marcar.',
    requerido: 'advertencia' },
  { clave: 'alumbrado', nivel: 'vivienda', registro: 2, variable: 37, grupo: 'vivienda-condiciones',
    etiqueta: 'Alumbrado predominante en la vivienda', tipo: 'unica', catalogo: 'CAT_ALUMBRADO',
    requerido: 'bloqueo' },
  { clave: 'cocinaSeparada', nivel: 'vivienda', registro: 2, variable: 41, grupo: 'vivienda-condiciones',
    etiqueta: '¿La cocina está separada de los demás espacios de la vivienda?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },
  { clave: 'banoSeparado', nivel: 'vivienda', registro: 2, variable: 42, grupo: 'vivienda-condiciones',
    etiqueta: '¿El baño está separado de los demás espacios de la vivienda?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },
  { clave: 'dormitoriosSeparados', nivel: 'vivienda', registro: 2, variable: 43, grupo: 'vivienda-condiciones',
    etiqueta: '¿Los dormitorios están separados físicamente?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },

  /* --- Acceso y desplazamiento (variables 38, 39 y 44 a 49) --- */
  { clave: 'accesoVivienda', nivel: 'vivienda', registro: 2, variable: 38, grupo: 'acceso',
    etiqueta: 'Acceso a la vivienda', tipo: 'unica', catalogo: 'CAT_ACCESO_VIVIENDA',
    ayuda: 'Lo que la familia tiene a su alcance desde la vivienda. Una sola respuesta: la principal.',
    requerido: 'bloqueo' },
  { clave: 'otrosAccesosVivienda', nivel: 'vivienda', registro: 2, variable: 39, grupo: 'acceso',
    etiqueta: 'Otros accesos a la vivienda', tipo: 'texto', max: 200, requerido: false },
  { clave: 'mediosTransporte', nivel: 'vivienda', registro: 2, variable: 44, grupo: 'acceso',
    etiqueta: 'Medios de transporte habituales de la familia', tipo: 'multiple', catalogo: 'CAT_MEDIOS_TRANSPORTE',
    requerido: 'bloqueo' },
  { clave: 'mediosTransporteOtro', nivel: 'vivienda', registro: 2, variable: 45, grupo: 'acceso',
    etiqueta: '¿Qué otro medio de transporte?', tipo: 'texto', max: 200,
    visible: conOtro('mediosTransporte'), requerido: 'bloqueo' },
  { clave: 'seguridadDesplazamiento', nivel: 'vivienda', registro: 2, variable: 46, grupo: 'acceso',
    etiqueta: 'Elementos de seguridad que usa la familia al desplazarse', tipo: 'multiple',
    catalogo: 'CAT_SEGURIDAD_DESPLAZAMIENTO', requerido: 'bloqueo' },
  { clave: 'seguridadDesplazamientoOtro', nivel: 'vivienda', registro: 2, variable: 47, grupo: 'acceso',
    etiqueta: '¿Qué otro elemento de seguridad?', tipo: 'texto', max: 200,
    visible: conOtro('seguridadDesplazamiento'), requerido: 'bloqueo' },
  { clave: 'desplazamientoMayor30', nivel: 'vivienda', registro: 2, variable: 48, grupo: 'acceso',
    etiqueta: 'Factores que hacen que el desplazamiento tome más de 30 minutos', tipo: 'multiple',
    catalogo: 'CAT_DESPLAZAMIENTO_30',
    ayuda: 'Si el desplazamiento habitual toma 30 minutos o menos, déjelo sin marcar.',
    requerido: 'advertencia' },
  { clave: 'desplazamientoMayor30Otro', nivel: 'vivienda', registro: 2, variable: 49, grupo: 'acceso',
    etiqueta: '¿Qué otro factor?', tipo: 'texto', max: 200,
    visible: conOtro('desplazamientoMayor30'), requerido: 'bloqueo' },

  /* --- Actividad económica (variables 51 y 52; la 50 es el ítem 39) --- */
  { clave: 'areaTrabajoIndependiente', nivel: 'vivienda', registro: 2, variable: 51, grupo: 'actividad',
    etiqueta: '¿El área de trabajo es independiente de las demás áreas de la vivienda?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', visible: esSi('actividadEconomica'), requerido: 'bloqueo' },
  { clave: 'familiarAfectadoActividad', nivel: 'vivienda', registro: 2, variable: 52, grupo: 'actividad',
    etiqueta: '¿Algún integrante de la familia se ha visto afectado por la actividad económica?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', visible: esSi('actividadEconomica'), requerido: 'bloqueo' },

  /* --- Tenencia de animales (variables 97 a 102; 92 a 96 son los ítems 40 a 44) --- */
  { clave: 'finalidadTenencia', nivel: 'vivienda', registro: 2, variable: 97, grupo: 'animales',
    etiqueta: 'Finalidad de la tenencia de los animales', tipo: 'multiple', catalogo: 'CAT_FINALIDAD_TENENCIA',
    visible: function (r) { return r.algunoSalvo('animales', VALOR_NINGUNO); }, requerido: 'bloqueo' },
  { clave: 'confinamientoAnimales', nivel: 'vivienda', registro: 2, variable: 98, grupo: 'animales',
    etiqueta: 'Confinamiento de los animales', tipo: 'multiple', catalogo: 'CAT_CONFINAMIENTO_ANIMALES',
    visible: function (r) { return r.algunoSalvo('animales', VALOR_NINGUNO); }, requerido: 'bloqueo' },
  { clave: 'desparasitaAnimales', nivel: 'vivienda', registro: 2, variable: 99, grupo: 'animales',
    etiqueta: '¿Se desparasita a los animales domésticos?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return r.algunoSalvo('animales', VALOR_NINGUNO); }, requerido: 'bloqueo' },
  { clave: 'instalacionesSegurasAnimales', nivel: 'vivienda', registro: 2, variable: 100, grupo: 'animales',
    etiqueta: '¿Las instalaciones para los animales son seguras?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return r.algunoSalvo('animales', VALOR_NINGUNO); }, requerido: 'bloqueo' },
  { clave: 'excretasAnimales', nivel: 'vivienda', registro: 2, variable: 101, grupo: 'animales',
    etiqueta: '¿Las excretas de los animales se recogen y disponen adecuadamente?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return r.algunoSalvo('animales', VALOR_NINGUNO); }, requerido: 'bloqueo' },
  { clave: 'barrerasContactoAnimales', nivel: 'vivienda', registro: 2, variable: 102, grupo: 'animales',
    etiqueta: '¿La vivienda tiene barreras que eviten el contacto directo con los animales?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', visible: function (r) { return r.algunoSalvo('animales', VALOR_NINGUNO); },
    requerido: 'bloqueo' },

  /* --- Agua (variables 54 a 57; la 53 es el ítem 46) --- */
  { clave: 'horasSuministroAgua', nivel: 'vivienda', registro: 2, variable: 54, grupo: 'agua',
    etiqueta: 'Horas al día con suministro de agua', tipo: 'unica', catalogo: 'CAT_HORAS_SUMINISTRO',
    control: 'select', requerido: 'bloqueo' },
  { clave: 'tanqueAlmacenamiento', nivel: 'vivienda', registro: 2, variable: 55, grupo: 'agua',
    etiqueta: 'Tanque de almacenamiento de agua', tipo: 'unica', catalogo: 'CAT_TANQUE_AGUA',
    control: 'select', requerido: 'bloqueo' },
  { clave: 'frecuenciaLimpiezaTanque', nivel: 'vivienda', registro: 2, variable: 56, grupo: 'agua',
    etiqueta: 'Frecuencia de limpieza del tanque', tipo: 'unica', catalogo: 'CAT_FRECUENCIA_LIMPIEZA_TANQUE',
    control: 'select',
    visible: function (r) { return r.v('tanqueAlmacenamiento') !== null && r.v('tanqueAlmacenamiento') !== TANQUE_NO_TIENE; },
    siOculta: function (r) { return r.v('tanqueAlmacenamiento') === TANQUE_NO_TIENE ? VALOR_NO_APLICA : null; },
    requerido: 'bloqueo' },
  { clave: 'distanciaTanque', nivel: 'vivienda', registro: 2, variable: 57, grupo: 'agua',
    etiqueta: 'Distancia entre el tanque y el pozo séptico o el alcantarillado', tipo: 'unica',
    catalogo: 'CAT_DISTANCIA_TANQUE', control: 'select',
    visible: function (r) { return r.v('tanqueAlmacenamiento') !== null && r.v('tanqueAlmacenamiento') !== TANQUE_NO_TIENE; },
    requerido: 'bloqueo' },

  /* --- Almacenamiento de residuos (variables 60 y 61) --- */
  { clave: 'almacenamientoResiduos', nivel: 'vivienda', registro: 2, variable: 60, grupo: 'residuos-almacenamiento',
    etiqueta: 'Almacenamiento de los residuos sólidos en la vivienda', tipo: 'multiple',
    catalogo: 'CAT_ALMACENAMIENTO_RESIDUOS', requerido: 'bloqueo' },
  { clave: 'almacenamientoResiduosOtro', nivel: 'vivienda', registro: 2, variable: 61, grupo: 'residuos-almacenamiento',
    etiqueta: '¿Qué otro sistema de almacenamiento?', tipo: 'texto', max: 200,
    visible: conOtro('almacenamientoResiduos'), requerido: 'bloqueo' },

  /* --- Manejo de residuos (variables 63 a 77) --- */
  { clave: 'conocePracticasResiduos', nivel: 'vivienda', registro: 2, variable: 63, grupo: 'residuos',
    etiqueta: '¿Conoce prácticas de reducción y separación de residuos en el hogar?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', requerido: 'bloqueo' },
  { clave: 'realizaReduccionResiduos', nivel: 'vivienda', registro: 2, variable: 64, grupo: 'residuos',
    etiqueta: '¿Realiza prácticas de reducción y separación de residuos?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },
  { clave: 'formasReduccionResiduos', nivel: 'vivienda', registro: 2, variable: 65, grupo: 'residuos',
    etiqueta: '¿Cómo reduce la generación de residuos?', tipo: 'multiple', catalogo: 'CAT_REDUCCION_RESIDUOS',
    visible: esSi('realizaReduccionResiduos'), requerido: 'bloqueo' },
  { clave: 'formasReduccionResiduosOtro', nivel: 'vivienda', registro: 2, variable: 66, grupo: 'residuos',
    etiqueta: '¿Qué otra práctica de reducción?', tipo: 'texto', max: 200,
    visible: conOtro('formasReduccionResiduos'), requerido: 'bloqueo' },
  { clave: 'realizaAprovechamientoResiduos', nivel: 'vivienda', registro: 2, variable: 67, grupo: 'residuos',
    etiqueta: '¿Realiza prácticas de aprovechamiento de residuos?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },
  { clave: 'practicasAprovechamiento', nivel: 'vivienda', registro: 2, variable: 68, grupo: 'residuos',
    etiqueta: '¿Qué prácticas de aprovechamiento de residuos realiza?', tipo: 'texto', max: 200,
    visible: esSi('realizaAprovechamientoResiduos'), requerido: false },
  { clave: 'disposicionResiduosPeligrosos', nivel: 'vivienda', registro: 2, variable: 69, grupo: 'residuos',
    etiqueta: '¿Cómo dispone los residuos peligrosos (pilas, bombillos, medicamentos, envases de químicos)?',
    tipo: 'multiple', catalogo: 'CAT_DISPOSICION_PELIGROSOS', requerido: 'bloqueo' },
  { clave: 'disposicionResiduosPeligrososOtro', nivel: 'vivienda', registro: 2, variable: 70, grupo: 'residuos',
    etiqueta: '¿Qué otra forma de disposición de residuos peligrosos?', tipo: 'texto', max: 200,
    visible: conOtro('disposicionResiduosPeligrosos'), requerido: 'bloqueo' },
  { clave: 'reduccionSeparacionRural', nivel: 'vivienda', registro: 2, variable: 71, grupo: 'residuos',
    etiqueta: '¿Realiza procesos de reducción y separación de residuos rurales?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },
  { clave: 'aprovechamientoRural', nivel: 'vivienda', registro: 2, variable: 72, grupo: 'residuos',
    etiqueta: '¿Qué prácticas de aprovechamiento de residuos rurales realiza?', tipo: 'multiple',
    catalogo: 'CAT_APROVECHAMIENTO_RURAL', visible: esSi('reduccionSeparacionRural'), requerido: 'bloqueo' },
  { clave: 'aprovechamientoRuralOtro', nivel: 'vivienda', registro: 2, variable: 73, grupo: 'residuos',
    etiqueta: '¿Qué otra práctica de aprovechamiento rural?', tipo: 'texto', max: 200,
    visible: conOtro('aprovechamientoRural'), requerido: 'bloqueo' },
  { clave: 'separacionRural', nivel: 'vivienda', registro: 2, variable: 74, grupo: 'residuos',
    etiqueta: '¿Qué prácticas de separación de residuos aplica?', tipo: 'multiple', catalogo: 'CAT_SEPARACION_RESIDUOS',
    visible: esSi('reduccionSeparacionRural'), requerido: 'bloqueo' },
  { clave: 'separacionRuralOtro', nivel: 'vivienda', registro: 2, variable: 75, grupo: 'residuos',
    etiqueta: '¿Qué otra práctica de separación?', tipo: 'texto', max: 200,
    visible: conOtro('separacionRural'), requerido: 'bloqueo' },
  { clave: 'limpiezaSuperficies', nivel: 'vivienda', registro: 2, variable: 76, grupo: 'residuos',
    etiqueta: '¿Cómo se realiza la limpieza de superficies?', tipo: 'unica', catalogo: 'CAT_LIMPIEZA_SUPERFICIES',
    requerido: 'bloqueo' },
  { clave: 'limpiezaSuperficiesOtro', nivel: 'vivienda', registro: 2, variable: 77, grupo: 'residuos',
    etiqueta: '¿Qué otra práctica de limpieza?', tipo: 'texto', max: 200,
    visible: conOtro('limpiezaSuperficies'), requerido: 'bloqueo' },

  /* --- Calidad del aire y energía (variables 78 a 83) --- */
  { clave: 'energiaCocinar', nivel: 'vivienda', registro: 2, variable: 78, grupo: 'aire',
    etiqueta: 'Fuente de energía para cocinar', tipo: 'multiple', catalogo: 'CAT_ENERGIA_COCINAR',
    requerido: 'bloqueo' },
  { clave: 'energiaCocinarOtro', nivel: 'vivienda', registro: 2, variable: 79, grupo: 'aire',
    etiqueta: '¿Qué otra fuente de energía?', tipo: 'texto', max: 200,
    visible: conOtro('energiaCocinar'), requerido: 'bloqueo' },
  { clave: 'fuentesHumo', nivel: 'vivienda', registro: 2, variable: 80, grupo: 'aire',
    etiqueta: 'Fuentes frecuentes de humo en el hogar', tipo: 'multiple', catalogo: 'CAT_FUENTES_HUMO',
    requerido: 'bloqueo' },
  { clave: 'fuentesHumoOtro', nivel: 'vivienda', registro: 2, variable: 81, grupo: 'aire',
    etiqueta: '¿Qué otra fuente de humo?', tipo: 'texto', max: 200,
    visible: conOtro('fuentesHumo'), requerido: 'bloqueo' },
  { clave: 'practicasCalidadAire', nivel: 'vivienda', registro: 2, variable: 82, grupo: 'aire',
    etiqueta: 'Prácticas que afectan la calidad del aire', tipo: 'multiple', catalogo: 'CAT_PRACTICAS_CALIDAD_AIRE',
    ayuda: 'El anexo no trae una opción «ninguna»: si no se presenta ninguna, déjelo sin marcar.',
    requerido: 'advertencia' },
  { clave: 'tipoEstufa', nivel: 'vivienda', registro: 2, variable: 83, grupo: 'aire',
    etiqueta: 'Tipo de estufa', tipo: 'multiple', catalogo: 'CAT_TIPO_ESTUFA', requerido: 'bloqueo' },

  /* --- Vectores y animales ponzoñosos (variables 85 a 91; la 84 es el ítem 37) --- */
  { clave: 'vectoresPresentes', nivel: 'vivienda', registro: 2, variable: 85, grupo: 'vectores',
    etiqueta: 'Vectores transmisores de enfermedades presentes en la vivienda', tipo: 'multiple',
    catalogo: 'CAT_VECTORES',
    ayuda: 'El anexo no trae una opción «ninguno»: si no se observa ninguno, déjelo sin marcar.',
    requerido: 'advertencia' },
  { clave: 'vectoresPresentesOtro', nivel: 'vivienda', registro: 2, variable: 86, grupo: 'vectores',
    etiqueta: '¿Qué otro vector?', tipo: 'texto', max: 200,
    visible: conOtro('vectoresPresentes'), requerido: 'bloqueo' },
  { clave: 'medidasControlVectores', nivel: 'vivienda', registro: 2, variable: 87, grupo: 'vectores',
    etiqueta: 'Medidas para el control de vectores transmisores de enfermedades', tipo: 'multiple',
    catalogo: 'CAT_MEDIDAS_VECTORES', requerido: 'advertencia' },
  { clave: 'medidasControlVectoresOtro', nivel: 'vivienda', registro: 2, variable: 88, grupo: 'vectores',
    etiqueta: '¿Qué otra medida de control?', tipo: 'texto', max: 200,
    visible: conOtro('medidasControlVectores'), requerido: 'bloqueo' },
  { clave: 'animalesPonzonosos', nivel: 'vivienda', registro: 2, variable: 89, grupo: 'vectores',
    etiqueta: 'Animales ponzoñosos en el hogar', tipo: 'multiple', catalogo: 'CAT_ANIMALES_PONZONOSOS',
    requerido: 'bloqueo' },
  { clave: 'animalesPonzonososOtro', nivel: 'vivienda', registro: 2, variable: 90, grupo: 'vectores',
    etiqueta: '¿Qué otro animal ponzoñoso?', tipo: 'texto', max: 200,
    visible: conOtro('animalesPonzonosos'), requerido: 'bloqueo' },
  { clave: 'medidasPonzonosos', nivel: 'vivienda', registro: 2, variable: 91, grupo: 'vectores',
    etiqueta: 'Medidas para reducir el riesgo de animales ponzoñosos', tipo: 'multiple',
    catalogo: 'CAT_MEDIDAS_PONZONOSOS',
    visible: function (r) { return r.algunoSalvo('animalesPonzonosos', VALOR_NO_APLICA); },
    requerido: 'advertencia' },

  /* --- Productos químicos (variables 104 a 109) --- */
  { clave: 'lugarQuimicos', nivel: 'vivienda', registro: 2, variable: 104, grupo: 'quimicos',
    etiqueta: 'Lugar donde adquiere los productos químicos del hogar', tipo: 'unica', catalogo: 'CAT_LUGAR_QUIMICOS',
    requerido: 'bloqueo' },
  { clave: 'disposicionQuimicos', nivel: 'vivienda', registro: 2, variable: 105, grupo: 'quimicos',
    etiqueta: 'Disposición final de los residuos químicos', tipo: 'multiple', catalogo: 'CAT_DISPOSICION_QUIMICOS',
    requerido: 'bloqueo' },
  { clave: 'disposicionQuimicosOtro', nivel: 'vivienda', registro: 2, variable: 106, grupo: 'quimicos',
    etiqueta: '¿Qué otra práctica de disposición de químicos?', tipo: 'texto', max: 200,
    visible: conOtro('disposicionQuimicos'), requerido: 'bloqueo' },
  { clave: 'instruccionesQuimicos', nivel: 'vivienda', registro: 2, variable: 107, grupo: 'quimicos',
    etiqueta: '¿Sigue las instrucciones del fabricante para manejar y almacenar los químicos?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', requerido: 'bloqueo' },
  { clave: 'envaseOriginalQuimicos', nivel: 'vivienda', registro: 2, variable: 108, grupo: 'quimicos',
    etiqueta: '¿Los productos químicos se guardan en su envase original y en un lugar asignado?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', requerido: 'bloqueo' },
  { clave: 'proteccionLimpieza', nivel: 'vivienda', registro: 2, variable: 109, grupo: 'quimicos',
    etiqueta: '¿Usa protección y ventila al limpiar con químicos?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },

  /* ================= Registro tipo 2 — familia ================= */

  { clave: 'aliasFamilia', nivel: 'familia', registro: 2, variable: 111, grupo: 'familia-alias',
    etiqueta: 'Alias de la familia', tipo: 'texto', max: 200,
    ayuda: 'Nombre con el que se reconoce a la familia. Ej. Familia Gómez Rincón.', requerido: 'bloqueo' },
  { clave: 'zaritPuntaje', nivel: 'familia', registro: 2, variable: 115, grupo: 'familia-zarit',
    etiqueta: 'Escala ZARIT: puntaje del cuidador principal', tipo: 'entero', min: 0, max: ZARIT_PUNTAJE_MAXIMO,
    ayuda: 'Puntaje total de 0 a 100. La clasificación de sobrecarga se calcula sola.',
    visible: esSi('cuidadorPrincipal'), requerido: 'bloqueo' },
  { clave: 'apgarFamiliar', nivel: 'familia', registro: 2, variable: 113, grupo: 'familia-apgar',
    etiqueta: 'APGAR familiar (funcionalidad de la familia)', tipo: 'unica', catalogo: 'CAT_APGAR',
    ayuda: 'Aplique el instrumento APGAR familiar y registre el rango del resultado.', requerido: 'bloqueo' },
  { clave: 'medidasRespiratorias', nivel: 'familia', registro: 2, variable: 120, grupo: 'familia-practicas',
    etiqueta: 'Medida principal ante enfermedades respiratorias en el hogar', tipo: 'unica',
    catalogo: 'CAT_MEDIDAS_RESPIRATORIAS', requerido: 'bloqueo' },
  { clave: 'medidasRespiratoriasOtro', nivel: 'familia', registro: 2, variable: 121, grupo: 'familia-practicas',
    etiqueta: '¿Qué otra medida?', tipo: 'texto', max: 200,
    visible: conOtro('medidasRespiratorias'), requerido: 'bloqueo' },
  { clave: 'higieneCompartida', nivel: 'familia', registro: 2, variable: 122, grupo: 'familia-practicas',
    etiqueta: '¿Los integrantes comparten implementos de higiene personal?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    requerido: 'bloqueo' },

  /* ================= Registro tipo 3 — integrante ================= */

  { clave: 'estatusMigratorio', nivel: 'integrante', registro: 3, variable: 10, grupo: 'integrante-migracion',
    etiqueta: 'Estatus migratorio', tipo: 'unica', catalogo: 'CAT_ESTATUS_MIGRATORIO', control: 'select',
    visible: function (r) { return r.v('nacionalidad') !== null && r.v('nacionalidad') !== NACIONALIDAD_COLOMBIA; },
    siOculta: function (r) { return r.v('nacionalidad') === NACIONALIDAD_COLOMBIA ? ESTATUS_MIGRATORIO_NO_APLICA : null; },
    requerido: 'bloqueo' },

  { clave: 'lavadoManos', nivel: 'integrante', registro: 3, variable: 43, grupo: 'integrante-lavado',
    etiqueta: '¿Se lava las manos con agua y jabón?', tipo: 'unica', catalogo: 'CAT_SI_NO', requerido: 'bloqueo' },

  { clave: 'urgenciasAccidente', nivel: 'integrante', registro: 3, variable: 47, grupo: 'integrante-eventos',
    etiqueta: '¿Acudió a urgencias por algún accidente en el hogar?', tipo: 'multiple',
    catalogo: 'CAT_URGENCIAS_HOGAR', requerido: 'bloqueo' },
  { clave: 'enfermedadesUltimoMes', nivel: 'integrante', registro: 3, variable: 48, grupo: 'integrante-eventos',
    etiqueta: 'Enfermedades sufridas en el último mes', tipo: 'multiple', catalogo: 'CAT_ENFERMEDADES_ULTIMO_MES',
    ayuda: 'El anexo no trae una opción «ninguna»: si no enfermó, déjelo sin marcar.', requerido: 'advertencia' },
  { clave: 'enfermedadesUltimoMesOtra', nivel: 'integrante', registro: 3, variable: 49, grupo: 'integrante-eventos',
    etiqueta: '¿Qué otra enfermedad?', tipo: 'texto', max: 200,
    visible: conOtro('enfermedadesUltimoMes'), requerido: 'bloqueo' },
  { clave: 'accionAfeccion', nivel: 'integrante', registro: 3, variable: 50, grupo: 'integrante-eventos',
    etiqueta: '¿Qué hizo ante la afección del último mes?', tipo: 'unica', catalogo: 'CAT_ACCION_AFECCION',
    control: 'select', visible: function (r) { return r.lista('enfermedadesUltimoMes').length > 0; },
    requerido: 'bloqueo' },
  { clave: 'accionAfeccionOtra', nivel: 'integrante', registro: 3, variable: 51, grupo: 'integrante-eventos',
    etiqueta: '¿Qué otra acción tomó?', tipo: 'texto', max: 200,
    visible: conOtro('accionAfeccion'), requerido: 'bloqueo' },

  { clave: 'tieneDiagnostico', nivel: 'integrante', registro: 3, variable: 56, grupo: 'integrante-diagnostico',
    etiqueta: '¿Tiene diagnóstico de alguna enfermedad?', tipo: 'unica', catalogo: 'CAT_SI_NO', requerido: 'bloqueo' },
  { clave: 'sintomasSinDiagnostico', nivel: 'integrante', registro: 3, variable: 57, grupo: 'integrante-diagnostico',
    etiqueta: '¿Tiene signos y síntomas compatibles con alguna enfermedad, sin diagnóstico?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', requerido: 'bloqueo' },

  { clave: 'consumoTabaco', nivel: 'integrante', registro: 3, variable: 64, grupo: 'integrante-tabaco',
    etiqueta: '¿Consume tabaco?', tipo: 'unica', catalogo: 'CAT_CONSUMO_TABACO',
    visible: function (r) { return mayorDeAnios(r, 10); },
    siOculta: function (r) { return r.edadMeses !== null && r.edadMeses < 120 ? TABACO_NO_APLICA : null; },
    requerido: 'bloqueo' },
  { clave: 'cigarrillosDiarios', nivel: 'integrante', registro: 3, variable: 65, grupo: 'integrante-tabaco',
    etiqueta: 'Consumo máximo de cigarrillos diarios (en los últimos 15 años)', tipo: 'entero', min: 0, max: 99,
    visible: function (r) { return r.v('consumoTabaco') === 'activo' || r.v('consumoTabaco') === 'exfumador'; },
    requerido: 'bloqueo' },
  { clave: 'aniosFumando', nivel: 'integrante', registro: 3, variable: 66, grupo: 'integrante-tabaco',
    etiqueta: 'Años que ha fumado', tipo: 'entero', min: 0, max: 99,
    visible: function (r) { return r.v('consumoTabaco') === 'activo' || r.v('consumoTabaco') === 'exfumador'; },
    requerido: 'bloqueo' },

  /* --- Salud materna y perinatal (variables 70 a 91, opcionales) ---
     La 71 (mujer en edad fértil) y la 72 (¿se encuentra en embarazo?) no
     se preguntan: se derivan del sexo, la edad y el ítem 85. */
  { clave: 'fechaUltimaMenstruacion', nivel: 'integrante', registro: 3, variable: 70, grupo: 'integrante-materno',
    etiqueta: 'Fecha de la última menstruación (FUM)', tipo: 'fecha', noPosterior: true,
    visible: enEdadFertil, requerido: false },
  { clave: 'conoceIve', nivel: 'integrante', registro: 3, variable: 74, grupo: 'integrante-materno',
    etiqueta: '¿Conoce sobre la Interrupción Voluntaria del Embarazo (IVE)?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: enEdadFertil, requerido: false },
  { clave: 'atencionPreconcepcional', nivel: 'integrante', registro: 3, variable: 81, grupo: 'integrante-materno',
    etiqueta: '¿Ha recibido atención para el cuidado preconcepcional?', tipo: 'unica', catalogo: 'CAT_SI_NO_NA',
    visible: enEdadFertil, requerido: false },
  { clave: 'conoceSignosAlarma', nivel: 'integrante', registro: 3, variable: 73, grupo: 'integrante-materno',
    etiqueta: '¿Conoce los signos de alarma en el embarazo?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return r.gestante; }, requerido: false },
  { clave: 'inicioPrenatales', nivel: 'integrante', registro: 3, variable: 75, grupo: 'integrante-materno',
    etiqueta: '¿Inició atenciones prenatales?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return r.gestante; }, requerido: false },
  { clave: 'inicioOportunoPrenatal', nivel: 'integrante', registro: 3, variable: 76, grupo: 'integrante-materno',
    etiqueta: '¿Inició oportunamente la atención prenatal?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return r.gestante && r.v('inicioPrenatales') === 'si'; }, requerido: false },
  { clave: 'numeroAtencionesPrenatales', nivel: 'integrante', registro: 3, variable: 80, grupo: 'integrante-materno',
    etiqueta: 'Número de atenciones prenatales hasta el momento', tipo: 'entero', min: 0, max: 99,
    visible: function (r) { return r.gestante && r.v('inicioPrenatales') === 'si'; }, requerido: false },
  { clave: 'controlesPrenatales', nivel: 'integrante', registro: 3, variable: 82, grupo: 'integrante-materno',
    etiqueta: '¿Recibe atención para el cuidado prenatal (controles prenatales)?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return r.gestante; }, requerido: false },
  { clave: 'riesgoGestacional', nivel: 'integrante', registro: 3, variable: 78, grupo: 'integrante-materno',
    etiqueta: 'Clasificación del riesgo gestacional', tipo: 'unica', catalogo: 'CAT_RIESGO_GESTACIONAL',
    visible: function (r) { return r.gestante; }, requerido: false },
  { clave: 'riesgoPreeclampsia', nivel: 'integrante', registro: 3, variable: 79, grupo: 'integrante-materno',
    etiqueta: 'Clasificación del riesgo de preeclampsia', tipo: 'unica', catalogo: 'CAT_RIESGO_PREECLAMPSIA',
    visible: function (r) { return r.gestante; }, requerido: false },
  { clave: 'sesionesPreparacion', nivel: 'integrante', registro: 3, variable: 83, grupo: 'integrante-materno',
    etiqueta: 'Sesiones de preparación para la maternidad y paternidad', tipo: 'entero', min: 0, max: 99,
    visible: function (r) { return r.gestante; }, requerido: false },
  { clave: 'accesoAnticonceptivosPostparto', nivel: 'integrante', registro: 3, variable: 77, grupo: 'integrante-materno',
    etiqueta: '¿Tiene acceso a métodos anticonceptivos postparto?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return r.gestante; }, requerido: false },
  { clave: 'fechaEventoObstetrico', nivel: 'integrante', registro: 3, variable: 84, grupo: 'integrante-materno',
    etiqueta: 'Fecha de atención del evento obstétrico (probable o del parto)', tipo: 'fecha',
    ayuda: 'En gestantes, la fecha probable del parto. Si el parto ya ocurrió, su fecha: se abren las preguntas del puerperio.',
    visible: function (r) { return enEdadFertil(r) || r.gestante; }, requerido: false },
  { clave: 'puerperio48h', nivel: 'integrante', registro: 3, variable: 85, grupo: 'integrante-materno',
    etiqueta: '¿Recibió atención del puerperio en las primeras 48 horas?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: eventoObstetricoOcurrido, requerido: false },
  { clave: 'seguimientoPuerperio', nivel: 'integrante', registro: 3, variable: 86, grupo: 'integrante-materno',
    etiqueta: '¿Tuvo consulta de seguimiento al puerperio entre el tercer y quinto día?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', visible: eventoObstetricoOcurrido, requerido: false },
  { clave: 'apoyoLactancia', nivel: 'integrante', registro: 3, variable: 87, grupo: 'integrante-materno',
    etiqueta: '¿Recibió apoyo a la lactancia materna?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: eventoObstetricoOcurrido, requerido: false },
  { clave: 'atencionRecienNacido24h', nivel: 'integrante', registro: 3, variable: 88, grupo: 'integrante-materno',
    etiqueta: '¿El recién nacido fue atendido durante sus primeras 24 horas de vida?', tipo: 'unica',
    catalogo: 'CAT_SI_NO', visible: eventoObstetricoOcurrido, requerido: false },
  { clave: 'controlRecienNacido', nivel: 'integrante', registro: 3, variable: 89, grupo: 'integrante-materno',
    etiqueta: '¿El recién nacido tuvo control entre el tercer y quinto día?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: eventoObstetricoOcurrido, requerido: false },
  { clave: 'vacunacionRecienNacido', nivel: 'integrante', registro: 3, variable: 90, grupo: 'integrante-materno',
    etiqueta: '¿El recién nacido fue vacunado?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: eventoObstetricoOcurrido, requerido: false },
  { clave: 'metodoAnticonceptivoPostparto', nivel: 'integrante', registro: 3, variable: 91, grupo: 'integrante-materno',
    etiqueta: 'Método anticonceptivo postparto inmediato', tipo: 'unica',
    catalogo: 'CAT_METODO_ANTICONCEPTIVO_POSTPARTO', control: 'select',
    visible: eventoObstetricoOcurrido, requerido: false },

  /* --- Historial laboral (variables 92 a 102, opcionales, desde los 15 años) --- */
  { clave: 'historialLaboral', nivel: 'integrante', registro: 3, variable: 92, grupo: 'integrante-laboral',
    etiqueta: '¿Cuenta con historial laboral?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'trabajoRecienteLugar', nivel: 'integrante', registro: 3, variable: 93, grupo: 'integrante-laboral',
    etiqueta: 'Lugar de trabajo o actividad específica más reciente', tipo: 'texto', max: 200,
    visible: esSi('historialLaboral'), requerido: false },
  { clave: 'trabajoRecienteEmpleador', nivel: 'integrante', registro: 3, variable: 94, grupo: 'integrante-laboral',
    etiqueta: 'Nombre del empleador', tipo: 'texto', max: 200, visible: esSi('historialLaboral'), requerido: false },
  { clave: 'trabajoRecienteMeses', nivel: 'integrante', registro: 3, variable: 95, grupo: 'integrante-laboral',
    etiqueta: 'Periodo laboral (meses)', tipo: 'entero', min: 0, max: 99,
    visible: esSi('historialLaboral'), requerido: false },
  { clave: 'empleosPrevios', nivel: 'integrante', registro: 3, variable: 96, grupo: 'integrante-laboral',
    etiqueta: '¿Cuenta con más empleos previos al actual?', tipo: 'unica', catalogo: 'CAT_SI_NO',
    visible: esSi('historialLaboral'), requerido: false },
  { clave: 'empleoPrevio1Lugar', nivel: 'integrante', registro: 3, variable: 97, grupo: 'integrante-laboral',
    etiqueta: 'Empleo previo 1: lugar de trabajo o actividad específica', tipo: 'texto', max: 200,
    visible: esSi('empleosPrevios'), requerido: false },
  { clave: 'empleoPrevio1Empleador', nivel: 'integrante', registro: 3, variable: 98, grupo: 'integrante-laboral',
    etiqueta: 'Empleo previo 1: nombre del empleador', tipo: 'texto', max: 200,
    visible: esSi('empleosPrevios'), requerido: false },
  { clave: 'empleoPrevio1Meses', nivel: 'integrante', registro: 3, variable: 99, grupo: 'integrante-laboral',
    etiqueta: 'Empleo previo 1: periodo laboral (meses)', tipo: 'entero', min: 0, max: 99,
    visible: esSi('empleosPrevios'), requerido: false },
  { clave: 'empleoPrevio2Lugar', nivel: 'integrante', registro: 3, variable: 100, grupo: 'integrante-laboral',
    etiqueta: 'Empleo previo 2: lugar de trabajo o actividad específica', tipo: 'texto', max: 200,
    visible: esSi('empleosPrevios'), requerido: false },
  { clave: 'empleoPrevio2Empleador', nivel: 'integrante', registro: 3, variable: 101, grupo: 'integrante-laboral',
    etiqueta: 'Empleo previo 2: nombre del empleador', tipo: 'texto', max: 200,
    visible: esSi('empleosPrevios'), requerido: false },
  { clave: 'empleoPrevio2Meses', nivel: 'integrante', registro: 3, variable: 102, grupo: 'integrante-laboral',
    etiqueta: 'Empleo previo 2: periodo laboral (meses)', tipo: 'entero', min: 0, max: 99,
    visible: esSi('empleosPrevios'), requerido: false },

  /* --- Exposición a asbesto (variables 103 a 116, opcionales, desde los 15 años) --- */
  { clave: 'actividadInvolucraAsbesto', nivel: 'integrante', registro: 3, variable: 103, grupo: 'integrante-asbesto',
    etiqueta: 'En alguno de sus trabajos, ¿ha realizado alguna actividad que involucre asbesto?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'actividadRelacionadaAsbesto', nivel: 'integrante', registro: 3, variable: 104, grupo: 'integrante-asbesto',
    etiqueta: 'En alguno de sus trabajos, ¿ha realizado alguna actividad relacionada con asbesto?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'actividadesAsbesto', nivel: 'integrante', registro: 3, variable: 105, grupo: 'integrante-asbesto',
    etiqueta: '¿Cuáles actividades relacionadas con asbesto ha realizado?', tipo: 'multiple',
    catalogo: 'CAT_ACTIVIDADES_ASBESTO', visible: esSi('actividadRelacionadaAsbesto'), requerido: 'bloqueo' },
  { clave: 'interactuoMaterialesAsbesto', nivel: 'integrante', registro: 3, variable: 106, grupo: 'integrante-asbesto',
    etiqueta: '¿Ha interactuado con materiales que tengan asbesto en sus trabajos?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'materialesAsbestoTrabajo', nivel: 'integrante', registro: 3, variable: 107, grupo: 'integrante-asbesto',
    etiqueta: '¿Con cuáles materiales con asbesto interactuó?', tipo: 'multiple',
    catalogo: 'CAT_MATERIALES_ASBESTO_TRABAJO', visible: esSi('interactuoMaterialesAsbesto'), requerido: 'bloqueo' },
  { clave: 'modalidadEmpleoAsbesto', nivel: 'integrante', registro: 3, variable: 108, grupo: 'integrante-asbesto',
    etiqueta: '¿En qué modalidad de empleo se presentó mayormente la exposición?', tipo: 'unica',
    catalogo: 'CAT_MODALIDAD_EMPLEO',
    visible: function (r) {
      return r.v('actividadInvolucraAsbesto') === 'si' || r.v('actividadRelacionadaAsbesto') === 'si' ||
        r.v('interactuoMaterialesAsbesto') === 'si';
    },
    requerido: false },
  { clave: 'materialesAsbestoHogar', nivel: 'integrante', registro: 3, variable: 109, grupo: 'integrante-asbesto',
    etiqueta: 'En su hogar, ¿ha tenido alguna vez materiales que contengan asbesto?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'elementosAsbestoHogar', nivel: 'integrante', registro: 3, variable: 110, grupo: 'integrante-asbesto',
    etiqueta: '¿Cuáles elementos del hogar tienen presencia de asbesto?', tipo: 'multiple',
    catalogo: 'CAT_ELEMENTOS_ASBESTO_HOGAR', visible: esSi('materialesAsbestoHogar'), requerido: 'bloqueo' },
  { clave: 'estadoMaterialesAsbesto', nivel: 'integrante', registro: 3, variable: 111, grupo: 'integrante-asbesto',
    etiqueta: '¿En qué estado se encuentran los materiales con asbesto de la vivienda?', tipo: 'unica',
    catalogo: 'CAT_ESTADO_MATERIALES', visible: esSi('materialesAsbestoHogar'), requerido: 'bloqueo' },
  { clave: 'conviveTrabajadorAsbesto', nivel: 'integrante', registro: 3, variable: 112, grupo: 'integrante-asbesto',
    etiqueta: 'En su hogar, ¿convive con alguien que haya trabajado con asbesto?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'reparacionesAsbesto', nivel: 'integrante', registro: 3, variable: 113, grupo: 'integrante-asbesto',
    etiqueta: '¿Ha hecho reparaciones en su vivienda con materiales que contengan asbesto?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'actividadAsbestoCerca', nivel: 'integrante', registro: 3, variable: 114, grupo: 'integrante-asbesto',
    etiqueta: '¿Recuerda alguna actividad que haya implicado asbesto cerca de su hogar?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false },
  { clave: 'actividadesAsbestoCerca', nivel: 'integrante', registro: 3, variable: 115, grupo: 'integrante-asbesto',
    etiqueta: '¿Cuál actividad con asbesto se realizó cerca de su hogar?', tipo: 'unica',
    catalogo: 'CAT_ACTIVIDADES_ASBESTO_CERCA', control: 'select',
    visible: esSi('actividadAsbestoCerca'), requerido: 'bloqueo' },
  { clave: 'familiaresEnfermedadAsbesto', nivel: 'integrante', registro: 3, variable: 116, grupo: 'integrante-asbesto',
    etiqueta: '¿Ha tenido familiares con enfermedades relacionadas con asbesto?', tipo: 'unica',
    catalogo: 'CAT_SI_NO_NA', visible: function (r) { return mayorDeAnios(r, 15); }, requerido: false }
];

/* ---------------------------------------------------------
   Catálogos citados por las preguntas
   Mapa explícito: en el navegador una `const` de otro <script> no es
   propiedad de `window`, y resolver el nombre con eval lo impide la CSP.
   pruebas/anexo.test.js comprueba que no falte ninguno.
   --------------------------------------------------------- */
const CATALOGOS_ANEXO = {
  CAT_SI_NO: CAT_SI_NO,
  CAT_SI_NO_NA: CAT_SI_NO_NA,
  CAT_TIPO_UBICACION: CAT_TIPO_UBICACION,
  CAT_AMBIENTES_VIVIENDA: CAT_AMBIENTES_VIVIENDA,
  CAT_ELEMENTOS_VIVIENDA: CAT_ELEMENTOS_VIVIENDA,
  CAT_ALUMBRADO: CAT_ALUMBRADO,
  CAT_ACCESO_VIVIENDA: CAT_ACCESO_VIVIENDA,
  CAT_MEDIOS_TRANSPORTE: CAT_MEDIOS_TRANSPORTE,
  CAT_SEGURIDAD_DESPLAZAMIENTO: CAT_SEGURIDAD_DESPLAZAMIENTO,
  CAT_DESPLAZAMIENTO_30: CAT_DESPLAZAMIENTO_30,
  CAT_FINALIDAD_TENENCIA: CAT_FINALIDAD_TENENCIA,
  CAT_CONFINAMIENTO_ANIMALES: CAT_CONFINAMIENTO_ANIMALES,
  CAT_HORAS_SUMINISTRO: CAT_HORAS_SUMINISTRO,
  CAT_TANQUE_AGUA: CAT_TANQUE_AGUA,
  CAT_FRECUENCIA_LIMPIEZA_TANQUE: CAT_FRECUENCIA_LIMPIEZA_TANQUE,
  CAT_DISTANCIA_TANQUE: CAT_DISTANCIA_TANQUE,
  CAT_ALMACENAMIENTO_RESIDUOS: CAT_ALMACENAMIENTO_RESIDUOS,
  CAT_REDUCCION_RESIDUOS: CAT_REDUCCION_RESIDUOS,
  CAT_DISPOSICION_PELIGROSOS: CAT_DISPOSICION_PELIGROSOS,
  CAT_APROVECHAMIENTO_RURAL: CAT_APROVECHAMIENTO_RURAL,
  CAT_SEPARACION_RESIDUOS: CAT_SEPARACION_RESIDUOS,
  CAT_LIMPIEZA_SUPERFICIES: CAT_LIMPIEZA_SUPERFICIES,
  CAT_ENERGIA_COCINAR: CAT_ENERGIA_COCINAR,
  CAT_FUENTES_HUMO: CAT_FUENTES_HUMO,
  CAT_PRACTICAS_CALIDAD_AIRE: CAT_PRACTICAS_CALIDAD_AIRE,
  CAT_TIPO_ESTUFA: CAT_TIPO_ESTUFA,
  CAT_VECTORES: CAT_VECTORES,
  CAT_MEDIDAS_VECTORES: CAT_MEDIDAS_VECTORES,
  CAT_ANIMALES_PONZONOSOS: CAT_ANIMALES_PONZONOSOS,
  CAT_MEDIDAS_PONZONOSOS: CAT_MEDIDAS_PONZONOSOS,
  CAT_LUGAR_QUIMICOS: CAT_LUGAR_QUIMICOS,
  CAT_DISPOSICION_QUIMICOS: CAT_DISPOSICION_QUIMICOS,
  CAT_APGAR: CAT_APGAR,
  CAT_MEDIDAS_RESPIRATORIAS: CAT_MEDIDAS_RESPIRATORIAS,
  CAT_ESTATUS_MIGRATORIO: CAT_ESTATUS_MIGRATORIO,
  CAT_URGENCIAS_HOGAR: CAT_URGENCIAS_HOGAR,
  CAT_ENFERMEDADES_ULTIMO_MES: CAT_ENFERMEDADES_ULTIMO_MES,
  CAT_ACCION_AFECCION: CAT_ACCION_AFECCION,
  CAT_CONSUMO_TABACO: CAT_CONSUMO_TABACO,
  CAT_RIESGO_GESTACIONAL: CAT_RIESGO_GESTACIONAL,
  CAT_RIESGO_PREECLAMPSIA: CAT_RIESGO_PREECLAMPSIA,
  CAT_METODO_ANTICONCEPTIVO_POSTPARTO: CAT_METODO_ANTICONCEPTIVO_POSTPARTO,
  CAT_ACTIVIDADES_ASBESTO: CAT_ACTIVIDADES_ASBESTO,
  CAT_MATERIALES_ASBESTO_TRABAJO: CAT_MATERIALES_ASBESTO_TRABAJO,
  CAT_MODALIDAD_EMPLEO: CAT_MODALIDAD_EMPLEO,
  CAT_ELEMENTOS_ASBESTO_HOGAR: CAT_ELEMENTOS_ASBESTO_HOGAR,
  CAT_ESTADO_MATERIALES: CAT_ESTADO_MATERIALES,
  CAT_ACTIVIDADES_ASBESTO_CERCA: CAT_ACTIVIDADES_ASBESTO_CERCA
};

function catalogoDePregunta(pregunta) {
  return pregunta.catalogo ? (CATALOGOS_ANEXO[pregunta.catalogo] || null) : null;
}

/* ---------------------------------------------------------
   Consultas sobre la declaración
   --------------------------------------------------------- */

const TABLA_POR_NIVEL = { ficha: 'ficha', vivienda: 'vivienda', familia: 'familia_ficha', integrante: 'integrante' };

function tablaDePregunta(pregunta) {
  return pregunta.tabla || TABLA_POR_NIVEL[pregunta.nivel];
}

/** `ambientesLuzNatural` → `ambientes_luz_natural`. */
function columnaDePregunta(pregunta) {
  return pregunta.columna || pregunta.clave.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/* Selección múltiple: una tabla puente por pregunta, como las del
   instrumento impreso (aps.vivienda_animal, aps.integrante_discapacidad…).
   Una fila por opción marcada permite contar y cruzar, que es lo que hacen
   las alertas y los reportes. */
const PUENTE_POR_TABLA = {
  ficha: { prefijo: 'ficha', padre: 'ficha_id', referencia: 'aps.ficha(id)' },
  vivienda: { prefijo: 'vivienda', padre: 'ficha_id', referencia: 'aps.vivienda(ficha_id)' },
  familia_ficha: { prefijo: 'familia', padre: 'familia_ficha_id', referencia: 'aps.familia_ficha(id)' },
  integrante: { prefijo: 'integrante', padre: 'integrante_id', referencia: 'aps.integrante(id)' }
};

function tablaPuenteDePregunta(pregunta) {
  return 'aps.' + PUENTE_POR_TABLA[tablaDePregunta(pregunta)].prefijo + '_' + columnaDePregunta(pregunta);
}

function columnaPadreDePregunta(pregunta) {
  return PUENTE_POR_TABLA[tablaDePregunta(pregunta)].padre;
}

/** `CAT_AMBIENTES_VIVIENDA` → `AMBIENTES_VIVIENDA`, el dominio en cat.dominio. */
function dominioDePregunta(pregunta) {
  return pregunta.catalogo ? pregunta.catalogo.replace(/^CAT_/, '') : null;
}

/** Código que aparece junto a la pregunta: A2.34 = registro 2, variable 34. */
function codigoDePregunta(pregunta) {
  return 'A' + pregunta.registro + '.' + pregunta.variable;
}

function preguntasDelNivel(nivel) {
  return PREGUNTAS_ANEXO.filter(function (p) { return p.nivel === nivel; });
}

function preguntasDelGrupo(grupo) {
  return PREGUNTAS_ANEXO.filter(function (p) { return p.grupo === grupo; });
}

function preguntaAnexo(clave) {
  return PREGUNTAS_ANEXO.find(function (p) { return p.clave === clave; }) || null;
}

function esVisibleAnexo(pregunta, lector) {
  return typeof pregunta.visible === 'function' ? pregunta.visible(lector) === true : true;
}
