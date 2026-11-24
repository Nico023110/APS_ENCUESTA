/* =========================================================================
   Ítems 24, 29 y 96 contra la base y el servidor (2026-11-24)
   -------------------------------------------------------------------------
   Sólo contra la copia local:

       node -r ./bd/base_local.js pruebas/presentes_bd.test.js

   Con PUERTO se elige el puerto del servidor (5173 por defecto). Crea fichas de
   prueba y las borra al final: la urbana con dirección y sin punto de
   referencia se guarda y el plano lleva la dirección; la rural sin punto se
   rechaza; con 1 persona presente de 3 se guarda, y la segunda visita agrega a
   los demás sin pedir que cambie el ítem 29; y una clasificación distinta de la
   calculada nunca se rechaza (la manda un teléfono con la versión anterior).
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const RAIZ = require('path').join(__dirname, '..');
const { Client } = require('pg');
const { opcionesConexion } = require(RAIZ + '/api/_db');
const { asegurarUsuarioDePrueba, iniciarSesionDePrueba } = require(RAIZ + '/pruebas/_sesion_prueba');
const { completarAnexo, integranteAnexo } = require(RAIZ + '/pruebas/_anexo_datos');

const BASE = 'http://localhost:' + (process.env.PUERTO || 5173);
const MARCA = 'F-PRUEBA-PRESENTES-' + Date.now();
const DOCS = ['1144078001', '1144078002', '1144078003', '1144078004'];

let ok = 0, fail = 0;
function verificar(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

const hoy = () => new Date().toISOString().split('T')[0];

function integrante(numeroId, nombre, rol, extra) {
  return Object.assign(integranteAnexo(), { riesgosSaludMentalJoven: ['ninguna'] }, {
    primerNombre: nombre, primerApellido: 'Prueba', tipoId: 'CC', numeroId: numeroId,
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
    clasificacionAntropometrica: 'sobrepeso',
    tensionSistolica: 115, tensionDiastolica: 75, clasificacionTension: 'normal',
    enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  }, extra || {});
}

function ficha(codigo, extra, integrantes, declarados) {
  return completarAnexo(Object.assign({
    consentimiento: 'si', situacionInminente: ['no_aplica'],
    departamentoCodigo: '76', municipioCodigo: '76001', uzpe: 'UZPE006', areaUbicacion: 'urbana',
    territorio: 'T48', microterritorio: 'MT01', divisionTerritorial: 'Barrio San Cayetano',
    equipoSaludId: 'EBS12', prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC', responsableNumeroId: '1144012345', responsableNombre: 'María Pérez',
    perfilProfesional: 'enfermeria', codigoFicha: codigo, fechaRegistro: new Date().toISOString(),
    fechaDiligenciamiento: hoy(), entornoAbordaje: 'hogar', cabezaFamilia: 'María Pérez', jovenesEnPaz: 'no',
    direccion: 'CL 45 A BIS SUR # 27 B - 15', direccionNormalizada: { completa: true, faltantes: [], canonica: 'CL 45 A BIS SUR # 27 B - 15' },
    latitud: 3.45, longitud: -76.53, ubicacionReferencia: 'Frente a la cancha',
    estrato: 'bajo', hogaresEnVivienda: 1, personasEnVivienda: integrantes.length, habitacionesVivienda: 2, elementosParaDormir: 3,
    tipoVivienda: 'casa', materialTecho: 'concreto', riesgosAccidente: ['ninguno'], vectores: 'no',
    factoresContaminacion: ['ninguno'], actividadEconomica: 'no', animales: ['ninguno'],
    perros: 0, perrosVacunados: 0, gatos: 0, gatosVacunados: 0, carnetAntirrabico: 'no_aplica',
    fuenteAgua: ['acueducto_esp'], disposicionExcretas: ['alcantarillado'], aguasResiduales: ['alcantarillado'],
    residuosSolidos: ['servicio_aseo'],
    familias: [{
      tipoFamilia: 'nuclear_monoparental', numeroIntegrantes: declarados || integrantes.length, hogarNumero: 1,
      integrantes: integrantes,
      cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'], practicasVinculo: ['escucha_activa'],
      redesApoyo: 'cuenta_protectoras', practicasCuidadoHogar: ['ventilacion']
    }]
  }, extra || {}));
}

async function principal() {
  const cliente = new Client(opcionesConexion(process.env.DATABASE_URL));
  await cliente.connect();
  const base = (await cliente.query('SELECT current_database() AS b, inet_server_addr() AS h')).rows[0];
  if (!/^(127\.0\.0\.1|::1)$/.test(String(base.h || '127.0.0.1')) || base.b !== 'aps_encuesta') {
    throw new Error('Esta prueba escribe fichas: sólo se corre contra la copia local (node -r ./bd/base_local.js).');
  }
  console.log('Base: ' + base.b + ' · servidor ' + BASE);

  await asegurarUsuarioDePrueba(cliente);
  const sesion = await iniciarSesionDePrueba(BASE);
  const enviar = async function (cuerpo) {
    const r = await fetch(BASE + '/api/guardar_encuesta', {
      method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, sesion.cabeceras), body: JSON.stringify(cuerpo)
    });
    return { estado: r.status, cuerpo: await r.json().catch(() => ({})) };
  };
  const completar = async function (codigo) {
    return (await (await fetch(BASE + '/api/ficha_completa?codigo=' + encodeURIComponent(codigo), { headers: sesion.cabeceras })).json()).encuesta;
  };
  const codigos = [];
  const nuevo = function (sufijo) { const c = MARCA + '-' + sufijo; codigos.push(c); return c; };

  try {
    console.log('\n=== 24. Punto de referencia ===');
    const urbana = nuevo('URB');
    let r = await enviar(ficha(urbana, { ubicacionReferencia: '' }, [integrante(DOCS[0], 'Ana')]));
    verificar('urbana con dirección y sin punto: se guarda', r.estado === 200, r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 400));
    const hogar = (await cliente.query('SELECT h.punto_referencia, h.direccion_normalizada FROM aps.hogar h JOIN aps.ficha f ON f.hogar_id = h.id WHERE f.codigo = $1', [urbana])).rows[0];
    verificar('  queda vacío (la columna no admite nulos)', hogar && hogar.punto_referencia === '', JSON.stringify(hogar));
    const leida = await completar(urbana);
    verificar('  y se vuelve a abrir bien', leida && leida.ubicacionReferencia === '' && leida.direccion === hogar.direccion_normalizada, JSON.stringify(leida && [leida.ubicacionReferencia, leida.direccion]));
    const { leerFichasCompletas } = require(RAIZ + '/api/_ficha_completa');
    const { construirReporte } = require(RAIZ + '/api/_reporte_sispro');
    const id = (await cliente.query('SELECT id FROM aps.ficha WHERE codigo = $1', [urbana])).rows[0].id;
    await cliente.query(`UPDATE aps.ficha SET estado = 'cerrada', cerrada_en = coalesce(cerrada_en, now()) WHERE codigo = $1 AND estado NOT IN ('cerrada','sincronizada')`, [urbana]);
    const enPlano = (await leerFichasCompletas(cliente, [String(id)]))[0];
    const reporte = construirReporte({ fichas: [enPlano], desde: hoy().slice(0, 8) + '01', hasta: hoy(), entidad: { tipo: 'NI', numero: '805027289' }, subregion: '006', nitPrestador: '805027289' });
    const linea = reporte.contenido.split('\r\n').find((l) => l.indexOf('2|') === 0).split('|');
    verificar('  en el plano la variable 11 lleva la dirección', linea[11] === 'CL 45 A BIS SUR NO 27 B - 15' && linea[14] === linea[11], JSON.stringify([linea[11], linea[14]]));

    const rural = nuevo('RUR');
    r = await enviar(ficha(rural, { ubicacionReferencia: '', areaUbicacion: 'rural', territorio: 'T216', microterritorio: 'MT02', divisionTerritorial: 'Vereda La Buitrera' },
      [integrante(DOCS[1], 'Luis')]));
    verificar('rural sin punto: 400 por RN-024', r.estado === 400 && (r.cuerpo.bloqueos || []).some((b) => b.codigo === 'RN-024'), r.estado + ' ' + JSON.stringify((r.cuerpo.bloqueos || []).map((b) => b.codigo)).slice(0, 200));

    console.log('\n=== 29. Presentes y segunda visita ===');
    const visita = nuevo('VIS');
    r = await enviar(ficha(visita, { personasEnVivienda: 1 }, [integrante(DOCS[0], 'Ana')], 3));
    verificar('1 presente de una familia de 3: se guarda', r.estado === 200, r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 400));
    verificar('  con la advertencia de que faltan (RN-051)', (r.cuerpo.advertencias || []).some((a) => a.codigo === 'RN-051'));
    const segunda = Object.assign({}, await completar(visita), { completarIntegrantes: true, esCorreccion: true });
    segunda.familias[0].integrantes.push(integrante(DOCS[1], 'Luis', 'hijo'));
    segunda.familias[0].integrantes.push(integrante(DOCS[2], 'Eva', 'hijo'));
    r = await enviar(segunda);
    verificar('la segunda visita agrega a 2 sin pedir que suba el ítem 29', r.estado === 200 && r.cuerpo.integrantesAgregados === 2, r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 400));
    const quedo = (await cliente.query('SELECT v.personas_en_vivienda p29, (SELECT count(*)::int FROM aps.integrante i JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id WHERE ff.ficha_id = f.id) n FROM aps.ficha f JOIN aps.vivienda v ON v.ficha_id = f.id WHERE f.codigo = $1', [visita])).rows[0];
    verificar('  el 29 sigue siendo el de la primera visita y hay 3 integrantes', quedo.p29 === 1 && quedo.n === 3, JSON.stringify(quedo));
    const masQueLos = nuevo('MAS');
    r = await enviar(ficha(masQueLos, { personasEnVivienda: 1 }, [integrante(DOCS[0], 'Ana'), integrante(DOCS[3], 'Iván', 'hijo')]));
    verificar('una ficha nueva con más hojas que presentes sigue rechazada (RN-029)', r.estado === 400 && (r.cuerpo.bloqueos || []).some((b) => b.codigo === 'RN-029'), r.estado + ' ' + JSON.stringify((r.cuerpo.bloqueos || []).map((b) => b.codigo)));

    console.log('\n=== 96. El servidor no rechaza lo marcado a mano ===');
    const manual = nuevo('MAN');
    r = await enviar(ficha(manual, {}, [integrante(DOCS[0], 'Ana', null, { clasificacionAntropometrica: 'normal' })]));
    verificar('una clasificación distinta de la calculada se guarda', r.estado === 200, r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 300));
    const c96 = (await cliente.query('SELECT i.clasificacion_antropometrica c FROM aps.integrante i JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id JOIN aps.ficha f ON f.id = ff.ficha_id WHERE f.codigo = $1', [manual])).rows[0];
    verificar('  tal como se mandó', c96 && c96.c === 'normal', JSON.stringify(c96));
  } finally {
    const hogares = (await cliente.query('DELETE FROM aps.ficha WHERE codigo = ANY($1) RETURNING hogar_id', [codigos])).rows.map((f) => f.hogar_id);
    const sinFicha = `SELECT h.id FROM aps.hogar h WHERE h.id = ANY($1::bigint[]) AND NOT EXISTS (SELECT 1 FROM aps.ficha f WHERE f.hogar_id = h.id)`;
    await cliente.query(`DELETE FROM aps.familia WHERE hogar_id IN (${sinFicha})`, [hogares]);
    await cliente.query(`DELETE FROM aps.hogar WHERE id IN (${sinFicha})`, [hogares]);
    await cliente.query('DELETE FROM aps.persona WHERE numero_id = ANY($1) AND NOT EXISTS (SELECT 1 FROM aps.integrante i WHERE i.persona_id = aps.persona.id)', [DOCS]);
    const queda = (await cliente.query('SELECT count(*)::int AS n FROM aps.ficha WHERE codigo = ANY($1)', [codigos])).rows[0].n;
    console.log('\nLimpieza: fichas de prueba ' + (queda === 0 ? 'borradas' : 'NO borradas'));
    await cliente.end();
  }
  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
}

principal().catch((e) => { console.error(e); process.exit(1); });
