/* =========================================================================
   Registro de una encuesta que se queda en la base
   -------------------------------------------------------------------------
       npm run encuesta            (ventana visible, se ve el proceso)
       npm run encuesta:rapido     (sin ventana)

   EN QUÉ SE DIFERENCIA DE LA PRUEBA

   `encuesta_completa.spec.js` comprueba que el formulario funciona y borra su
   ficha al terminar. Este guion registra: diligencia una vivienda y deja la
   ficha en la base para siempre.

   Por eso no corre con `npm run e2e` —está fuera por `testIgnore`— y hay que
   pedirlo a propósito. Correrlo dos veces crea dos fichas distintas: el
   código lleva la fecha y la hora.

   SOBRE LOS DATOS

   Son datos de ejemplo, verosímiles pero inventados. No corresponden a
   ninguna vivienda ni a ninguna persona real. Para cargar una visita de
   campo de verdad, reemplace VIVIENDA y HABITANTES por lo que traiga el
   instrumento diligenciado en papel.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });

const { test, expect } = require('@playwright/test');
const ayudas = require('./ayudas');
const flujo = require('./diligenciar');

/* ---------------------------------------------------------
   Identificadores de esta visita
   ---------------------------------------------------------
   Llevan la fecha y la hora para no chocar entre corridas, y un prefijo
   distinto del de la prueba: `F-PW-` lo borra `encuesta_completa.spec.js`
   en cada pasada, y esta ficha tiene que sobrevivir a eso.
   --------------------------------------------------------- */

function sello() {
  const f = new Date();
  const dos = function (n) { return String(n).padStart(2, '0'); };
  return String(f.getFullYear()) + dos(f.getMonth() + 1) + dos(f.getDate()) +
    '-' + dos(f.getHours()) + dos(f.getMinutes());
}

const SELLO = sello();

/* ---------------------------------------------------------
   La vivienda
   --------------------------------------------------------- */

const VIVIENDA = {
  codigo: 'F-CALI-' + SELLO,
  hogar: 'HG-CALI-' + SELLO,
  /* Ítem 26: el número de referencia de la familia. No es su llave. */
  familia: 'FM-CALI-' + SELLO,
  /* RN-026: la llave real la deriva el servidor del hogar y el consecutivo. */
  codigoFamiliaDerivado: 'HG-CALI-' + SELLO + '-F1',
  ebs: 'EBS0931',

  situacionInminente: 'no_aplica',
  uzpe: 'UZPE006',
  areaUbicacion: 'urbana',
  territorio: 'T49',
  microterritorio: 'MT01',
  divisionTerritorial: 'Barrio Terrón Colorado, sector La Legua',

  prestador: 'PROV-ESE-LADERA',
  responsableTipoId: 'CC',
  responsableNumeroId: '31892456',
  perfilProfesional: 'auxiliar_enfermeria',
  entornoAbordaje: 'hogar',
  cabezaFamilia: 'Rosa Elena Valencia Murillo',
  jovenesEnPaz: 'no',

  direccion: { viaTipo: 'KR', viaNumero: '52', genNumero: '12', placa: '34' },
  latitud: '3.464812',
  longitud: '-76.556037',
  ubicacionReferencia: 'Subiendo por la escalera de la tienda de doña Fabiola',

  estrato: 'bajo',
  hogaresEnVivienda: '1',
  personasEnVivienda: '4',
  habitacionesVivienda: '2',
  elementosParaDormir: '3',

  tipoVivienda: 'casa',
  materialTecho: 'zinc',
  vectores: 'no',
  riesgosAccidente: 'ninguno',
  factoresContaminacion: 'ninguno',
  actividadEconomica: 'no',

  /* Hay perros en la vivienda: eso habilita los conteos de los ítems 41 a 45
     y el carnet antirrábico, que con «ninguno» nunca se tocan. Los dos están
     vacunados, así que la cobertura es completa y no genera alerta. */
  animales: 'perros',
  mascotas: {
    perros: '2', perrosVacunados: '2',
    gatos: '0', gatosVacunados: '0',
    carnet: 'si'
  },

  fuenteAgua: 'acueducto_esp',
  disposicionExcretas: 'alcantarillado',
  aguasResiduales: 'alcantarillado',
  residuosSolidos: 'servicio_aseo',

  tipoFamilia: 'extenso_biparental',
  cuidadorPrincipal: 'no',
  redesApoyo: 'cuenta_protectoras',
  situacionesRiesgo: 'ninguna',
  practicasVinculo: 'escucha_activa',
  practicasCuidadoHogar: 'ventilacion',

  planVivienda: {
    ejecutorTipoId: 'CC', ejecutorNumeroId: '31892456',
    codigoAccion: 'NC-AMB-07', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se revisó la humedad del muro de la cocina y se acordó ventilar a diario',
    accionConcertada: 'Eliminar criaderos de zancudos en las materas y el tanque del patio'
  },
  planFamilia: {
    ejecutorTipoId: 'CC', ejecutorNumeroId: '31892456',
    codigoAccion: 'NC-FAM-02', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se conversó con la familia sobre el relevo del cuidador',
    accionConcertada: 'Turnar entre los adultos el acompañamiento a la abuela'
  },
  planPersona: {
    /* Danna, la adolescente. */
    integrante: 2,
    ejecutorTipoId: 'CC', ejecutorNumeroId: '31892456',
    codigoAccion: 'NC-GES-06', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se dejó agendada la cita de control con verificación de asistencia',
    accionConcertada: 'Consulta de primera vez para valoración integral de la adolescencia'
  }
};

/* ---------------------------------------------------------
   Los habitantes
   ---------------------------------------------------------
   Cuatro personas de edades muy distintas. RN-051 manda que haya
   exactamente un responsable económico. Los documentos siguen el catálogo
   por edad: cédula para los adultos, tarjeta de identidad para la
   adolescente de quince años.
   --------------------------------------------------------- */

const HABITANTES = [
  {
    titulo: 'Rosa Elena Valencia Murillo — 42 años, responsable económica',
    primerNombre: 'Rosa', segundoNombre: 'Elena',
    primerApellido: 'Valencia', segundoApellido: 'Murillo',
    tipoId: 'CC', numeroId: '31892456', fechaNacimiento: '1984-02-18',
    sexo: 'mujer', genero: 'femenino', autoidentificacion: 'femenino',
    orientacion: 'heterosexual',
    telefono: '3168894477', rol: 'responsable_economico',
    ocupacion: '9111', nivelEducativo: 'media_academica',
    peso: '72', talla: '158', cintura: '89',
    sistolica: '116', diastolica: '74',
    gestacion: 'no'
  },
  {
    titulo: 'Luis Alberto Caicedo Rentería — 47 años, cónyuge',
    primerNombre: 'Luis', segundoNombre: 'Alberto',
    primerApellido: 'Caicedo', segundoApellido: 'Rentería',
    tipoId: 'CC', numeroId: '16789234', fechaNacimiento: '1979-06-05',
    sexo: 'hombre', genero: 'masculino', autoidentificacion: 'masculino',
    orientacion: 'heterosexual',
    telefono: '3204471209', rol: 'conyuge',
    ocupacion: '7111', nivelEducativo: 'basica_secundaria',
    peso: '81', talla: '174', cintura: '97',
    sistolica: '118', diastolica: '76',
    /* Sin gestación: el formulario esconde la pregunta por sexo (RN-085). */
    gestacion: null
  },
  {
    titulo: 'Danna Valeria Caicedo Valencia — 15 años, hija',
    primerNombre: 'Danna', segundoNombre: 'Valeria',
    primerApellido: 'Caicedo', segundoApellido: 'Valencia',
    tipoId: 'TI', numeroId: '1006554433', fechaNacimiento: '2011-04-23',
    sexo: 'mujer', genero: 'femenino', autoidentificacion: 'femenino',
    orientacion: 'heterosexual',
    telefono: '', rol: 'hijo',
    ocupacion: '0000', nivelEducativo: 'basica_secundaria',
    /* Menor de 18: sin cintura ni tensión. Sí responde el ítem 105, que se
       indaga entre los 14 y los 28 años. */
    peso: '52', talla: '160', cintura: null,
    sistolica: null, diastolica: null,
    gestacion: 'no'
  },
  {
    titulo: 'Carmen Rosa Murillo Angulo — 68 años, madre',
    primerNombre: 'Carmen', segundoNombre: 'Rosa',
    primerApellido: 'Murillo', segundoApellido: 'Angulo',
    tipoId: 'CC', numeroId: '29876543', fechaNacimiento: '1958-09-30',
    sexo: 'mujer', genero: 'femenino', autoidentificacion: 'femenino',
    orientacion: 'heterosexual',
    telefono: '', rol: 'padre_madre',
    ocupacion: '0000', nivelEducativo: 'basica_primaria',
    peso: '64', talla: '152', cintura: '91',
    sistolica: '118', diastolica: '78',
    gestacion: 'no'
  }
];

/* =========================================================
   El registro
   ========================================================= */

test.describe.configure({ mode: 'serial' });

/* Sin `beforeAll` ni `afterAll` de limpieza: eso es lo que distingue este
   guion de la prueba. La ficha se queda. */

test('Se registra una encuesta real y queda guardada en la base', async function ({ page }, infoPrueba) {
  const diario = ayudas.crearDiario();
  ayudas.vigilar(page, diario);

  console.log('\n  Registrando la ficha ' + VIVIENDA.codigo +
    ' — ' + HABITANTES.length + ' habitantes\n');

  await flujo.diligenciarEncuesta(page, diario, VIVIENDA, HABITANTES);

  const cierre = await flujo.cerrarYGuardar(page, diario, VIVIENDA);

  await page.screenshot({
    path: infoPrueba.outputPath('ficha-registrada.png'),
    fullPage: true
  });

  ayudas.imprimirInforme(diario);

  /* Nada de esto se da por bueno sin comprobarlo contra la base: el objetivo
     del guion no es que el formulario no proteste, es que la ficha quede
     escrita. Se consulta lo que de verdad se guardó. */
  expect(cierre.guardo, 'la ficha no cerró; revise el informe de arriba').toBe(true);
  expect(cierre.respuestaApi && cierre.respuestaApi.estado,
    'la ficha no llegó a la base').toBe(200);

  const guardado = await leerDeLaBase(VIVIENDA.codigo);

  console.log('\n' + '='.repeat(74));
  console.log('  LA FICHA QUEDÓ REGISTRADA');
  console.log('='.repeat(74));
  console.log('  Ficha        : ' + guardado.ficha.codigo + '   (id ' + guardado.ficha.id + ')');
  console.log('  Diligenciada : ' + String(guardado.ficha.fecha).slice(0, 15));
  console.log('  Territorio   : ' + guardado.ficha.territorio + ' · ' + guardado.ficha.microterritorio +
    ' · comuna ' + guardado.ficha.comuna);
  console.log('  Dirección    : ' + guardado.ficha.direccion);
  console.log('  Hogar        : ' + guardado.ficha.hogar);
  console.log('  Familia      : ' + guardado.ficha.familia);
  console.log('  Plan         : ' + guardado.plan.planes + ' plan(es), ' +
    guardado.plan.acciones + ' acción(es), ' + guardado.plan.seguimientos + ' seguimiento(s)');
  console.log('  Alertas      : ' + guardado.alertas);
  console.log('\n  Integrantes:');
  guardado.integrantes.forEach(function (i) {
    console.log('    · ' + i.nombre.padEnd(34) + ' ' + String(i.tipo_id + ' ' + i.numero_id).padEnd(16) +
      ' IMC ' + (i.imc === null ? ' —  ' : String(i.imc).padStart(5)) +
      '   ' + (i.clasificacion_tension || 'sin tensión'));
  });
  console.log('\n  Consúltela en la aplicación: pestaña Historial.');
  console.log('='.repeat(74) + '\n');

  await infoPrueba.attach('ficha-registrada.txt', {
    body: JSON.stringify(guardado, null, 2),
    contentType: 'text/plain'
  });

  expect(guardado.integrantes.length,
    'la base no guardó los ' + HABITANTES.length + ' integrantes').toBe(HABITANTES.length);
  expect(guardado.plan.acciones, 'la base no guardó las tres acciones del plan').toBe(3);

  /* Los problemas del recorrido se reportan pero no tumban el registro: si
     la ficha quedó escrita, el trabajo se hizo. Se listan para que quien
     corra el guion sepa qué revisar en la aplicación. */
  if (diario.problemas.length > 0) {
    console.log('  Atención: el recorrido reportó ' + diario.problemas.length +
      ' problema(s). La ficha se guardó igual; revise el informe de arriba.\n');
  }
});

/* ---------------------------------------------------------
   Lectura de comprobación
   --------------------------------------------------------- */

async function leerDeLaBase(codigoFicha) {
  const { Client } = require('pg');
  const cliente = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: false
  });

  await cliente.connect();
  try {
    /* El territorio y la dirección viven en `hogar`, no en `ficha`: la ficha
       es la visita, el hogar es el lugar, y un mismo lugar recibe varias
       visitas a lo largo del tiempo. */
    const ficha = await cliente.query(`
      SELECT f.id, f.codigo, f.fecha_diligenciamiento AS fecha,
             h.territorio_codigo AS territorio, h.microterritorio_codigo AS microterritorio,
             h.comuna, h.direccion_normalizada AS direccion,
             h.codigo AS hogar, fa.codigo AS familia
        FROM aps.ficha f
        JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
        JOIN aps.familia fa       ON fa.id = ff.familia_id
        JOIN aps.hogar h          ON h.id = fa.hogar_id
       WHERE f.codigo = $1
       LIMIT 1
    `, [codigoFicha]);

    if (ficha.rows.length === 0) {
      throw new Error('La ficha ' + codigoFicha + ' no está en la base.');
    }

    const integrantes = await cliente.query(`
      SELECT trim(concat_ws(' ', p.primer_nombre, p.primer_apellido)) AS nombre,
             p.tipo_id, p.numero_id, i.imc, i.clasificacion_tension
        FROM aps.integrante i
        JOIN aps.persona p        ON p.id = i.persona_id
        JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
       WHERE ff.ficha_id = $1
       ORDER BY i.id
    `, [ficha.rows[0].id]);

    const plan = await cliente.query(`
      SELECT count(DISTINCT pc.id)::int AS planes,
             count(DISTINCT pa.id)::int AS acciones,
             count(DISTINCT ps.id)::int AS seguimientos
        FROM aps.plan_cuidado pc
        LEFT JOIN aps.plan_accion      pa ON pa.plan_id = pc.id
        LEFT JOIN aps.plan_seguimiento ps ON ps.plan_id = pc.id
       WHERE pc.ficha_id = $1
    `, [ficha.rows[0].id]);

    const alertas = await cliente.query(
      'SELECT count(*)::int AS n FROM aps.alerta WHERE ficha_id = $1', [ficha.rows[0].id]
    );

    return {
      ficha: ficha.rows[0],
      integrantes: integrantes.rows,
      plan: plan.rows[0],
      alertas: alertas.rows[0].n
    };
  } finally {
    await cliente.end();
  }
}
