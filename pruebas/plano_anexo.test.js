/* =========================================================================
   Archivo plano contra el anexo técnico SI-APS (APS124CCFP v7)
   -------------------------------------------------------------------------
       node pruebas/plano_anexo.test.js

   Lee las listas de códigos del anexo (bd/sispro/anexo_APS124CCFP_v7.md) y
   comprueba, sin base de datos:
     1. que toda opción de un catálogo que alimenta una variable tenga un
        código que el anexo admite para esa variable;
     2. que los «No aplica» fijos del generador existan en su lista;
     3. que un archivo armado con fichas de varias edades, sexos, una
        gestante, una migrante y una vivienda rural cumpla campo por campo:
        número de campos, longitud, tipo, códigos e identificadores.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { viviendaAnexo, familiaAnexo, integranteAnexo } = require('./_anexo_datos');
const reporte = require('../api/_reporte_sispro');
const DICCIONARIO = require('../api/_diccionario_sispro');

const BASE = path.join(__dirname, '..');
let pasadas = 0, fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

/* ---------- Listas de códigos del anexo, por registro y variable ---------- */
const md = fs.readFileSync(path.join(BASE, 'bd/sispro/anexo_APS124CCFP_v7.md'), 'utf8').replace(/\r/g, '');
const INICIO = { 2: md.indexOf('## 3. DICCIONARIO DETALLADO'), 3: md.indexOf('## 4. DICCIONARIO DETALLADO'), fin: md.indexOf('## 5. CARACTER') };
const LISTAS = { 2: {}, 3: {} };
const MULTIPLES = { 2: {}, 3: {} };
[2, 3].forEach(function (t) {
  const partes = md.slice(INICIO[t], t === 2 ? INICIO[3] : INICIO.fin).split(/\n#### Campo (\d+):[^\n]*\n/);
  for (let i = 1; i < partes.length; i += 2) {
    const n = Number(partes[i]);
    const lineas = partes[i + 1].split('\n');
    if (/m[uú]ltiple|varias opciones/i.test(partes[i + 1])) MULTIPLES[t][n] = true;
    const codigos = [];
    lineas.forEach(function (linea, k) {
      if (!/^C[oó]digo\s+Descripci[oó]n/i.test(linea.trim())) return;
      /* La lista sigue hasta «Ejemplo» o «Nota»: las descripciones largas
         ocupan varios renglones, y a veces el código va solo en el suyo. */
      for (let j = k + 1; j < lineas.length; j++) {
        const s = lineas[j].trim();
        if (/^(Ejemplo|Nota|NOTA|Para |Se |Si |Cuando |Variable |Permite |Es una |Valores permitidos)/.test(s) ||
            /^C[oó]digo\s+Descripci[oó]n/i.test(s)) break;
        const m = /^([0-9]{1,3}|[A-Z]{2,3})(\s+\S|$)/.exec(s);
        if (m) codigos.push(m[1]);
      }
    });
    if (codigos.length) LISTAS[t][n] = new Set(codigos);
  }
});
const admite = (lista, codigo) => lista.has(String(codigo)) || lista.has(String(Number(codigo)));

console.log('\n=== 1. Opciones de los catálogos contra las listas del anexo ===');
const contexto = vm.createContext({ console });
['catalogos_sispro.js', 'catalogos.js', 'anexo.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(BASE, f), 'utf8'), contexto, { filename: f });
});
const fuente = fs.readFileSync(path.join(BASE, 'api/_reporte_sispro.js'), 'utf8');
const BLOQUES = {
  2: fuente.slice(fuente.indexOf('function variablesTipo2'), fuente.indexOf('function variablesTipo3')),
  3: fuente.slice(fuente.indexOf('function variablesTipo3'), fuente.indexOf('function variableDesdeAnexo'))
};
const USOS = { 2: {}, 3: {} };
const NO_APLICA = { 2: {}, 3: {} };
[2, 3].forEach(function (t) {
  BLOQUES[t].split(/\n(?=\s{4}\d+: \{)/).forEach(function (trozo) {
    const n = /^\s{4}(\d+): \{/.exec(trozo);
    if (!n) return;
    const cat = /'(CAT_[A-Z0-9_]+)'/.exec(trozo);
    const na = /noAplica: '([^']+)'/.exec(trozo);
    if (cat) USOS[t][Number(n[1])] = cat[1];
    if (na) NO_APLICA[t][Number(n[1])] = na[1];
  });
});
vm.runInContext('PREGUNTAS_ANEXO', contexto).forEach(function (p) {
  if ((p.registro === 2 || p.registro === 3) && p.catalogo && !USOS[p.registro][p.variable]) USOS[p.registro][p.variable] = p.catalogo;
});
let comparadas = 0;
const fuera = [];
[2, 3].forEach(function (t) {
  Object.keys(USOS[t]).forEach(function (n) {
    const lista = LISTAS[t][n];
    if (!lista) return;                       // tabla externa (Pais, CIUO, EAPB…)
    comparadas++;
    vm.runInContext(USOS[t][n], contexto).filter(function (o) { return o.vigente !== false && o.sispro; })
      .forEach(function (o) { if (!admite(lista, o.sispro)) fuera.push('tipo ' + t + ' var ' + n + ': ' + o.valor + ' → ' + o.sispro); });
  });
});
verificar('Más de 140 variables con catálogo tienen su lista en el anexo', comparadas > 140, comparadas);
verificar('Toda opción usa un código que el anexo admite para su variable', fuera.length === 0, fuera.join('; '));
const malNoAplica = [];
[2, 3].forEach(function (t) {
  Object.keys(NO_APLICA[t]).forEach(function (n) {
    if (LISTAS[t][n] && !admite(LISTAS[t][n], NO_APLICA[t][n])) malNoAplica.push('tipo ' + t + ' var ' + n + ': ' + NO_APLICA[t][n]);
  });
});
verificar('Cada «No aplica» fijo del generador existe en la lista de su variable', malNoAplica.length === 0, malNoAplica.join('; '));

console.log('\n=== 2. Archivo de fichas variadas, campo por campo ===');
const HOY = new Date('2026-10-15T12:00:00');
const iso = (d) => d.toISOString().slice(0, 10);
function haceMeses(m) { const d = new Date(HOY); d.setMonth(d.getMonth() - m); return iso(d); }
let documento = 0;
/* Integrante con lo que el formulario pide a su edad y sexo. */
function persona(meses, sexo, extra) {
  const anios = Math.floor(meses / 12);
  const p = Object.assign(integranteAnexo(), {
    primerNombre: 'José', segundoNombre: 'Ángel', primerApellido: 'Peña', segundoApellido: 'Muñoz',
    fechaNacimiento: haceMeses(meses), nacionalidad: 'CO', sexo: sexo,
    genero: sexo === 'hombre' ? 'masculino' : 'femenino',
    autoidentificacionGenero: sexo === 'hombre' ? 'masculino' : 'femenino', orientacionSexual: 'heterosexual',
    telefono1: '3155551234', rolFamiliar: 'hijo', ocupacion: '5223', nivelEducativo: 'media_academica',
    regimenAfiliacion: 'subsidiado', eapb: 'ESS024', sujetoEspecialProteccion: ['ninguna'], pertenenciaEtnica: 'ninguna',
    saberesAncestrales: ['ninguna'], discapacidad: ['sin_discapacidad'], certificacionRlcpd: 'no_aplica',
    intencionReproductiva: 'no', practicasCuidado: ['alimentacion'], atencionesPendientesRpms: ['ninguna'],
    conocimientoDerecho: ['derechos_deberes'], lactanciaExclusiva: 'no_aplica', peso: 65, talla: 160, imc: 25.4,
    circunferenciaCintura: 80, clasificacionAntropometrica: 'normal', tensionSistolica: 118, tensionDiastolica: 75,
    clasificacionTension: 'normal', enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'], riesgosSaludMentalJoven: ['ninguna'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  });
  documento++;
  p.tipoId = anios >= 18 ? 'CC' : anios >= 7 ? 'TI' : 'RC';
  p.numeroId = String(1144000000 + documento);
  if (sexo !== 'hombre' && anios >= 10) p.gestacionActual = 'no';
  if (anios < 18) {
    ['circunferenciaCintura', 'tensionSistolica', 'tensionDiastolica', 'clasificacionTension'].forEach(function (k) { delete p[k]; });
    p.peso = anios >= 10 ? 45 : anios >= 5 ? 26 : anios >= 1 ? 13 : 6;
    p.talla = anios >= 10 ? 150 : anios >= 5 ? 128 : anios >= 1 ? 92 : 62;
    p.clasificacionAntropometrica = 'peso_adecuado';
    p.nivelEducativo = anios >= 12 ? 'basica_secundaria' : anios >= 5 ? 'basica_primaria' : 'ninguno';
  }
  if (anios < 15) delete p.ocupacion;
  if (anios < 14) { delete p.ideacionSuicida; delete p.sintomatologiaDepresiva; p.consumoSpa = 'no_aplica'; }
  if (anios < 13) delete p.orientacionSexual;
  if (anios < 10) { delete p.intencionReproductiva; delete p.gestacionActual; }
  if (meses <= 5) p.lactanciaExclusiva = 'si';
  if (meses >= 3 && meses <= 60) p.signosDesnutricion = ['ninguna'];
  return Object.assign(p, extra || {});
}
function familia(integrantes, extra) {
  return Object.assign(familiaAnexo(), {
    tipoFamilia: 'nuclear_biparental', numeroIntegrantes: integrantes.length, integrantes: integrantes,
    cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'], practicasVinculo: ['escucha_activa'],
    redesApoyo: 'cuenta_protectoras', practicasCuidadoHogar: ['ventilacion']
  }, extra || {});
}
function vivienda(familias, extra) {
  return Object.assign(viviendaAnexo(), {
    consentimiento: 'si', situacionInminente: ['no_aplica'], departamentoCodigo: '76', municipioCodigo: '76001',
    uzpe: 'UZPE006', areaUbicacion: 'urbana', territorio: 'T48', microterritorio: 'MT01',
    divisionTerritorial: 'Barrio San Cayetano', equipoSaludId: 'EBS012', prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC', responsableNumeroId: '1144012345', perfilProfesional: 'enfermeria',
    codigoFicha: 'F-' + documento, fechaDiligenciamiento: iso(HOY), entornoAbordaje: 'hogar', direccion: 'CL 5 # 10 - 20',
    latitud: 3.4512345, longitud: -76.5312345, ubicacionReferencia: 'Frente a la cancha', estrato: 'bajo',
    hogaresEnVivienda: 1, personasEnVivienda: familias.reduce(function (s, f) { return s + f.integrantes.length; }, 0),
    habitacionesVivienda: 3, elementosParaDormir: 4, tipoVivienda: 'casa', materialTecho: 'concreto',
    riesgosAccidente: ['ninguno'], vectores: 'no', factoresContaminacion: ['ninguno'], actividadEconomica: 'no',
    animales: ['ninguno'], perros: 0, perrosVacunados: 0, gatos: 0, gatosVacunados: 0, carnetAntirrabico: 'no_aplica',
    fuenteAgua: ['acueducto_esp'], disposicionExcretas: ['alcantarillado'], aguasResiduales: ['alcantarillado'],
    residuosSolidos: ['servicio_aseo'], familias: familias
  }, extra || {});
}

const fichas = [
  vivienda([familia([
    persona(40 * 12, 'hombre', { rolFamiliar: 'responsable_economico' }),
    persona(36 * 12, 'mujer', { rolFamiliar: 'conyuge', gestacionActual: 'si', atencionesPendientesMaterno: ['ninguna'] }),
    persona(8 * 12, 'hombre'), persona(4, 'mujer')
  ])]),
  vivienda([
    familia([persona(70 * 12, 'mujer', { rolFamiliar: 'responsable_economico' }), persona(15 * 12, 'hombre')]),
    familia([persona(30 * 12, 'mujer', { rolFamiliar: 'responsable_economico', nacionalidad: 'VE', tipoId: 'PT',
      numeroId: '1234567', estatusMigratorio: 'regular', sujetoEspecialProteccion: ['migrante'] })], { tipoFamilia: 'unipersonal' })
  ], { areaUbicacion: 'rural', territorio: 'T216', microterritorio: 'MT02', divisionTerritorial: 'Vereda La Buitrera' })
].map(function (encuesta, k) {
  return { encuesta: encuesta, meta: { consecutivoVivienda: k + 1, personasPorHabitacion: 2, hacinamiento: false,
    familias: encuesta.familias.map(function (f, j) { return { consecutivo: j + 1 }; }) } };
});
const r = reporte.construirReporte({ fichas: fichas, desde: '2026-10-01', hasta: '2026-10-31',
  entidad: { tipo: 'NI', numero: '805027289' }, subregion: '117' });
const registros = r.contenido.replace(/\r\n$/, '').split('\r\n').map(function (l) { return l.split('|'); });
const t2 = registros.filter(function (x) { return x[0] === '2'; });
const t3 = registros.filter(function (x) { return x[0] === '3'; });

verificar('Nombre de 36 caracteres con la fecha de corte y el NIT en 12 dígitos',
  r.nombreArchivo === 'APS124CCFP20261031NI000805027289.TXT', r.nombreArchivo);
verificar('Sólo ASCII, sin comillas y en mayúsculas', /^[\x20-\x7e\r\n]*$/.test(r.contenido) && !/"/.test(r.contenido) && !/[a-z]/.test(r.contenido));
verificar('Control: 6 campos y el total de registros de detalle', registros[0].length === 6 && registros[0][5] === String(t2.length + t3.length));

const errores = [];
[[2, t2], [3, t3]].forEach(function (par) {
  const t = par[0];
  par[1].forEach(function (campos, k) {
    const dic = DICCIONARIO['TIPO_' + t];
    if (campos.length !== dic.length) errores.push('tipo ' + t + ' registro ' + (k + 1) + ': ' + campos.length + ' campos');
    dic.forEach(function (d) {
      const v = campos[d.n];
      if (v === '' || v === undefined) return;
      const multiple = MULTIPLES[t][d.n];
      const donde = 'tipo ' + t + ' var ' + d.n;
      if (v.length > d.max) errores.push(donde + ': largo ' + v.length + ' > ' + d.max);
      /* La EAPB es «N» en el anexo pero su tabla (SGDCodigoEAPB) es alfanumérica. */
      if (d.tipo === 'N' && !(t === 3 && d.n === 21) && !(multiple ? /^\d+(,\d+)*$/ : /^\d+$/).test(v)) errores.push(donde + ': no numérico');
      if (d.tipo === 'D' && !/^-?\d+(\.\d+)?$/.test(v)) errores.push(donde + ': no decimal');
      if (d.tipo === 'F' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errores.push(donde + ': fecha');
      if (d.tipo === 'A' && !/^[A-Z0-9,]+$/.test(v)) errores.push(donde + ': alfanumérico');
      const lista = LISTAS[t][d.n];
      if (lista && (d.tipo === 'N' || d.tipo === 'A')) {
        (multiple ? v.split(',') : [v]).forEach(function (x) {
          if (!admite(lista, x) && !lista.has(x.padStart(2, '0'))) errores.push(donde + ': código ' + x + ' fuera de la lista');
        });
      }
    });
  });
});
verificar('Cada campo respeta número de campos, longitud, tipo y códigos del anexo', errores.length === 0, errores.slice(0, 8).join('; '));

const idsFamilia = new Set(t2.map(function (x) { return x[124]; }));
verificar('Vivienda (123) = var 3+4+5+6+7 + H + 4 dígitos; familia (124) = 123 + F + 4 dígitos',
  t2.every(function (x) { return x[123] === x[3] + x[4] + x[5] + x[6] + x[7] + x[123].slice(-5) && /H\d{4}$/.test(x[123]) &&
    x[124].startsWith(x[123]) && /^F\d{4}$/.test(x[124].slice(x[123].length)); }), t2.map(function (x) { return x[124]; }).join(','));
verificar('Integrante (118) = 117 + tipo + número, y su familia existe en el tipo 2',
  t3.every(function (x) { return x[118] === x[117] + x[6] + x[7] && idsFamilia.has(x[117]); }));
verificar('Consecutivos de 1 en 1, cada tipo desde 1',
  t2.every(function (x, k) { return x[1] === String(k + 1); }) && t3.every(function (x, k) { return x[1] === String(k + 1); }));
const nino = t3[2], bebe = t3[3], hombre = t3[0];
verificar('A quien no se le preguntó por su edad o sexo: orientación 5, intención y gestación 2',
  nino[14] === '5' && nino[32] === '2' && nino[33] === '2' && bebe[14] === '5' && hombre[33] === '2',
  [nino[14], nino[32], nino[33], bebe[14], hombre[33]].join('/'));
verificar('Menor de 14: consumo de SPA (63) vacío, no 3', nino[63] === '' && bebe[63] === '', nino[63] + '/' + bebe[63]);
verificar('La gestante reporta 1 en gestación (33) y en embarazo (72)', t3[1][33] === '1' && t3[1][72] === '1', t3[1][33] + '/' + t3[1][72]);

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
process.exit(fallidas > 0 ? 1 : 0);
