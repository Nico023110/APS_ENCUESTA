/* Prueba funcional del motor de reglas APS.
   Carga catalogos.js y reglas.js en un contexto global, como hace el navegador. */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BASE = require('path').join(__dirname, '..');
const contexto = vm.createContext({ console: console });

['catalogos.js', 'reglas.js'].forEach(function (archivo) {
  vm.runInContext(fs.readFileSync(path.join(BASE, archivo), 'utf8'), contexto, { filename: archivo });
});

const { validarReglas, evaluarAdvertencias, evaluarAlertas, validarCierre,
        evaluarHacinamiento, calcularEdad, calcularImc, atencionesRpmsExigibles } = contexto;

let pasadas = 0, fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const HOY = new Date();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ---------- Ficha base: ítems 1 a 38 completos y válidos ---------- */
function fichaBase() {
  return {
    consentimiento: 'si',
    situacionInminente: 'no_aplica',
    departamentoCodigo: '76',
    municipioCodigo: '76001',
    uzpe: 'UZPE006',
    areaUbicacion: 'urbana',
    territorio: 'T48',
    microterritorio: 'MT01',
    divisionTerritorial: 'Barrio San Cayetano',
    equipoSaludId: 'EBS001',
    prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC',
    responsableNumeroId: '1144012345',
    perfilProfesional: 'enfermeria',
    codigoFicha: '76001-EBS001-0001',
    fechaDiligenciamiento: iso(HOY),
    entornoAbordaje: 'hogar',
    cabezaFamilia: 'María Pérez',
    jovenesEnPaz: 'no',
    direccionNormalizada: { completa: true, faltantes: [] },
    latitud: 3.45, longitud: -76.53,
    ubicacionReferencia: 'Frente a la cancha',
    idHogar: 'HOG-001', idFamilia: 'FAM-001',
    estrato: 'bajo',
    hogaresEnVivienda: 1,
    personasEnVivienda: 4,
    habitacionesVivienda: 2,
    elementosParaDormir: 3,
    tipoVivienda: 'casa',
    materialTecho: 'concreto',
    riesgosAccidente: ['ninguno'],
    vectores: 'no',
    factoresContaminacion: ['ninguno']
  };
}

/* ---------- Integrante adulto válido ---------- */
function adultaValida() {
  return {
    primerNombre: 'Ana', primerApellido: 'Gomez',
    tipoId: 'CC', numeroId: '1144099887',
    fechaNacimiento: '1996-05-10',
    nacionalidad: 'CO', sexo: 'mujer', genero: 'femenino',
    autoidentificacionGenero: 'femenino', orientacionSexual: 'heterosexual',
    telefono1: '3155551234', rolFamiliar: 'responsable_economico',
    /* Códigos de catálogo, no texto libre: los ítems 73 y 76 son llave
       foránea en el esquema (cat.ocupacion_ciuo, cat.eapb). */
    ocupacion: '5223', nivelEducativo: 'media_academica',
    regimenAfiliacion: 'subsidiado', eapb: 'ESS024',
    sujetoEspecialProteccion: ['ninguna'], pertenenciaEtnica: 'ninguna',
    saberesAncestrales: ['ninguna'], discapacidad: ['sin_discapacidad'],
    certificacionRlcpd: 'no_aplica', intencionReproductiva: 'no', gestacionActual: 'no',
    practicasCuidado: ['alimentacion'], atencionesPendientesRpms: ['ninguna'],
    conocimientoDerecho: ['derechos_deberes'], lactanciaExclusiva: 'no_aplica',
    peso: 65, talla: 160, circunferenciaCintura: 80, imc: 25.39,
    clasificacionAntropometrica: 'normal',
    tensionSistolica: 118, tensionDiastolica: 75, clasificacionTension: 'normal',
    enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: ['ninguna'], sintomatologiaDepresiva: ['ninguno'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  };
}

function familiaValida(integrantes) {
  return {
    idFamilia: 'FAM-001', tipoFamilia: 'nuclear_monoparental',
    numeroIntegrantes: integrantes.length, integrantes: integrantes,
    cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'],
    practicasVinculo: ['escucha_activa'], redesApoyo: 'cuenta_protectoras',
    practicasCuidadoHogar: ['ventilacion']
  };
}

console.log('\n=== 1. Compatibilidad: la app actual (ítems 1-38) sigue funcionando ===');
const base = fichaBase();
let errores = validarReglas(base);
verificar('Ficha válida sin familias => 0 bloqueos', errores.length === 0,
  JSON.stringify(errores.map(e => e.codigo + ':' + e.campo)));

const sinConsentimiento = Object.assign(fichaBase(), { consentimiento: 'no' });
verificar('Sin consentimiento => sólo RN-001', validarReglas(sinConsentimiento).length === 1);

const incompleta = fichaBase();
delete incompleta.estrato;
incompleta.habitacionesVivienda = null;
errores = validarReglas(incompleta);
verificar('Faltan estrato y habitaciones => 2 bloqueos', errores.length === 2,
  JSON.stringify(errores.map(e => e.codigo)));

console.log('\n=== 2. Activación por sección: las reglas nuevas no bloquean antes de tiempo ===');
verificar('Ítems 39-49 ausentes => no se evalúan', validarReglas(fichaBase()).length === 0);
const conSaneamiento = Object.assign(fichaBase(), { actividadEconomica: 'no' });
errores = validarReglas(conSaneamiento);
verificar('Al aparecer el ítem 39 se activa el bloque 4', errores.length > 0 &&
  errores.some(e => e.codigo === 'RN-046'), JSON.stringify(errores.map(e => e.codigo)));

console.log('\n=== 3. RN-032 / RN-033 — Umbrales DANE de hacinamiento ===');
verificar('4 personas / 2 hab = 2.0 => sin hacinamiento', evaluarHacinamiento(4, 2).hacinamiento === 'no');
verificar('5 personas / 2 hab = 2.5 => hacinamiento regular',
  evaluarHacinamiento(5, 2).hacinamiento === 'si' && evaluarHacinamiento(5, 2).prioridad === 'regular');
verificar('7 personas / 2 hab = 3.5 => hacinamiento crítico',
  evaluarHacinamiento(7, 2).critico === true && evaluarHacinamiento(7, 2).prioridad === 'prioritaria');

console.log('\n=== 4. RN-064 — Edad calculada y coherencia con el documento ===');
const edad = calcularEdad('2025-03-12', '2026-08-12');
verificar('Edad 1 año 5 meses => 17 meses', edad.anios === 1 && edad.meses === 5 && edad.totalMeses === 17,
  JSON.stringify(edad));
verificar('IMC 65 kg / 160 cm = 25.39', calcularImc(65, 160) === 25.39, String(calcularImc(65, 160)));

const menorConAS = familiaValida([Object.assign(adultaValida(), {
  tipoId: 'AS', numeroId: 'TMP-0001', fechaNacimiento: '2015-01-01'
})]);
errores = validarReglas(Object.assign(fichaBase(), { familias: [menorConAS] }));
verificar('AS en un menor de edad => bloqueo RN-064',
  errores.some(e => e.codigo === 'RN-064' && e.campo === 'tipoId'));

const adultoConTI = familiaValida([Object.assign(adultaValida(), { tipoId: 'TI', numeroId: '1144099887' })]);
const datosTI = Object.assign(fichaBase(), { familias: [adultoConTI] });
verificar('TI en un adulto => advertencia, no bloqueo',
  validarReglas(datosTI).filter(e => e.codigo === 'RN-064').length === 0 &&
  evaluarAdvertencias(datosTI).some(e => e.codigo === 'RN-064'));

console.log('\n=== 5. RN-087 — Matriz de tamizajes por edad y sexo ===');
const paraMujer30 = atencionesRpmsExigibles(30 * 12, 'mujer', false).map(a => a.valor);
const paraHombre55 = atencionesRpmsExigibles(55 * 12, 'hombre', false).map(a => a.valor);
const paraBebe = atencionesRpmsExigibles(4, 'mujer', false).map(a => a.valor);
verificar('Mujer de 30 no recibe tamizaje de próstata', paraMujer30.indexOf('tamizaje_prostata') === -1);
verificar('Mujer de 30 sí recibe tamizaje de anemia (edad fértil)', paraMujer30.indexOf('tamizaje_anemia') !== -1);
verificar('Mujer de 30 no recibe tamizaje de mama (< 40 años)', paraMujer30.indexOf('tamizaje_mama') === -1);
verificar('Hombre de 55 sí recibe próstata y colon',
  paraHombre55.indexOf('tamizaje_prostata') !== -1 && paraHombre55.indexOf('tamizaje_colon') !== -1);
verificar('Bebé de 4 meses recibe lactancia y vacunación',
  paraBebe.indexOf('lactancia_materna') !== -1 && paraBebe.indexOf('vacunacion') !== -1);
verificar('Bebé de 4 meses no recibe riesgo cardiovascular', paraBebe.indexOf('tamizaje_cardiovascular') === -1);

const conTamizajeInvalido = familiaValida([Object.assign(adultaValida(), {
  atencionesPendientesRpms: ['tamizaje_prostata']
})]);
verificar('Marcar próstata en una mujer => bloqueo RN-087',
  validarReglas(Object.assign(fichaBase(), { familias: [conTamizajeInvalido] }))
    .some(e => e.codigo === 'RN-087'));

console.log('\n=== 6. RN-051 — El bloque 5 se repite por integrante ===');
const familiaIncompleta = familiaValida([adultaValida()]);
familiaIncompleta.numeroIntegrantes = 3;
errores = validarReglas(Object.assign(fichaBase(), { familias: [familiaIncompleta] }));
verificar('Declara 3 integrantes y captura 1 => bloqueo RN-051',
  errores.some(e => e.codigo === 'RN-051'),
  JSON.stringify(errores.filter(e => e.codigo === 'RN-051').map(e => e.mensaje)));

const dosResponsables = familiaValida([adultaValida(),
  Object.assign(adultaValida(), { numeroId: '1144099888', primerNombre: 'Luz' })]);
verificar('Dos responsables económicos => bloqueo RN-051',
  validarReglas(Object.assign(fichaBase(), { familias: [dosResponsables] }))
    .some(e => e.codigo === 'RN-051' && e.campo === 'rolFamiliar'));

const documentoRepetido = familiaValida([adultaValida(),
  Object.assign(adultaValida(), { primerNombre: 'Luz', rolFamiliar: 'hijo' })]);
verificar('Documento repetido en la familia => bloqueo RN-063',
  validarReglas(Object.assign(fichaBase(), { familias: [documentoRepetido] }))
    .some(e => e.codigo === 'RN-063'));

console.log('\n=== 7. Reglas de decisión clínica (RN-201 a RN-212) ===');
const conSuicidio = familiaValida([Object.assign(adultaValida(), { ideacionSuicida: 'ha_pensado' })]);
let alertas = evaluarAlertas(Object.assign(fichaBase(), { familias: [conSuicidio] }));
const alertaSuicidio = alertas.find(a => a.codigo === 'RN-202');
verificar('Ideación suicida => alerta INMEDIATA', alertaSuicidio && alertaSuicidio.prioridad === 'inmediata');
verificar('RN-202 notifica a SIVIGILA y bloquea sincronización',
  alertaSuicidio && alertaSuicidio.notificaSivigila && alertaSuicidio.bloqueaSincronizacion);
verificar('RN-202 es la alerta de mayor prioridad (va primero)', alertas[0].codigo === 'RN-202');

const conCrisis = familiaValida([Object.assign(adultaValida(), {
  tensionSistolica: 190, tensionDiastolica: 125, clasificacionTension: 'crisis'
})]);
alertas = evaluarAlertas(Object.assign(fichaBase(), { familias: [conCrisis] }));
verificar('Crisis hipertensiva => RN-203 INMEDIATA',
  alertas.some(a => a.codigo === 'RN-203' && a.prioridad === 'inmediata'));

const hipertensoSinAdherencia = familiaValida([Object.assign(adultaValida(), {
  tensionSistolica: 135, tensionDiastolica: 85, clasificacionTension: 'nivel1',
  enfermedadesNoTransmisibles: ['cardiovascular'], adherenciaTratamiento: 'no',
  motivoNoTratamiento: ['sin_medicamentos']
})]);
alertas = evaluarAlertas(Object.assign(fichaBase(), { familias: [hipertensoSinAdherencia] }));
verificar('Hipertensión nivel 1 sin adherencia => sube a PRIORITARIA',
  alertas.some(a => a.codigo === 'RN-203' && a.prioridad === 'prioritaria'));
verificar('Desabastecimiento => barrera administrativa RN-210',
  alertas.some(a => a.codigo === 'RN-210' && a.titulo.indexOf('administrativa') !== -1));

const gestanteMenor = familiaValida([Object.assign(adultaValida(), {
  fechaNacimiento: iso(new Date(HOY.getFullYear() - 13, HOY.getMonth(), HOY.getDate())),
  tipoId: 'TI', gestacionActual: 'si', atencionesPendientesMaterno: ['control_prenatal'],
  barrerasAcceso: ['sin_agenda'], nivelEducativo: 'basica_secundaria', ocupacion: null
})]);
alertas = evaluarAlertas(Object.assign(fichaBase(), { familias: [gestanteMenor] }));
verificar('Gestante de 13 años => RN-205 INMEDIATA',
  alertas.some(a => a.codigo === 'RN-205' && a.prioridad === 'inmediata'));
verificar('Gestante menor de 14 => presunto delito sexual RN-206',
  alertas.some(a => a.codigo === 'RN-206' && a.prioridad === 'inmediata'));

const desnutricionSevera = familiaValida([Object.assign(adultaValida(), {
  fechaNacimiento: iso(new Date(HOY.getFullYear() - 3, HOY.getMonth(), HOY.getDate())),
  tipoId: 'RC', numeroId: '10203040506',
  clasificacionAntropometrica: 'desnutricion_severa', signosDesnutricion: ['edema']
})]);
alertas = evaluarAlertas(Object.assign(fichaBase(), { familias: [desnutricionSevera] }));
const alertaNutricional = alertas.find(a => a.codigo === 'RN-204');
verificar('Desnutrición severa con edema => INMEDIATA y notifica',
  alertaNutricional && alertaNutricional.prioridad === 'inmediata' && alertaNutricional.notificaSivigila);

const conTuberculosis = familiaValida([
  Object.assign(adultaValida(), { condicionesTransmisibles: ['tuberculosis'] }),
  Object.assign(adultaValida(), { primerNombre: 'Luz', numeroId: '1144099889', rolFamiliar: 'hijo' })
]);
alertas = evaluarAlertas(Object.assign(fichaBase(), { familias: [conTuberculosis], personasEnVivienda: 7, habitacionesVivienda: 2 }));
verificar('Tuberculosis => notificación SIVIGILA',
  alertas.some(a => a.codigo === 'RN-208' && a.notificaSivigila));
verificar('Conviviente marcado como contacto de TB',
  alertas.some(a => a.titulo === 'Contacto de tuberculosis'));
verificar('Hacinamiento eleva la prioridad del contacto',
  alertas.some(a => a.titulo === 'Contacto de tuberculosis' && a.prioridad === 'prioritaria'));

const noAfiliadoEnfermo = familiaValida([Object.assign(adultaValida(), {
  regimenAfiliacion: 'no_afiliado', eapb: null,
  tensionSistolica: 190, tensionDiastolica: 125, clasificacionTension: 'crisis'
})]);
alertas = evaluarAlertas(Object.assign(fichaBase(), { familias: [noAfiliadoEnfermo] }));
verificar('No afiliado con alerta clínica => RN-209 sube a INMEDIATA',
  alertas.some(a => a.codigo === 'RN-209' && a.prioridad === 'inmediata'));

const entornoMalo = Object.assign(fichaBase(), {
  actividadEconomica: 'no', animales: ['ninguno'],
  fuenteAgua: 'rio_quebrada', disposicionExcretas: 'campo_abierto',
  aguasResiduales: 'campo_abierto', residuosSolidos: 'quema',
  vectores: 'si', materialTecho: 'fibrocemento_con_asbesto',
  personasEnVivienda: 8, habitacionesVivienda: 2
});
alertas = evaluarAlertas(entornoMalo);
verificar('Entorno con 3+ hallazgos => alto riesgo sanitario',
  alertas.some(a => a.titulo === 'Entorno de alto riesgo sanitario'));

console.log('\n=== 8. RN-221 / RN-222 — Semaforización y cierre ===');
const cierreLimpio = validarCierre(Object.assign(fichaBase(), { familias: [familiaValida([adultaValida()])] }));
verificar('Ficha completa y sin riesgo => puede cerrar', cierreLimpio.puedeCerrar,
  JSON.stringify(cierreLimpio.impedimentos.map(i => i.codigo + ': ' + i.mensaje)));
verificar('Sin alertas => "Sin riesgo identificado"', cierreLimpio.riesgoFamiliar.nivel === 'sin_riesgo');

const cierreConSuicidio = validarCierre(Object.assign(fichaBase(), { familias: [conSuicidio] }));
verificar('Riesgo suicida sin plan => no puede cerrar', cierreConSuicidio.puedeCerrar === false);
verificar('Riesgo suicida => semáforo en riesgo alto', cierreConSuicidio.riesgoFamiliar.nivel === 'alto');
verificar('Riesgo alto => seguimiento a 30 días con gestor de caso',
  cierreConSuicidio.riesgoFamiliar.diasSeguimiento === 30 && cierreConSuicidio.riesgoFamiliar.gestorDeCaso);

console.log('\n=== 9. Advertencias que no bloquean ===');
const fueraDeCali = Object.assign(fichaBase(), { latitud: 4.71, longitud: -74.07 });
verificar('Coordenadas de Bogotá => advertencia, no bloqueo',
  validarReglas(fueraDeCali).length === 0 &&
  evaluarAdvertencias(fueraDeCali).filter(a => a.codigo === 'RN-022' || a.codigo === 'RN-023').length === 2);

const territorioRuralEnUrbano = Object.assign(fichaBase(), { territorio: 'T55', microterritorio: 'MT01' });
verificar('Territorio rural con área urbana => advertencia RN-007',
  evaluarAdvertencias(territorioRuralEnUrbano).some(a => a.codigo === 'RN-007'));

console.log('\n=== 10. Campos calculados y llaves del plan de cuidado ===');
const hacinamientoManipulado = Object.assign(fichaBase(), {
  personasEnVivienda: 6, habitacionesVivienda: 2,
  personasPorHabitacion: 1.0, hacinamiento: 'no'
});
errores = validarReglas(hacinamientoManipulado);
verificar('Personas por habitación editada a mano => bloqueo RN-032',
  errores.some(e => e.codigo === 'RN-032'));
verificar('Hacinamiento editado a mano => bloqueo RN-033',
  errores.some(e => e.codigo === 'RN-033'));

const imcManipulado = familiaValida([Object.assign(adultaValida(), { imc: 19 })]);
verificar('IMC editado a mano => bloqueo RN-095',
  validarReglas(Object.assign(fichaBase(), { familias: [imcManipulado] }))
    .some(e => e.codigo === 'RN-095'));

const tensionManipulada = familiaValida([Object.assign(adultaValida(), {
  tensionSistolica: 190, tensionDiastolica: 125, clasificacionTension: 'normal'
})]);
verificar('Clasificación de tensión incoherente => bloqueo RN-099',
  validarReglas(Object.assign(fichaBase(), { familias: [tensionManipulada] }))
    .some(e => e.codigo === 'RN-099'));

// RN-133 / RN-134: el plan de la persona debe apuntar al integrante correcto.
const conPlanErrado = familiaValida([Object.assign(adultaValida(), {
  planPersona: {
    codigoEbs: 'EBS001', codigoVivienda: 'HOG-001', codigoFamilia: 'FAM-001',
    tipoIdIntegrante: 'CC', numeroIdIntegrante: '9999999999',
    acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: '890201', tipoRespuesta: 'en_sitio' }],
    seguimientos: []
  }
})]);
const datosPlanErrado = Object.assign(fichaBase(), {
  familias: [conPlanErrado],
  planVivienda: { codigoEbs: 'EBS001', codigoVivienda: 'HOG-001', acciones: [], seguimientos: [] }
});
errores = validarReglas(datosPlanErrado);
verificar('Plan que apunta a un documento inexistente => bloqueo RN-134',
  errores.some(e => e.codigo === 'RN-134'),
  JSON.stringify(errores.map(e => e.codigo)));

const conPlanCorrecto = familiaValida([Object.assign(adultaValida(), {
  planPersona: {
    codigoEbs: 'EBS001', codigoVivienda: 'HOG-001', codigoFamilia: 'FAM-001',
    tipoIdIntegrante: 'CC', numeroIdIntegrante: '1144099887',
    acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: '890201', tipoRespuesta: 'en_sitio' }],
    seguimientos: []
  }
})]);
verificar('Plan con llaves heredadas correctas => sin bloqueos',
  validarReglas(Object.assign(fichaBase(), {
    familias: [conPlanCorrecto],
    planVivienda: { codigoEbs: 'EBS001', codigoVivienda: 'HOG-001', acciones: [], seguimientos: [] }
  })).length === 0);

const llaveViviendaErrada = Object.assign(fichaBase(), {
  familias: [familiaValida([adultaValida()])],
  planVivienda: { codigoEbs: 'OTRO-EBS', codigoVivienda: 'HOG-001', acciones: [], seguimientos: [] }
});
verificar('Código de EBS divergente en el plan => bloqueo RN-111',
  validarReglas(llaveViviendaErrada).some(e => e.codigo === 'RN-111'));

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas > 0 ? 1 : 0);
