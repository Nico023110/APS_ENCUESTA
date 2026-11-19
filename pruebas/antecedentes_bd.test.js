/* =========================================================================
   Prueba de «familia ya caracterizada = segunda visita» (RN-015, RN-230)
   contra la base y el servidor.
   -------------------------------------------------------------------------
   Requiere el servidor arriba y la base que diga DATABASE_URL (la de
   .env.local, o la copia local si se arranca con -r ./bd/base_local.js):

       PUERTO=5174 node -r ./bd/base_local.js pruebas/antecedentes_bd.test.js

   Pone en la base anterior (hist) una vivienda de prueba con una persona,
   guarda tres fichas —una con esa persona, otra después con ella y alguien
   más, otra sin coincidencias— y comprueba el CF (CF002, CF003, CF001), el
   vínculo, la auditoría y el detalle. Al final borra todo lo de prueba.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const RAIZ = require('path').join(__dirname, '..');
const { Client } = require('pg');
const { opcionesConexion } = require(RAIZ + '/api/_db');
const { asegurarUsuarioDePrueba, iniciarSesionDePrueba } = require(RAIZ + '/pruebas/_sesion_prueba');
const { completarAnexo, integranteAnexo } = require(RAIZ + '/pruebas/_anexo_datos');

const BASE = 'http://localhost:' + (process.env.PUERTO || 5173);
const MARCA = Date.now();
const CODIGOS = ['F-PRUEBA-ANTECEDENTE-A-' + MARCA, 'F-PRUEBA-ANTECEDENTE-B-' + MARCA, 'F-PRUEBA-ANTECEDENTE-C-' + MARCA];
const HUELLA = 'prueba-antecedentes-' + MARCA;
const DOC_A = '1144077911';
const DOC_B = '1144077912';
const DOC_C = '1144077913';
const DOCS = [DOC_A, DOC_B, DOC_C];

let ok = 0, fail = 0;
function verificar(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const hoy = () => new Date().toISOString().split('T')[0];

function integrante(numeroId, nombre, rol) {
  return Object.assign(integranteAnexo(), { riesgosSaludMentalJoven: ['ninguna'] }, {
    primerNombre: nombre, primerApellido: 'Gomez', tipoId: 'CC', numeroId: numeroId,
    fechaNacimiento: '1996-05-10', nacionalidad: 'CO', sexo: 'mujer', genero: 'femenino',
    autoidentificacionGenero: 'femenino', orientacionSexual: 'heterosexual',
    telefono1: '3155551234', rolFamiliar: rol || 'responsable_economico',
    ocupacion: '5223', nivelEducativo: 'media_academica',
    regimenAfiliacion: 'subsidiado', eapb: 'ESS024',
    sujetoEspecialProteccion: ['ninguna'], pertenenciaEtnica: 'ninguna',
    saberesAncestrales: ['ninguna'], discapacidad: ['sin_discapacidad'],
    certificacionRlcpd: 'no_aplica', intencionReproductiva: 'no', gestacionActual: 'no',
    practicasCuidado: ['alimentacion'], atencionesPendientesRpms: ['ninguna'],
    conocimientoDerecho: ['derechos_deberes'], lactanciaExclusiva: 'no_aplica',
    peso: 65, talla: 160, circunferenciaCintura: 80, imc: 25.39,
    clasificacionAntropometrica: 'normal',
    tensionSistolica: 110, tensionDiastolica: 70, clasificacionTension: 'normal',
    enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  });
}

function ficha(codigo, integrantes) {
  return completarAnexo({
    consentimiento: 'si', situacionInminente: ['no_aplica'],
    departamentoCodigo: '76', municipioCodigo: '76001', uzpe: 'UZPE006', areaUbicacion: 'urbana',
    territorio: 'T48', microterritorio: 'MT01', divisionTerritorial: 'Barrio San Cayetano',
    equipoSaludId: 'EBS12', prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC', responsableNumeroId: '1144012345', responsableNombre: 'María Pérez',
    perfilProfesional: 'enfermeria', codigoFicha: codigo, fechaRegistro: new Date().toISOString(),
    fechaDiligenciamiento: hoy(), entornoAbordaje: 'hogar', cabezaFamilia: 'María Pérez', jovenesEnPaz: 'no',
    direccion: 'CL 45 A BIS SUR # 27 B - 15', direccionNormalizada: { completa: true, faltantes: [] },
    latitud: 3.45, longitud: -76.53, ubicacionReferencia: 'Frente a la cancha',
    estrato: 'bajo', hogaresEnVivienda: 1, personasEnVivienda: integrantes.length, habitacionesVivienda: 2, elementosParaDormir: 3,
    tipoVivienda: 'casa', materialTecho: 'concreto', riesgosAccidente: ['ninguno'], vectores: 'no',
    factoresContaminacion: ['ninguno'], actividadEconomica: 'no', animales: ['ninguno'],
    perros: 0, perrosVacunados: 0, gatos: 0, gatosVacunados: 0, carnetAntirrabico: 'no_aplica',
    fuenteAgua: ['acueducto_esp'], disposicionExcretas: ['alcantarillado'], aguasResiduales: ['alcantarillado'],
    residuosSolidos: ['servicio_aseo'],
    familias: [{
      tipoFamilia: integrantes.length > 1 ? 'nuclear_monoparental' : 'unipersonal',
      numeroIntegrantes: integrantes.length, hogarNumero: 1, integrantes: integrantes,
      cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'], practicasVinculo: ['escucha_activa'],
      redesApoyo: 'cuenta_protectoras', practicasCuidadoHogar: ['ventilacion']
    }]
  });
}

async function principal() {
  const cliente = new Client(opcionesConexion(process.env.DATABASE_URL));
  await cliente.connect();
  const base = (await cliente.query('SELECT current_database() AS b, inet_server_addr() AS h')).rows[0];
  console.log('Base: ' + base.b + ' en ' + (base.h || 'socket local') + ' · servidor ' + BASE);

  await asegurarUsuarioDePrueba(cliente);
  const sesion = await iniciarSesionDePrueba(BASE);
  const enviar = async function (cuerpo) {
    const r = await fetch(BASE + '/api/guardar_encuesta', {
      method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, sesion.cabeceras),
      body: JSON.stringify(cuerpo)
    });
    return { estado: r.status, cuerpo: await r.json().catch(() => ({})) };
  };
  const enLaBase = async function (codigo) {
    return (await cliente.query(`
      SELECT ff.codigo_cf, ff.visitas_anteriores,
             (SELECT json_agg(a.origen || ':' || a.referencia ORDER BY a.origen, a.referencia)
                FROM aps.familia_antecedente a WHERE a.familia_ficha_id = ff.id) AS antecedentes
        FROM aps.ficha f JOIN aps.familia_ficha ff ON ff.ficha_id = f.id WHERE f.codigo = $1`, [codigo])).rows[0] || {};
  };

  try {
    /* Una vivienda de prueba en la base anterior, con una persona. */
    const carga = (await cliente.query(`
      INSERT INTO hist.carga (archivo, huella, periodo, viviendas, personas)
      VALUES ('prueba', $1, 'prueba', 1, 1) RETURNING id`, [HUELLA])).rows[0].id;
    const vivienda = (await cliente.query(`
      INSERT INTO hist.vivienda (carga_id, numero_anterior, territorio, ultima_fecha, ebs_codigo, familias, personas)
      VALUES ($1, 'PRUEBA-1', 'T48', '2025-09-23', 'EBS004', 1, 1) RETURNING id`, [carga])).rows[0].id;
    await cliente.query("INSERT INTO hist.persona (vivienda_id, tipo_id, numero_id) VALUES ($1, 'CC', $2)", [vivienda, DOC_A]);

    console.log('\n=== Ficha con una persona de la base anterior ===');
    const primera = ficha(CODIGOS[0], [integrante(DOC_A, 'Ana')]);
    let r = await enviar(primera);
    verificar('Se guarda: 200', r.estado === 200, r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 300));
    verificar('La respuesta dice que ya estaba caracterizada y que queda en CF002',
      (r.cuerpo.visitasAnteriores || []).length === 1 && r.cuerpo.visitasAnteriores[0].codigoCf === 'CF002' &&
      r.cuerpo.visitasAnteriores[0].antecedentes[0].referencia === 'PRUEBA-1' &&
      r.cuerpo.codigos && r.cuerpo.codigos.codigosCf.join(',') === 'CF002', JSON.stringify(r.cuerpo.visitasAnteriores));
    let fila = await enLaBase(CODIGOS[0]);
    verificar('En la base: CF002, una visita anterior y el vínculo con la vivienda anterior',
      fila.codigo_cf === 'CF002' && fila.visitas_anteriores === 1 && JSON.stringify(fila.antecedentes) === '["base_previa:PRUEBA-1"]',
      JSON.stringify(fila));
    const evento = (await cliente.query(`
      SELECT e.valor_anterior, e.valor_nuevo FROM aud.evento e JOIN aps.ficha f ON f.id = e.ficha_id
       WHERE f.codigo = $1 AND e.campo = 'codigo_cf'`, [CODIGOS[0]])).rows;
    verificar('Queda en la auditoría: CF001 → CF002 y por qué', evento.length === 1 && evento[0].valor_anterior === 'CF001' &&
      /CF002: ya caracterizada antes en base anterior, vivienda PRUEBA-1/.test(evento[0].valor_nuevo), JSON.stringify(evento));

    const detalle = await (await fetch(BASE + '/api/obtener_ficha?codigo=' + encodeURIComponent(CODIGOS[0]),
      { headers: sesion.cabeceras })).json();
    const familiaDetalle = (detalle.encuesta || detalle).familias ? (detalle.encuesta || detalle).familias[0] : null;
    verificar('El detalle de la ficha trae la caracterización anterior',
      familiaDetalle && familiaDetalle.codigoCf === 'CF002' && (familiaDetalle.antecedentes || []).length === 1 &&
      familiaDetalle.antecedentes[0].referencia === 'PRUEBA-1', JSON.stringify(familiaDetalle && familiaDetalle.antecedentes));

    /* El mismo envío otra vez, como cuando se cae la señal antes de la respuesta. */
    r = await enviar(primera);
    fila = await enLaBase(CODIGOS[0]);
    verificar('Volver a guardarla (reenvío) no la sube otra vez: sigue en CF002', r.estado === 200 && fila.codigo_cf === 'CF002',
      r.estado + ' ' + JSON.stringify(fila));

    console.log('\n=== Otra ficha después, con esa persona y alguien más ===');
    r = await enviar(ficha(CODIGOS[1], [integrante(DOC_A, 'Ana'), integrante(DOC_B, 'Luis', 'hijo')]));
    fila = await enLaBase(CODIGOS[1]);
    verificar('Base anterior + la ficha de la app de antes: CF003',
      r.estado === 200 && fila.codigo_cf === 'CF003' && fila.visitas_anteriores === 2 &&
      JSON.stringify(fila.antecedentes) === JSON.stringify(['app:' + CODIGOS[0], 'base_previa:PRUEBA-1']),
      r.estado + ' ' + JSON.stringify(fila));

    console.log('\n=== Ficha sin coincidencias ===');
    r = await enviar(ficha(CODIGOS[2], [integrante(DOC_C, 'Eva')]));
    fila = await enLaBase(CODIGOS[2]);
    verificar('Sigue en CF001, sin vínculo ni aviso', r.estado === 200 && fila.codigo_cf === 'CF001' && fila.visitas_anteriores === 0 &&
      fila.antecedentes === null && (r.cuerpo.visitasAnteriores || []).length === 0, JSON.stringify(fila));
  } finally {
    const hogares = (await cliente.query('DELETE FROM aps.ficha WHERE codigo = ANY($1) RETURNING hogar_id', [CODIGOS])).rows
      .map((f) => f.hogar_id);
    const sinFicha = `SELECT h.id FROM aps.hogar h WHERE h.id = ANY($1::bigint[])
                       AND NOT EXISTS (SELECT 1 FROM aps.ficha f WHERE f.hogar_id = h.id)`;
    await cliente.query(`DELETE FROM aps.familia WHERE hogar_id IN (${sinFicha})`, [hogares]);
    await cliente.query(`DELETE FROM aps.hogar WHERE id IN (${sinFicha})`, [hogares]);
    await cliente.query('DELETE FROM aps.persona WHERE numero_id = ANY($1) AND NOT EXISTS ' +
      '(SELECT 1 FROM aps.integrante i WHERE i.persona_id = aps.persona.id)', [DOCS]);
    await cliente.query('DELETE FROM hist.carga WHERE huella = $1', [HUELLA]);
    const queda = (await cliente.query('SELECT count(*)::int AS n FROM aps.ficha WHERE codigo = ANY($1)', [CODIGOS])).rows[0].n;
    console.log('\nLimpieza: fichas de prueba ' + (queda === 0 ? 'borradas' : 'NO borradas') + ', vivienda anterior de prueba borrada');
    await cliente.end();
  }

  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
}

principal().catch((e) => { console.error(e); process.exit(1); });
