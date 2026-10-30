/* =========================================================================
   Plan de pruebas de la encuesta — escenarios contra el motor de reglas
   -------------------------------------------------------------------------
       node pruebas/plan_escenarios.test.js

   Ejecuta, sin base de datos ni servidor, los casos del plan de pruebas
   («Plan de pruebas — Encuesta APS (ficha SI-APS)») que se deciden en el
   motor de reglas: bloqueos, advertencias, alertas y semáforo. Cada
   verificación lleva el ID del caso del plan (E01, B09, C05…) para pasar
   el resultado al documento.

   Los casos que dependen del navegador (qué se muestra u oculta) van en
   plan_escenarios_vista.test.js; los que guardan, corrigen o sincronizan
   necesitan la base y no están aquí.
   ========================================================================= */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BASE = path.join(__dirname, '..');
const ctx = vm.createContext({ console: console });
['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'reglas.js'].forEach(function (archivo) {
  vm.runInContext(fs.readFileSync(path.join(BASE, archivo), 'utf8'), ctx, { filename: archivo });
});
const { viviendaAnexo, familiaAnexo, integranteAnexo } = require('./_anexo_datos');
const M = ctx;

/* ---------- Registro de resultados por caso ---------- */
const resultados = new Map();   // id → { pasa, fallas: [] }
let pasadas = 0, fallidas = 0;

function verificar(id, nombre, condicion, detalle) {
  if (!resultados.has(id)) resultados.set(id, { pasa: true, fallas: [] });
  const r = resultados.get(id);
  if (condicion) { pasadas++; console.log('  OK    ' + id + '  ' + nombre); return; }
  fallidas++;
  r.pasa = false;
  r.fallas.push(nombre + (detalle ? ' -> ' + detalle : ''));
  console.log('  FALLA ' + id + '  ' + nombre + (detalle ? '  -> ' + detalle : ''));
}

/* ---------- Fechas ---------- */
const HOY = new Date(); HOY.setHours(0, 0, 0, 0);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function haceMeses(meses, dias) {
  const d = new Date(HOY);
  d.setMonth(d.getMonth() - meses);
  if (dias) d.setDate(d.getDate() - dias);
  return iso(d);
}
function enDias(n) { const d = new Date(HOY); d.setDate(d.getDate() + n); return iso(d); }

/* ---------- Constructores del modelo ---------- */
let consecutivoDoc = 0;
function documentoNuevo(digitos) {
  consecutivoDoc++;
  return ('1144' + String(consecutivoDoc).padStart(6, '0') + '0000000').slice(0, digitos);
}

/* Integrante con los campos que el formulario pide a su edad y sexo; los
   que el formulario oculta por edad no se envían, igual que en la app. */
function integrante(meses, sexo, extra) {
  const anios = Math.floor(meses / 12);
  const p = Object.assign(integranteAnexo(), {
    primerNombre: 'Ana', primerApellido: 'PRUEBA',
    fechaNacimiento: haceMeses(meses),
    nacionalidad: 'CO', sexo: sexo,
    genero: sexo === 'hombre' ? 'masculino' : 'femenino',
    autoidentificacionGenero: sexo === 'hombre' ? 'masculino' : 'femenino',
    orientacionSexual: 'heterosexual',
    telefono1: '3155551234', rolFamiliar: 'hijo',
    ocupacion: '5223', nivelEducativo: 'media_academica',
    regimenAfiliacion: 'subsidiado', eapb: 'ESS024',
    sujetoEspecialProteccion: ['ninguna'], pertenenciaEtnica: 'ninguna',
    saberesAncestrales: ['ninguna'], discapacidad: ['sin_discapacidad'],
    certificacionRlcpd: 'no_aplica', intencionReproductiva: 'no',
    practicasCuidado: ['alimentacion'], atencionesPendientesRpms: ['ninguna'],
    conocimientoDerecho: ['derechos_deberes'], lactanciaExclusiva: 'no_aplica',
    peso: 65, talla: 160, circunferenciaCintura: 80,
    clasificacionAntropometrica: 'normal',
    tensionSistolica: 118, tensionDiastolica: 75, clasificacionTension: 'normal',
    enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'], riesgosSaludMentalJoven: ['ninguna'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  });
  if (sexo !== 'hombre') p.gestacionActual = 'no';

  if (anios >= 18) { p.tipoId = 'CC'; p.numeroId = documentoNuevo(10); }
  else if (anios >= 7) { p.tipoId = 'TI'; p.numeroId = documentoNuevo(10); }
  else { p.tipoId = 'RC'; p.numeroId = documentoNuevo(10); }

  if (anios < 18) {
    ['circunferenciaCintura', 'tensionSistolica', 'tensionDiastolica', 'clasificacionTension'].forEach(k => delete p[k]);
    p.peso = anios >= 10 ? 45 : anios >= 5 ? 26 : anios >= 1 ? 13 : 6;
    p.talla = anios >= 10 ? 150 : anios >= 5 ? 128 : anios >= 1 ? 92 : 62;
    p.clasificacionAntropometrica = 'peso_adecuado';
    p.nivelEducativo = anios >= 12 ? 'basica_secundaria' : 'basica_primaria';
  }
  if (anios < 15) delete p.ocupacion;
  if (anios < 14) ['ideacionSuicida', 'consumoSpa', 'sintomatologiaDepresiva'].forEach(k => delete p[k]);
  if (anios < 13) delete p.orientacionSexual;
  if (anios < 10) delete p.consumoTabaco;
  if (anios < 10) { delete p.intencionReproductiva; delete p.gestacionActual; }
  if (anios < 5) delete p.nivelEducativo;
  if (meses <= 5) p.lactanciaExclusiva = 'si';
  if (meses >= 3 && meses <= 60) p.signosDesnutricion = ['ninguna'];
  p.imc = M.calcularImc(p.peso, p.talla);
  return Object.assign(p, extra || {});
}

function responsable(meses, sexo, extra) {
  return integrante(meses, sexo, Object.assign({ rolFamiliar: 'responsable_economico' }, extra || {}));
}

function familia(integrantes, extra) {
  return Object.assign(familiaAnexo(), {
    idFamilia: 'FAM-001', tipoFamilia: 'nuclear_biparental',
    numeroIntegrantes: integrantes.length, integrantes: integrantes,
    cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'],
    practicasVinculo: ['escucha_activa'], redesApoyo: 'cuenta_protectoras',
    practicasCuidadoHogar: ['ventilacion']
  }, extra || {});
}

function ficha(familias, extra) {
  const personas = familias.reduce((s, f) => s + f.integrantes.length, 0);
  return Object.assign(viviendaAnexo(), {
    consentimiento: 'si', situacionInminente: ['no_aplica'],
    departamentoCodigo: '76', municipioCodigo: '76001', uzpe: 'UZPE006',
    areaUbicacion: 'urbana', territorio: 'T48', microterritorio: 'MT01',
    divisionTerritorial: 'Barrio San Cayetano',
    equipoSaludId: 'EBS012', prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC', responsableNumeroId: '1144012345', perfilProfesional: 'enfermeria',
    codigoFicha: '76001-EBS012-0001', fechaDiligenciamiento: iso(HOY),
    entornoAbordaje: 'hogar', cabezaFamilia: '', jovenesEnPaz: 'no',
    direccionNormalizada: { completa: true, faltantes: [] },
    latitud: 3.45, longitud: -76.53, ubicacionReferencia: 'Frente a la cancha',
    idHogar: 'HOG-001', idFamilia: 'FAM-001', estrato: 'bajo',
    hogaresEnVivienda: 1, personasEnVivienda: Math.max(personas, 1), habitacionesVivienda: 3,
    elementosParaDormir: Math.max(personas, 1), tipoVivienda: 'casa', materialTecho: 'concreto',
    riesgosAccidente: ['ninguno'], vectores: 'no', factoresContaminacion: ['ninguno'],
    actividadEconomica: 'no', animales: ['ninguno'], perros: 0, perrosVacunados: 0, gatos: 0, gatosVacunados: 0,
    carnetAntirrabico: 'no_aplica',
    fuenteAgua: ['acueducto_esp'], disposicionExcretas: ['alcantarillado'],
    aguasResiduales: ['alcantarillado'], residuosSolidos: ['servicio_aseo'],
    familias: familias
  }, extra || {});
}

/* Ficha E01: hombre 40, mujer 36, niño 8 años, bebé 4 meses. */
function fichaE01() {
  return ficha([familia([
    responsable(40 * 12, 'hombre', { primerNombre: 'Pedro' }),
    integrante(36 * 12, 'mujer', { rolFamiliar: 'conyuge' }),
    integrante(8 * 12, 'hombre', { primerNombre: 'Juan' }),
    integrante(4, 'mujer', { primerNombre: 'Luisa' })
  ])]);
}

/* ---------- Consultas sobre el resultado ---------- */
const bloqueos = (d) => M.validarReglas(d);
const advertencias = (d) => M.evaluarAdvertencias(d);
const alertas = (d) => M.evaluarAlertas(d);
const resumen = (lista) => lista.map(e => e.codigo + ':' + (e.ruta || e.campo || '')).join(', ');
function hay(lista, campo, codigo) {
  return lista.some(e => (!campo || String(e.ruta || e.campo || '').indexOf(campo) !== -1) &&
    (!codigo || e.codigo === codigo));
}
function alerta(d, titulo) { return alertas(d).find(a => a.titulo.indexOf(titulo) !== -1) || null; }
const titulos = (d) => alertas(d).map(a => a.codigo + ' ' + a.titulo + ' (' + a.prioridad + ')').join(' | ');
function soloDe(fichaModelo, campo) {
  const b = bloqueos(fichaModelo);
  return b.length > 0 && b.every(e => String(e.ruta || e.campo || '').indexOf(campo) !== -1);
}
function primerIntegrante(d) { return d.familias[0].integrantes[0]; }

/* =========================================================================
   E — Punta a punta
   ========================================================================= */
console.log('\n=== E. Escenarios de punta a punta ===');

let f = fichaE01();
verificar('E01', 'Familia típica de 4 integrantes: sin bloqueos', bloqueos(f).length === 0, resumen(bloqueos(f)));
verificar('E01', 'Sin alertas de riesgo', alertas(f).length === 0, titulos(f));
verificar('E01', 'Semáforo: sin riesgo identificado', M.clasificarRiesgoFamiliar(f).nivel === 'sin_riesgo',
  JSON.stringify(M.clasificarRiesgoFamiliar(f)));
verificar('E01', 'Puede cerrarse', M.validarCierre(f).puedeCerrar === true, JSON.stringify(M.validarCierre(f).impedimentos || []));

f = ficha([
  familia([responsable(40 * 12, 'hombre')], { hogarNumero: 1 }),
  familia([responsable(35 * 12, 'mujer')], { hogarNumero: 1, idFamilia: 'FAM-002' }),
  familia([responsable(60 * 12, 'mujer')], { hogarNumero: 2, idFamilia: 'FAM-003' })
], { hogaresEnVivienda: 2 });
verificar('E02', 'Dos hogares y tres familias: sin bloqueos', bloqueos(f).length === 0, resumen(bloqueos(f)));
verificar('E02', 'Sin advertencia RN-028 (todos los hogares tienen familia)', !hay(advertencias(f), '', 'RN-028'),
  resumen(advertencias(f)));

f = ficha([familia([responsable(78 * 12, 'hombre', {
  enfermedadesNoTransmisibles: ['hipertension'], adherenciaTratamiento: 'no', motivoNoTratamiento: ['no_adherencia'],
  tensionSistolica: 150, tensionDiastolica: 95, clasificacionTension: 'nivel2'
})], { tipoFamilia: 'unipersonal' })]);
verificar('E03', 'Adulto mayor hipertenso: sin bloqueos', bloqueos(f).length === 0, resumen(bloqueos(f)));
let a = alerta(f, 'Tensión arterial alterada') || alerta(f, 'Crisis hipertensiva');
verificar('E03', 'Hipertensión nivel 2 sin adherencia sube a INMEDIATA (RN-203)', a && a.prioridad === 'inmediata', titulos(f));

f = ficha([familia([responsable(40 * 12, 'mujer'), integrante(16 * 12, 'mujer', {
  gestacionActual: 'si', atencionesPendientesMaterno: ['control_prenatal'], barrerasAcceso: ['servicio_lejano'],
  fechaUltimaMenstruacion: haceMeses(3), conoceSignosAlarma: 'si'
})])]);
verificar('E04', 'Gestante de 16 años con módulo materno: sin bloqueos', bloqueos(f).length === 0, resumen(bloqueos(f)));
a = alerta(f, 'Gestación confirmada');
verificar('E04', 'Alerta materna al menos PRIORITARIA (RN-205)', a && (a.prioridad === 'prioritaria' || a.prioridad === 'inmediata'), titulos(f));

f = fichaE01(); f.situacionInminente = ['fisica'];
verificar('E06', 'Urgencia vital sin observaciones: bloqueo A2.24', hay(bloqueos(f), 'observacionesSituacion'), resumen(bloqueos(f)));
f.observacionesSituacion = 'Persona inconsciente, se llamó a la línea 123.';
verificar('E06', 'Con observaciones: alerta INMEDIATA RN-201', (alerta(f, 'Urgencia vital') || {}).prioridad === 'inmediata', titulos(f));

f = fichaE01(); f.consentimiento = 'no';
verificar('E07', 'Sin consentimiento: sólo el bloqueo RN-001 y ninguna alerta',
  bloqueos(f).length === 1 && bloqueos(f)[0].codigo === 'RN-001' && alertas(f).length === 0, resumen(bloqueos(f)));

f = ficha([familia([
  responsable(38 * 12, 'hombre', { nacionalidad: 'VE', tipoId: 'PT', numeroId: '1234567', estatusMigratorio: 'regular' }),
  integrante(5 * 12, 'hombre', { nacionalidad: 'VE', tipoId: 'MS', numeroId: 'MS0001', estatusMigratorio: 'sin_autorizacion' })
])]);
verificar('E09', 'Familia migrante con PT y MS: sin bloqueos', bloqueos(f).length === 0, resumen(bloqueos(f)));
verificar('E09', 'Alerta de barrera de identificación por MS', !!alerta(f, 'Barrera de identificación'), titulos(f));
verificar('E09', 'Alerta de población migrante (RN-065)', alertas(f).some(a => /migrante/i.test(a.titulo + a.descripcion)), titulos(f));

f = ficha([familia([responsable(25 * 12, 'mujer', { ideacionSuicida: 'ha_pensado' })])]);
a = alerta(f, 'Riesgo de suicidio');
verificar('E10', 'Ideación suicida: alerta INMEDIATA RN-202', a && a.prioridad === 'inmediata', titulos(f));
verificar('E10', 'Sin plan, la ficha igual puede cerrarse (plan diferido)', M.validarCierre(f).puedeCerrar === true,
  JSON.stringify(M.validarCierre(f).impedimentos || []));
verificar('E10', 'El resumen marca el plan como pendiente', (M.resumirPlanCuidado ? M.resumirPlanCuidado(f) : {}).pendiente === true,
  JSON.stringify(M.resumirPlanCuidado ? M.resumirPlanCuidado(f) : null));

/* =========================================================================
   B — Por bloque del instrumento
   ========================================================================= */
console.log('\n=== B. Por bloque del instrumento ===');

f = fichaE01(); f.situacionInminente = ['fisica', 'psicologica']; f.observacionesSituacion = 'Crisis en curso';
verificar('B01', 'Física y Psicológica juntas: válidas', !hay(bloqueos(f), 'situacionInminente'), resumen(bloqueos(f)));
f.situacionInminente = ['no_aplica', 'fisica'];
verificar('B01', 'No aplica junto a otra opción: bloqueo RN-002', hay(bloqueos(f), 'situacionInminente'), resumen(bloqueos(f)));

f = fichaE01(); f.territorio = 'T20';
verificar('B02', 'Territorio no vigente (T20): el motor lo acepta (fichas antiguas); la lista del formulario no lo ofrece', !hay(bloqueos(f), 'territorio'),
  resumen(bloqueos(f)));

f = fichaE01(); f.territorio = 'T55'; f.microterritorio = 'MT01'; f.areaUbicacion = 'urbana';
verificar('B03', 'Territorio rural con área urbana: bloqueo RN-007 (el plan y la base lo tratan como bloqueo)',
  hay(bloqueos(f), 'territorio', 'RN-007'), 'bloqueos: ' + resumen(bloqueos(f)) + ' / advertencias: ' + resumen(advertencias(f)));
f = fichaE01(); f.areaUbicacion = 'rural';
verificar('B03', 'Territorio urbano (T48) con área rural: bloqueo RN-007 (la base también lo rechaza)',
  hay(bloqueos(f), 'territorio', 'RN-007'), resumen(bloqueos(f)));

f = fichaE01(); f.entornoAbordaje = 'institucional'; f.nombreInstitucion = ''; f.cabezaFamilia = 'Rector';
verificar('B05', 'Entorno institucional sin nombre: bloqueo RN-018', hay(bloqueos(f), 'nombreInstitucion'), resumen(bloqueos(f)));

f = fichaE01();
verificar('B06', 'Entorno hogar sin líder: se toma del responsable económico',
  /Pedro/.test(M.liderDelEntorno(f) || ''), String(M.liderDelEntorno(f)));

f = fichaE01(); f.direccionNormalizada = { completa: false, faltantes: ['placa'] };
verificar('B07', 'Dirección sin placa: bloqueo RN-021', hay(bloqueos(f), 'direccion', 'RN-021'), resumen(bloqueos(f)));

f = fichaE01(); f.latitud = 4.6;
verificar('B08', 'Latitud fuera de Cali: advertencia y no bloqueo', hay(advertencias(f), 'latitud') && !hay(bloqueos(f), 'latitud'),
  'b: ' + resumen(bloqueos(f)) + ' a: ' + resumen(advertencias(f)));
f = fichaE01(); f.longitud = null;
verificar('B08', 'Latitud sin longitud: bloqueo (van en par)', hay(bloqueos(f), 'longitud') || hay(bloqueos(f), 'latitud'), resumen(bloqueos(f)));
f = fichaE01(); f.latitud = null; f.longitud = null;
verificar('B08', 'Sin coordenadas: no deja cerrar (RN-022)', M.validarCierre(f).puedeCerrar === false && hay(bloqueos(f), 'latitud', 'RN-022'), JSON.stringify(M.validarCierre(f).impedimentos));
f.motivoSinGeorreferenciacion = 'Sin señal GPS en la ladera';
verificar('B08', 'Sin coordenadas aunque haya motivo: tampoco cierra (PISIS las exige)', M.validarCierre(f).puedeCerrar === false, JSON.stringify(M.validarCierre(f).impedimentos));
f = fichaE01(); f.areaUbicacion = 'rural'; f.latitud = null; f.longitud = null;
verificar('B08', 'Vivienda rural sin coordenadas: bloqueo RN-022', hay(bloqueos(f), 'latitud', 'RN-022'), resumen(bloqueos(f)));

let h = M.evaluarHacinamiento(7, 2);
verificar('B09', '7/2 = 3.5: hacinamiento crítico PRIORITARIO', h.hacinamiento === 'si' && h.critico && h.prioridad === 'prioritaria', JSON.stringify(h));
h = M.evaluarHacinamiento(4, 2);
verificar('B09', '4/2 = 2.0: sin hacinamiento', h.hacinamiento === 'no', JSON.stringify(h));
h = M.evaluarHacinamiento(5, 2);
verificar('B09', '5/2 = 2.5: hacinamiento REGULAR', h.hacinamiento === 'si' && !h.critico && h.prioridad === 'regular', JSON.stringify(h));

f = fichaE01(); f.personasEnVivienda = 6; f.elementosParaDormir = 2;
verificar('B10', '6 personas y 2 elementos: alerta de déficit', !!alerta(f, 'Déficit de elementos'), titulos(f));

f = fichaE01(); f.personasEnVivienda = 3;
verificar('B11', '3 personas con 4 integrantes: bloqueo RN-029', hay(bloqueos(f), 'personasEnVivienda'), resumen(bloqueos(f)));
f = fichaE01(); f.personasEnVivienda = 21; f.elementosParaDormir = 21; f.habitacionesVivienda = 11;
verificar('B11', '21 personas: advertencia de confirmación', hay(advertencias(f), 'personasEnVivienda'), resumen(advertencias(f)));

['fibrocemento_con_asbesto', 'fibrocemento_asbesto'].forEach(function (techo) {
  const fx = fichaE01(); fx.materialTecho = techo;
  verificar('B12', 'Techo ' + techo + ': alerta PRIORITARIA de asbesto', (alerta(fx, 'asbesto') || {}).prioridad === 'prioritaria', titulos(fx));
});

f = ficha([familia([responsable(30 * 12, 'mujer'), integrante(3 * 12, 'hombre')])]);
f.riesgosAccidente = ['objetos_cortopunzantes'];
verificar('B13', 'Riesgo de accidente con niño de 3 años: alerta PRIORITARIA', !!alerta(f, 'Riesgos de accidente'), titulos(f));
f = ficha([familia([responsable(30 * 12, 'mujer')])]); f.riesgosAccidente = ['objetos_cortopunzantes'];
verificar('B13', 'Sin menores de 5 ni mayores de 70: no eleva', !alerta(f, 'Riesgos de accidente'), titulos(f));

f = fichaE01(); f.animales = ['perros']; f.perros = 3; f.perrosVacunados = 4; f.carnetAntirrabico = 'si';
verificar('B14', '3 perros y 4 vacunados: bloqueo RN-042', hay(bloqueos(f), 'perrosVacunados'), resumen(bloqueos(f)));
f.perrosVacunados = 1; f.carnetAntirrabico = 'no';
verificar('B14', '1 de 3 vacunados: alerta de rabia', !!alerta(f, 'rabia'), titulos(f));
f.carnetAntirrabico = undefined;
verificar('B14', 'Con perros, el carné es obligatorio', hay(bloqueos(f), 'carnetAntirrabico'), resumen(bloqueos(f)));

f = fichaE01();
verificar('B15', 'Animales Ninguno con conteos en 0: válido', !hay(bloqueos(f), 'perros') && !hay(bloqueos(f), 'animales'), resumen(bloqueos(f)));

f = fichaE01(); f.fuenteAgua = ['acueducto_esp', 'aguas_lluvias'];
verificar('B16', 'Acueducto + aguas lluvias: válido', !hay(bloqueos(f), 'fuenteAgua'), resumen(bloqueos(f)));
f.fuenteAgua = ['rio_quebrada'];
verificar('B16', 'Río o quebrada: alerta de agua no apta', !!alerta(f, 'Agua no apta'), titulos(f));

f = fichaE01(); f.disposicionExcretas = ['campo_abierto']; f.fuenteAgua = ['rio_quebrada']; f.materialTecho = 'desechos';
verificar('B17', 'Tres hallazgos: entorno de alto riesgo sanitario', !!alerta(f, 'Entorno de alto riesgo sanitario'), titulos(f));

f = ficha([familia([integrante(40 * 12, 'hombre'), integrante(36 * 12, 'mujer')])]);
verificar('B19', 'Sin responsable económico: bloqueo RN-051', hay(bloqueos(f), 'rolFamiliar') || hay(bloqueos(f), 'integrantes'), resumen(bloqueos(f)));
f = ficha([familia([responsable(40 * 12, 'hombre'), responsable(36 * 12, 'mujer')])]);
verificar('B19', 'Dos responsables económicos: bloqueo RN-051', hay(bloqueos(f), 'rolFamiliar'), resumen(bloqueos(f)));

f = fichaE01(); f.familias[0].cuidadorPrincipal = 'si';
verificar('B20', 'Cuidador sin puntaje Zarit: bloqueo', hay(bloqueos(f), 'zarit'), resumen(bloqueos(f)));
f.familias[0].zaritPuntaje = 50; f.familias[0].zarit = M.clasificarZarit(50);
verificar('B20', 'Zarit 50: sobrecarga ligera REGULAR', f.familias[0].zarit === 'ligera' && (alerta(f, 'Sobrecarga') || {}).prioridad === 'regular', f.familias[0].zarit + ' / ' + titulos(f));
f.familias[0].zaritPuntaje = 60; f.familias[0].zarit = M.clasificarZarit(60);
verificar('B20', 'Zarit 60: sobrecarga intensa PRIORITARIA', f.familias[0].zarit === 'intensa' && (alerta(f, 'Sobrecarga') || {}).prioridad === 'prioritaria', f.familias[0].zarit + ' / ' + titulos(f));
f.familias[0].zarit = 'ausencia';
verificar('B20', 'Categoría que no corresponde al puntaje: bloqueo RN-053', hay(bloqueos(f), 'zarit', 'RN-053'), resumen(bloqueos(f)));

f = fichaE01(); f.familias[0].integrantes.forEach(i => { delete i.telefono1; });
verificar('B21', 'Familia sin teléfono: deja cerrar (el anexo no exige el teléfono)', M.validarCierre(f).puedeCerrar === true, JSON.stringify(M.validarCierre(f).impedimentos));
f.familias[0].sinContactoTelefonico = true;
verificar('B21', 'Con la novedad «sin medio de contacto»: deja cerrar', M.validarCierre(f).puedeCerrar === true, JSON.stringify(M.validarCierre(f).impedimentos));
f = fichaE01(); primerIntegrante(f).telefono1 = '5551234';
verificar('B21', 'Teléfono de 7 dígitos: bloqueo RN-070', hay(bloqueos(f), 'telefono1'), resumen(bloqueos(f)));

f = fichaE01(); f.familias[0].integrantes[1].tipoId = 'CC'; f.familias[0].integrantes[1].numeroId = primerIntegrante(f).numeroId;
verificar('B22', 'Documento repetido en la ficha: bloqueo RN-063', hay(bloqueos(f), 'numeroId', 'RN-063'), resumen(bloqueos(f)));

f = fichaE01(); primerIntegrante(f).nacionalidad = 'VE';
verificar('B23', 'Venezuela sin estatus migratorio: bloqueo A3.10', hay(bloqueos(f), 'estatusMigratorio'), resumen(bloqueos(f)));
f = fichaE01(); primerIntegrante(f).estatusMigratorio = 'regular';
verificar('B23', 'Colombia: el estatus no se exige', !hay(bloqueos(f), 'estatusMigratorio'), resumen(bloqueos(f)));

f = fichaE01(); primerIntegrante(f).ocupacion = 'vendedor';
verificar('B24', 'Ocupación en texto libre: bloqueo RN-073', hay(bloqueos(f), 'ocupacion', 'RN-073'), resumen(bloqueos(f)));
primerIntegrante(f).ocupacion = '9998';
verificar('B24', 'Ocupación 9998: válida', !hay(bloqueos(f), 'ocupacion'), resumen(bloqueos(f)));

f = fichaE01(); primerIntegrante(f).regimenAfiliacion = 'no_afiliado';
delete primerIntegrante(f).eapb;
verificar('B25', 'No afiliado sin EAPB: válido y con alerta RN-209', !hay(bloqueos(f), 'eapb') && !!alerta(f, 'no afiliada'), resumen(bloqueos(f)) + ' / ' + titulos(f));

f = fichaE01(); primerIntegrante(f).sujetoEspecialProteccion = ['victima_violencia_interpersonal'];
verificar('B26', 'Víctima de violencia sin modalidad: bloqueo RN-078', hay(bloqueos(f), 'modalidadViolencia'), resumen(bloqueos(f)));
primerIntegrante(f).modalidadViolencia = ['psicologica'];
verificar('B26', 'Con modalidad: alerta de violencia', !!alerta(f, 'Víctima de violencia'), titulos(f));

f = fichaE01(); primerIntegrante(f).pertenenciaEtnica = 'indigena';
verificar('B27', 'Indígena sin pueblo: guarda (el anexo no exige el pueblo)', !hay(bloqueos(f), 'puebloEtnico'), resumen(bloqueos(f)));

/* =========================================================================
   C — Edad, sexo y condición
   ========================================================================= */
console.log('\n=== C. Edad, sexo y condición ===');

function fichaCon(i) { return ficha([familia([responsable(35 * 12, 'mujer'), i])]); }
function sinBloqueosDe(i) { const fx = fichaCon(i); return { ok: bloqueos(fx).length === 0, detalle: resumen(bloqueos(fx)) }; }

let r = sinBloqueosDe(integrante(4, 'mujer'));
verificar('C01', 'Bebé de 4 meses con lo que pide el formulario: sin bloqueos', r.ok, r.detalle);
let ix = integrante(4, 'mujer'); delete ix.lactanciaExclusiva;
verificar('C01', 'Bebé de 4 meses sin lactancia: bloqueo RN-091', hay(bloqueos(fichaCon(ix)), 'lactanciaExclusiva'), resumen(bloqueos(fichaCon(ix))));
ix = integrante(4, 'mujer'); delete ix.intencionReproductiva;
verificar('C01', 'Bebé de 4 meses: no se le exige intención reproductiva', !hay(bloqueos(fichaCon(ix)), 'intencionReproductiva'),
  resumen(bloqueos(fichaCon(ix))));

r = sinBloqueosDe(integrante(6, 'hombre', { lactanciaExclusiva: 'no_aplica' }));
verificar('C02', 'Bebé de 6 meses sin lactancia: sin bloqueos', r.ok, r.detalle);
ix = integrante(2, 'hombre'); delete ix.signosDesnutricion;
r = sinBloqueosDe(ix);
verificar('C03', 'Bebé de 2 meses sin signos de desnutrición: sin bloqueos', r.ok, r.detalle);

f = fichaCon(integrante(3 * 12, 'mujer', { signosDesnutricion: ['edema'] }));
a = alerta(f, 'estado nutricional');
verificar('C04', 'Niña de 3 años con edema: alerta INMEDIATA RN-204', a && a.prioridad === 'inmediata', titulos(f));

ix = integrante(8 * 12, 'hombre', { tipoId: 'CC', numeroId: '1144099500' });
verificar('C05', 'Niño de 8 años con CC: bloqueo RN-064', hay(bloqueos(fichaCon(ix)), 'tipoId', 'RN-064'), resumen(bloqueos(fichaCon(ix))));
r = sinBloqueosDe(integrante(8 * 12, 'hombre'));
verificar('C05', 'Niño de 8 años con TI y sin tabaco: sin bloqueos', r.ok, r.detalle);

ix = integrante(6 * 12, 'hombre', { tipoId: 'TI', numeroId: '1144099501' });
verificar('C06', 'Niño de 6 años con TI: bloqueo RN-064', hay(bloqueos(fichaCon(ix)), 'tipoId', 'RN-064'), resumen(bloqueos(fichaCon(ix))));

r = sinBloqueosDe(integrante(12 * 12, 'mujer', { consumoTabaco: 'no_aplica' }));
verificar('C07', 'Adolescente de 12 años sin orientación, SPA ni ideación: sin bloqueos', r.ok, r.detalle);
ix = integrante(12 * 12, 'mujer'); delete ix.consumoTabaco;
verificar('C07', 'Adolescente de 12 años sin tabaco: bloqueo A3.64 (tabaco desde los 10)', hay(bloqueos(fichaCon(ix)), 'consumoTabaco'), resumen(bloqueos(fichaCon(ix))));
ix = integrante(13 * 12, 'hombre', { consumoTabaco: 'no_aplica' }); delete ix.orientacionSexual;
verificar('C08', 'Adolescente de 13 años sin orientación: bloqueo', hay(bloqueos(fichaCon(ix)), 'orientacionSexual'), resumen(bloqueos(fichaCon(ix))));
ix = integrante(14 * 12, 'hombre', { consumoTabaco: 'no_aplica' }); delete ix.ideacionSuicida;
verificar('C09', 'Adolescente de 14 años sin ideación: bloqueo', hay(bloqueos(fichaCon(ix)), 'ideacionSuicida'), resumen(bloqueos(fichaCon(ix))));

f = fichaCon(integrante(16 * 12, 'hombre', { ocupacion: '5223', consumoTabaco: 'no_aplica' }));
verificar('C10', '16 años con ocupación: alerta de posible trabajo adolescente', !!alerta(f, 'trabajo adolescente'), titulos(f));

ix = integrante(17 * 12, 'mujer', { tipoId: 'CC', numeroId: '1144099502', consumoTabaco: 'no_aplica' });
verificar('C11', '17 años con CC: bloqueo RN-064', hay(bloqueos(fichaCon(ix)), 'tipoId', 'RN-064'), resumen(bloqueos(fichaCon(ix))));

ix = integrante(18 * 12, 'mujer');
verificar('C12', 'Cumple 18 el día de la visita: edad 18 años', M.calcularEdad(ix.fechaNacimiento, iso(HOY)).anios === 18,
  JSON.stringify(M.calcularEdad(ix.fechaNacimiento, iso(HOY))));
r = sinBloqueosDe(ix);
verificar('C12', 'Con CC, tensión y cintura: sin bloqueos', r.ok, r.detalle);

const valores = (lista) => lista.map(o => o.valor);
let rpms = valores(M.atencionesRpmsExigibles(36 * 12, 'mujer', false));
verificar('C13', 'Mujer de 36: sin próstata ni mama, con riesgo cardiovascular',
  rpms.indexOf('tamizaje_prostata') === -1 && rpms.indexOf('tamizaje_mama') === -1 && rpms.indexOf('tamizaje_cardiovascular') !== -1, rpms.join(','));
rpms = valores(M.atencionesRpmsExigibles(45 * 12, 'mujer', false));
verificar('C14', 'Mujer de 45: tamizaje de mama', rpms.indexOf('tamizaje_mama') !== -1, rpms.join(','));
rpms = valores(M.atencionesRpmsExigibles(56 * 12, 'hombre', false));
verificar('C15', 'Hombre de 56: próstata y colon, sin cuello uterino',
  rpms.indexOf('tamizaje_prostata') !== -1 && rpms.indexOf('tamizaje_colon') !== -1 && rpms.indexOf('tamizaje_cuello_uterino') === -1, rpms.join(','));

const fum = M.PREGUNTAS_ANEXO ? null : null; // (las condiciones del anexo se leen con el lector)
function visibleAnexo(clave, i) {
  const p = vm.runInContext('PREGUNTAS_ANEXO', ctx).find(x => x.clave === clave);
  const fx = fichaCon(i);
  const c = M.contextoIntegrante(i, fx);
  const lector = M.lectorDeRespuestas([i, fx.familias[0], fx], { edadMeses: c.edadMeses, sexo: c.sexo, gestante: c.gestante, fechaFicha: fx.fechaDiligenciamiento });
  return M.esVisibleAnexo(p, lector);
}
verificar('C16', 'Mujer de 55 años: módulo materno oculto', visibleAnexo('fechaUltimaMenstruacion', integrante(55 * 12, 'mujer')) === false);
verificar('C16', 'Mujer de 54 años: módulo materno visible', visibleAnexo('fechaUltimaMenstruacion', integrante(54 * 12, 'mujer')) === true);
verificar('C07', 'Niña de 12 años: módulo materno visible', visibleAnexo('fechaUltimaMenstruacion', integrante(12 * 12, 'mujer')) === true);
verificar('C07', 'Niño de 9 años: tabaco oculto; de 10: visible',
  visibleAnexo('consumoTabaco', integrante(9 * 12, 'hombre')) === false && visibleAnexo('consumoTabaco', integrante(10 * 12, 'hombre')) === true);

ix = integrante(30 * 12, 'hombre', { gestacionActual: 'si' });
verificar('C17', 'Hombre con gestación Sí: bloqueo RN-085', hay(bloqueos(fichaCon(ix)), 'gestacionActual'), resumen(bloqueos(fichaCon(ix))));

f = ficha([familia([responsable(80 * 12, 'hombre', { tensionSistolica: 118 })])]); f.riesgosAccidente = ['superficies_resbaladizas'];
verificar('C18', 'Adulto de 80 años y riesgo de accidente: eleva la prioridad', !!alerta(f, 'Riesgos de accidente'), titulos(f));

ix = integrante(30 * 12, 'mujer', { fechaNacimiento: enDias(10) });
verificar('C21', 'Fecha de nacimiento futura: bloqueo RN-064', hay(bloqueos(fichaCon(ix)), 'fechaNacimiento'), resumen(bloqueos(fichaCon(ix))));
ix = integrante(30 * 12, 'mujer', { fechaNacimiento: haceMeses(121 * 12) });
verificar('C21', 'Más de 120 años: bloqueo RN-064', hay(bloqueos(fichaCon(ix)), 'fechaNacimiento'), resumen(bloqueos(fichaCon(ix))));

verificar('C22', 'IMC de 70 kg y 170 cm = 24.22', M.calcularImc(70, 170) === 24.22, String(M.calcularImc(70, 170)));
ix = integrante(30 * 12, 'mujer', { peso: 3500, imc: M.calcularImc(3500, 160) });
verificar('C22', 'Peso 3500 (gramos): bloqueo RN-092', hay(bloqueos(fichaCon(ix)), 'peso'), resumen(bloqueos(fichaCon(ix))));
ix = integrante(30 * 12, 'mujer', { talla: 1.6, imc: M.calcularImc(65, 1.6) });
verificar('C22', 'Talla 1.6 (metros): bloqueo RN-093', hay(bloqueos(fichaCon(ix)), 'talla'), resumen(bloqueos(fichaCon(ix))));

f = ficha([familia([responsable(50 * 12, 'hombre', { tensionSistolica: 190, tensionDiastolica: 125, clasificacionTension: 'crisis' })])]);
verificar('C23', 'TA 190/125: crisis hipertensiva INMEDIATA', (alerta(f, 'Crisis hipertensiva') || {}).prioridad === 'inmediata', titulos(f));
f = ficha([familia([responsable(50 * 12, 'hombre', { tensionSistolica: 125, tensionDiastolica: 78, clasificacionTension: 'elevada' })])]);
verificar('C23', 'TA 125/78: elevada REGULAR', (alerta(f, 'Tensión arterial alterada') || {}).prioridad === 'regular', titulos(f));
f = ficha([familia([responsable(50 * 12, 'hombre', { tensionSistolica: 125, tensionDiastolica: 78, clasificacionTension: 'normal' })])]);
verificar('C23', 'TA 125/78 marcada «Normal»: el motor no acepta una clasificación que no corresponde', hay(bloqueos(f), 'clasificacionTension'), resumen(bloqueos(f)));

f = ficha([familia([responsable(40 * 12, 'mujer', { tipoId: 'AS', numeroId: 'AS0001' }), integrante(10 * 12, 'hombre', { tipoId: 'MS', numeroId: 'MS0002', consumoTabaco: 'no_aplica' })])]);
verificar('C24', 'AS y MS: alerta de barrera de identificación', alertas(f).filter(x => x.titulo === 'Barrera de identificación').length === 2, titulos(f));

/* =========================================================================
   A — Anexo SI-APS
   ========================================================================= */
console.log('\n=== A. Variables del anexo SI-APS ===');

f = fichaE01(); delete f.alumbrado;
verificar('A01', 'El bloqueo de una pregunta del anexo cita su código (A2.37)', hay(bloqueos(f), 'alumbrado', 'A2.37'), resumen(bloqueos(f)));
f = fichaE01(); delete f.tipoUbicacion;
verificar('A02', 'Sin tipo de ubicación: bloqueo A2.8', hay(bloqueos(f), 'tipoUbicacion', 'A2.8'), resumen(bloqueos(f)));
f = fichaE01(); f.telefonoVivienda = '5551234';
verificar('A03', 'Teléfono de la vivienda de 7 dígitos: rechazo', hay(bloqueos(f), 'telefonoVivienda'), resumen(bloqueos(f)));
f.telefonoVivienda = '';
verificar('A03', 'Teléfono de la vivienda vacío: permitido', !hay(bloqueos(f), 'telefonoVivienda'), resumen(bloqueos(f)));
f = fichaE01(); f.situacionInminente = ['emergencia']; f.observacionesSituacion = 'Inundación | evacuación';
verificar('A04', 'Observaciones con «|»: rechazo', hay(bloqueos(f), 'observacionesSituacion'), resumen(bloqueos(f)));
f.observacionesSituacion = 'x'.repeat(201);
verificar('A04', 'Observaciones de 201 caracteres: rechazo', hay(bloqueos(f), 'observacionesSituacion'), resumen(bloqueos(f)));
f = fichaE01(); f.elementosVivienda = [];
verificar('A05', 'Elementos de la vivienda sin marcar: bloqueo A2.36 (obligatoria en el anexo)',
  hay(bloqueos(f), 'elementosVivienda', 'A2.36'), 'b: ' + resumen(bloqueos(f)) + ' a: ' + resumen(advertencias(f)));
f.elementosVivienda = ['ninguno'];
verificar('A05', 'Elementos de la vivienda «Ninguno»: guarda', !hay(bloqueos(f), 'elementosVivienda'), resumen(bloqueos(f)));
f = fichaE01(); f.mediosTransporte = ['publico', 'otro'];
verificar('A06', 'Transporte «Otro» sin cuál: guarda (el anexo no exige el texto)', !hay(bloqueos(f), 'mediosTransporteOtro'), resumen(bloqueos(f)));
f = fichaE01(); f.actividadEconomica = 'si';
verificar('A07', 'Actividad económica Sí: exige A2.51 y A2.52',
  hay(bloqueos(f), 'areaTrabajoIndependiente') && hay(bloqueos(f), 'familiarAfectadoActividad'), resumen(bloqueos(f)));
f = fichaE01();
verificar('A08', 'Sin tanque: no exige frecuencia ni distancia',
  !hay(bloqueos(f), 'frecuenciaLimpiezaTanque') && !hay(bloqueos(f), 'distanciaTanque'), resumen(bloqueos(f)));
f.tanqueAlmacenamiento = 'aereo';
verificar('A08', 'Tanque aéreo: exige frecuencia y distancia',
  hay(bloqueos(f), 'frecuenciaLimpiezaTanque') && hay(bloqueos(f), 'distanciaTanque'), resumen(bloqueos(f)));
f = fichaE01(); f.animales = ['perros']; f.perros = 2; f.perrosVacunados = 2; f.carnetAntirrabico = 'si';
const tenencia = ['finalidadTenencia', 'confinamientoAnimales', 'desparasitaAnimales', 'instalacionesSegurasAnimales', 'excretasAnimales', 'barrerasContactoAnimales'];
verificar('A09', 'Con perros: exige las 6 preguntas de tenencia', tenencia.every(c => hay(bloqueos(f), c)), resumen(bloqueos(f)));
f = fichaE01(); delete f.familias[0].aliasFamilia; delete f.familias[0].apgarFamiliar;
verificar('A10', 'Sin alias ni Apgar: bloqueo en ambos', hay(bloqueos(f), 'aliasFamilia') && hay(bloqueos(f), 'apgarFamiliar'), resumen(bloqueos(f)));
f = fichaE01(); f.familias[0].cuidadorPrincipal = 'si'; f.familias[0].zaritPuntaje = 101; f.familias[0].zarit = M.clasificarZarit(101);
verificar('A11', 'Zarit 101: rechazo (0 a 100)', hay(bloqueos(f), 'zaritPuntaje'), resumen(bloqueos(f)));
f.familias[0].zaritPuntaje = 46; f.familias[0].zarit = M.clasificarZarit(46);
verificar('A11', 'Zarit 46: ausencia de sobrecarga', f.familias[0].zarit === 'ausencia' && !hay(bloqueos(f), 'zarit'), f.familias[0].zarit + ' ' + resumen(bloqueos(f)));
f = fichaE01(); primerIntegrante(f).nacionalidad = 'EC'; primerIntegrante(f).estatusMigratorio = 'regular';
verificar('A12', 'Ecuador con estatus Regular: válido', bloqueos(f).length === 0, resumen(bloqueos(f)));
f = fichaE01(); primerIntegrante(f).enfermedadesUltimoMes = ['eda'];
verificar('A13', 'Enfermedad del último mes sin acción: bloqueo A3.50', hay(bloqueos(f), 'accionAfeccion'), resumen(bloqueos(f)));
f = fichaE01(); primerIntegrante(f).consumoTabaco = 'activo';
verificar('A14', 'Fumador activo sin cigarrillos ni años: bloqueo (PISIS los exige)', hay(bloqueos(f), 'cigarrillosDiarios') && hay(bloqueos(f), 'aniosFumando'), resumen(bloqueos(f)));
primerIntegrante(f).cigarrillosDiarios = 100; primerIntegrante(f).aniosFumando = 20;
verificar('A14', '100 cigarrillos: rechazo (0 a 99)', hay(bloqueos(f), 'cigarrillosDiarios'), resumen(bloqueos(f)));
f = ficha([familia([responsable(30 * 12, 'mujer', { gestacionActual: 'si', atencionesPendientesMaterno: ['ninguna'] })])]);
verificar('A15', 'Gestante con el módulo materno vacío: guarda (opcional)', !bloqueos(f).some(e => /^A3\.(7\d|8\d|9[01])$/.test(e.codigo)), resumen(bloqueos(f)));
primerIntegrante(f).fechaUltimaMenstruacion = enDias(5);
verificar('A15', 'FUM posterior a la visita: bloqueo A3.70', hay(bloqueos(f), 'fechaUltimaMenstruacion', 'A3.70'), resumen(bloqueos(f)));

/* =========================================================================
   P — Alertas y plan de cuidado
   ========================================================================= */
console.log('\n=== P. Alertas y plan de cuidado ===');

f = fichaE01(); f.fuenteAgua = ['rio_quebrada'];
verificar('P01', 'Alerta sin acción: igual deja cerrar', M.validarCierre(f).puedeCerrar === true, JSON.stringify(M.validarCierre(f).impedimentos));

function planVivienda(fx, acciones, seguimientos) {
  fx.planVivienda = { codigoEbs: fx.equipoSaludId, codigoVivienda: fx.idHogar, acciones: acciones || [], seguimientos: seguimientos || [] };
  return fx;
}
const accion = (extra) => Object.assign({ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: 'NC-AMB-07', tipoRespuesta: 'en_sitio' }, extra || {});
const seguimiento = (extra) => Object.assign({ seguimientoTipoId: 'CC', seguimientoNumeroId: '1144012345', accionConcertada: 'Mejorar ventilación' }, extra || {});

f = planVivienda(fichaE01(), [accion({ tipoRespuesta: 'derivada' })]);
verificar('P03', 'Derivada sin institución: advertencia, no bloqueo',
  hay(advertencias(f), 'institucionDestino') && !hay(bloqueos(f), 'institucionDestino'), 'b: ' + resumen(bloqueos(f)) + ' a: ' + resumen(advertencias(f)));

f = planVivienda(fichaE01(), [accion()], [seguimiento({ seg1Fecha: haceMeses(0, 3), seg1Estado: 'C' })]);
let todos = bloqueos(f).concat(advertencias(f));
verificar('P04', 'Seguimiento 1 anterior a la fecha de la ficha: error', hay(todos, 'seg1Fecha'), resumen(todos));
f = planVivienda(fichaE01(), [accion()], [seguimiento({ seg1Fecha: enDias(5), seg1Estado: 'C', seg2Fecha: enDias(2), seg2Estado: 'C' })]);
todos = bloqueos(f).concat(advertencias(f));
verificar('P04', 'Seguimiento 2 anterior al 1: error', hay(todos, 'seg2'), resumen(todos));

f = planVivienda(fichaE01(), [accion()], [seguimiento({ seg1Fecha: enDias(5), seg1Estado: 'NC' })]);
todos = bloqueos(f).concat(advertencias(f));
verificar('P05', 'NC sin motivo: se señala el motivo', hay(todos, 'seg1MotivoNc'), resumen(todos));

f = planVivienda(fichaE01(), [accion({ ejecutorNumeroId: '' , ejecutorTipoId: '' })]);
verificar('P06', 'Acción con código y sin ejecutor: advertencia, no bloqueo',
  !hay(bloqueos(f), 'ejecutor') && hay(advertencias(f), 'ejecutor'), 'b: ' + resumen(bloqueos(f)) + ' a: ' + resumen(advertencias(f)));

f = fichaE01(); f.situacionInminente = ['fisica']; f.observacionesSituacion = 'Urgencia';
verificar('P11', 'Una INMEDIATA: riesgo alto', M.clasificarRiesgoFamiliar(f).nivel === 'alto', JSON.stringify(M.clasificarRiesgoFamiliar(f)));
f = fichaE01(); f.fuenteAgua = ['rio_quebrada']; f.materialTecho = 'fibrocemento_con_asbesto';
verificar('P11', 'Dos PRIORITARIAS: riesgo medio', M.clasificarRiesgoFamiliar(f).nivel === 'medio', titulos(f) + ' => ' + JSON.stringify(M.clasificarRiesgoFamiliar(f)));
f = fichaE01(); f.residuosSolidos = ['quema'];
verificar('P11', 'Sólo REGULARES: riesgo bajo', M.clasificarRiesgoFamiliar(f).nivel === 'bajo', titulos(f) + ' => ' + JSON.stringify(M.clasificarRiesgoFamiliar(f)));

f = fichaE01(); primerIntegrante(f).condicionesTransmisibles = ['tuberculosis'];
verificar('P12', 'Tuberculosis: los demás integrantes quedan como contactos',
  alertas(f).filter(x => x.titulo === 'Contacto de tuberculosis').length === 3, titulos(f));

f = fichaE01(); primerIntegrante(f).condicionesTransmisibles = ['dengue']; f.vectores = 'si';
a = alertas(f);
verificar('P13', 'Dengue con criaderos: pide control vectorial en el plan de vivienda',
  a.some(x => x.plan === 'vivienda' && /vector/i.test(x.titulo + x.descripcion)), titulos(f));

f = ficha([familia([responsable(50 * 12, 'hombre', { regimenAfiliacion: 'no_afiliado', tensionSistolica: 190, tensionDiastolica: 125, clasificacionTension: 'crisis' })])]);
delete primerIntegrante(f).eapb;
verificar('P14', 'No afiliado con crisis hipertensiva: RN-209 INMEDIATA', (alerta(f, 'no afiliada') || {}).prioridad === 'inmediata', titulos(f));

f = fichaCon(integrante(13 * 12, 'mujer', { gestacionActual: 'si', consumoTabaco: 'no_aplica', atencionesPendientesMaterno: ['ninguna'] }));
verificar('P15', 'Gestante de 13 años: alerta INMEDIATA de presunto delito sexual', (alerta(f, 'Presunto delito sexual') || {}).prioridad === 'inmediata', titulos(f));

f = fichaE01(); f.animales = ['perros']; f.perros = 2; f.perrosVacunados = 0; f.carnetAntirrabico = 'no';
verificar('P16', 'Perros sin vacunar: alerta de rabia en el plan de vivienda', (alerta(f, 'rabia') || {}).plan === 'vivienda', titulos(f));

/* =========================================================================
   N — Negativos y límites
   ========================================================================= */
console.log('\n=== N. Negativos y límites ===');

f = fichaE01(); f.fechaDiligenciamiento = enDias(1);
verificar('N01', 'Fecha de la ficha mañana: bloqueo RN-016', hay(bloqueos(f), 'fechaDiligenciamiento'), resumen(bloqueos(f)));
f = fichaE01(); f.fechaDiligenciamiento = enDias(-31);
verificar('N01', 'Fecha de hace 31 días: bloqueo RN-016', hay(bloqueos(f), 'fechaDiligenciamiento'), resumen(bloqueos(f)));
f = fichaE01(); f.fechaDiligenciamiento = enDias(-30);
verificar('N01', 'Fecha de hace 30 días: aceptada', !hay(bloqueos(f), 'fechaDiligenciamiento'), resumen(bloqueos(f)));

[['CC', '12345'], ['CC', '12345678901'], ['RC', '1234567'], ['CE', 'AB-12#']].forEach(function (par) {
  const fx = fichaE01(); primerIntegrante(fx).tipoId = par[0]; primerIntegrante(fx).numeroId = par[1];
  verificar('N02', par[0] + ' ' + par[1] + ': bloqueo RN-063', hay(bloqueos(fx), 'numeroId'), resumen(bloqueos(fx)));
});

f = fichaE01(); primerIntegrante(f).primerNombre = 'María'; primerIntegrante(f).primerApellido = "Ñúñez D'Angelo";
verificar('N03', "Nombre con tildes, Ñ y apóstrofo: válido", !hay(bloqueos(f), 'primerNombre') && !hay(bloqueos(f), 'primerApellido'), resumen(bloqueos(f)));

f = fichaE01(); f.ubicacionReferencia = 'x'.repeat(201);
verificar('N04', 'Punto de referencia de 201 caracteres: bloqueo', hay(bloqueos(f), 'ubicacionReferencia'), resumen(bloqueos(f)));

f = fichaE01(); f.familias[0].numeroIntegrantes = 0;
verificar('N05', 'Ítem 51 en 0: bloqueo', hay(bloqueos(f), 'numeroIntegrantes'), resumen(bloqueos(f)));
f.familias[0].numeroIntegrantes = -1;
verificar('N05', 'Ítem 51 negativo: bloqueo', hay(bloqueos(f), 'numeroIntegrantes'), resumen(bloqueos(f)));

f = fichaE01(); f.habitacionesVivienda = 0;
verificar('N06', 'Habitaciones en 0: bloqueo', hay(bloqueos(f), 'habitacionesVivienda'), resumen(bloqueos(f)));
h = M.evaluarHacinamiento(4, 0);
verificar('N06', 'Sin división por cero en hacinamiento', h && h.personasPorHabitacion !== Infinity && !Number.isNaN(h.personasPorHabitacion), JSON.stringify(h));

f = fichaE01(); f.animales = ['perros']; f.perros = 11; f.perrosVacunados = 11; f.carnetAntirrabico = 'si';
verificar('N07', '11 perros: advertencia de confirmación', hay(advertencias(f), 'perros'), resumen(advertencias(f)));

/* ---------- Resumen por caso ---------- */
console.log('\n---------------------------------------------');
const ids = Array.from(resultados.keys()).sort();
const fallan = ids.filter(id => !resultados.get(id).pasa);
console.log('Casos evaluados: ' + ids.length + '   Pasan: ' + (ids.length - fallan.length) + '   Fallan: ' + fallan.length);
fallan.forEach(id => console.log('  ' + id + ': ' + resultados.get(id).fallas.join(' || ')));
console.log('Verificaciones: ' + pasadas + ' pasadas, ' + fallidas + ' fallidas');
/* El detalle por caso, para pasarlo al documento del plan, queda fuera del repositorio. */
fs.writeFileSync(path.join(require('os').tmpdir(), 'resultados_plan_motor.json'),
  JSON.stringify(Object.fromEntries(ids.map(id => [id, resultados.get(id)])), null, 2));
process.exit(fallidas > 0 ? 1 : 0);
