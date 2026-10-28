/* Prueba funcional del motor de reglas APS.
   Carga catalogos.js y reglas.js en un contexto global, como hace el navegador. */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BASE = require('path').join(__dirname, '..');
const contexto = vm.createContext({ console: console });

['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'reglas.js'].forEach(function (archivo) {
  vm.runInContext(fs.readFileSync(path.join(BASE, archivo), 'utf8'), contexto, { filename: archivo });
});

/* Las variables obligatorias del anexo técnico SI-APS (anexo.js). */
const { viviendaAnexo, familiaAnexo, integranteAnexo } = require('./_anexo_datos');

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
  return Object.assign(viviendaAnexo(), {
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
    factoresContaminacion: ['ninguno'],
    // ítems 39-49: el motor los exige siempre
    actividadEconomica: 'no', animales: ['ninguno'], carnetAntirrabico: 'no_aplica',
    fuenteAgua: ['acueducto_esp'], disposicionExcretas: ['alcantarillado'],
    aguasResiduales: ['alcantarillado'], residuosSolidos: ['servicio_aseo']
  });
}

/* ---------- Integrante adulto válido ---------- */
function adultaValida() {
  return Object.assign(integranteAnexo(), {
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
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'], riesgosSaludMentalJoven: ['ninguna'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  });
}

function familiaValida(integrantes) {
  return Object.assign(familiaAnexo(), {
    idFamilia: 'FAM-001', tipoFamilia: 'nuclear_monoparental',
    numeroIntegrantes: integrantes.length, integrantes: integrantes,
    cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'],
    practicasVinculo: ['escucha_activa'], redesApoyo: 'cuenta_protectoras',
    practicasCuidadoHogar: ['ventilacion']
  });
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

console.log('\n=== 2. Bloque 4 (ítems 39-49): se exige siempre ===');
/* El formulario omite los campos vacíos: sin los ítems 39 y 46 el bloque
   entero se saltaba y la ficha se guardaba sin agua ni saneamiento. */
const sinAguaNiActividad = fichaBase();
delete sinAguaNiActividad.fuenteAgua;
delete sinAguaNiActividad.actividadEconomica;
errores = validarReglas(sinAguaNiActividad);
verificar('Sin fuente de agua ni actividad económica => bloquea RN-039 y RN-046',
  errores.length === 2 && errores.some(e => e.codigo === 'RN-039') && errores.some(e => e.codigo === 'RN-046'),
  JSON.stringify(errores.map(e => e.codigo)));
verificar('…y la ficha no puede cerrarse', validarCierre(sinAguaNiActividad).puedeCerrar === false);

const sinSaneamiento = fichaBase();
['actividadEconomica', 'animales', 'carnetAntirrabico', 'fuenteAgua',
 'disposicionExcretas', 'aguasResiduales', 'residuosSolidos'].forEach(c => { delete sinSaneamiento[c]; });
const codigosSinSaneamiento = validarReglas(sinSaneamiento).map(e => e.codigo).sort().join(',');
verificar('Bloque 4 vacío => exige RN-039, RN-040 y RN-046 a RN-049',
  codigosSinSaneamiento === 'RN-039,RN-040,RN-046,RN-047,RN-048,RN-049', codigosSinSaneamiento);

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

/* RN-028 — Un hogar puede reunir varias familias: cada familia dice a qué
   hogar pertenece, y la advertencia cuenta hogares, no familias. */
const familiaEnHogar = (n) => Object.assign(familiaValida([adultaValida()]), { hogarNumero: n });
const dosFamiliasUnHogar = Object.assign(fichaBase(), { hogaresEnVivienda: 1, familias: [familiaEnHogar(1), familiaEnHogar(1)] });
verificar('Dos familias en el único hogar declarado => sin bloqueo ni advertencia RN-028',
  validarReglas(dosFamiliasUnHogar).filter(e => e.codigo === 'RN-028').length === 0 &&
  !evaluarAdvertencias(dosFamiliasUnHogar).some(e => e.codigo === 'RN-028'),
  JSON.stringify(validarReglas(dosFamiliasUnHogar).concat(evaluarAdvertencias(dosFamiliasUnHogar))
    .filter(e => e.codigo === 'RN-028').map(e => e.mensaje)));

const dosHogaresUnoCaracterizado = Object.assign(fichaBase(), { hogaresEnVivienda: 2, familias: [familiaEnHogar(1), familiaEnHogar(1)] });
verificar('Dos familias en el hogar 1 de 2 declarados => advertencia RN-028 por el hogar 2',
  evaluarAdvertencias(dosHogaresUnoCaracterizado).some(e => e.codigo === 'RN-028' && /caracterizadas en 1/.test(e.mensaje)) &&
  validarReglas(dosHogaresUnoCaracterizado).filter(e => e.codigo === 'RN-028').length === 0);

const sinHogar = Object.assign(fichaBase(), { hogaresEnVivienda: 2, familias: [familiaEnHogar(null)] });
verificar('Familia sin hogar elegido => bloqueo RN-028 sobre su campo',
  validarReglas(sinHogar).some(e => e.codigo === 'RN-028' && e.ruta === 'familias[0].hogarNumero'),
  JSON.stringify(validarReglas(sinHogar).filter(e => e.codigo === 'RN-028')));

const hogarInexistente = Object.assign(fichaBase(), { hogaresEnVivienda: 2, familias: [familiaEnHogar(3)] });
verificar('Familia en el hogar 3 con 2 declarados => bloqueo RN-028',
  validarReglas(hogarInexistente).some(e => e.codigo === 'RN-028' && e.campo === 'hogarNumero' && /del 1 al 2/.test(e.mensaje)));

verificar('Ficha anterior al campo (sin hogarNumero) => no se bloquea',
  validarReglas(Object.assign(fichaBase(), { familias: [familiaValida([adultaValida()])] }))
    .filter(e => e.codigo === 'RN-028').length === 0);

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

/* RN-065: el país sale de la tabla de SISPRO (variable 9). Una ficha anterior
   con «Otra» y el país escrito ya no se puede reportar: hay que elegirlo. */
const otraEscrita = familiaValida([Object.assign(adultaValida(), { nacionalidad: 'OT', nacionalidadOtra: 'Ecuador' })]);
const errOtra = validarReglas(Object.assign(fichaBase(), { familias: [otraEscrita] }))
  .filter(e => e.codigo === 'RN-065' && e.campo === 'nacionalidad');
verificar('País «Otra» de una ficha antigua => bloqueo RN-065 que recuerda lo escrito',
  errOtra.length === 1 && /Ecuador/.test(errOtra[0].mensaje), JSON.stringify(errOtra));
const ecuatoriana = familiaValida([Object.assign(adultaValida(), {
  nacionalidad: 'EC', tipoId: 'PT', numeroId: 'PT12345', estatusMigratorio: 'regular'
})]);
verificar('País de la tabla (Ecuador) con estatus migratorio => sin RN-065 ni A3.10',
  validarReglas(Object.assign(fichaBase(), { familias: [ecuatoriana] }))
    .filter(e => e.codigo === 'RN-065' || e.codigo === 'A3.10').length === 0,
  JSON.stringify(validarReglas(Object.assign(fichaBase(), { familias: [ecuatoriana] })).map(e => e.codigo + ':' + e.campo)));
const sinEstatus = familiaValida([Object.assign(adultaValida(), { nacionalidad: 'VE', tipoId: 'PT', numeroId: 'PT12345' })]);
verificar('Extranjero sin estatus migratorio => bloqueo A3.10',
  validarReglas(Object.assign(fichaBase(), { familias: [sinEstatus] })).some(e => e.codigo === 'A3.10'));

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
/* RN-222: nada del plan bloquea el guardado; lo que falte se advierte. */
errores = validarReglas(filaAMedias);
verificar('Fila del plan a medias => no bloquea el guardado', !errores.some(e => e.codigo === 'RN-114'),
  JSON.stringify(errores.map(e => e.codigo)));
verificar('  pero se advierte que falta el código (RN-114)',
  evaluarAdvertencias(filaAMedias).some(e => e.codigo === 'RN-114'));

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


console.log('\n=== 9b. RN-016 — registrar a tiempo vs. corregir lo ya registrado ===');
const hace45 = new Date(HOY.getTime());
hace45.setDate(hace45.getDate() - 45);
const fichaVieja = Object.assign(fichaBase(), { fechaDiligenciamiento: iso(hace45) });
verificar('Ficha nueva de hace 45 días => bloqueo RN-016',
  validarReglas(fichaVieja).some(e => e.codigo === 'RN-016'));
verificar('La misma ficha ya registrada en la base => sin bloqueo RN-016 al corregirla',
  !validarReglas(Object.assign(fichaVieja, { yaRegistradaEnLaBase: true })).some(e => e.codigo === 'RN-016'));
const fichaFutura = Object.assign(fichaBase(), { fechaDiligenciamiento: '2999-01-01', yaRegistradaEnLaBase: true });
verificar('Una fecha futura sigue bloqueada aunque esté registrada',
  validarReglas(fichaFutura).some(e => e.codigo === 'RN-016'));

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
errores = evaluarAdvertencias(datosPlanErrado);
verificar('Plan que apunta a un documento inexistente => advertencia RN-134 (no bloquea)',
  errores.some(e => e.codigo === 'RN-134') && !validarReglas(datosPlanErrado).some(e => e.codigo === 'RN-134'),
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
verificar('Código de EBS divergente en el plan => advertencia RN-111 (no bloquea)',
  evaluarAdvertencias(llaveViviendaErrada).some(e => e.codigo === 'RN-111') &&
  !validarReglas(llaveViviendaErrada).some(e => e.codigo === 'RN-111'));

console.log('\n=== 12. Variables del anexo técnico SI-APS (anexo.js) ===');
const codigos = (datos) => validarReglas(datos).map(e => e.codigo);
const avisos = (datos) => evaluarAdvertencias(datos).map(e => e.codigo);
const fichaConFamilia = (cambiosIntegrante, cambiosFamilia, cambiosVivienda) => Object.assign(fichaBase(), cambiosVivienda || {}, {
  familias: [Object.assign(familiaValida([Object.assign(adultaValida(), cambiosIntegrante || {})]), cambiosFamilia || {})]
});

verificar('Ficha completa con el anexo => sin bloqueos', codigos(fichaConFamilia()).length === 0,
  JSON.stringify(validarReglas(fichaConFamilia()).map(e => e.codigo + ':' + e.campo)));

const sinAlumbrado = fichaBase(); delete sinAlumbrado.alumbrado;
verificar('Falta el alumbrado => bloqueo A2.37', codigos(sinAlumbrado).indexOf('A2.37') !== -1);
verificar('Alumbrado fuera del catálogo => bloqueo A2.37',
  codigos(Object.assign(fichaBase(), { alumbrado: 'antorcha' })).indexOf('A2.37') !== -1);

verificar('Transporte «otro» sin decir cuál => bloqueo A2.45',
  codigos(Object.assign(fichaBase(), { mediosTransporte: ['publico', 'otro'] })).indexOf('A2.45') !== -1);
verificar('Transporte «otro» con cuál => sin A2.45',
  codigos(Object.assign(fichaBase(), { mediosTransporte: ['otro'], mediosTransporteOtro: 'Mototaxi' })).indexOf('A2.45') === -1);

verificar('Sin tanque => no se exigen limpieza ni distancia (A2.56, A2.57)',
  codigos(fichaBase()).filter(c => c === 'A2.56' || c === 'A2.57').length === 0);
const conTanque = codigos(Object.assign(fichaBase(), { tanqueAlmacenamiento: 'aereo' }));
verificar('Con tanque aéreo => se exigen limpieza y distancia',
  conTanque.indexOf('A2.56') !== -1 && conTanque.indexOf('A2.57') !== -1, JSON.stringify(conTanque));

const sinElementos = Object.assign(fichaBase(), { elementosVivienda: [] });
verificar('Sin elementos en la vivienda (sin opción «ninguno» en el anexo) => advertencia A2.36, no bloqueo',
  codigos(sinElementos).indexOf('A2.36') === -1 && avisos(sinElementos).indexOf('A2.36') !== -1);

verificar('«No aplica» junto con otra fuente de humo => bloqueo A2.80',
  codigos(Object.assign(fichaBase(), { fuentesHumo: ['no_aplica', 'lena'] })).indexOf('A2.80') !== -1);
verificar('Texto con barra vertical «|» => bloqueo (rompe el archivo plano)',
  codigos(Object.assign(fichaBase(), { otrosAccesosVivienda: 'Por la loma | escaleras' })).indexOf('A2.39') !== -1);
verificar('Teléfono de la vivienda de 7 dígitos => bloqueo A2.15',
  codigos(Object.assign(fichaBase(), { telefonoVivienda: '4451234' })).indexOf('A2.15') !== -1);

verificar('Situación inminente múltiple (física y emergencia) con observaciones => válida',
  codigos(Object.assign(fichaBase(), {
    situacionInminente: ['fisica', 'emergencia'], observacionesSituacion: 'Adulto mayor con caída reciente'
  })).filter(c => c === 'RN-002' || c === 'A2.24').length === 0);
verificar('Situación inminente sin observaciones => bloqueo A2.24',
  codigos(Object.assign(fichaBase(), { situacionInminente: ['fisica'] })).indexOf('A2.24') !== -1);
verificar('«No aplica» junto con una situación => bloqueo RN-002',
  codigos(Object.assign(fichaBase(), { situacionInminente: ['no_aplica', 'fisica'] })).indexOf('RN-002') !== -1);
verificar('Situación inminente de una ficha antigua (texto) => se sigue leyendo',
  codigos(Object.assign(fichaBase(), { situacionInminente: 'no_aplica' })).indexOf('RN-002') === -1);

verificar('Fuente de agua como lista (ítem 46 múltiple) => válida',
  codigos(Object.assign(fichaBase(), {
    actividadEconomica: 'no', animales: ['ninguno'], carnetAntirrabico: 'no_aplica',
    fuenteAgua: ['acueducto_esp', 'agua_embotellada'], disposicionExcretas: ['alcantarillado'],
    aguasResiduales: ['alcantarillado'], residuosSolidos: ['servicio_aseo']
  })).filter(c => /^RN-04[6-9]$/.test(c)).length === 0);
const aguaDeRio = evaluarAlertas(Object.assign(fichaBase(), { fuenteAgua: ['acueducto_esp', 'rio_quebrada'] }));
verificar('Una de las fuentes no es segura => alerta RN-211 que la nombra',
  aguaDeRio.some(a => a.codigo === 'RN-211' && /Río/.test(a.descripcion)));

verificar('Cuidador principal sin puntaje ZARIT => bloqueo A2.115',
  codigos(fichaConFamilia({}, { cuidadorPrincipal: 'si' })).indexOf('A2.115') !== -1);
verificar('Puntaje ZARIT de 101 => fuera de rango (A2.115)',
  codigos(fichaConFamilia({}, { cuidadorPrincipal: 'si', zaritPuntaje: 101, zarit: 'intensa' })).indexOf('A2.115') !== -1);
verificar('Puntaje ZARIT 60 con clasificación derivada «intensa» => válido',
  codigos(fichaConFamilia({}, { cuidadorPrincipal: 'si', zaritPuntaje: 60, zarit: 'intensa' }))
    .filter(c => c === 'A2.115' || c === 'RN-053').length === 0);
verificar('Clasificación ZARIT que no corresponde al puntaje => bloqueo RN-053',
  codigos(fichaConFamilia({}, { cuidadorPrincipal: 'si', zaritPuntaje: 60, zarit: 'ausencia' })).indexOf('RN-053') !== -1);

verificar('Fumador activo sin cigarrillos ni años => bloqueos A3.65 y A3.66',
  ['A3.65', 'A3.66'].every(c => codigos(fichaConFamilia({ consumoTabaco: 'activo' })).indexOf(c) !== -1));
verificar('Asbesto: actividad relacionada «sí» sin decir cuál => bloqueo A3.105',
  codigos(fichaConFamilia({ actividadRelacionadaAsbesto: 'si' })).indexOf('A3.105') !== -1);
verificar('Módulo materno opcional: una gestante sin responderlo guarda igual',
  codigos(fichaConFamilia({ gestacionActual: 'si', sujetoEspecialProteccion: ['gestante'],
    atencionesPendientesMaterno: ['ninguna'] })).filter(c => /^A3\.(7\d|8\d|9[01])$/.test(c)).length === 0);
verificar('Fecha de última menstruación posterior a la visita => bloqueo A3.70',
  codigos(fichaConFamilia({ fechaUltimaMenstruacion: iso(new Date(HOY.getFullYear() + 1, 0, 1)) })).indexOf('A3.70') !== -1);
verificar('Evento del último mes sin decir qué hizo => bloqueo A3.50',
  codigos(fichaConFamilia({ enfermedadesUltimoMes: ['resfriado'] })).indexOf('A3.50') !== -1);

verificar('Ocupación que no es código CIUO => bloqueo RN-073',
  codigos(fichaConFamilia({ ocupacion: 'Ingeniera de Sistemas' })).indexOf('RN-073') !== -1);
verificar('Ocupación 9998 (sin ocupación remunerada) => válida',
  codigos(fichaConFamilia({ ocupacion: '9998' })).indexOf('RN-073') === -1);
verificar('Teléfono de 7 dígitos (fijo antiguo) => bloqueo RN-070',
  codigos(fichaConFamilia({ telefono1: '4451234' })).indexOf('RN-070') !== -1);
verificar('Nivel educativo retirado («Técnica laboral») => bloqueo RN-074',
  codigos(fichaConFamilia({ nivelEducativo: 'tecnica_laboral' })).indexOf('RN-074') !== -1);
verificar('Sujeto «violencia de género» (retirado del anexo) => bloqueo RN-077',
  codigos(fichaConFamilia({ sujetoEspecialProteccion: ['victima_violencia_genero'], modalidadViolencia: ['fisica'] }))
    .indexOf('RN-077') !== -1);
verificar('Violencia interpersonal sin modalidad => bloqueo RN-078',
  codigos(fichaConFamilia({ sujetoEspecialProteccion: ['victima_violencia_interpersonal'] })).indexOf('RN-078') !== -1);
verificar('Zona endémica con dos respuestas => bloqueo RN-102 (respuesta única en el anexo)',
  codigos(fichaConFamilia({ zonaEndemica: ['malaria', 'tracoma'] })).indexOf('RN-102') !== -1);
verificar('Derecho a la salud sin respuesta => bloqueo RN-090 (obligatoria desde el anexo)',
  codigos(fichaConFamilia({ conocimientoDerecho: [] })).indexOf('RN-090') !== -1);
verificar('Riesgos para la salud mental se exigen también a un niño de 8 años (RN-105)',
  codigos(fichaConFamilia({ riesgosSaludMentalJoven: [], tipoId: 'TI', numeroId: '1144099887',
    fechaNacimiento: iso(new Date(HOY.getFullYear() - 8, 0, 1)) })).indexOf('RN-105') !== -1);

/* ---------- Ficha técnica APS124CCFP: formatos de los campos ---------- */
console.log('\n=== Ficha técnica APS124CCFP ===');

const { limpiarNumeroDocumento } = contexto;

verificar('Variable 54: el documento se limpia de puntos, comas, guiones y espacios',
  limpiarNumeroDocumento('1.144.000.000') === '1144000000' &&
  limpiarNumeroDocumento('AB-12,3 4') === 'AB1234');

const conGuion = familiaValida([Object.assign(adultaValida(), {
  tipoId: 'CE', numeroId: 'AB-12345', nacionalidad: 'VE'
})]);
verificar('Variable 54: un documento con guion => bloqueo RN-063 (antes pasaba y lo rechazaba la base)',
  validarReglas(Object.assign(fichaBase(), { familias: [conGuion] }))
    .some(e => e.codigo === 'RN-063' && /sin puntos, comas ni guiones/.test(e.mensaje)),
  JSON.stringify(validarReglas(Object.assign(fichaBase(), { familias: [conGuion] })).map(e => e.codigo)));

const conDocumentoLimpio = familiaValida([Object.assign(adultaValida(), {
  tipoId: 'CE', numeroId: 'AB12345', nacionalidad: 'VE'
})]);
verificar('  y el mismo documento sin guion => sin bloqueo RN-063',
  !validarReglas(Object.assign(fichaBase(), { familias: [conDocumentoLimpio] })).some(e => e.codigo === 'RN-063'));

verificar('Variable 9: punto de referencia de 200 caracteres => válido',
  !validarReglas(Object.assign(fichaBase(), { ubicacionReferencia: 'x'.repeat(200) }))
    .some(e => e.codigo === 'RN-024'));
verificar('Variable 9: punto de referencia de 201 caracteres => bloqueo RN-024',
  validarReglas(Object.assign(fichaBase(), { ubicacionReferencia: 'x'.repeat(201) }))
    .some(e => e.codigo === 'RN-024'));

function advertenciasDe(campo, valor) {
  const ficha = fichaBase();
  ficha[campo] = valor;
  return evaluarAdvertencias(ficha).filter(a => a.campo === campo);
}

verificar('Código del equipo con la estructura de la ficha (EBS001) => sin advertencia',
  advertenciasDe('equipoSaludId', 'EBS001').length === 0);

verificar('Variable 15: EBS12 => advertencia RN-010, no bloqueo',
  advertenciasDe('equipoSaludId', 'EBS12').some(a => a.codigo === 'RN-010') &&
  !validarReglas(Object.assign(fichaBase(), { equipoSaludId: 'EBS12' })).some(e => e.codigo === 'RN-010'));

/* Ítems 25 y 26: los asigna el servidor (08_codigos_vivienda.sql). Una ficha
   nueva llega sin ellos y no se bloquea ni se advierte. */
const fichaSinCodigos = Object.assign(fichaBase(), { idHogar: null, idFamilia: null });
verificar('Ficha nueva sin códigos de vivienda ni familia => sin bloqueo ni aviso RN-025/RN-026',
  !validarReglas(fichaSinCodigos).some(e => e.codigo === 'RN-025' || e.codigo === 'RN-026') &&
  !evaluarAdvertencias(fichaSinCodigos).some(e => e.codigo === 'RN-025' || e.codigo === 'RN-026'));

/* Variable 7: la vivienda sin dirección. direccion.js no lo carga este
   contexto, así que se arma uno con los tres archivos, como el servidor. */
const contextoDireccion = vm.createContext({ console: console });
['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'reglas.js'].forEach(function (archivo) {
  vm.runInContext(fs.readFileSync(path.join(BASE, archivo), 'utf8'), contextoDireccion, { filename: archivo });
});
const sinDireccion = contextoDireccion.normalizarDireccion({ modo: 'sin_direccion', complementos: [{ tipo: 'AP', valor: '1' }] });
verificar('Variable 7: «Sin dirección» queda completa como SIN DIRECCION, sin complementos',
  sinDireccion.completa === true && sinDireccion.canonica === 'SIN DIRECCION', JSON.stringify(sinDireccion));
verificar('  y no se manda vía al geocodificador',
  contextoDireccion.textoViaParaGeocodificar({ modo: 'sin_direccion' }) === '');
verificar('  y la ficha sin dirección pasa RN-021',
  !contextoDireccion.validarReglas(Object.assign(fichaBase(), { direccionNormalizada: sinDireccion }))
    .some(e => e.codigo === 'RN-021'));

console.log('\n=== 13. Fallos del plan de pruebas (B03, C01, C04, E09, P04) ===');

/* B03 — RN-007 bloquea en los dos sentidos, como aps.trg_hogar_territorio_area. */
const conRn007 = (cambios) => validarReglas(Object.assign(fichaBase(), cambios)).filter(e => e.codigo === 'RN-007');
verificar('Territorio rural (T55) con área urbana => bloqueo RN-007 en el ítem 7',
  conRn007({ territorio: 'T55', microterritorio: 'MT01' }).some(e => e.ruta === 'territorio'));
verificar('Territorio urbano (T48) con área rural => bloqueo RN-007',
  conRn007({ areaUbicacion: 'rural' }).length === 1);
verificar('Territorio rural con área rural, o urbano con área urbana => sin RN-007',
  conRn007({ territorio: 'T55', microterritorio: 'MT01', areaUbicacion: 'rural' }).length === 0 && conRn007({}).length === 0);

/* C01 — Intención reproductiva y gestación desde los 10 años. */
const haceAnios = (anios, meses) => iso(new Date(HOY.getFullYear() - anios, HOY.getMonth() - (meses || 0), HOY.getDate()));
const sinReproductivas = (cambios) => {
  const persona = Object.assign(adultaValida(), cambios);
  delete persona.intencionReproductiva;
  delete persona.gestacionActual;
  return validarReglas(Object.assign(fichaBase(), { familias: [familiaValida([persona])] }))
    .filter(e => e.campo === 'intencionReproductiva' || e.campo === 'gestacionActual').map(e => e.codigo);
};
verificar('Bebé de 4 meses sin intención reproductiva ni gestación => sin RN-084 ni RN-085',
  sinReproductivas({ fechaNacimiento: haceAnios(0, 4), tipoId: 'RC', numeroId: '10203040506' }).length === 0);
verificar('Niña de 12 años sin responderlas => RN-084 y RN-085',
  sinReproductivas({ fechaNacimiento: haceAnios(12), tipoId: 'TI', numeroId: '1020304050' }).join() === 'RN-084,RN-085');

/* C04 — El edema alerta aunque el peso para la talla sea adecuado. */
const conEdema = familiaValida([Object.assign(adultaValida(), {
  fechaNacimiento: haceAnios(3), tipoId: 'RC', numeroId: '10203040506',
  clasificacionAntropometrica: 'peso_adecuado', signosDesnutricion: ['edema']
})]);
const alertaEdema = evaluarAlertas(Object.assign(fichaBase(), { familias: [conEdema] })).find(a => a.codigo === 'RN-204');
verificar('Edema con peso adecuado => RN-204 INMEDIATA, notifica y señala el ítem 97',
  !!alertaEdema && alertaEdema.prioridad === 'inmediata' && alertaEdema.notificaSivigila &&
  /signosDesnutricion$/.test(alertaEdema.ruta), JSON.stringify(alertaEdema));

/* E09 — Alerta de población migrante. */
const migrante = (cambios) => evaluarAlertas(Object.assign(fichaBase(), {
  familias: [familiaValida([Object.assign(adultaValida(), cambios)])]
})).find(a => a.titulo === 'Población migrante');
const venezolanaRegular = migrante({ nacionalidad: 'VE', tipoId: 'PT', numeroId: '1234567', estatusMigratorio: 'regular' });
verificar('Venezolana con PT y estatus regular => alerta REGULAR que pide marcar el ítem 77',
  !!venezolanaRegular && venezolanaRegular.prioridad === 'regular' && /ítem 77/.test(venezolanaRegular.descripcion),
  JSON.stringify(venezolanaRegular));
verificar('Sin autorización de permanencia => alerta PRIORITARIA',
  (migrante({ nacionalidad: 'VE', tipoId: 'PT', numeroId: '1234567', estatusMigratorio: 'sin_autorizacion' }) || {}).prioridad === 'prioritaria');
verificar('Colombiana con «Migrantes» en el ítem 77 => alerta',
  !!migrante({ sujetoEspecialProteccion: ['migrante'] }));
verificar('Colombiana sin marca de migrante => sin alerta', !migrante({}));

/* P04 — Un seguimiento anterior a la visita bloquea aunque el plan sólo advierta. */
const ayer = new Date(HOY.getTime()); ayer.setDate(ayer.getDate() - 1);
const conSeguimiento = (fecha) => Object.assign(fichaBase(), { planVivienda: {
  codigoEbs: 'EBS001', codigoVivienda: 'HOG-001', acciones: [],
  seguimientos: [{ seguimientoTipoId: 'CC', seguimientoNumeroId: '1144012345', accionConcertada: 'Visita de control',
                   seg1Fecha: fecha, seg1Estado: 'C' }]
} });
verificar('Primer seguimiento de ayer => bloqueo RN-226 en la fecha',
  validarReglas(conSeguimiento(iso(ayer))).some(e => e.codigo === 'RN-226' && /seg1Fecha$/.test(e.ruta)));
verificar('Primer seguimiento del día de la visita => sin ese bloqueo',
  !validarReglas(conSeguimiento(iso(HOY))).some(e => e.codigo === 'RN-226'));

console.log('\n=== 14. Territorios del listado de la E.S.E.: continuidad y ampliación ===');
const { etiquetaTerritorio, fijarCatalogosDinamicos, esTerritorioRural } = contexto;
const vigentes = [];
for (let n = 48; n <= 84; n++) vigentes.push('T' + n);
for (let n = 163; n <= 224; n++) vigentes.push('T' + n);
const sinNombre = vigentes.map(etiquetaTerritorio).filter(e => !/^T\d+ · \S/.test(e) || /Zona rural/.test(e));
verificar('Los 99 territorios vigentes (T48 a T84 y T163 a T224) tienen nombre propio', sinNombre.length === 0, sinNombre.join(', '));
verificar('Urbano: «T48 · Comuna 3»; rural: «T55 · Montebello 1 (rural)»',
  etiquetaTerritorio('T48') === 'T48 · Comuna 3' && etiquetaTerritorio('T55') === 'T55 · Montebello 1 (rural)',
  etiquetaTerritorio('T48') + ' / ' + etiquetaTerritorio('T55'));
verificar('Un territorio no vigente y sin datos se rotula sólo con el código', etiquetaTerritorio('T20') === 'T20');
verificar('Un corregimiento se llama igual en la continuidad y en la ampliación (La Buitrera 1 … 7)',
  etiquetaTerritorio('T76') === 'T76 · La Buitrera 1 (rural)' && etiquetaTerritorio('T216') === 'T216 · La Buitrera 7 (rural)',
  etiquetaTerritorio('T76') + ' / ' + etiquetaTerritorio('T216'));

const T = vm.runInContext('CAT_TERRITORIOS', contexto);
const malFormados = [];
for (let n = 163; n <= 224; n++) {
  const lista = T['T' + n] || [];
  if (lista.map(m => m.codigo).join() !== 'MT01,MT02,MT03' || lista.some(m => !m.nombre || !m.comuna)) malFormados.push('T' + n);
}
verificar('Ampliación: cada territorio trae MT01 a MT03 con nombre y comuna', malFormados.length === 0, malFormados.join(', '));
verificar('  la fila de Caney con el código de Pichindé quedó en T167, y T187 sólo tiene Pichindé',
  T.T167[1].nombre === 'Caney sector 2' && T.T187.every(m => /^Pichindé/.test(m.nombre)),
  JSON.stringify([T.T167[1], T.T187.map(m => m.nombre)]));
const rurales = vigentes.filter(esTerritorioRural);
verificar('  32 territorios rurales en la ampliación y 30 en la continuidad',
  rurales.filter(t => +t.slice(1) >= 163).length === 32 && rurales.filter(t => +t.slice(1) <= 84).length === 30, rurales.length);
verificar('  RN-007: un rural de la ampliación (T173) con área urbana bloquea; urbano (T189) con área urbana no',
  validarReglas(Object.assign(fichaBase(), { territorio: 'T173', microterritorio: 'MT01' })).some(e => e.codigo === 'RN-007') &&
  !validarReglas(Object.assign(fichaBase(), { territorio: 'T189', microterritorio: 'MT01' })).some(e => e.codigo === 'RN-007'));
/* Al final: cambia el catálogo compartido del contexto. */
fijarCatalogosDinamicos({ nombresTerritorios: { T55: 'T55', T56: 'Montebello Dos' } });
verificar('La base actualiza el nombre, pero no lo reemplaza por el código (base sin migrar)',
  etiquetaTerritorio('T55') === 'T55 · Montebello 1 (rural)' && etiquetaTerritorio('T56') === 'T56 · Montebello Dos (rural)',
  etiquetaTerritorio('T55') + ' / ' + etiquetaTerritorio('T56'));

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas > 0 ? 1 : 0);
