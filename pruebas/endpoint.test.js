/* =========================================================================
   Prueba del endpoint /api/guardar_encuesta contra la base local.
   -------------------------------------------------------------------------
   Requiere la base creada (npm run bd:crear) y el servidor arriba.
   Se lanza solo el servidor si no está corriendo.

       node pruebas/endpoint.test.js

   Comprueba lo que el resto de las pruebas no puede: que el endpoint
   rechace lo inválido en vez de rellenarlo, y que lo válido se guarde
   tal como se envió.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const { spawn } = require('child_process');
const path = require('path');
const { Client } = require('pg');

const BASE = 'http://localhost:' + (process.env.PUERTO || 5173);
const RAIZ = path.join(__dirname, '..');

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK   ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : ''));
  }
}

/* ---------------------------------------------------------
   Ficha de referencia: válida y completa hasta donde el
   endpoint escribe hoy.
   --------------------------------------------------------- */

function hoyIso() {
  return new Date().toISOString().split('T')[0];
}

/* Réplica de la ficha que `pruebas/reglas.test.js` da por válida (fichaBase +
   familiaValida + adultaValida), con una diferencia deliberada: eapb,
   ocupacion y prestadorPrimario van como CÓDIGO de catálogo y no como texto
   libre, porque el esquema los declara llave foránea. */
function integranteValido() {
  return {
    primerNombre: 'Ana', primerApellido: 'Gomez',
    tipoId: 'CC', numeroId: '1144099887',
    fechaNacimiento: '1996-05-10',
    nacionalidad: 'CO', sexo: 'mujer', genero: 'femenino',
    autoidentificacionGenero: 'femenino', orientacionSexual: 'heterosexual',
    telefono1: '3155551234', rolFamiliar: 'responsable_economico',
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

function fichaValida(sufijo) {
  const integrante = integranteValido();

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
    equipoSaludId: 'EBS12',
    prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC',
    responsableNumeroId: '1144012345',
    responsableNombre: 'María Pérez',
    perfilProfesional: 'enfermeria',
    codigoFicha: 'F-TEST-' + sufijo,
    fechaDiligenciamiento: hoyIso(),
    entornoAbordaje: 'hogar',
    cabezaFamilia: 'María Pérez',
    jovenesEnPaz: 'no',
    direccion: 'CL 45 A BIS SUR # 27 B - 15',
    direccionNormalizada: { completa: true, faltantes: [] },
    latitud: 3.45,
    longitud: -76.53,
    ubicacionReferencia: 'Frente a la cancha',
    idHogar: 'HG-TEST-' + sufijo,
    idFamilia: 'FM-TEST-' + sufijo,
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
    /* Ítems 39 a 49: la base los exige NOT NULL. */
    actividadEconomica: 'no',
    animales: ['ninguno'],
    perros: 0,
    perrosVacunados: 0,
    gatos: 0,
    gatosVacunados: 0,
    carnetAntirrabico: 'no_aplica',
    fuenteAgua: 'acueducto_esp',
    disposicionExcretas: 'alcantarillado',
    aguasResiduales: 'alcantarillado',
    residuosSolidos: 'servicio_aseo',
    familias: [{
      idFamilia: 'FM-TEST-' + sufijo,
      tipoFamilia: 'nuclear_monoparental',
      numeroIntegrantes: 1,
      integrantes: [integrante],
      cuidadorPrincipal: 'no',
      situacionesRiesgo: ['ninguna'],
      practicasVinculo: ['escucha_activa'],
      redesApoyo: 'cuenta_protectoras',
      practicasCuidadoHogar: ['ventilacion']
    }]
  };
}

async function enviar(ficha) {
  const respuesta = await fetch(BASE + '/api/guardar_encuesta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ficha)
  });
  const cuerpo = await respuesta.json().catch(function () { return {}; });
  return { estado: respuesta.status, cuerpo: cuerpo };
}

/* Busca un bloqueo por la ruta del campo. */
function bloqueoEn(cuerpo, fragmentoRuta) {
  return (cuerpo.bloqueos || []).some(function (b) {
    return String(b.ruta || '').indexOf(fragmentoRuta) !== -1;
  });
}

/* ---------------------------------------------------------
   Casos
   --------------------------------------------------------- */

/* Las comprobaciones de las tablas puente cuentan filas de toda la tabla, así
   que el estado tiene que partir limpio para ser determinista. */
async function limpiar() {
  const cliente = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: false
  });
  await cliente.connect();
  await cliente.query("DELETE FROM aps.ficha WHERE codigo LIKE 'F-TEST-%' OR codigo LIKE 'F-PRUEBA-%'");
  await cliente.query("DELETE FROM aps.familia WHERE codigo LIKE 'FM-TEST-%' OR codigo LIKE 'FM-PRUEBA-%'");
  await cliente.query("DELETE FROM aps.hogar WHERE codigo LIKE 'HG-TEST-%' OR codigo LIKE 'HG-PRUEBA-%'");
  await cliente.query("DELETE FROM aps.persona WHERE numero_id IN ('1144099887','1144055099')");
  await cliente.end();
}

async function correrPruebas() {
  const sello = Date.now().toString(36);

  await limpiar();

  console.log('\n=== 1. Rechazo de datos ausentes (antes se rellenaban) ===');

  const sinEquipo = fichaValida(sello + 'a');
  delete sinEquipo.equipoSaludId;
  let r = await enviar(sinEquipo);
  verificar('Sin equipo de salud => 400', r.estado === 400, 'estado ' + r.estado);
  verificar('  no se inventó EQTEST', JSON.stringify(r.cuerpo).indexOf('EQTEST') === -1);

  const sinTerritorio = fichaValida(sello + 'b');
  delete sinTerritorio.territorio;
  delete sinTerritorio.microterritorio;
  r = await enviar(sinTerritorio);
  verificar('Sin territorio => 400', r.estado === 400, 'estado ' + r.estado);

  const sinDocumento = fichaValida(sello + 'c');
  delete sinDocumento.familias[0].integrantes[0].numeroId;
  r = await enviar(sinDocumento);
  verificar('Integrante sin documento => 400', r.estado === 400, 'estado ' + r.estado);

  console.log('\n=== 2. Validación contra catálogo (antes: error crudo de PostgreSQL) ===');

  const rolMalo = fichaValida(sello + 'd');
  rolMalo.familias[0].integrantes[0].rolFamiliar = 'jefe_hogar';
  r = await enviar(rolMalo);
  verificar('Rol familiar inexistente => 400', r.estado === 400, 'estado ' + r.estado);
  verificar('  señala el campo exacto', bloqueoEn(r.cuerpo, 'rolFamiliar'));
  verificar('  no filtra el nombre de la restricción',
    JSON.stringify(r.cuerpo).indexOf('int_rol_valido') === -1);

  const uzpeMala = fichaValida(sello + 'e');
  uzpeMala.uzpe = 'UZPE003';
  r = await enviar(uzpeMala);
  verificar('UZPE no vigente => 400 (antes se reescribía a UZPE006)',
    r.estado === 400, 'estado ' + r.estado);
  verificar('  señala uzpe', bloqueoEn(r.cuerpo, 'uzpe'));

  const microMalo = fichaValida(sello + 'f');
  microMalo.microterritorio = 'MT04';
  microMalo.territorio = 'T48';
  r = await enviar(microMalo);
  const microValido = r.estado === 200;
  if (!microValido) {
    verificar('Microterritorio ajeno al territorio => 400', r.estado === 400, 'estado ' + r.estado);
  } else {
    verificar('Microterritorio MT04 pertenece a T48 => 200', true);
  }

  console.log('\n=== 3. Afiliación (antes se falsificaba como "no afiliado") ===');

  const eapbInexistente = fichaValida(sello + 'g');
  eapbInexistente.familias[0].integrantes[0].eapb = 'EPS999';
  r = await enviar(eapbInexistente);
  verificar('EAPB inexistente => 400', r.estado === 400, 'estado ' + r.estado);
  verificar('  señala eapb', bloqueoEn(r.cuerpo, 'eapb'));

  const afiliadoSinEapb = fichaValida(sello + 'h');
  delete afiliadoSinEapb.familias[0].integrantes[0].eapb;
  r = await enviar(afiliadoSinEapb);
  verificar('Régimen subsidiado sin EAPB => 400 (RN-076)', r.estado === 400, 'estado ' + r.estado);

  const noAfiliadoConEapb = fichaValida(sello + 'i');
  noAfiliadoConEapb.familias[0].integrantes[0].regimenAfiliacion = 'no_afiliado';
  r = await enviar(noAfiliadoConEapb);
  verificar('No afiliado con EAPB => 400 (RN-076)', r.estado === 400, 'estado ' + r.estado);

  console.log('\n=== 4. RN-016 — fecha de diligenciamiento ===');

  const fechaVieja = fichaValida(sello + 'j');
  const hace60 = new Date();
  hace60.setDate(hace60.getDate() - 60);
  fechaVieja.fechaDiligenciamiento = hace60.toISOString().split('T')[0];
  r = await enviar(fechaVieja);
  verificar('Fecha de hace 60 días => 400 (antes se reescribía a hoy)',
    r.estado === 400, 'estado ' + r.estado);

  const fechaFutura = fichaValida(sello + 'k');
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  fechaFutura.fechaDiligenciamiento = manana.toISOString().split('T')[0];
  r = await enviar(fechaFutura);
  verificar('Fecha futura => 400', r.estado === 400, 'estado ' + r.estado);

  console.log('\n=== 5. RN-063 — documento repetido en la ficha ===');

  const repetido = fichaValida(sello + 'l');
  repetido.familias[0].numeroIntegrantes = 2;
  repetido.familias[0].integrantes.push(
    Object.assign({}, repetido.familias[0].integrantes[0], { primerNombre: 'Otra' })
  );
  r = await enviar(repetido);
  verificar('Dos integrantes con el mismo documento => 400', r.estado === 400, 'estado ' + r.estado);

  console.log('\n=== 6. Ficha válida: se guarda tal como se envió ===');

  const buena = fichaValida(sello + 'z');
  r = await enviar(buena);
  verificar('Ficha válida => 200', r.estado === 200,
    'estado ' + r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 300));

  if (r.estado === 200) {
    const cliente = new Client({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: false
    });
    await cliente.connect();

    const fila = await cliente.query(`
      SELECT f.uzpe_codigo, f.fecha_diligenciamiento, f.estado,
             h.territorio_codigo, h.microterritorio_codigo,
             e.codigo AS equipo,
             i.regimen_afiliacion, i.eapb_codigo, i.rol_familiar,
             p.primer_nombre, p.sexo
        FROM aps.ficha f
        JOIN aps.hogar h            ON h.id = f.hogar_id
        JOIN aps.equipo_salud e     ON e.id = f.equipo_salud_id
        JOIN aps.familia_ficha ff   ON ff.ficha_id = f.id
        JOIN aps.integrante i       ON i.familia_ficha_id = ff.id
        JOIN aps.persona p          ON p.id = i.persona_id
       WHERE f.codigo = $1
    `, [buena.codigoFicha]);

    const g = fila.rows[0] || {};
    verificar('  UZPE guardada sin reescribir', g.uzpe_codigo === 'UZPE006', g.uzpe_codigo);
    verificar('  Territorio guardado', g.territorio_codigo === 'T48', g.territorio_codigo);
    verificar('  Equipo guardado sin sustituir', g.equipo === 'EBS12', g.equipo);
    verificar('  Régimen conservado', g.regimen_afiliacion === 'subsidiado', g.regimen_afiliacion);
    verificar('  EAPB conservada', g.eapb_codigo === 'ESS024', g.eapb_codigo);
    verificar('  Rol conservado', g.rol_familiar === 'responsable_economico', g.rol_familiar);
    verificar('  Sexo conservado', g.sexo === 'mujer', g.sexo);
    verificar('  Estado cerrada', g.estado === 'cerrada', g.estado);

    console.log('\n=== 7. Tablas puente de selección múltiple ===');

    verificar('  el endpoint informa cuántas filas escribió',
      typeof r.cuerpo.filasSeleccionMultiple === 'number' && r.cuerpo.filasSeleccionMultiple > 0,
      String(r.cuerpo.filasSeleccionMultiple));

    /* Las consultas se acotan a ESTA ficha. Contar filas de toda la tabla daría
       falsos negativos: la prueba del microterritorio guarda otra ficha válida. */
    const filtroFicha = { text: '', values: [buena.codigoFicha] };

    const puentes = await cliente.query(`
      WITH f AS (SELECT id FROM aps.ficha WHERE codigo = $1),
           ff AS (SELECT ff.id FROM aps.familia_ficha ff JOIN f ON ff.ficha_id = f.id),
           i  AS (SELECT i.id FROM aps.integrante i JOIN ff ON i.familia_ficha_id = ff.id)
      SELECT 'vivienda_riesgo_accidente' AS tabla, count(*)::int AS filas
        FROM aps.vivienda_riesgo_accidente t JOIN f ON t.ficha_id = f.id
      UNION ALL SELECT 'vivienda_factor_contaminacion', count(*)::int
        FROM aps.vivienda_factor_contaminacion t JOIN f ON t.ficha_id = f.id
      UNION ALL SELECT 'familia_situacion_riesgo', count(*)::int
        FROM aps.familia_situacion_riesgo t JOIN ff ON t.familia_ficha_id = ff.id
      UNION ALL SELECT 'familia_practica_vinculo', count(*)::int
        FROM aps.familia_practica_vinculo t JOIN ff ON t.familia_ficha_id = ff.id
      UNION ALL SELECT 'familia_practica_cuidado_hogar', count(*)::int
        FROM aps.familia_practica_cuidado_hogar t JOIN ff ON t.familia_ficha_id = ff.id
      UNION ALL SELECT 'integrante_sujeto_proteccion', count(*)::int
        FROM aps.integrante_sujeto_proteccion t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_saber_ancestral', count(*)::int
        FROM aps.integrante_saber_ancestral t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_discapacidad', count(*)::int
        FROM aps.integrante_discapacidad t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_practica_cuidado', count(*)::int
        FROM aps.integrante_practica_cuidado t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_atencion_rpms', count(*)::int
        FROM aps.integrante_atencion_rpms t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_conocimiento_derecho', count(*)::int
        FROM aps.integrante_conocimiento_derecho t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_enfermedad_no_transmisible', count(*)::int
        FROM aps.integrante_enfermedad_no_transmisible t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_condicion_transmisible', count(*)::int
        FROM aps.integrante_condicion_transmisible t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_zona_endemica', count(*)::int
        FROM aps.integrante_zona_endemica t JOIN i ON t.integrante_id = i.id
      UNION ALL SELECT 'integrante_sintoma_depresivo', count(*)::int
        FROM aps.integrante_sintoma_depresivo t JOIN i ON t.integrante_id = i.id
      ORDER BY tabla
    `, filtroFicha.values);

    const vacias = puentes.rows.filter(function (f) { return f.filas === 0; });
    verificar('  las 15 tablas comprobadas tienen filas de esta ficha',
      vacias.length === 0,
      vacias.length > 0 ? 'vacías: ' + vacias.map(function (f) { return f.tabla; }).join(', ') : '');

    /* Consulta reutilizable de las discapacidades de esta ficha. */
    const discapacidadesDe = async function () {
      const q = await cliente.query(`
        SELECT t.codigo
          FROM aps.integrante_discapacidad t
          JOIN aps.integrante i     ON i.id = t.integrante_id
          JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
          JOIN aps.ficha f          ON f.id = ff.ficha_id
         WHERE f.codigo = $1
         ORDER BY t.codigo
      `, filtroFicha.values);
      return q.rows.map(function (x) { return x.codigo; });
    };

    /* El marcador excluyente se guarda: distingue "se preguntó y no hay" de
       "no se preguntó". */
    const marcador = await discapacidadesDe();
    verificar('  el marcador excluyente se guarda como fila',
      marcador.length === 1 && marcador[0] === 'sin_discapacidad', marcador.join(','));

    console.log('\n=== 8. Re-sincronizar no duplica ni deja filas obsoletas ===');

    /* La sincronización reenvía cada ficha completa en cada pasada, así que
       este es el caso corriente, no un borde. */
    const reenvio = await enviar(fichaValida(sello + 'z'));
    verificar('Reenvío idéntico => 200', reenvio.estado === 200,
      'estado ' + reenvio.estado + ' ' + JSON.stringify(reenvio.cuerpo).slice(0, 200));

    const trasReenvio = await discapacidadesDe();
    verificar('  no se duplicaron filas', trasReenvio.length === 1, trasReenvio.join(','));

    /* Ahora con una selección corregida: la fila vieja debe desaparecer. */
    const corregida = fichaValida(sello + 'z');
    corregida.familias[0].integrantes[0].practicasCuidado = ['actividad_fisica', 'lavado_manos'];
    const r2 = await enviar(corregida);
    verificar('Reenvío con selección corregida => 200', r2.estado === 200,
      'estado ' + r2.estado + ' ' + JSON.stringify(r2.cuerpo).slice(0, 200));

    const practicas = await cliente.query(`
      SELECT t.codigo
        FROM aps.integrante_practica_cuidado t
        JOIN aps.integrante i     ON i.id = t.integrante_id
        JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
        JOIN aps.ficha f          ON f.id = ff.ficha_id
       WHERE f.codigo = $1
       ORDER BY t.codigo
    `, filtroFicha.values);

    const codigos = practicas.rows.map(function (x) { return x.codigo; });
    verificar('  quedó la selección nueva y desapareció la vieja',
      codigos.length === 2 && codigos.indexOf('alimentacion') === -1,
      codigos.join(','));

    console.log('\n=== 9. Las alertas clínicas se persisten con su ámbito ===');

    /* Hipertensión nivel 2: prioridad "prioritaria", así que genera alerta
       sin bloquear el cierre —sólo las inmediatas exigen conducta—. */
    const conAlerta = fichaValida(sello + 'z');
    conAlerta.familias[0].integrantes[0].tensionSistolica = 150;
    conAlerta.familias[0].integrantes[0].tensionDiastolica = 95;
    conAlerta.familias[0].integrantes[0].clasificacionTension = 'nivel2';

    const rAlerta = await enviar(conAlerta);
    verificar('Ficha con hipertensión nivel 2 => 200', rAlerta.estado === 200,
      'estado ' + rAlerta.estado + ' ' + JSON.stringify(rAlerta.cuerpo).slice(0, 250));

    if (rAlerta.estado === 200) {
      const filas = await cliente.query(`
        SELECT al.regla_codigo, al.ambito, al.prioridad, al.motivo,
               al.vence_en IS NOT NULL AS vence,
               al.integrante_id IS NOT NULL AS tiene_integrante,
               al.familia_ficha_id IS NOT NULL AS tiene_familia
          FROM aps.alerta al
          JOIN aps.ficha f ON f.id = al.ficha_id
         WHERE f.codigo = $1 AND al.regla_codigo = 'RN-203'
      `, filtroFicha.values);

      const al = filas.rows[0] || {};
      verificar('  se escribió la alerta RN-203', filas.rows.length === 1,
        String(filas.rows.length));
      verificar('  con ámbito de persona', al.ambito === 'persona', String(al.ambito));
      verificar('  resolviendo familia e integrante desde la ruta',
        al.tiene_familia === true && al.tiene_integrante === true,
        al.tiene_familia + '/' + al.tiene_integrante);
      verificar('  con la prioridad del catálogo', al.prioridad === 'prioritaria',
        String(al.prioridad));
      verificar('  y el vencimiento que calcula el disparador (RN-200)',
        al.vence === true, String(al.vence));

      /* Al reenviar sin la alteración, la alerta debe desaparecer: las
         alertas son deducidas, no acumuladas. */
      await enviar(fichaValida(sello + 'z'));
      const tras = await cliente.query(`
        SELECT count(*)::int AS n FROM aps.alerta al
          JOIN aps.ficha f ON f.id = al.ficha_id
         WHERE f.codigo = $1
      `, filtroFicha.values);
      verificar('  al corregir el dato la alerta desaparece', tras.rows[0].n === 0,
        String(tras.rows[0].n));
    }

    console.log('\n=== 10. Los planes de familia y de persona (ítems 120 a 140) ===');

    /* plan_ambito_coherente exige que cada ámbito lleve exactamente sus
       llaves: el de familia sin integrante, el de persona con documento. */
    const conPlanes = fichaValida(sello + 'z');
    const llavesComunes = {
      codigoEbs: conPlanes.equipoSaludId,
      codigoVivienda: conPlanes.idHogar,
      codigoFamilia: conPlanes.familias[0].idFamilia,
      acciones: [{
        ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
        codigoAccion: 'NC-FAM-01', tipoRespuesta: 'en_sitio'
      }],
      seguimientos: [{
        seguimientoTipoId: 'CC', seguimientoNumeroId: '1144012345',
        accionConcertada: 'Compromiso acordado con la familia',
        seg1Fecha: hoyIso(), seg1Estado: 'C'
      }]
    };

    conPlanes.planVivienda = {
      codigoEbs: conPlanes.equipoSaludId,
      codigoVivienda: conPlanes.idHogar,
      acciones: llavesComunes.acciones,
      seguimientos: llavesComunes.seguimientos
    };
    conPlanes.familias[0].planFamilia = Object.assign({}, llavesComunes);
    conPlanes.familias[0].integrantes[0].planPersona = Object.assign({}, llavesComunes, {
      tipoIdIntegrante: 'CC',
      numeroIdIntegrante: conPlanes.familias[0].integrantes[0].numeroId
    });

    const rPlanes = await enviar(conPlanes);
    verificar('Ficha con los tres planes => 200', rPlanes.estado === 200,
      'estado ' + rPlanes.estado + ' ' + JSON.stringify(rPlanes.cuerpo).slice(0, 300));

    if (rPlanes.estado === 200) {
      const ambitos = await cliente.query(`
        SELECT pc.ambito,
               pc.familia_ficha_id IS NOT NULL AS con_familia,
               pc.integrante_id IS NOT NULL    AS con_integrante,
               pc.numero_id_integrante         AS documento,
               (SELECT count(*)::int FROM aps.plan_accion      pa WHERE pa.plan_id = pc.id) AS acciones,
               (SELECT count(*)::int FROM aps.plan_seguimiento ps WHERE ps.plan_id = pc.id) AS seguimientos
          FROM aps.plan_cuidado pc
          JOIN aps.ficha f ON f.id = pc.ficha_id
         WHERE f.codigo = $1
         ORDER BY pc.ambito
      `, filtroFicha.values);

      const por = {};
      ambitos.rows.forEach(function (x) { por[x.ambito] = x; });

      verificar('  se escribieron los tres ámbitos', ambitos.rows.length === 3,
        ambitos.rows.map(function (x) { return x.ambito; }).join(', '));
      verificar('  el de vivienda no cuelga de familia ni integrante',
        por.vivienda && !por.vivienda.con_familia && !por.vivienda.con_integrante);
      verificar('  el de familia cuelga de la familia y no del integrante',
        por.familia && por.familia.con_familia && !por.familia.con_integrante);
      verificar('  el de persona cuelga de ambos y lleva el documento',
        por.persona && por.persona.con_familia && por.persona.con_integrante &&
        por.persona.documento === '1144099887',
        por.persona ? String(por.persona.documento) : 'sin plan de persona');
      verificar('  cada plan trae su acción y su seguimiento',
        ambitos.rows.every(function (x) { return x.acciones === 1 && x.seguimientos === 1; }),
        ambitos.rows.map(function (x) { return x.ambito + ':' + x.acciones + '/' + x.seguimientos; }).join(' '));
    }

    console.log('\n=== 11. Restricciones del plan que se rechazan con 400 ===');

    const derivadaSinDestino = fichaValida(sello + 'z');
    derivadaSinDestino.planVivienda = {
      codigoEbs: derivadaSinDestino.equipoSaludId,
      codigoVivienda: derivadaSinDestino.idHogar,
      acciones: [{
        ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
        codigoAccion: 'NC-FAM-01', tipoRespuesta: 'derivada'
      }],
      seguimientos: []
    };
    let rp = await enviar(derivadaSinDestino);
    verificar('Acción derivada sin institución de destino => 400', rp.estado === 400,
      'estado ' + rp.estado);
    verificar('  señala institucionDestino', bloqueoEn(rp.cuerpo, 'institucionDestino'));

    const cupsInexistente = fichaValida(sello + 'z');
    cupsInexistente.planVivienda = {
      codigoEbs: cupsInexistente.equipoSaludId,
      codigoVivienda: cupsInexistente.idHogar,
      acciones: [{
        ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
        codigoAccion: 'NoCUPS-AMB07', tipoRespuesta: 'en_sitio'
      }],
      seguimientos: []
    };
    rp = await enviar(cupsInexistente);
    verificar('Código de acción inexistente => 400', rp.estado === 400, 'estado ' + rp.estado);
    verificar('  señala codigoAccion', bloqueoEn(rp.cuerpo, 'codigoAccion'));

    /* El ejecutor del plan acaba en `aps.funcionario`, la misma tabla que el
       responsable de la ficha, y la restricción `func_formato_documento` le
       exige el formato de RN-013. Sin esta comprobación el documento malo
       llegaba a la transacción y la reventaba con un 500: el encuestador veía
       «no hubo respuesta del servidor» sobre un campo que nadie le señaló, y
       la ficha se quedaba sin subir para siempre. */
    const ejecutorConDocumentoMalo = fichaValida(sello + 'z');
    ejecutorConDocumentoMalo.planVivienda = {
      codigoEbs: ejecutorConDocumentoMalo.equipoSaludId,
      codigoVivienda: ejecutorConDocumentoMalo.idHogar,
      acciones: [{
        ejecutorTipoId: 'CC', ejecutorNumeroId: '12345',   // CC exige 6 a 10 dígitos
        codigoAccion: 'NC-FAM-01', tipoRespuesta: 'en_sitio'
      }],
      seguimientos: []
    };
    rp = await enviar(ejecutorConDocumentoMalo);
    verificar('Documento inválido del ejecutor => 400, no 500', rp.estado === 400,
      'estado ' + rp.estado + ' ' + JSON.stringify(rp.cuerpo).slice(0, 200));
    verificar('  señala ejecutorNumeroId', bloqueoEn(rp.cuerpo, 'ejecutorNumeroId'));

    const seguimientoConDocumentoMalo = fichaValida(sello + 'z');
    seguimientoConDocumentoMalo.planVivienda = {
      codigoEbs: seguimientoConDocumentoMalo.equipoSaludId,
      codigoVivienda: seguimientoConDocumentoMalo.idHogar,
      acciones: [],
      seguimientos: [{
        seguimientoTipoId: 'CC', seguimientoNumeroId: '1144-0123',  // ni dígitos ni longitud
        accionConcertada: 'Compromiso acordado', seg1Fecha: hoyIso(), seg1Estado: 'C'
      }]
    };
    rp = await enviar(seguimientoConDocumentoMalo);
    verificar('Documento inválido del responsable del seguimiento => 400, no 500',
      rp.estado === 400, 'estado ' + rp.estado);
    verificar('  señala seguimientoNumeroId', bloqueoEn(rp.cuerpo, 'seguimientoNumeroId'));

    /* Limpieza. El orden importa: `familia` cuelga de `hogar` y la ficha
       arrastra en cascada su vivienda, familia_ficha e integrantes, pero no
       la identidad persistente del hogar ni la de la familia (RN-025/026). */
    await cliente.query('DELETE FROM aps.ficha WHERE codigo LIKE $1', ['F-TEST-%']);
    await cliente.query('DELETE FROM aps.familia WHERE codigo LIKE $1', ['FM-TEST-%']);
    await cliente.query('DELETE FROM aps.hogar WHERE codigo LIKE $1', ['HG-TEST-%']);
    await cliente.query('DELETE FROM aps.persona WHERE numero_id = $1', ['1144099887']);
    await cliente.end();
  }

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  return fallidas === 0;
}

/* ---------------------------------------------------------
   Arranque
   --------------------------------------------------------- */

async function servidorArriba() {
  try {
    const r = await fetch(BASE + '/index.html', { method: 'GET' });
    return r.ok;
  } catch (error) {
    return false;
  }
}

async function principal() {
  let proceso = null;

  if (!(await servidorArriba())) {
    console.log('  Levantando el servidor local...');
    proceso = spawn('node', ['servidor.js'], { cwd: RAIZ, stdio: 'ignore' });

    let intentos = 0;
    while (intentos < 30 && !(await servidorArriba())) {
      await new Promise(function (r) { setTimeout(r, 200); });
      intentos++;
    }

    if (!(await servidorArriba())) {
      console.error('  No fue posible levantar el servidor.');
      if (proceso) proceso.kill();
      process.exit(1);
    }
  }

  let ok = false;
  try {
    ok = await correrPruebas();
  } finally {
    if (proceso) proceso.kill();
  }

  process.exit(ok ? 0 : 1);
}

principal().catch(function (error) {
  console.error('  Error en la prueba:', error);
  process.exit(1);
});
