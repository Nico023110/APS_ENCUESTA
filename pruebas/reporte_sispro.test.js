/* =========================================================================
   Archivo plano APS124CCFP (anexo técnico SI-APS)
   -------------------------------------------------------------------------
       node pruebas/reporte_sispro.test.js

   Arma el archivo desde fichas escritas a mano y lo lee campo por campo:
   estructura (1 + 125 + 119 variables, pipes, fin de línea), identificadores
   de vivienda, familia e integrante, códigos del anexo, «No aplica» de lo
   que depende de la edad, formato del texto y las incidencias que se
   informan en vez de inventar datos.

   No necesita base de datos: construirReporte es una función pura.
   ========================================================================= */

'use strict';

const { completarAnexo } = require('./_anexo_datos');
const reporte = require('../api/_reporte_sispro');
const DICCIONARIO = require('../api/_diccionario_sispro');

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK   ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + detalle : ''));
  }
}

const ENTIDAD = { tipo: 'NI', numero: '805027289' };

function adulta() {
  return {
    primerNombre: 'Ana María', primerApellido: 'Gómez', segundoApellido: 'Ñúñez',
    tipoId: 'CC', numeroId: '1144099887', fechaNacimiento: '1996-05-10',
    nacionalidad: 'CO', sexo: 'mujer', genero: 'femenino',
    autoidentificacionGenero: 'femenino', orientacionSexual: 'heterosexual',
    telefono1: '315 555 1234', rolFamiliar: 'responsable_economico',
    ocupacion: '5223', nivelEducativo: 'media_academica',
    regimenAfiliacion: 'subsidiado', eapb: 'ESS024',
    sujetoEspecialProteccion: ['ninguna'], pertenenciaEtnica: 'ninguna',
    saberesAncestrales: ['ninguna'], discapacidad: ['sin_discapacidad'],
    certificacionRlcpd: 'no_aplica', intencionReproductiva: 'no', gestacionActual: 'no',
    practicasCuidado: ['alimentacion', 'actividad_fisica'], atencionesPendientesRpms: ['ninguna'],
    conocimientoDerecho: ['derechos_deberes'], lactanciaExclusiva: 'no_aplica',
    peso: 65, talla: 160, circunferenciaCintura: 80, imc: 25.39,
    clasificacionAntropometrica: 'normal',
    tensionSistolica: 118, tensionDiastolica: 75, clasificacionTension: 'normal',
    enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no',
    riesgosSaludMentalJoven: ['ninguna']
  };
}

/* Un niño de 8 años: sin ocupación, sin tensión arterial ni cintura, y con
   los ítems de adulto vacíos porque el formulario no los pregunta. */
function nino() {
  return {
    primerNombre: 'Juan', primerApellido: 'Gómez',
    tipoId: 'TI', numeroId: '1144555666', fechaNacimiento: '2018-03-01',
    nacionalidad: 'CO', sexo: 'hombre', genero: 'masculino',
    autoidentificacionGenero: 'masculino', orientacionSexual: 'no_responde',
    rolFamiliar: 'hijo', nivelEducativo: 'basica_primaria',
    regimenAfiliacion: 'subsidiado', eapb: 'ESS024',
    sujetoEspecialProteccion: ['ninez'], pertenenciaEtnica: 'ninguna',
    saberesAncestrales: ['ninguna'], discapacidad: ['sin_discapacidad'],
    certificacionRlcpd: 'no_aplica',
    practicasCuidado: ['higiene_oral'], atencionesPendientesRpms: ['ninguna'],
    conocimientoDerecho: ['no_registra'],
    peso: 26, talla: 128, imc: 15.87, clasificacionAntropometrica: 'peso_adecuado',
    enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', limitacionCotidiana: 'no',
    riesgosSaludMentalJoven: ['ninguna']
  };
}

function ficha() {
  return completarAnexo({
    codigoFicha: 'F-RPT-1',
    consentimiento: 'si',
    situacionInminente: ['no_aplica'],
    departamentoCodigo: '76', municipioCodigo: '76001',
    areaUbicacion: 'urbana', territorio: 'T48', microterritorio: 'MT01',
    divisionTerritorial: 'Barrio San Cayetano | «Ñ»',
    equipoSaludId: 'EBS12', prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC', responsableNumeroId: '1144012345',
    perfilProfesional: 'enfermeria',
    fechaDiligenciamiento: '2026-09-15',
    direccion: 'CL 45 A BIS SUR # 27 B - 15',
    latitud: 3.4512345, longitud: -76.5312345,
    ubicacionReferencia: 'Frente a la cancha',
    estrato: 'bajo', hogaresEnVivienda: 1, personasEnVivienda: 4,
    habitacionesVivienda: 2, elementosParaDormir: 3,
    tipoVivienda: 'casa', materialTecho: 'concreto',
    riesgosAccidente: ['ninguno'], vectores: 'no', factoresContaminacion: ['ninguno'],
    actividadEconomica: 'no', animales: ['ninguno'],
    perros: 0, perrosVacunados: 0, gatos: 0, gatosVacunados: 0,
    fuenteAgua: ['acueducto_esp', 'aguas_lluvias'],
    disposicionExcretas: ['alcantarillado'], aguasResiduales: ['alcantarillado'],
    residuosSolidos: ['servicio_aseo'],
    familias: [{
      tipoFamilia: 'nuclear_monoparental', numeroIntegrantes: 2,
      cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'],
      practicasVinculo: ['escucha_activa'], redesApoyo: 'cuenta_protectoras',
      practicasCuidadoHogar: ['ventilacion'],
      integrantes: [adulta(), nino()]
    }]
  });
}

function meta() {
  return { consecutivoVivienda: 7, personasPorHabitacion: 2, hacinamiento: false, familias: [{ consecutivo: 1 }] };
}

function generar(fichas, subregion) {
  return reporte.construirReporte({
    fichas: fichas, desde: '2026-09-01', hasta: '2026-09-30',
    entidad: ENTIDAD, subregion: subregion === undefined ? '117' : subregion
  });
}

/* Variable n de una línea (el separador es el pipe). */
function campo(linea, n) { return linea.split('|')[n]; }

function incidenciasDe(resultado, tipo, variable) {
  return resultado.resumen.incidencias.detalle.filter(function (x) {
    return x.tipoRegistro === tipo && x.variable === variable;
  });
}

console.log('\n=== 1. Diccionario y definiciones ===');

verificar('el diccionario tiene 6 + 125 + 119 variables',
  DICCIONARIO.TIPO_1.length === 6 && DICCIONARIO.TIPO_2.length === 125 && DICCIONARIO.TIPO_3.length === 119);
let definiciones = null;
try { definiciones = reporte.obtenerDefiniciones(); } catch (error) { definiciones = error.message; }
verificar('toda variable de los tipos 2 y 3 tiene de dónde salir', typeof definiciones === 'object',
  typeof definiciones === 'string' ? definiciones : '');

console.log('\n=== 2. Formato ===');

verificar('texto: mayúsculas, sin tildes, Ñ → N, sin pipes ni comillas',
  reporte.textoPlano('María Ñúñez | "la 5ª"') === 'MARIA NUNEZ LA 5A', reporte.textoPlano('María Ñúñez | "la 5ª"'));
verificar('territorio T48 queda T48', reporte.territorioSispro('T48') === 'T48');
verificar('T99 está reservado: el 99 es U01', reporte.territorioSispro('T99') === 'U01', reporte.territorioSispro('T99'));
verificar('T110 es U12', reporte.territorioSispro('T110') === 'U12', reporte.territorioSispro('T110'));
verificar('coordenada con la precisión que cabe en 10 caracteres',
  reporte.coordenada(-76.5312345, 10) === '-76.531234' && reporte.coordenada(3.45, 10) === '3.450000',
  reporte.coordenada(-76.5312345, 10) + ' ' + reporte.coordenada(3.45, 10));
verificar('nombre del archivo: APS124CCFP + corte + NI + NIT a 12 dígitos',
  reporte.nombreDeArchivo(ENTIDAD, '2026-09-30') === 'APS124CCFP20260930NI000805027289.TXT');

console.log('\n=== 3. Estructura del archivo ===');

const r = generar([{ encuesta: ficha(), meta: meta() }]);
const lineas = r.contenido.split('\r\n');
verificar('los registros se separan con CRLF y el último no lleva salto (sin fin de archivo)',
  !r.contenido.endsWith('\r\n') && !r.contenido.endsWith('\n') && lineas[lineas.length - 1] !== '' &&
  !/\r(?!\n)|[^\r]\n/.test(r.contenido));
verificar('1 registro de control + 1 de familia + 2 de integrantes', lineas.length === 4, lineas.length);
verificar('el control va primero, luego los tipo 2 y después los tipo 3',
  lineas.map(function (l) { return l.split('|')[0]; }).join('') === '1233', lineas.map(function (l) { return l.split('|')[0]; }).join(''));
verificar('un solo consecutivo en todo el archivo: los tipo 3 siguen a los tipo 2',
  lineas[1].split('|')[1] === '1' && lineas[2].split('|')[1] === '2' && lineas[3].split('|')[1] === '3',
  [lineas[1], lineas[2], lineas[3]].map(function (l) { return l.split('|')[1]; }).join(','));
verificar('registro de control', lineas[0] === '1|NI|805027289|2026-09-01|2026-09-30|3', lineas[0]);
const t2 = lineas[1];
const [t3a, t3b] = [lineas[2], lineas[3]];
verificar('el tipo 2 tiene 125 variables', t2.split('|').length === 125, t2.split('|').length);
verificar('los tipo 3 tienen 119 variables', t3a.split('|').length === 119 && t3b.split('|').length === 119);
verificar('consecutivos: 1 la familia, 2 y 3 sus integrantes', campo(t2, 1) === '1' && campo(t3a, 1) === '2' && campo(t3b, 1) === '3');
verificar('sólo ASCII imprimible', /^[\x20-\x7E\r\n]*$/.test(r.contenido));

console.log('\n=== 4. Identificadores (variables 123, 124, 117 y 118) ===');

const idVivienda = '76' + 'UZPE117' + '76001' + 'T48' + 'MT01' + 'H0007';
verificar('ID de la vivienda: depto + subregión + municipio + territorio + micro + H + consecutivo',
  campo(t2, 123) === idVivienda, campo(t2, 123));
verificar('ID de la familia: vivienda + F + consecutivo', campo(t2, 124) === idVivienda + 'F0001', campo(t2, 124));
verificar('el integrante apunta a su familia', campo(t3a, 117) === campo(t2, 124) && campo(t3b, 117) === campo(t2, 124));
verificar('ID del integrante: familia + tipo + número', campo(t3a, 118) === idVivienda + 'F0001CC1144099887', campo(t3a, 118));
verificar('número de personas de la familia = registros tipo 3', campo(t2, 110) === '2', campo(t2, 110));

/* La variable 4 es la UZPE de la vivienda, completa (PISIS: «CodUZPE», 7
   caracteres); el parámetro sólo respalda a la ficha que no trae UZPE. */
const conUzpe = Object.assign(ficha(), { uzpe: 'UZPE006' });
const tUzpe = generar([{ encuesta: conUzpe, meta: meta() }], '117').contenido.split('\r\n')[1];
verificar('Ficha con UZPE006: UZPE006 en la variable 4 y en el ID de la vivienda (26 caracteres, como en PISIS)',
  campo(tUzpe, 4) === 'UZPE006' && campo(tUzpe, 123) === '76' + 'UZPE006' + '76001' + 'T48' + 'MT01' + 'H0007' &&
  campo(tUzpe, 123).length === 26, campo(tUzpe, 4) + ' ' + campo(tUzpe, 123));
const sinNada = generar([{ encuesta: ficha(), meta: meta() }], null);
verificar('Sin UZPE ni parámetro: la 4 vacía y señalada como incidencia',
  campo(sinNada.contenido.split('\r\n')[1], 4) === '' && incidenciasDe(sinNada, 2, 4).length === 1);
verificar('subregionDe: UZPE006 => UZPE006; sin UZPE, el parámetro con su prefijo',
  reporte.subregionDe({ uzpe: 'uzpe006' }, null) === 'UZPE006' && reporte.subregionDe({}, { subregion: '117' }) === 'UZPE117');

console.log('\n=== 5. Registro tipo 2 ===');

verificar('consentimiento sí => 1', campo(t2, 2) === '1');
verificar('texto de la división territorial normalizado', campo(t2, 9) === 'BARRIO SAN CAYETANO N', campo(t2, 9));
verificar('tipo de ubicación (anexo) barrio => 5', campo(t2, 8) === '5', campo(t2, 8));
verificar('área urbana => 1', campo(t2, 10) === '1');
verificar('longitud y latitud', campo(t2, 12) === '-76.531234' && campo(t2, 13) === '3.451234', campo(t2, 12) + ' ' + campo(t2, 13));
verificar('situación «No aplica» => 4 y observaciones «NO APLICA» (PISIS la exige llena)', campo(t2, 23) === '4' && campo(t2, 24) === 'NO APLICA',
  campo(t2, 23) + ' / ' + campo(t2, 24));
verificar('NIT del prestador primario', campo(t2, 26) === '805027289', campo(t2, 26));
verificar('perfil como texto', campo(t2, 29) === 'ENFERMERIA (PROFESIONAL)' || /^ENFERMER/.test(campo(t2, 29)), campo(t2, 29));
verificar('fuente de agua múltiple => 1,12', campo(t2, 53) === '1,12', campo(t2, 53));
verificar('sin tanque: la frecuencia de limpieza va «No aplica» (4)', campo(t2, 56) === '4', campo(t2, 56));
verificar('sin actividad económica: el área de trabajo va «No» (2), PISIS no la admite vacía', campo(t2, 51) === '2', campo(t2, 51));
verificar('criaderos (ítem 37) «no» => 2', campo(t2, 84) === '2', campo(t2, 84));
verificar('medidas para vectores (103) derivada de la 87', campo(t2, 103) === '1', campo(t2, 103));
verificar('hacinamiento no => 2 y personas por habitación', campo(t2, 21) === '2' && campo(t2, 20) === '2');

console.log('\n=== 6. Registro tipo 3 ===');

verificar('nombre y apellidos en mayúsculas sin tildes', campo(t3a, 2) === 'ANA MARIA' && campo(t3a, 5) === 'NUNEZ',
  campo(t3a, 2) + ' / ' + campo(t3a, 5));
verificar('país Colombia => 170 (tabla Pais)', campo(t3a, 9) === '170', campo(t3a, 9));
verificar('colombiana: estatus migratorio «No aplica» (3)', campo(t3a, 10) === '3', campo(t3a, 10));
verificar('teléfono sólo con dígitos', campo(t3a, 15) === '3155551234', campo(t3a, 15));
verificar('ocupación CIUO', campo(t3a, 18) === '5223');
verificar('EAPB con su código oficial', campo(t3a, 21) === 'ESS024');
verificar('etnia con dos dígitos', campo(t3a, 24) === '07', campo(t3a, 24));
verificar('peso y talla con un decimal, IMC con uno', campo(t3a, 37) === '65.0' && campo(t3a, 38) === '160.0' && campo(t3a, 39) === '25.4',
  [campo(t3a, 37), campo(t3a, 38), campo(t3a, 39)].join(' '));
verificar('adulta: cintura y tensión', campo(t3a, 40) === '80' && campo(t3a, 44) === '118' && campo(t3a, 46) === '5',
  [campo(t3a, 40), campo(t3a, 44), campo(t3a, 46)].join(' '));
verificar('mujer de 30 años: edad fértil 1, embarazo 2', campo(t3a, 71) === '1' && campo(t3a, 72) === '2');
verificar('niño de 8 años sin ocupación => 9998', campo(t3b, 18) === '9998', campo(t3b, 18));
verificar('niño: cintura y tensión en 0 (no aplican), clasificación de tensión «No aplica» (6)',
  campo(t3b, 40) === '0' && campo(t3b, 44) === '0' && campo(t3b, 46) === '6', [campo(t3b, 40), campo(t3b, 44), campo(t3b, 46)].join('/'));
verificar('niño: ítems de mayores de 14 «No aplica» (52 => 5, 53 => 3)',
  campo(t3b, 52) === '5' && campo(t3b, 53) === '3', [campo(t3b, 52), campo(t3b, 53)].join('/'));
/* La lista de la 63 (LstSINO) no tiene «No aplica»: el 3 no existe ahí. */
verificar('niño: consumo de SPA (63) «No» (2), no 3; adulta que no consume => 2',
  campo(t3b, 63) === '2' && campo(t3a, 63) === '2', campo(t3b, 63) + ' / ' + campo(t3a, 63));
verificar('niño de 8: tabaco «No aplica» por su siOculta (3)', campo(t3b, 64) === '3', campo(t3b, 64));
/* Obligatorias sin «No aplica» que el formulario no le pregunta a un niño:
   se reporta lo cierto en vez de dejarlas vacías. */
verificar('niño de 8: orientación «No responde» (5), intención reproductiva y gestación «No» (2)',
  campo(t3b, 14) === '5' && campo(t3b, 32) === '2' && campo(t3b, 33) === '2',
  [campo(t3b, 14), campo(t3b, 32), campo(t3b, 33)].join('/'));
verificar('  y el niño no deja incidencias en las variables 14, 32 y 33',
  [14, 32, 33].every((n) => incidenciasDe(r, 3, n).length === 0));
verificar('adulta: su orientación y su respuesta de gestación (no => 2)',
  campo(t3a, 14) === '1' && campo(t3a, 33) === '2', campo(t3a, 14) + '/' + campo(t3a, 33));
verificar('niño de 8: signos de desnutrición (3 meses a 5 años) «No aplica» (9)', campo(t3b, 41) === '9', campo(t3b, 41));
verificar('hombre: edad fértil 2', campo(t3b, 71) === '2');

verificar('una ficha completa no deja incidencias', r.resumen.incidencias.total === 0,
  JSON.stringify(r.resumen.incidencias.detalle.map(function (x) {
    return x.tipoRegistro + '.' + x.variable + ' ' + x.problema;
  })));

console.log('\n=== 6b. No. Familias de la vivienda (variable 17) ===');

/* El ítem 28 cuenta hogares y un hogar puede reunir varias familias (RN-028):
   la variable cuenta familias. */
const lineaT2 = (r) => r.contenido.split('\r\n')[1];
const dosFamiliasUnHogar = ficha();
dosFamiliasUnHogar.hogaresEnVivienda = 1;
dosFamiliasUnHogar.familias = [dosFamiliasUnHogar.familias[0], JSON.parse(JSON.stringify(dosFamiliasUnHogar.familias[0]))];
const rFamilias = generar([{ encuesta: dosFamiliasUnHogar, meta: { consecutivoVivienda: 7, familias: [{ consecutivo: 1 }, { consecutivo: 2 }] } }]);
verificar('1 hogar con 2 familias => 2 familias, no 1 hogar', campo(lineaT2(rFamilias), 17) === '2', campo(lineaT2(rFamilias), 17));
const tipoYConsecutivo = rFamilias.contenido.split('\r\n').slice(1)
  .map(function (l) { return l.split('|')[0] + ':' + l.split('|')[1]; }).join(',');
verificar('2 familias de 2 integrantes: tipo 2 en 1 y 2, tipo 3 del 3 al 6',
  tipoYConsecutivo === '2:1,2:2,3:3,3:4,3:5,3:6', tipoYConsecutivo);

const hogarAusente = ficha();
hogarAusente.hogaresEnVivienda = 3;                              // sólo una familia caracterizada
const rAusente = generar([{ encuesta: hogarAusente, meta: meta() }]);
verificar('3 hogares declarados y 1 familia caracterizada => 3 (cada hogar tiene al menos una)',
  campo(lineaT2(rAusente), 17) === '3', campo(lineaT2(rAusente), 17));

verificar('1 hogar, 1 familia => 1', campo(lineaT2(generar([{ encuesta: ficha(), meta: meta() }])), 17) === '1');

console.log('\n=== 7. Lo que falta se informa, no se inventa ===');

const sinSubregion = generar([{ encuesta: ficha(), meta: meta() }], null);
const t2s = sinSubregion.contenido.split('\r\n')[1];
verificar('sin subregión: variables 4, 123 y 124 vacías', campo(t2s, 4) === '' && campo(t2s, 123) === '' && campo(t2s, 124) === '');
verificar('  y quedan como incidencias', incidenciasDe(sinSubregion, 2, 4).length === 1 && incidenciasDe(sinSubregion, 2, 124).length === 1 &&
  incidenciasDe(sinSubregion, 3, 117).length === 1);

const vieja = ficha();
vieja.familias[0].integrantes[1].tipoId = 'NV';                  // retirado: no está en TipoIDAfiliado
vieja.familias[0].integrantes[0].nacionalidad = 'OT';            // «Otra» de antes del anexo
vieja.familias[0].integrantes[0].nivelEducativo = 'tecnica_laboral';
delete vieja.alumbrado;                                          // ficha anterior al anexo
const rv = generar([{ encuesta: vieja, meta: meta() }]);
const lv = rv.contenido.split('\r\n');
verificar('tipo de documento NV: vacío e incidencia', campo(lv[3], 6) === '' &&
  incidenciasDe(rv, 3, 6).some(function (x) { return /no tiene código/.test(x.problema); }));
verificar('nacionalidad «Otra»: vacía e incidencia con la ficha', campo(lv[2], 9) === '' &&
  incidenciasDe(rv, 3, 9).some(function (x) { return x.fichas.indexOf('F-RPT-1') !== -1; }));
verificar('nivel educativo retirado: incidencia', incidenciasDe(rv, 3, 19).length === 1);
verificar('variable obligatoria del anexo sin responder: incidencia', incidenciasDe(rv, 2, 37).some(function (x) {
  return x.problema === 'Obligatoria y vacía';
}));

const larga = ficha();
larga.ubicacionReferencia = 'x'.repeat(250);
const rl = generar([{ encuesta: larga, meta: meta() }]);
verificar('texto de más de 200 caracteres se recorta e informa',
  campo(rl.contenido.split('\r\n')[1], 11).length === 200 && incidenciasDe(rl, 2, 11).length === 1);

const rota = ficha();
rota.equipoSaludId = 'EBS|12\r\n2|X';                            // un valor que intentara partir el registro
rota.familias[0].integrantes[0].ocupacion = 'Juan Pérez, vendedor';
const rr = generar([{ encuesta: rota, meta: meta() }]);
const lr = rr.contenido.split('\r\n');
verificar('ningún valor parte el registro: mismas líneas y 125 variables',
  lr.length === 4 && lr[1].split('|').length === 125, lr.length + ' / ' + (lr[1] || '').split('|').length);
verificar('el resumen no repite un texto libre de la ficha',
  JSON.stringify(rr.resumen).indexOf('JUAN') === -1 && JSON.stringify(rr.resumen).indexOf('Juan') === -1 &&
  incidenciasDe(rr, 3, 18).some(function (x) { return /texto libre/.test(x.problema); }));

console.log('\n=== 9. Lo que no se diligenció va vacío entre pipes ===');

/* «Ninguno/Ninguna» de las 7 listas obligatorias que el anexo trae sin
   opción de exclusión: responde la pregunta, pero no tiene código. */
const conNinguna = ficha();
Object.assign(conNinguna, {
  elementosVivienda: ['ninguno'], desplazamientoMayor30: ['ninguno'], practicasCalidadAire: ['ninguna'],
  vectoresPresentes: ['ninguno'], medidasControlVectores: ['ninguna'],
  animalesPonzonosos: ['aranas'], medidasPonzonosos: ['ninguna']
});
conNinguna.familias[0].integrantes[0].enfermedadesUltimoMes = ['ninguna'];
conNinguna.familias[0].practicasVinculo = ['ninguna'];
conNinguna.familias[0].practicasCuidadoHogar = ['ninguna'];
const rn = generar([{ encuesta: conNinguna, meta: meta() }]);
const [, t2n, t3n] = rn.contenido.split('\r\n');
const sinExclusion = [36, 48, 82, 85, 87, 91, 117, 119];
verificar('«Ninguna» sin código: variables 36, 48, 82, 85, 87, 91 y 3.48 en 0; la 117 y la 119 con su «Ninguna» de SISPRO (7 y 9)',
  [36, 48, 82, 85, 87, 91].every(function (n) { return campo(t2n, n) === '0'; }) && campo(t3n, 48) === '0' &&
  campo(t2n, 117) === '7' && campo(t2n, 119) === '9',
  sinExclusion.map(function (n) { return n + '=' + campo(t2n, n); }).join(' ') + ' 3.48=' + campo(t3n, 48));
verificar('  y no son incidencia', sinExclusion.every(function (n) { return incidenciasDe(rn, 2, n).length === 0; }) &&
  incidenciasDe(rn, 3, 48).length === 0, JSON.stringify(rn.resumen.incidencias.detalle.map(function (x) {
    return x.tipoRegistro + '.' + x.variable + ' ' + x.problema;
  })));
verificar('  y sin enfermedad no se pregunta qué hizo: 3.50 en 1 (PISIS no admite 0)', campo(t3n, 50) === '1' && incidenciasDe(rn, 3, 50).length === 0);

const listaSinMarcar = ficha();
listaSinMarcar.elementosVivienda = [];
verificar('lista obligatoria sin marcar: vacía y «Obligatoria y vacía»',
  campo(generar([{ encuesta: listaSinMarcar, meta: meta() }]).contenido.split('\r\n')[1], 36) === '' &&
  incidenciasDe(generar([{ encuesta: listaSinMarcar, meta: meta() }]), 2, 36).some(function (x) { return x.problema === 'Obligatoria y vacía'; }));

const opcionalesVacios = ficha();
opcionalesVacios.mediosTransporte = ['otro'];
delete opcionalesVacios.familias[0].integrantes[0].eapb;
delete opcionalesVacios.familias[0].integrantes[0].telefono1;
const ro = generar([{ encuesta: opcionalesVacios, meta: meta() }]);
const [, t2o, t3o] = ro.contenido.split('\r\n');
verificar('«Otro» medio de transporte sin decir cuál: 44 = 10 y 45 vacía', campo(t2o, 44) === '10' && campo(t2o, 45) === '');
verificar('EAPB y teléfono sin diligenciar: 3.21 y 3.15 vacías', campo(t3o, 21) === '' && campo(t3o, 15) === '');
verificar('  ninguno de esos opcionales es incidencia', ro.resumen.incidencias.total === 0,
  JSON.stringify(ro.resumen.incidencias.detalle.map(function (x) { return x.tipoRegistro + '.' + x.variable + ' ' + x.problema; })));
verificar('  y el registro conserva sus 125 y 119 campos', t2o.split('|').length === 125 && t3o.split('|').length === 119);

const repetida = [{ encuesta: ficha(), meta: meta() }, { encuesta: ficha(), meta: meta() }];
repetida[1].encuesta.codigoFicha = 'F-RPT-2';
verificar('la misma persona en dos familias del período se informa',
  incidenciasDe(generar(repetida), 3, 118).some(function (x) { return /repetido/.test(x.problema); }));

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas === 0 ? 0 : 1);
