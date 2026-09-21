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
        evaluarHacinamiento, calcularEdad, calcularImc, atencionesRpmsExigibles, liderDelEntorno } = contexto;

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

/* Por debajo de la edad mínima del documento no hay trámite pendiente que
   valga: el documento aún no puede existir. */
const menorConCC = familiaValida([Object.assign(adultaValida(), {
  tipoId: 'CC', numeroId: '1144099887', fechaNacimiento: '2011-05-10'
})]);
const datosCC = Object.assign(fichaBase(), { familias: [menorConCC] });
const bloqueoCC = validarReglas(datosCC).find(e => e.codigo === 'RN-064' && e.campo === 'tipoId');
verificar('CC en un menor de edad => bloqueo RN-064 sobre tipoId', !!bloqueoCC,
  JSON.stringify(validarReglas(datosCC).map(e => e.codigo + ':' + e.campo)));
verificar('  el mensaje nombra la edad exigida y la calculada',
  !!bloqueoCC && /18 años o más/.test(bloqueoCC.mensaje) && /15 años/.test(bloqueoCC.mensaje),
  bloqueoCC && bloqueoCC.mensaje);
verificar('  y no se duplica como advertencia',
  evaluarAdvertencias(datosCC).filter(e => e.codigo === 'RN-064').length === 0);

const ninoConTI = familiaValida([Object.assign(adultaValida(), {
  tipoId: 'TI', numeroId: '1144099887', fechaNacimiento: '2022-05-10'
})]);
verificar('TI a los 4 años => bloqueo RN-064',
  validarReglas(Object.assign(fichaBase(), { familias: [ninoConTI] }))
    .some(e => e.codigo === 'RN-064' && e.campo === 'tipoId'));

const recienCedulado = familiaValida([Object.assign(adultaValida(), {
  tipoId: 'CC', numeroId: '1144099887',
  fechaNacimiento: iso(new Date(HOY.getFullYear() - 18, HOY.getMonth(), HOY.getDate()))
})]);
verificar('CC el día que cumple 18 => sin incumplimiento ni advertencia',
  validarReglas(Object.assign(fichaBase(), { familias: [recienCedulado] })).filter(e => e.codigo === 'RN-064').length === 0 &&
  evaluarAdvertencias(Object.assign(fichaBase(), { familias: [recienCedulado] })).filter(e => e.codigo === 'RN-064').length === 0);

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
const fichaIncompleta = Object.assign(fichaBase(), { familias: [familiaIncompleta] });
errores = validarReglas(fichaIncompleta);
/* El integrante que no estaba en la visita no impide guardar: advierte. */
verificar('Declara 3 integrantes y captura 1 => advertencia RN-051, no bloqueo',
  errores.filter(e => e.codigo === 'RN-051').length === 0 &&
  evaluarAdvertencias(fichaIncompleta).some(e => e.codigo === 'RN-051' && e.campo === 'numeroIntegrantes'),
  JSON.stringify(errores.filter(e => e.codigo === 'RN-051').map(e => e.mensaje)));

const dosHogaresUnaFamilia = Object.assign(fichaBase(), { hogaresEnVivienda: 2, familias: [familiaValida([adultaValida()])] });
verificar('Declara 2 hogares y caracteriza 1 familia => advertencia RN-028, no bloqueo',
  validarReglas(dosHogaresUnaFamilia).filter(e => e.codigo === 'RN-028').length === 0 &&
  evaluarAdvertencias(dosHogaresUnaFamilia).some(e => e.codigo === 'RN-028') &&
  validarCierre(dosHogaresUnaFamilia).puedeCerrar === true,
  JSON.stringify(validarCierre(dosHogaresUnaFamilia).impedimentos.map(i => i.codigo)));

/* RN-051 (rol): el aviso dice qué falta y cae sobre el integrante a cambiar. */
const sinResponsable = familiaValida([Object.assign(adultaValida(), { rolFamiliar: 'hijo' })]);
const errSinResp = validarReglas(Object.assign(fichaBase(), { familias: [sinResponsable] }))
  .filter(e => e.codigo === 'RN-051' && e.campo === 'rolFamiliar');
verificar('Sin responsable económico => un solo aviso que dice que ninguno tiene el rol',
  errSinResp.length === 1 && /Ningún integrante/.test(errSinResp[0].mensaje) &&
  errSinResp[0].ruta === 'familias[0].integrantes[0].rolFamiliar',
  JSON.stringify(errSinResp));

const dosResponsablesRol = familiaValida([adultaValida(), Object.assign(adultaValida(), { numeroId: '1144099888' })]);
const errDosResp = validarReglas(Object.assign(fichaBase(), { familias: [dosResponsablesRol] }))
  .filter(e => e.codigo === 'RN-051' && e.campo === 'rolFamiliar');
verificar('Dos responsables económicos => el aviso cae sobre el segundo y nombra al primero',
  errDosResp.length === 1 && errDosResp[0].ruta === 'familias[0].integrantes[1].rolFamiliar' &&
  /ya tiene un/.test(errDosResp[0].mensaje),
  JSON.stringify(errDosResp));

/* RN-019: en Hogar el líder se toma del responsable económico. */
const hogarSinLider = Object.assign(fichaBase(), { entornoAbordaje: 'hogar', cabezaFamilia: '', familias: [familiaValida([adultaValida()])] });
verificar('Entorno Hogar sin ítem 19 => no bloquea y se deriva «Ana Gomez»',
  validarReglas(hogarSinLider).filter(e => e.codigo === 'RN-019').length === 0 &&
  liderDelEntorno(hogarSinLider) === 'Ana Gomez',
  liderDelEntorno(hogarSinLider));
const comunitarioSinLider = Object.assign(fichaBase(), { entornoAbordaje: 'comunitario', nombreInstitucion: 'JAC', cabezaFamilia: '' });
verificar('Entorno comunitario sin ítem 19 => sigue bloqueando RN-019',
  validarReglas(comunitarioSinLider).some(e => e.codigo === 'RN-019'));

/* RN-065: «Otra» exige el país en 65.1. */
const otraSinPais = familiaValida([Object.assign(adultaValida(), { nacionalidad: 'OT', nacionalidadOtra: '' })]);
verificar('Nacionalidad «Otra» sin país => bloqueo RN-065 en 65.1',
  validarReglas(Object.assign(fichaBase(), { familias: [otraSinPais] }))
    .some(e => e.codigo === 'RN-065' && e.campo === 'nacionalidadOtra'));
const otraConPais = familiaValida([Object.assign(adultaValida(), { nacionalidad: 'OT', nacionalidadOtra: 'Ecuador' })]);
verificar('Nacionalidad «Otra» con país => sin incumplimiento RN-065',
  validarReglas(Object.assign(fichaBase(), { familias: [otraConPais] }))
    .filter(e => e.codigo === 'RN-065').length === 0);

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

/* Plan de cuidado diferido: la ficha se guarda sin plan y queda marcada como
   pendiente; la conducta ante riesgo de suicidio se exige por esa vía. */
const cierreConSuicidio = validarCierre(Object.assign(fichaBase(), { familias: [conSuicidio] }));
verificar('Riesgo suicida sin plan => puede guardar (plan diferido)', cierreConSuicidio.puedeCerrar === true,
  JSON.stringify(cierreConSuicidio.impedimentos.map(i => i.codigo + ': ' + i.mensaje)));
verificar('Riesgo suicida sin plan => plan de cuidado pendiente',
  cierreConSuicidio.planCuidado.pendiente === true && cierreConSuicidio.planCuidado.alertasSinConducta > 0);
verificar('El pendiente nombra la conducta ante riesgo de suicidio',
  cierreConSuicidio.planCuidado.pendientes.some(p => p.codigo === 'RN-202' && /suicidio/.test(p.mensaje)));
verificar('Riesgo suicida => semáforo en riesgo alto', cierreConSuicidio.riesgoFamiliar.nivel === 'alto');

verificar('Ficha sin alertas y sin acciones => plan pendiente (sin acciones registradas)',
  cierreLimpio.planCuidado.pendiente === true && cierreLimpio.planCuidado.accionesRegistradas === 0 &&
  cierreLimpio.planCuidado.pendientes.length === 1);

const planVacio = {
  codigoEbs: 'EBS001', codigoVivienda: 'HOG-001',
  acciones: [{ ejecutorTipoId: null, ejecutorNumeroId: '', codigoAccion: null, procedimientoRealizado: '' }],
  seguimientos: [{ seguimientoTipoId: '', seguimientoNumeroId: null, accionConcertada: null, seg1Fecha: null, seg1Estado: null }]
};
const conFilaVacia = Object.assign(fichaBase(), { planVivienda: planVacio });
errores = validarReglas(conFilaVacia);
verificar('Fila vacía del plan => no genera incumplimientos', errores.length === 0,
  JSON.stringify(errores.map(e => e.codigo + ':' + e.ruta)));

const filaAMedias = Object.assign(fichaBase(), { planVivienda: Object.assign({}, planVacio, {
  acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: null }]
}) });
errores = validarReglas(filaAMedias);
verificar('Fila del plan a medias => sí se exige completarla', errores.some(e => e.codigo === 'RN-114'),
  JSON.stringify(errores.map(e => e.codigo)));

const conPlan = Object.assign(fichaBase(), { familias: [familiaValida([adultaValida()])], planVivienda: Object.assign({}, planVacio, {
  acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: '890201', tipoRespuesta: 'en_sitio' }],
  seguimientos: []
}) });
const cierreConPlan = validarCierre(conPlan);
verificar('Ficha con una acción y sin alertas => plan registrado',
  cierreConPlan.puedeCerrar && cierreConPlan.planCuidado.pendiente === false &&
  cierreConPlan.planCuidado.accionesRegistradas === 1,
  JSON.stringify(cierreConPlan.impedimentos.map(i => i.codigo + ': ' + i.mensaje)));
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

/* Unidades equivocadas: antes pasaban el "mayor a cero" y la base respondía
   500 "numeric field overflow" al generar el IMC. */
function bloqueosAntropometricos(peso, talla) {
  const familia = familiaValida([Object.assign(adultaValida(), {
    peso: peso, talla: talla, imc: calcularImc(peso, talla)
  })]);
  return validarReglas(Object.assign(fichaBase(), { familias: [familia] }));
}
verificar('Peso en gramos (3500) => bloqueo RN-092 sobre peso',
  bloqueosAntropometricos(3500, 160).some(e => e.codigo === 'RN-092' && e.campo === 'peso'));
verificar('Talla en metros (1.65) => bloqueo RN-093 sobre talla',
  bloqueosAntropometricos(65, 1.65).some(e => e.codigo === 'RN-093' && e.campo === 'talla'));
verificar('Talla con dígito de menos (16) => bloqueo RN-093',
  bloqueosAntropometricos(65, 16).some(e => e.codigo === 'RN-093'));
verificar('Par incoherente (100 kg / 30 cm, IMC 1111) => bloqueo RN-095',
  bloqueosAntropometricos(100, 30).some(e => e.codigo === 'RN-095'));
verificar('Recién nacido (3.2 kg / 49 cm) => sin bloqueo antropométrico',
  !bloqueosAntropometricos(3.2, 49).some(e => ['RN-092', 'RN-093', 'RN-095'].indexOf(e.codigo) !== -1));
verificar('Obesidad extrema (250 kg / 170 cm) => sin bloqueo antropométrico',
  !bloqueosAntropometricos(250, 170).some(e => ['RN-092', 'RN-093', 'RN-095'].indexOf(e.codigo) !== -1));

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
