/* =========================================================================
   El recorrido del formulario, de principio a fin
   -------------------------------------------------------------------------
   Aquí vive el diligenciamiento y nada más. Lo usan dos guiones con
   propósitos distintos:

     encuesta_completa.spec.js   una ficha de prueba, que se borra al terminar
     encuesta_real.spec.js       una ficha de verdad, que se queda en la base

   Están separados porque hacen cosas distintas —uno verifica, el otro
   registra— pero comparten este archivo para que no se conviertan en dos
   copias que se van separando con el tiempo. Si el formulario cambia, cambia
   aquí una vez.

   CÓMO SE DILIGENCIA

   Con clic y teclado, tecla por tecla. Nunca asignando `.value`: cada
   pulsación dispara los `input` que el formulario escucha para recalcular
   edad, IMC y hacinamiento, y un atajo los saltaría.

   El recorrido no se detiene en el primer tropiezo. Lo anota en el diario y
   sigue, para que una sola pasada muestre todo lo que falló.
   ========================================================================= */

'use strict';

const { expect } = require('@playwright/test');
const ayudas = require('./ayudas');

/** Fecha en formato ISO, desplazada los días que se le pidan. */
function fechaISO(desplazamientoEnDias) {
  const f = new Date();
  f.setDate(f.getDate() + (desplazamientoEnDias || 0));
  return f.toISOString().split('T')[0];
}

/* Los campos que el formulario muestra u oculta según la edad y el sexo se
   piden con esta marca: si no están, no es un fallo. */
const SI_APLICA = { opcional: true };

/* =========================================================
   RECORRIDO PRINCIPAL
   ========================================================= */

/**
 * Diligencia el formulario entero salvo el cierre.
 *
 * @param {object} ficha    Datos de la vivienda, el hogar y el plan.
 * @param {Array}  personas Integrantes de la familia, en orden.
 */
async function diligenciarEncuesta(page, diario, ficha, personas) {
  const escribir = function (campo, valor, etiqueta, opciones) {
    return ayudas.escribir(page, diario, campo, valor, etiqueta, opciones);
  };
  const elegir = function (campo, valor, etiqueta, opciones) {
    return ayudas.elegir(page, diario, campo, valor, etiqueta, opciones);
  };
  const marcar = function (nombre, valores, etiqueta, opciones) {
    return ayudas.marcar(page, diario, nombre, valores, etiqueta, opciones);
  };
  const buscarCups = function (campo, codigo, etiqueta) {
    return ayudas.buscarCups(page, diario, campo, codigo, etiqueta);
  };

  const seccion = async function (titulo) {
    diario.entrarA(titulo);
    await ayudas.anunciar(page, titulo);
  };

  const HOY = fechaISO(0);
  const EN_UN_MES = fechaISO(30);

  /* ---------------------------------------------------------
     0. Abrir la aplicación
     --------------------------------------------------------- */

  await seccion('0. Apertura de la aplicación');

  await page.goto('/');
  await expect(page.locator('#appTabs')).toBeVisible();

  /* Los catálogos pueblan los selects al cargar. Empezar antes haría fallar
     todo por listas vacías y el informe culparía al formulario. */
  await page.waitForFunction(function () {
    const s = document.getElementById('territorio');
    return s && s.options.length > 1;
  }, null, { timeout: 15000 });

  diario.hito('Catálogos cargados; el formulario está listo');

  await page.getByRole('button', { name: 'Nueva Encuesta' }).click();
  await expect(page.locator('#view-nueva')).toHaveClass(/is-active/);
  await expect(page.locator('#encuestaForm')).toBeVisible();

  /* ---------------------------------------------------------
     1. Consentimiento informado (RN-001)
     ---------------------------------------------------------
     Va de primero de verdad, no por orden estético: sin él, el `fieldset`
     de captura queda deshabilitado y ningún otro campo admite datos.
     --------------------------------------------------------- */

  await seccion('1. Política de tratamiento de datos');

  await marcar('consentimiento', 'si', 'Consentimiento informado');
  await expect(page.locator('#bloquesCaptura')).not.toBeDisabled();
  diario.hito('El consentimiento desbloqueó los bloques de captura');

  /* ---------------------------------------------------------
     2. Información general
     --------------------------------------------------------- */

  await seccion('2.1 Situaciones inminentes que ponen en peligro la vida');
  await marcar('situacionInminente', ficha.situacionInminente, 'Situación inminente');

  await seccion('2.2 Datos generales del escenario del entorno');

  await elegir('#uzpe', ficha.uzpe, 'UZPE');
  await elegir('#areaUbicacion', ficha.areaUbicacion, 'Área de ubicación');
  await elegir('#territorio', ficha.territorio, 'Territorio');

  /* RN-009: el microterritorio se repuebla al elegir territorio. */
  await page.waitForFunction(function () {
    const s = document.getElementById('microterritorio');
    return s && !s.disabled && s.options.length > 1;
  }, null, { timeout: 5000 }).catch(function () {
    diario.problema('Microterritorio',
      'no se pobló tras elegir el territorio ' + ficha.territorio + ' (RN-009)');
  });

  await elegir('#microterritorio', ficha.microterritorio, 'Microterritorio');
  await escribir('#divisionTerritorial', ficha.divisionTerritorial, 'División territorial');

  /* La comuna se deduce del microterritorio: se comprueba, no se escribe. */
  const comuna = await page.locator('#comuna').inputValue();
  if (comuna) diario.ok('Comuna (derivada)', comuna);
  else diario.problema('Comuna', 'no se dedujo del microterritorio (RN-009)');

  await seccion('2.3 y 2.4 Equipo de salud y personal responsable');

  await escribir('#equipoSaludId', ficha.ebs, 'Código del EBS');
  await elegir('#prestadorPrimario', ficha.prestador, 'Prestador primario');
  await elegir('#responsableTipoId', ficha.responsableTipoId, 'Tipo de documento del responsable');
  await escribir('#responsableNumeroId', ficha.responsableNumeroId, 'Documento del responsable');
  await elegir('#perfilProfesional', ficha.perfilProfesional, 'Perfil profesional');
  await escribir('#codigoFicha', ficha.codigo, 'Código de la ficha');
  await escribir('#fechaDiligenciamiento', HOY, 'Fecha de diligenciamiento');

  await seccion('2.4.1 Datos de abordaje');

  await elegir('#entornoAbordaje', ficha.entornoAbordaje, 'Entorno de abordaje');
  await escribir('#cabezaFamilia', ficha.cabezaFamilia, 'Cabeza de familia');
  await elegir('#jovenesEnPaz', ficha.jovenesEnPaz, 'Jóvenes en paz');

  await seccion('2.5 Datos generales de la vivienda');

  /* Ítem 21 (RN-021): la dirección se arma por componentes. */
  await elegir('#viaTipo', ficha.direccion.viaTipo, 'Tipo de vía');
  await escribir('#viaNumero', ficha.direccion.viaNumero, 'Número de vía');
  await escribir('#genNumero', ficha.direccion.genNumero, 'Número generador');
  await escribir('#placa', ficha.direccion.placa, 'Placa');

  const direccion = (await page.locator('.direccion-resultado')
    .first().textContent().catch(function () { return ''; })) || '';
  if (direccion.trim()) diario.ok('Dirección compuesta', direccion.trim().slice(0, 80));

  /* Ítem 22: georreferenciación. */
  await escribir('#latitud', ficha.latitud, 'Latitud');
  await escribir('#longitud', ficha.longitud, 'Longitud');
  await escribir('#ubicacionReferencia', ficha.ubicacionReferencia, 'Punto de referencia');

  await escribir('#idHogar', ficha.hogar, 'ID del hogar');
  await escribir('#idFamilia', ficha.familia, 'ID de la familia');
  await elegir('#estrato', ficha.estrato, 'Estrato');
  await escribir('#hogaresEnVivienda', ficha.hogaresEnVivienda, 'Hogares en la vivienda');
  await escribir('#personasEnVivienda', ficha.personasEnVivienda, 'Personas en la vivienda');
  await escribir('#habitacionesVivienda', ficha.habitacionesVivienda, 'Habitaciones');
  await escribir('#elementosParaDormir', ficha.elementosParaDormir, 'Elementos para dormir');

  /* RN-030: el hacinamiento se calcula solo. */
  const porHabitacion = await page.locator('#personasPorHabitacion').inputValue();
  if (porHabitacion) diario.ok('Personas por habitación (calculada)', porHabitacion);
  else diario.problema('Personas por habitación', 'no se calculó (RN-030)');

  /* ---------------------------------------------------------
     3. Condiciones del entorno y la vivienda
     --------------------------------------------------------- */

  await seccion('3.1 Características y condiciones de la vivienda');

  await elegir('#tipoVivienda', ficha.tipoVivienda, 'Tipo de vivienda');
  await elegir('#materialTecho', ficha.materialTecho, 'Material del techo');
  await marcar('vectores', ficha.vectores, 'Presencia de vectores');
  await marcar('riesgosAccidente', ficha.riesgosAccidente, 'Riesgos de accidente');
  await marcar('factoresContaminacion', ficha.factoresContaminacion, 'Factores de contaminación');

  await seccion('3.2 Oficios y animales en la vivienda');

  await marcar('actividadEconomica', ficha.actividadEconomica, 'Actividad económica en la vivienda');
  await marcar('animales', ficha.animales, 'Animales en la vivienda');

  /* RN-041 a RN-045: los conteos sólo se habilitan si hay perros o gatos, y
     el ítem 45 (carnet antirrábico) pasa de «No aplica» a obligatorio. */
  if (ficha.mascotas) {
    await escribir('#perros', ficha.mascotas.perros, 'Perros', SI_APLICA);
    await escribir('#perrosVacunados', ficha.mascotas.perrosVacunados, 'Perros vacunados', SI_APLICA);
    await escribir('#gatos', ficha.mascotas.gatos, 'Gatos', SI_APLICA);
    await escribir('#gatosVacunados', ficha.mascotas.gatosVacunados, 'Gatos vacunados', SI_APLICA);
    await marcar('carnetAntirrabico', ficha.mascotas.carnet, 'Carnet antirrábico (ítem 45)');
  }

  await seccion('3.3 Agua y saneamiento básico');

  await elegir('#fuenteAgua', ficha.fuenteAgua, 'Fuente de agua');
  await elegir('#disposicionExcretas', ficha.disposicionExcretas, 'Disposición de excretas');
  await elegir('#aguasResiduales', ficha.aguasResiduales, 'Aguas residuales');
  await elegir('#residuosSolidos', ficha.residuosSolidos, 'Residuos sólidos');

  /* ---------------------------------------------------------
     4. La familia
     --------------------------------------------------------- */

  await seccion('4.1 Estructura y contexto familiar');

  /* RN-050: lo declarado aquí debe coincidir con los integrantes que se
     caractericen abajo. */
  await elegir('familias[0].tipoFamilia', ficha.tipoFamilia, 'Tipo de familia');
  await escribir('familias[0].numeroIntegrantes', String(personas.length), 'Número de integrantes');

  /* Al declarar el número, `sincronizarIntegrantes` abre los bloques que
     faltan: no hay que pulsar «Agregar integrante». Se comprueba, porque de
     ese automatismo depende que la sección 5 exista. */
  const bloquesIntegrante = page.locator(
    '[data-bloque="familia"] [data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]'
  );
  await expect(bloquesIntegrante,
    'declarar ' + personas.length + ' integrantes no abrió sus bloques en la sección 5')
    .toHaveCount(personas.length, { timeout: 5000 });

  diario.ok('El formulario abrió los bloques de integrante', personas.length + ' bloques');

  await marcar('familias[0].cuidadorPrincipal', ficha.cuidadorPrincipal, 'Cuidador principal');
  await marcar('familias[0].redesApoyo', ficha.redesApoyo, 'Redes de apoyo');
  await marcar('familias[0].situacionesRiesgo', ficha.situacionesRiesgo, 'Situaciones de riesgo familiar');

  await seccion('4.2 Prácticas protectoras de la familia');

  await marcar('familias[0].practicasVinculo', ficha.practicasVinculo, 'Prácticas de vínculo');
  await marcar('familias[0].practicasCuidadoHogar', ficha.practicasCuidadoHogar,
    'Prácticas de cuidado en el hogar');

  /* ---------------------------------------------------------
     5. Los integrantes
     --------------------------------------------------------- */

  for (let i = 0; i < personas.length; i++) {
    await diligenciarIntegrante(page, diario, i, personas[i], seccion,
      { escribir: escribir, elegir: elegir, marcar: marcar });
  }

  /* Cerrada la sección 5, lo declarado y lo caracterizado deben coincidir
     (RN-050). Comprobarlo aquí ahorra descifrar después de dónde salió el
     descuadre que denuncia el cierre. */
  await expect(bloquesIntegrante, 'la familia no quedó con los integrantes declarados')
    .toHaveCount(personas.length);

  /* ---------------------------------------------------------
     6. Plan de cuidado
     --------------------------------------------------------- */

  const verificarHerencia = crearVerificadorDeHerencia(page, diario);

  await seccion('6.1 Plan de cuidado de la vivienda');

  /* RN-111 y RN-112: los códigos de EBS y vivienda no se digitan, se heredan
     de la ficha; lo que corresponde es comprobarlos. */
  await verificarHerencia('planVivienda', {
    codigoEbs: ficha.ebs,
    codigoVivienda: ficha.hogar
  }, ['RN-111', 'RN-112']);

  await diligenciarAccionYSeguimiento(
    'planVivienda', ficha.planVivienda, HOY, EN_UN_MES,
    { escribir: escribir, elegir: elegir, marcar: marcar, buscarCups: buscarCups });

  await seccion('6.2 Plan de cuidado de la familia');

  /* El plan se ata a una familia caracterizada en la sección 4. El valor de
     la opción es el índice de la familia, no su código. */
  await elegir('planesFamilia[0].familiaRef', '0', 'Familia a la que corresponde el plan');

  await verificarHerencia('planesFamilia[0]', {
    codigoEbs: ficha.ebs,
    codigoVivienda: ficha.hogar,
    /* RN-026: la llave de la familia no es el ítem 26 que se digitó, sino la
       que el servidor deriva del hogar y del consecutivo. */
    codigoFamilia: ficha.codigoFamiliaDerivado
  }, ['RN-120', 'RN-121', 'RN-122']);

  await diligenciarAccionYSeguimiento(
    'planesFamilia[0]', ficha.planFamilia, HOY, EN_UN_MES,
    { escribir: escribir, elegir: elegir, marcar: marcar, buscarCups: buscarCups });

  await seccion('6.3 Plan de cuidado de la persona');

  /* El valor de la opción es «familia:integrante». */
  const intervenido = ficha.planPersona.integrante;
  await elegir('planesPersona[0].integranteRef', '0:' + intervenido, 'Integrante intervenido');

  await verificarHerencia('planesPersona[0]', {
    codigoEbs: ficha.ebs,
    codigoVivienda: ficha.hogar,
    codigoFamilia: ficha.codigoFamiliaDerivado
  }, ['RN-130', 'RN-131', 'RN-132']);

  await verificarDocumentoDelPlan(page, diario, personas[intervenido]);

  await diligenciarAccionYSeguimiento(
    'planesPersona[0]', ficha.planPersona, HOY, EN_UN_MES,
    { escribir: escribir, elegir: elegir, marcar: marcar, buscarCups: buscarCups });
}

/* =========================================================
   UN INTEGRANTE
   ========================================================= */

async function diligenciarIntegrante(page, diario, indice, persona, seccion, api) {
  const P = 'familias[0].integrantes[' + indice + '].';
  const escribir = api.escribir;
  const elegir = api.elegir;
  const marcar = api.marcar;

  await seccion('5.' + (indice + 1) + ' Integrante ' + (indice + 1) + ': ' + persona.titulo);

  await escribir(P + 'primerNombre', persona.primerNombre, 'Primer nombre');
  if (persona.segundoNombre) await escribir(P + 'segundoNombre', persona.segundoNombre, 'Segundo nombre');
  await escribir(P + 'primerApellido', persona.primerApellido, 'Primer apellido');
  await escribir(P + 'segundoApellido', persona.segundoApellido, 'Segundo apellido');

  await marcar(P + 'tipoId', persona.tipoId, 'Tipo de documento');
  await escribir(P + 'numeroId', persona.numeroId, 'Número de documento');
  await escribir(P + 'fechaNacimiento', persona.fechaNacimiento, 'Fecha de nacimiento');

  /* RN-065: la edad la calcula el formulario, y de ella dependen las
     preguntas que se muestran a continuación. */
  const edad = await page.locator('[name="' + P + 'edadTexto"]').inputValue();
  if (edad && edad !== '—') diario.ok('Edad (calculada)', edad);
  else diario.problema('Edad', 'no se calculó desde la fecha de nacimiento (RN-065)');

  const anios = parseInt(String(edad).match(/^(\d+)/) ? String(edad).match(/^(\d+)/)[1] : '', 10);

  await elegir(P + 'nacionalidad', persona.nacionalidad || 'CO', 'Nacionalidad');
  await marcar(P + 'sexo', persona.sexo, 'Sexo al nacer');
  await marcar(P + 'genero', persona.genero, 'Género');
  await marcar(P + 'autoidentificacionGenero', persona.autoidentificacion, 'Autoidentificación de género');

  /* Orientación sexual: desde los 13 años. */
  if (persona.orientacion) {
    await marcar(P + 'orientacionSexual', persona.orientacion, 'Orientación sexual', SI_APLICA);
  } else {
    diario.noAplica('Orientación sexual', 'sólo se pregunta desde los 13 años');
  }

  if (persona.telefono) await escribir(P + 'telefono1', persona.telefono, 'Teléfono de contacto');
  await marcar(P + 'rolFamiliar', persona.rol, 'Rol en la familia');

  /* --- Socioeconómicas --- */
  await elegir(P + 'ocupacion', persona.ocupacion, 'Ocupación (CIUO)');
  await elegir(P + 'nivelEducativo', persona.nivelEducativo, 'Nivel educativo');
  await elegir(P + 'regimenAfiliacion', persona.regimen || 'subsidiado', 'Régimen de afiliación');
  await elegir(P + 'eapb', persona.eapb || 'ESS024', 'EAPB');
  await marcar(P + 'sujetoEspecialProteccion', 'ninguna', 'Sujeto de especial protección');
  await elegir(P + 'pertenenciaEtnica', persona.pertenenciaEtnica || 'ninguna', 'Pertenencia étnica');
  await marcar(P + 'saberesAncestrales', 'ninguna', 'Saberes ancestrales');

  /* --- Salud y prácticas de cuidado --- */
  await marcar(P + 'discapacidad', 'sin_discapacidad', 'Discapacidad');
  await marcar(P + 'certificacionRlcpd', 'no_aplica', 'Certificación RLCPD');
  await marcar(P + 'practicasCuidado', 'alimentacion', 'Prácticas de cuidado');
  await marcar(P + 'intencionReproductiva', persona.intencionReproductiva || 'no', 'Intención reproductiva');

  /* Gestación: sólo para sexos con capacidad de gestar (RN-085). */
  if (persona.gestacion) {
    await marcar(P + 'gestacionActual', persona.gestacion, 'Gestación actual', SI_APLICA);
  } else {
    diario.noAplica('Gestación actual', 'no se pregunta para este sexo (RN-085)');
  }

  /* Lactancia exclusiva: el formulario sólo la muestra a menores de 6 meses. */
  await marcar(P + 'atencionesPendientesRpms', 'ninguna', 'Atenciones pendientes RPMS');
  await marcar(P + 'conocimientoDerecho', 'derechos_deberes', 'Conocimiento de derechos');

  /* --- Antropometría --- */
  await escribir(P + 'peso', persona.peso, 'Peso (kg)');
  await escribir(P + 'talla', persona.talla, 'Talla (cm)');

  /* Circunferencia de cintura: desde los 18 años. */
  if (persona.cintura) {
    await escribir(P + 'circunferenciaCintura', persona.cintura, 'Circunferencia de cintura', SI_APLICA);
  } else {
    diario.noAplica('Circunferencia de cintura', 'sólo se mide desde los 18 años');
  }

  /* RN-092 a RN-097: el IMC lo calcula el formulario con lo recién tecleado. */
  const imc = await page.locator('[name="' + P + 'imc"]').inputValue();
  if (imc && imc !== '—') diario.ok('IMC (calculado)', imc);
  else diario.problema('IMC', 'no se calculó desde peso y talla (RN-092)');

  await marcar(P + 'clasificacionAntropometrica',
    persona.clasificacionAntropometrica || 'normal', 'Clasificación antropométrica');

  /* Tensión arterial: desde los 18 años. */
  if (persona.sistolica) {
    await escribir(P + 'tensionSistolica', persona.sistolica, 'Tensión sistólica', SI_APLICA);
    await escribir(P + 'tensionDiastolica', persona.diastolica, 'Tensión diastólica', SI_APLICA);
  } else {
    diario.noAplica('Tensión arterial', 'sólo se toma desde los 18 años');
  }

  /* --- Morbilidad --- */
  await marcar(P + 'enfermedadesNoTransmisibles',
    persona.enfermedadesNoTransmisibles || 'ninguna', 'Enfermedades no transmisibles');
  await marcar(P + 'condicionesTransmisibles', 'ninguna', 'Condiciones transmisibles');
  await marcar(P + 'zonaEndemica', 'ninguna', 'Zona endémica');
  await marcar(P + 'limitacionCotidiana', 'no', 'Limitación en la vida cotidiana');

  /* Ítem 105: situaciones de riesgo psicosocial, sólo entre los 14 y los 28. */
  if (isFinite(anios) && anios >= 14 && anios <= 28) {
    await marcar(P + 'riesgosSaludMentalJoven', 'ninguna',
      'Situaciones de riesgo para la salud mental (ítem 105)', SI_APLICA);
  } else {
    diario.noAplica('Situaciones de riesgo para la salud mental',
      'sólo se indaga entre los 14 y los 28 años');
  }

  /* Salud mental y consumo: desde los 14 años (RN-105 a RN-110). */
  if (isFinite(anios) && anios >= 14) {
    await marcar(P + 'sintomatologiaDepresiva', 'ninguno', 'Sintomatología depresiva', SI_APLICA);
    await marcar(P + 'ideacionSuicida', 'ninguno', 'Ideación suicida', SI_APLICA);
    await marcar(P + 'consumoSpa', 'no', 'Consumo de SPA', SI_APLICA);
  } else {
    diario.noAplica('Salud mental y consumo de SPA', 'sólo se indaga desde los 14 años');
  }
}

/* =========================================================
   PIEZAS COMPARTIDAS DEL PLAN DE CUIDADO
   ========================================================= */

/** Una acción y su seguimiento, que los tres planes comparten en forma. */
async function diligenciarAccionYSeguimiento(prefijo, plan, hoy, enUnMes, api) {
  const A = prefijo + '.acciones[0].';
  await api.elegir(A + 'ejecutorTipoId', plan.ejecutorTipoId, 'Tipo de documento del ejecutor');
  await api.escribir(A + 'ejecutorNumeroId', plan.ejecutorNumeroId, 'Documento del ejecutor');
  /* Ítems 114, 124 y 136a: el código se teclea y la tabla `cat.cups` responde
     con las coincidencias. Se escribe y se elige de la lista, como en campo. */
  await api.buscarCups(A + 'codigoAccion', plan.codigoAccion, 'Código de la acción');
  await api.escribir(A + 'procedimientoRealizado', plan.procedimientoRealizado,
    'Procedimiento realizado', { opcional: true });
  await api.marcar(A + 'tipoRespuesta', plan.tipoRespuesta, 'Tipo de respuesta');

  const S = prefijo + '.seguimientos[0].';
  await api.elegir(S + 'seguimientoTipoId', plan.ejecutorTipoId, 'Tipo de documento del seguimiento');
  await api.escribir(S + 'seguimientoNumeroId', plan.ejecutorNumeroId, 'Documento del seguimiento');
  await api.escribir(S + 'accionConcertada', plan.accionConcertada, 'Acción concertada');
  await api.escribir(S + 'seg1Fecha', hoy, 'Fecha del primer seguimiento');
  await api.elegir(S + 'seg1Estado', 'C', 'Estado del primer seguimiento');
  /* RN-119: el segundo seguimiento va después del primero. */
  await api.escribir(S + 'seg2Fecha', enUnMes, 'Fecha del segundo seguimiento');
  await api.elegir(S + 'seg2Estado', 'C', 'Estado del segundo seguimiento');
}

/**
 * Comprueba las llaves que el plan hereda de la ficha (RN-111 y siguientes):
 * que traigan el valor correcto y que no admitan digitación.
 */
function crearVerificadorDeHerencia(page, diario) {
  return async function (prefijo, esperados, codigosRegla) {
    const leidos = await page.evaluate(function (datos) {
      const salida = {};
      Object.keys(datos.campos).forEach(function (campo) {
        const el = document.querySelector('[name="' + datos.prefijo + '.' + campo + '"]');
        salida[campo] = el ? { valor: el.value, soloLectura: !!el.readOnly } : null;
      });
      return salida;
    }, { prefijo: prefijo, campos: esperados });

    Object.keys(esperados).forEach(function (campo, i) {
      const regla = codigosRegla[i] || '';
      const leido = leidos[campo];

      if (!leido) {
        diario.problema(campo, 'la llave heredada no existe en el plan (' + regla + ')');
        return;
      }
      if (leido.valor !== esperados[campo]) {
        diario.problema(campo, 'no heredó el valor de la ficha (' + regla + ')',
          'se esperaba "' + esperados[campo] + '" y quedó "' + leido.valor + '"');
        return;
      }
      if (!leido.soloLectura) {
        diario.problema(campo, 'la llave heredada admite digitación (' + regla + ')');
        return;
      }
      diario.ok(campo + ' heredado y bloqueado (' + regla + ')', leido.valor);
    });
  };
}

/**
 * RN-133 y RN-134: al elegir el integrante, su documento se autocompleta y
 * queda bloqueado. Escribir en él sería un error; lo que corresponde es
 * comprobar que trajo lo de la sección 5.
 */
async function verificarDocumentoDelPlan(page, diario, persona) {
  const documento = await page.evaluate(function () {
    const tipo = document.querySelector('select[name="planesPersona[0].tipoIdIntegrante"]');
    const numero = document.querySelector('input[name="planesPersona[0].numeroIdIntegrante"]');
    return {
      tipo: tipo ? tipo.value : null, tipoBloqueado: tipo ? tipo.disabled : null,
      numero: numero ? numero.value : null, numeroBloqueado: numero ? numero.readOnly : null
    };
  });

  if (documento.tipo === persona.tipoId && documento.numero === persona.numeroId) {
    diario.ok('Documento del integrante autocompletado (RN-133/134)',
      documento.tipo + ' ' + documento.numero);
  } else {
    diario.problema('Documento del integrante en el plan',
      'no se autocompletó desde la sección 5 (RN-133/134)',
      'se esperaba ' + persona.tipoId + ' ' + persona.numeroId +
      ' y quedó ' + documento.tipo + ' ' + documento.numero);
  }

  if (documento.tipoBloqueado && documento.numeroBloqueado) {
    diario.ok('El documento heredado quedó bloqueado a la digitación');
  } else {
    diario.problema('Documento del integrante en el plan',
      'quedó editable pese a ser heredado (RN-133/134)',
      'tipo bloqueado: ' + documento.tipoBloqueado +
      ', número bloqueado: ' + documento.numeroBloqueado);
  }
}

/* =========================================================
   CIERRE Y GUARDADO
   ========================================================= */

/**
 * Pulsa «Guardar», que ahora escribe directamente en la base, y comprueba
 * después que no quede nada pendiente de sincronizar.
 *
 * El orden importa: se empieza a escuchar la petición antes de pulsar. Si se
 * escuchara después, la respuesta podría llegar primero y la espera se
 * quedaría colgada hasta agotar el tiempo.
 *
 * @returns {{guardo: boolean, respuestaApi: object|null, alertas: Array}}
 */
async function cerrarYGuardar(page, diario, ficha) {
  const seccion = async function (titulo) {
    diario.entrarA(titulo);
    await ayudas.anunciar(page, titulo);
  };

  await seccion('7. Cierre y guardado de la ficha');

  await page.locator('#seccion-cierre').scrollIntoViewIfNeeded();

  const esperaApi = page.waitForResponse(function (r) {
    return r.url().indexOf('/api/guardar_encuesta') !== -1;
  }, { timeout: 30000 });

  await page.locator('#btnGuardar').click();

  /* Si la ficha no pasa la validación del navegador, nunca sale la petición:
     la espera se resuelve en nulo y el diagnóstico lo dan los impedimentos. */
  const respuesta = await esperaApi.catch(function () { return null; });

  await page.waitForTimeout(1200);

  const avisos = await ayudas.leerAvisos(page);
  const erroresDeCampo = await ayudas.leerErroresDeCampo(page);
  const impedimentos = await ayudas.leerImpedimentos(page);
  const alertas = await ayudas.leerAlertas(page);

  diario.hito('Resultado del intento de guardar');
  avisos.forEach(function (a) { console.log('   • aviso [' + a.tipo + '] ' + a.texto); });

  if (alertas.length > 0) {
    console.log('\n   Alertas calculadas para esta ficha (RN-200 y siguientes):');
    alertas.forEach(function (a) {
      console.log('     – ' + a.titulo + '   [' + a.pies.join(' · ') + ']');
    });
  } else {
    console.log('\n   Sin alertas calculadas para esta ficha.');
  }

  if (erroresDeCampo.length > 0) {
    console.log('\n   Incumplimientos de reglas marcados en el formulario:');
    erroresDeCampo.forEach(function (e) {
      diario.problema('campo ' + e.campo, 'incumplimiento de regla al guardar', e.mensaje);
    });
  }

  if (impedimentos.length > 0) {
    console.log('\n   Impedimentos de cierre (RN-222):');
    impedimentos.forEach(function (i) {
      diario.problema('cierre', 'impedimento pendiente', i.mensaje + '   [' + i.pies.join(' · ') + ']');
    });
  }

  let respuestaApi = null;

  if (!respuesta) {
    diario.problema('Guardado',
      'el formulario no llamó a /api/guardar_encuesta al pulsar Guardar');
  } else {
    const estado = respuesta.status();
    const cuerpo = await respuesta.json().catch(function () { return {}; });
    respuestaApi = { estado: estado, cuerpo: cuerpo };

    if (estado === 200) {
      diario.ok('La ficha se escribió en la base al guardar', 'HTTP 200 · ' + JSON.stringify({
        alertas: cuerpo.alertas, plan: cuerpo.filasPlanCuidado
      }));
    } else {
      const bloqueos = (cuerpo.bloqueos || []).map(function (b) {
        return b.codigo + ' @ ' + b.ruta + ': ' + b.mensaje;
      });
      diario.problema('Guardado', 'la API rechazó la ficha (HTTP ' + estado + ')',
        bloqueos.length > 0 ? bloqueos.join('\n       ') : JSON.stringify(cuerpo).slice(0, 400));
    }
  }

  const guardo = avisos.some(function (a) { return a.tipo === 'success'; });

  if (!guardo) {
    diario.hito('La ficha no pudo cerrarse');
    return { guardo: false, respuestaApi: respuestaApi, alertas: alertas };
  }

  /* ------------------------------------------------------------------
     8. La sincronización ya no debería tener nada que hacer
     ------------------------------------------------------------------ */

  await seccion('8. Comprobación de que no queda nada pendiente');

  await expect(page.locator('#view-historial')).toHaveClass(/is-active/);

  const filas = await page.locator('#historialTableBody tr').count();
  if (filas > 0) diario.ok('La ficha aparece en el historial', filas + ' registro(s)');
  else diario.problema('Historial', 'la ficha guardada no aparece en el historial');

  /* La ficha tiene que haber quedado marcada como sincronizada: es lo que
     distingue «se guardó en la base» de «se guardó en el dispositivo». */
  const estadoLocal = await page.evaluate(function (codigo) {
    const todas = JSON.parse(localStorage.getItem('aps_encuestas') || '[]');
    const nuestra = todas.find(function (e) { return e.codigoFicha === codigo; });
    return {
      existe: !!nuestra,
      sincronizada: nuestra ? nuestra.sincronizada === true : null,
      pendientes: todas.filter(function (e) { return e.sincronizada !== true; }).length
    };
  }, ficha.codigo);

  if (estadoLocal.existe && estadoLocal.sincronizada) {
    diario.ok('La ficha quedó marcada como guardada en la base', ficha.codigo);
  } else {
    diario.problema('Estado local',
      'la ficha no quedó marcada como sincronizada pese a haberse guardado',
      JSON.stringify(estadoLocal));
  }

  /* La aplicación ya no siembra fichas de demostración, así que el
     almacenamiento no debería traer nada más que lo diligenciado aquí. Se
     comprueba en vez de limpiarlo: si reaparecieran, este paso volvería a
     medir el rechazo de unas fichas de ejemplo en lugar del de la ficha real. */
  const soloLaNuestra = await page.evaluate(function (codigo) {
    const todas = JSON.parse(localStorage.getItem('aps_encuestas') || '[]');
    return {
      total: todas.length,
      ajenas: todas.filter(function (e) { return e.codigoFicha !== codigo; })
        .map(function (e) { return e.codigoFicha; })
    };
  }, ficha.codigo);

  if (soloLaNuestra.ajenas.length === 0) {
    diario.ok('El almacenamiento local sólo tiene la ficha diligenciada');
  } else {
    diario.problema('Almacenamiento local',
      'hay fichas que esta corrida no diligenció',
      soloLaNuestra.ajenas.join(', '));
  }

  await page.getByRole('button', { name: 'Inicio' }).click();
  await page.getByRole('button', { name: 'Sincronizar a la Nube' }).click();
  await page.waitForTimeout(900);

  const avisosSync = await ayudas.leerAvisos(page);
  avisosSync.forEach(function (a) { console.log('   • aviso [' + a.tipo + '] ' + a.texto); });

  const yaEstaba = avisosSync.some(function (a) {
    return a.texto.indexOf('ya están guardadas') !== -1;
  });

  if (yaEstaba) {
    diario.ok('Sincronizar no reenvía lo que ya está en la base');
  } else {
    diario.problema('Sincronización',
      'no informó que la ficha ya estaba guardada',
      avisosSync.map(function (a) { return a.tipo + ': ' + a.texto; }).join(' | '));
  }

  await ayudas.anunciar(page, 'Recorrido terminado');
  await page.waitForTimeout(600);

  return { guardo: true, respuestaApi: respuestaApi, alertas: alertas };
}


module.exports = {
  fechaISO: fechaISO,
  diligenciarEncuesta: diligenciarEncuesta,
  cerrarYGuardar: cerrarYGuardar
};
