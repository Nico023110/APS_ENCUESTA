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
verificar('cada registro termina en CRLF (también el último)', r.contenido.endsWith('\r\n') && lineas[lineas.length - 1] === '');
lineas.pop();
verificar('1 registro de control + 1 de familia + 2 de integrantes', lineas.length === 4, lineas.length);
verificar('registro de control', lineas[0] === '1|NI|805027289|2026-09-01|2026-09-30|3', lineas[0]);
const t2 = lineas[1];
const [t3a, t3b] = [lineas[2], lineas[3]];
verificar('el tipo 2 tiene 125 variables', t2.split('|').length === 125, t2.split('|').length);
verificar('los tipo 3 tienen 119 variables', t3a.split('|').length === 119 && t3b.split('|').length === 119);
verificar('consecutivos: cada tipo desde 1', campo(t2, 1) === '1' && campo(t3a, 1) === '1' && campo(t3b, 1) === '2');
verificar('sólo ASCII imprimible', /^[\x20-\x7E\r\n]*$/.test(r.contenido));

console.log('\n=== 4. Identificadores (variables 123, 124, 117 y 118) ===');

const idVivienda = '76' + '117' + '76001' + 'T48' + 'MT01' + 'H0007';
verificar('ID de la vivienda: depto + subregión + municipio + territorio + micro + H + consecutivo',
  campo(t2, 123) === idVivienda, campo(t2, 123));
verificar('ID de la familia: vivienda + F + consecutivo', campo(t2, 124) === idVivienda + 'F0001', campo(t2, 124));
verificar('el integrante apunta a su familia', campo(t3a, 117) === campo(t2, 124) && campo(t3b, 117) === campo(t2, 124));
verificar('ID del integrante: familia + tipo + número', campo(t3a, 118) === idVivienda + 'F0001CC1144099887', campo(t3a, 118));
verificar('número de personas de la familia = registros tipo 3', campo(t2, 110) === '2', campo(t2, 110));

console.log('\n=== 5. Registro tipo 2 ===');

verificar('consentimiento sí => 1', campo(t2, 2) === '1');
verificar('texto de la división territorial normalizado', campo(t2, 9) === 'BARRIO SAN CAYETANO N', campo(t2, 9));
verificar('tipo de ubicación (anexo) barrio => 5', campo(t2, 8) === '5', campo(t2, 8));
verificar('área urbana => 1', campo(t2, 10) === '1');
verificar('longitud y latitud', campo(t2, 12) === '-76.531234' && campo(t2, 13) === '3.451234', campo(t2, 12) + ' ' + campo(t2, 13));
verificar('situación «No aplica» => 4 y observaciones «NO APLICA»', campo(t2, 23) === '4' && campo(t2, 24) === 'NO APLICA',
  campo(t2, 23) + ' / ' + campo(t2, 24));
verificar('NIT del prestador primario', campo(t2, 26) === '805027289', campo(t2, 26));
verificar('perfil como texto', campo(t2, 29) === 'ENFERMERIA (PROFESIONAL)' || /^ENFERMER/.test(campo(t2, 29)), campo(t2, 29));
verificar('fuente de agua múltiple => 1,12', campo(t2, 53) === '1,12', campo(t2, 53));
verificar('sin tanque: la frecuencia de limpieza va «No aplica» (4)', campo(t2, 56) === '4', campo(t2, 56));
verificar('sin actividad económica: el área de trabajo va vacía', campo(t2, 51) === '', campo(t2, 51));
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
verificar('niño: sin cintura ni tensión, clasificación de tensión «No aplica» (6)',
  campo(t3b, 40) === '' && campo(t3b, 44) === '' && campo(t3b, 46) === '6', [campo(t3b, 40), campo(t3b, 44), campo(t3b, 46)].join('/'));
verificar('niño: ítems de mayores de 14 «No aplica» (52 => 5, 53 => 3, 63 => 3)',
  campo(t3b, 52) === '5' && campo(t3b, 53) === '3' && campo(t3b, 63) === '3',
  [campo(t3b, 52), campo(t3b, 53), campo(t3b, 63)].join('/'));
verificar('niño de 8: tabaco «No aplica» por su siOculta (3)', campo(t3b, 64) === '3', campo(t3b, 64));
verificar('niño de 8: signos de desnutrición (3 meses a 5 años) «No aplica» (9)', campo(t3b, 41) === '9', campo(t3b, 41));
verificar('hombre: edad fértil 2', campo(t3b, 71) === '2');

verificar('una ficha completa no deja incidencias', r.resumen.incidencias.total === 0,
  JSON.stringify(r.resumen.incidencias.detalle.map(function (x) {
    return x.tipoRegistro + '.' + x.variable + ' ' + x.problema;
  })));

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
lr.pop();
verificar('ningún valor parte el registro: mismas líneas y 125 variables',
  lr.length === 4 && lr[1].split('|').length === 125, lr.length + ' / ' + (lr[1] || '').split('|').length);
verificar('el resumen no repite un texto libre de la ficha',
  JSON.stringify(rr.resumen).indexOf('JUAN') === -1 && JSON.stringify(rr.resumen).indexOf('Juan') === -1 &&
  incidenciasDe(rr, 3, 18).some(function (x) { return /texto libre/.test(x.problema); }));

const repetida = [{ encuesta: ficha(), meta: meta() }, { encuesta: ficha(), meta: meta() }];
repetida[1].encuesta.codigoFicha = 'F-RPT-2';
verificar('la misma persona en dos familias del período se informa',
  incidenciasDe(generar(repetida), 3, 118).some(function (x) { return /repetido/.test(x.problema); }));

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas === 0 ? 0 : 1);
