/* =========================================================================
   Fichas en Excel (Reporte SI-APS → Fichas en Excel)
   -------------------------------------------------------------------------
       node pruebas/excel_fichas.test.js

   Arma el libro con fichas escritas a mano, lo abre (es un ZIP) y lee sus
   hojas: nombres, títulos con el número del instrumento, respuestas escritas
   y no en código, números como números, el código de la ficha en cada hoja
   y nada de códigos de regla. Sin base de datos.
   ========================================================================= */

'use strict';

const zlib = require('zlib');
const path = require('path');
const { spawnSync } = require('child_process');
const { viviendaAnexo, familiaAnexo, integranteAnexo } = require('./_anexo_datos');
const { construirExcel } = require('../api/_excel_fichas');
const { obtenerMotor } = require('../api/_validacion');
const { CAMPOS_FICHA } = require('../api/_campos_ficha');

let pasadas = 0, fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + detalle : '')); }
}

/* ---------- Lectura del .xlsx: ZIP y celdas ---------- */
function abrirZip(buffer) {
  const fin = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const total = buffer.readUInt16LE(fin + 10);
  let p = buffer.readUInt32LE(fin + 16);
  const archivos = {};
  for (let k = 0; k < total; k++) {
    const metodo = buffer.readUInt16LE(p + 10);
    const comprimido = buffer.readUInt32LE(p + 20);
    const largoNombre = buffer.readUInt16LE(p + 28);
    const extra = buffer.readUInt16LE(p + 30);
    const comentario = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nombre = buffer.slice(p + 46, p + 46 + largoNombre).toString('utf8');
    const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const datos = buffer.slice(inicio, inicio + comprimido);
    archivos[nombre] = (metodo === 8 ? zlib.inflateRawSync(datos) : datos).toString('utf8');
    p += 46 + largoNombre + extra + comentario;
  }
  return archivos;
}
const desescapar = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/* Filas de una hoja: { número: [valores en orden de columna] }. */
function filasDe(xmlHoja) {
  const filas = {};
  for (const fila of xmlHoja.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const valores = [];
    for (const c of fila[2].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>)/g)) {
      const col = c[1].split('').reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1;
      valores[col] = c[2] !== undefined ? Number(c[2]) : c[3] !== undefined ? desescapar(c[3]) : null;
    }
    filas[Number(fila[1])] = valores;
  }
  return filas;
}

/* ---------- Fichas de ejemplo ---------- */
let documento = 0;
function persona(anios, sexo, extra) {
  documento++;
  const p = Object.assign(integranteAnexo(), {
    primerNombre: 'Ana', segundoNombre: 'María', primerApellido: 'Gómez', segundoApellido: 'Ruiz & <Hijos>',
    tipoId: anios >= 18 ? 'CC' : 'TI', numeroId: String(1144000000 + documento),
    fechaNacimiento: (2026 - anios) + '-01-15', nacionalidad: 'CO', sexo: sexo,
    genero: sexo === 'hombre' ? 'masculino' : 'femenino', autoidentificacionGenero: sexo === 'hombre' ? 'masculino' : 'femenino',
    orientacionSexual: 'heterosexual', telefono1: '3155551234', rolFamiliar: 'hijo', ocupacion: '5223',
    nivelEducativo: 'media_academica', regimenAfiliacion: 'subsidiado', eapb: 'ESS024', sujetoEspecialProteccion: ['ninguna'],
    pertenenciaEtnica: 'ninguna', saberesAncestrales: ['ninguna'], discapacidad: ['sin_discapacidad'], certificacionRlcpd: 'no_aplica',
    intencionReproductiva: 'no', practicasCuidado: ['alimentacion', 'actividad_fisica'], atencionesPendientesRpms: ['ninguna'],
    conocimientoDerecho: ['derechos_deberes'], lactanciaExclusiva: 'no_aplica', peso: 65.5, talla: 160, imc: 25.59,
    circunferenciaCintura: 80, clasificacionAntropometrica: 'normal', tensionSistolica: 118, tensionDiastolica: 75,
    clasificacionTension: 'normal', enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'], riesgosSaludMentalJoven: ['ninguna'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  });
  if (sexo !== 'hombre') p.gestacionActual = 'no';
  return Object.assign(p, extra || {});
}
function vivienda(codigo, familias, extra) {
  return Object.assign(viviendaAnexo(), {
    codigoFicha: codigo, fechaDiligenciamiento: '2026-10-15', fechaRegistro: '2026-10-15T14:30:00Z',
    consentimiento: 'si', situacionInminente: ['no_aplica'], departamentoCodigo: '76', municipioCodigo: '76001', uzpe: 'UZPE006',
    areaUbicacion: 'urbana', territorio: 'T48', microterritorio: 'MT01', divisionTerritorial: 'Barrio San Cayetano',
    equipoSaludId: 'EBS012', prestadorPrimario: 'PROV-ESE-LADERA', responsableTipoId: 'CC', responsableNumeroId: '1144012345',
    perfilProfesional: 'enfermeria', entornoAbordaje: 'hogar', direccion: 'CL 5 # 10 - 20', latitud: 3.4512345, longitud: -76.5312345,
    estrato: 'bajo', hogaresEnVivienda: 1, personasEnVivienda: 3, habitacionesVivienda: 2, elementosParaDormir: 3,
    tipoVivienda: 'casa', materialTecho: 'concreto', riesgosAccidente: ['ninguno'], vectores: 'no', factoresContaminacion: ['ninguno'],
    actividadEconomica: 'no', animales: ['ninguno'], fuenteAgua: ['acueducto_esp'], familias: familias
  }, extra || {});
}
const fichas = [
  { encuesta: vivienda('76001-EBS012-AAAA-0001-20261015', [Object.assign(familiaAnexo(), {
      idFamilia: 'T48MT01H0001F0001', codigoCf: 'CF001', tipoFamilia: 'nuclear_biparental', numeroIntegrantes: 2,
      cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'], practicasVinculo: ['escucha_activa', 'resuelve_conflictos'],
      redesApoyo: 'cuenta_protectoras', practicasCuidadoHogar: ['ventilacion'],
      integrantes: [
        persona(40, 'mujer', { rolFamiliar: 'responsable_economico', tensionSistolica: 185, tensionDiastolica: 125, clasificacionTension: 'crisis',
          planPersona: { acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345', codigoAccion: '890201', tipoRespuesta: 'en_sitio' }],
            seguimientos: [{ seguimientoTipoId: 'CC', seguimientoNumeroId: '1144012345', accionConcertada: 'Control de tensión', seg1Fecha: '2026-10-16', seg1Estado: 'C' }] } }),
        persona(8, 'hombre')
      ] })]),
    meta: { estado: 'cerrada', personasPorHabitacion: 1.5, hacinamiento: false } },
  { encuesta: vivienda('76001-EBS012-AAAA-0002-20261016', [Object.assign(familiaAnexo(), {
      idFamilia: 'T216MT02H0001F0001', tipoFamilia: 'unipersonal', numeroIntegrantes: 1, cuidadorPrincipal: 'no',
      situacionesRiesgo: ['ninguna'], practicasVinculo: [], redesApoyo: 'cuenta_protectoras', practicasCuidadoHogar: [],
      integrantes: [persona(30, 'mujer', { nacionalidad: 'VE', tipoId: 'PT', numeroId: '1234567', estatusMigratorio: 'regular' })] })],
    { areaUbicacion: 'rural', territorio: 'T216', microterritorio: 'MT02', fechaDiligenciamiento: '2026-10-16' }),
    meta: { estado: 'sincronizada' } }
];

const r = construirExcel({ fichas: fichas, motor: obtenerMotor(), nombresAcciones: { '890201': 'CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL' },
  desde: '2026-10-01', hasta: '2026-10-31', generadoPor: 'Coordinadora de prueba', ahora: new Date('2026-10-29T15:00:00Z') });
const archivos = abrirZip(r.contenido);
const nombresHojas = [...archivos['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
const hoja = (nombre) => filasDe(archivos['xl/worksheets/sheet' + (nombresHojas.indexOf(nombre) + 1) + '.xml']);

console.log('\n=== 1. Libro ===');
const comprobar = spawnSync(process.execPath, [path.join(__dirname, '..', 'bd', 'gen_campos_ficha.js'), '--comprobar'], { encoding: 'utf8' });
verificar('La lista de preguntas (api/_campos_ficha.js) está al día con el formulario', comprobar.status === 0, comprobar.stderr);
verificar('Nombre del archivo con el período', r.nombreArchivo === 'Fichas_caracterizacion_20261001_20261031.xlsx', r.nombreArchivo);
verificar('Es un .xlsx con sus partes', ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet7.xml'].every((n) => archivos[n]),
  Object.keys(archivos).join(', '));
verificar('Siete hojas en orden', nombresHojas.join('|') === 'Resumen|Fichas|Familias|Integrantes|Acciones|Seguimientos|Alertas', nombresHojas.join('|'));
verificar('Totales', JSON.stringify(r.totales) === JSON.stringify({ fichas: 2, familias: 2, personas: 3, acciones: 1, seguimientos: 1, alertas: r.totales.alertas, inmediatas: r.totales.inmediatas }) &&
  r.totales.inmediatas >= 1, JSON.stringify(r.totales));
const todo = Object.keys(archivos).filter((n) => /worksheets/.test(n)).map((n) => archivos[n]).join('');
verificar('Ningún código de regla (RN-…) en el libro', !/RN-\d/.test(todo), (todo.match(/.{30}RN-\d+.{20}/) || [''])[0]);
verificar('Caracteres especiales escapados y legibles', /Ruiz &amp; &lt;Hijos&gt;/.test(todo));

console.log('\n=== 2. Resumen ===');
const resumen = hoja('Resumen');
const fila = (h, texto) => Object.values(h).find((f) => f && f[0] === texto);
verificar('Período, quién lo generó y conteos', fila(resumen, 'Período')[1] === '2026-10-01 a 2026-10-31' &&
  fila(resumen, 'Generado por')[1] === 'Coordinadora de prueba' && fila(resumen, 'Personas')[1] === 3 && fila(resumen, 'Generado el')[1] === '2026-10-29 10:00');
verificar('Aviso de datos personales y sensibles', /Ley 1581/.test(fila(resumen, 'Uso de la información')[1]));

console.log('\n=== 3. Fichas ===');
const hFichas = hoja('Fichas');
const titulos = hFichas[2];
const col = (nombre) => titulos.indexOf(nombre);
verificar('Fila de secciones y fila de títulos con el número del ítem',
  hFichas[1][0] === 'Ficha' && titulos[0] === '15. Código de la ficha' && col('27. Estrato socioeconómico de la vivienda') > 0 && col('7. Territorio') > 0);
const columnasEsperadas = 4 + CAMPOS_FICHA.ficha.length - 2 + 1 + 7;
verificar('Una columna por pregunta, más las calculadas y el resumen', titulos.length === columnasEsperadas, titulos.length + ' / ' + columnasEsperadas);
const f1 = hFichas[3], f2 = hFichas[4];
verificar('Respuestas escritas: consentimiento, estrato, territorio, comuna', f1[col('1. Consentimiento informado para el tratamiento de datos')] === 'Sí' &&
  f1[col('27. Estrato socioeconómico de la vivienda')] === 'Bajo' && f2[col('7. Territorio')] === 'T216 · La Buitrera 7 (rural)' &&
  f1[col('Comuna (derivada del territorio)')] === 'Comuna 3' && f2[col('Comuna (derivada del territorio)')] === 'Zona rural',
  [f1[col('27. Estrato socioeconómico de la vivienda')], f2[col('7. Territorio')]].join(' / '));
verificar('Números como números y calculados (personas por habitación, hacinamiento)',
  f1[col('29. N.° de personas en la vivienda')] === 3 && f1[col('32. N.° personas por habitación: (cálculo auto)')] === 1.5 && f1[col('33. Hacinamiento')] === 'No');
verificar('Estado, hora de registro en hora de Colombia, plan y alertas', f1[col('Estado de la ficha')] === 'Cerrada' &&
  f2[col('Estado de la ficha')] === 'Sincronizada' && f1[col('Fecha y hora de registro')] === '2026-10-15 09:30' && f1[col('Alertas inmediatas')] >= 1);
verificar('Paneles inmovilizados y autofiltro', /state="frozen"/.test(archivos['xl/worksheets/sheet2.xml']) && /<autoFilter ref="A2:/.test(archivos['xl/worksheets/sheet2.xml']));

console.log('\n=== 4. Familias e integrantes ===');
const hFam = hoja('Familias');
const tf = hFam[2];
verificar('Familia: código de ficha, ID, CF y listas con «; »',
  hFam[3][0] === '76001-EBS012-AAAA-0001-20261015' && hFam[3][tf.indexOf('N.° de ID de la familia')] === 'T48MT01H0001F0001' &&
  hFam[3][tf.indexOf('Código de la visita a la familia (CF)')] === 'CF001' && /; /.test(hFam[3][tf.indexOf('55. Prácticas que favorecen los vínculos familiares')]));
const hInt = hoja('Integrantes');
const ti = hInt[2];
const ci = (t) => ti.indexOf(t);
verificar('Una fila por persona', Object.keys(hInt).length === 2 + 3, Object.keys(hInt).length);
const nino = hInt[4], migrante = hInt[5];
verificar('Nombre completo, edad, sexo y país escritos', /^Ana María Gómez Ruiz/.test(hInt[3][ci('Nombre completo')]) &&
  nino[ci('Edad (cálculo automático)')] === '8 años' && nino[ci('66. Sexo')] === 'Hombre' && migrante[ci('65. País de origen')] === 'Venezuela',
  [nino[ci('Edad (cálculo automático)')], migrante[ci('65. País de origen')]].join(' / '));
verificar('Ocupación con su nombre CIUO y EAPB con su nombre', /^5223 — /.test(hInt[3][ci('73. Ocupación (código CIUO)')]) &&
  typeof hInt[3][ci('76. EAPB')] === 'string' && hInt[3][ci('76. EAPB')] !== 'ESS024');
verificar('Peso decimal como número', hInt[3][ci('92. Peso (en kilogramos)')] === 65.5);
verificar('Documento como texto (no pierde ceros ni se vuelve notación científica)', typeof hInt[3][ci('63. Número de identificación')] === 'string');

console.log('\n=== 5. Plan de cuidado y alertas ===');
const hAcc = hoja('Acciones');
verificar('Acción con su nombre del catálogo y su dueño', hAcc[2] && hAcc[2][5] === '890201' && hAcc[2][6] === 'CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL' &&
  hAcc[2][1] === 'Persona' && /^Familia 1 · Ana Gómez/.test(hAcc[2][2]) && hAcc[2][8] === 'En sitio', JSON.stringify(hAcc[2]));
const hSeg = hoja('Seguimientos');
verificar('Seguimiento con su estado escrito', hSeg[2] && hSeg[2][5] === 'Control de tensión' && hSeg[2][6] === '2026-10-16' && typeof hSeg[2][7] === 'string' && hSeg[2][7] !== 'C',
  JSON.stringify(hSeg[2]));
const hAle = hoja('Alertas');
const crisis = Object.values(hAle).find((f) => f && f[4] === 'Crisis hipertensiva');
verificar('Alerta de crisis hipertensiva: inmediata, con plazo y conducta registrada', crisis && crisis[3] === 'Inmediata' && crisis[6] === 2 && crisis[8] === 'Sí',
  JSON.stringify(crisis));

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas > 0 ? 1 : 0);
