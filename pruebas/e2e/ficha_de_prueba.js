/* =========================================================================
   La ficha de prueba y su limpieza
   -------------------------------------------------------------------------
   La usan encuesta_completa.spec.js (con señal) y pwa.spec.js (sin señal). Sólo
   datos inventados. La limpieza usa la conexión que tenga el proceso: quien la
   llama responde por que sea la que quiere borrar.
   ========================================================================= */

'use strict';

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
    ocupacion: '8324', nivelEducativo: 'basica_secundaria',
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
    /* Sin gestación ni intención reproductiva: desde los 10 años (RN-084, RN-085). */
    gestacion: null
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
    /* Los códigos de ficha y de hogar ya no los fija la prueba (RN-015 y el
       anexo SI-APS los generan): las fichas de prueba se reconocen por los
       documentos de sus integrantes. */
    const propias = await cliente.query(`
      SELECT DISTINCT f.id, f.hogar_id
        FROM aps.ficha f
        JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
        JOIN aps.integrante i     ON i.familia_ficha_id = ff.id
        JOIN aps.persona p        ON p.id = i.persona_id
       WHERE p.numero_id = ANY($1)
    `, [DOCUMENTOS]);
    const fichas = propias.rows.map(function (r) { return r.id; });
    const hogares = propias.rows.map(function (r) { return r.hogar_id; });
    await cliente.query('DELETE FROM aps.ficha WHERE id = ANY($1::bigint[])', [fichas]);
    await cliente.query(`
      DELETE FROM aps.familia f
       WHERE f.hogar_id = ANY($1::bigint[])
         AND NOT EXISTS (SELECT 1 FROM aps.familia_ficha ff WHERE ff.familia_id = f.id)
    `, [hogares]);
    await cliente.query(`
      DELETE FROM aps.hogar h
       WHERE h.id = ANY($1::bigint[])
         AND NOT EXISTS (SELECT 1 FROM aps.ficha f WHERE f.hogar_id = h.id)
    `, [hogares]);
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

module.exports = { FICHA, PERSONAS, limpiarBase };
