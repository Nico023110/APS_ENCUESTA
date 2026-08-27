/* =========================================================================
   Una encuesta completa, de principio a fin, en un navegador de verdad
   -------------------------------------------------------------------------
       npm run e2e          (ventana visible, paso a paso)
       npm run e2e:rapido   (sin ventana)

   El recorrido vive en `diligenciar.js`, compartido con `encuesta_real.spec.js`.
   Aquí sólo van los datos de la ficha de prueba, la limpieza y el veredicto.

   ESTA FICHA NO SE QUEDA. Se borra antes y después de cada corrida: es una
   prueba, no un registro. Para grabar una encuesta de verdad está
   `npm run encuesta`.

   QUÉ SE COMPRUEBA

   1. Que todos los campos del recorrido se pudieron diligenciar.
   2. Que el navegador no lanzó excepciones ni errores de consola.
   3. Que la ficha cierra: sin incumplimientos de reglas ni impedimentos
      de cierre (RN-222).
   4. Que llega a la base por /api/guardar_encuesta.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });

const { test, expect } = require('@playwright/test');
const ayudas = require('./ayudas');
const flujo = require('./diligenciar');

/* ---------------------------------------------------------
   Datos de la ficha de prueba
   --------------------------------------------------------- */

const SUFIJO = Date.now().toString(36).toUpperCase();

const FICHA = {
  codigo: 'F-PW-' + SUFIJO,
  hogar: 'HG-PW-' + SUFIJO,
  /* Ítem 26: el número que la familia usa como referencia. No es su llave. */
  familia: 'FM-PW-' + SUFIJO,
  /* RN-026: la llave real, derivada del hogar y del consecutivo. Es la que
     heredan los planes 6.2 y 6.3 y la que el servidor escribe en la base. */
  codigoFamiliaDerivado: 'HG-PW-' + SUFIJO + '-F1',
  ebs: 'EBSPW01',

  situacionInminente: 'no_aplica',
  uzpe: 'UZPE006',
  areaUbicacion: 'urbana',
  territorio: 'T48',
  microterritorio: 'MT01',
  divisionTerritorial: 'Barrio San Cayetano',

  prestador: 'PROV-ESE-LADERA',
  responsableTipoId: 'CC',
  responsableNumeroId: '1144012345',
  perfilProfesional: 'enfermeria',
  entornoAbordaje: 'hogar',
  cabezaFamilia: 'María Pérez',
  jovenesEnPaz: 'no',

  direccion: { viaTipo: 'CL', viaNumero: '45', genNumero: '27', placa: '15' },
  latitud: '3.451647',
  longitud: '-76.531985',
  ubicacionReferencia: 'Frente a la cancha del barrio',

  estrato: 'bajo',
  hogaresEnVivienda: '1',
  personasEnVivienda: '3',
  habitacionesVivienda: '2',
  elementosParaDormir: '3',

  tipoVivienda: 'casa',
  materialTecho: 'concreto',
  vectores: 'no',
  riesgosAccidente: 'ninguno',
  factoresContaminacion: 'ninguno',
  actividadEconomica: 'no',
  /* RN-040: con «ninguno», los conteos de perros y gatos quedan
     deshabilitados a propósito. No se tocan. */
  animales: 'ninguno',

  fuenteAgua: 'acueducto_esp',
  disposicionExcretas: 'alcantarillado',
  aguasResiduales: 'alcantarillado',
  residuosSolidos: 'servicio_aseo',

  tipoFamilia: 'nuclear_biparental',
  cuidadorPrincipal: 'no',
  redesApoyo: 'cuenta_protectoras',
  situacionesRiesgo: 'ninguna',
  practicasVinculo: 'escucha_activa',
  practicasCuidadoHogar: 'ventilacion',

  planVivienda: {
    ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
    codigoAccion: 'NC-AMB-07', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se revisó la humedad del muro de la cocina y se acordó ventilar a diario',
    accionConcertada: 'Mejorar la ventilación de la cocina'
  },
  planFamilia: {
    ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
    codigoAccion: 'NC-FAM-02', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se conversó con la familia sobre el relevo del cuidador',
    accionConcertada: 'Repartir las tareas de cuidado entre los dos adultos del hogar'
  },
  planPersona: {
    integrante: 2,
    ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
    codigoAccion: 'NC-GES-06', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se dejó agendada la cita de control con verificación de asistencia',
    accionConcertada: 'Llevar a Sofía a consulta de crecimiento y desarrollo'
  }
};

/* Tres personas de edades distintas a propósito. El formulario muestra u
   oculta catorce preguntas según la edad y el sexo (RN-085 y siguientes), y
   con un solo integrante adulto esa lógica no se ejercita nunca.

   RN-051 manda que haya exactamente un responsable económico. Los documentos
   siguen el catálogo por edad: cédula para los adultos, tarjeta de identidad
   para la niña de ocho años. */
const PERSONAS = [
  {
    titulo: 'Ana Gómez — 30 años, responsable económico',
    primerNombre: 'Ana', segundoNombre: 'Lucía',
    primerApellido: 'Gómez', segundoApellido: 'Rivas',
    tipoId: 'CC', numeroId: '1144099887', fechaNacimiento: '1996-05-10',
    sexo: 'mujer', genero: 'femenino', autoidentificacion: 'femenino',
    orientacion: 'heterosexual',
    telefono: '3155551234', rol: 'responsable_economico',
    ocupacion: '5223', nivelEducativo: 'media_academica',
    peso: '65', talla: '160', cintura: '80',
    sistolica: '118', diastolica: '75',
    gestacion: 'no'
  },
  {
    titulo: 'Carlos Gómez — 35 años, cónyuge',
    primerNombre: 'Carlos', segundoNombre: 'Andrés',
    primerApellido: 'Gómez', segundoApellido: 'Ortiz',
    tipoId: 'CC', numeroId: '1144077665', fechaNacimiento: '1991-03-22',
    sexo: 'hombre', genero: 'masculino', autoidentificacion: 'masculino',
    orientacion: 'heterosexual',
    telefono: '3155559876', rol: 'conyuge',
    ocupacion: '8322', nivelEducativo: 'basica_secundaria',
    peso: '78', talla: '172', cintura: '92',
    sistolica: '124', diastolica: '80',
    /* Sin gestación: el formulario esconde la pregunta por sexo (RN-085). */
    gestacion: null
  },
  {
    titulo: 'Sofía Gómez — 8 años, hija',
    primerNombre: 'Sofía', segundoNombre: '',
    primerApellido: 'Gómez', segundoApellido: 'Rivas',
    tipoId: 'TI', numeroId: '1098776554', fechaNacimiento: '2018-07-14',
    sexo: 'mujer', genero: 'femenino', autoidentificacion: 'femenino',
    /* Sin orientación sexual: sólo se pregunta desde los 13 años. */
    orientacion: null,
    telefono: '', rol: 'hijo',
    ocupacion: '0000', nivelEducativo: 'basica_primaria',
    peso: '26', talla: '128', cintura: null,
    sistolica: null, diastolica: null,
    gestacion: 'no'
  }
];

/* ---------------------------------------------------------
   Limpieza
   ---------------------------------------------------------
   La prueba se recoge sola, como el resto de las pruebas del proyecto.
   No es sólo higiene: las fichas que quedaban sueltas dejaban filas en
   `aps.persona` referenciadas desde `integrante`, y la limpieza de
   `endpoint.test.js` chocaba después contra esa llave foránea.
   --------------------------------------------------------- */

const DOCUMENTOS = PERSONAS.map(function (p) { return p.numeroId; });

async function limpiarBase() {
  const { Client } = require('pg');
  const cliente = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: false
  });

  await cliente.connect();
  try {
    await cliente.query("DELETE FROM aps.ficha WHERE codigo LIKE 'F-PW-%'");
    await cliente.query(`
      DELETE FROM aps.familia
       WHERE hogar_id IN (SELECT id FROM aps.hogar WHERE codigo LIKE 'HG-PW-%')
    `);
    await cliente.query("DELETE FROM aps.hogar WHERE codigo LIKE 'HG-PW-%'");
    await cliente.query('DELETE FROM aps.persona WHERE numero_id = ANY($1)', [DOCUMENTOS]);
  } finally {
    await cliente.end();
  }
}

test.describe.configure({ mode: 'serial' });

/* Antes y después: antes por si una corrida anterior se interrumpió a mitad
   de camino y dejó la ficha a medio escribir. */
test.beforeAll(limpiarBase);
test.afterAll(limpiarBase);

/* ---------------------------------------------------------
   La prueba
   --------------------------------------------------------- */

test('Se diligencia y guarda una encuesta completa', async function ({ page }, infoPrueba) {
  const diario = ayudas.crearDiario();
  ayudas.vigilar(page, diario);

  await flujo.diligenciarEncuesta(page, diario, FICHA, PERSONAS);

  const cierre = await flujo.cerrarYGuardar(page, diario, FICHA);

  await page.screenshot({
    path: infoPrueba.outputPath('cierre-de-la-ficha.png'),
    fullPage: true
  });

  /* El informe se imprime antes de cualquier aserción: si la prueba falla,
     el diagnóstico ya está en la salida y no hay que volver a correrla. */
  ayudas.imprimirInforme(diario);

  await infoPrueba.attach('informe-del-diligenciamiento.txt', {
    body: JSON.stringify(diario, null, 2),
    contentType: 'text/plain'
  });

  /* Las aserciones comparan listas de frases cortas, no los objetos del
     diario: un `toEqual` sobre los objetos completos entierra el hallazgo
     bajo cien líneas de diff. */
  expect(
    diario.consola.map(function (c) { return c.tipo + ' en «' + c.zona + '»: ' + c.texto; }),
    'el navegador reportó errores durante el diligenciamiento'
  ).toEqual([]);

  expect(
    diario.problemas.map(function (p) {
      return '«' + p.zona + '» ' + p.etiqueta + ': ' + p.motivo +
        (p.detalle ? ' — ' + p.detalle : '');
    }),
    'hubo campos que no se pudieron diligenciar o reglas incumplidas'
  ).toEqual([]);

  expect(
    diario.peticiones.map(function (r) { return r.estado + ' ' + r.url; }),
    'la aplicación hizo peticiones que fallaron'
  ).toEqual([]);

  expect(cierre.guardo, 'la encuesta no se pudo guardar; revise el informe de arriba')
    .toBe(true);

  /* Guardar escribe en la base: la petición sale al pulsar el botón, no en un
     paso de sincronización posterior. */
  expect(cierre.respuestaApi && cierre.respuestaApi.estado,
    'guardar no escribió la ficha en la base').toBe(200);
});
