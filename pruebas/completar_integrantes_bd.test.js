/* =========================================================================
   Prueba de «Completar integrantes» (RN-051) contra la base y el servidor.
   -------------------------------------------------------------------------
   Requiere el servidor arriba y la base que diga DATABASE_URL (la de
   .env.local, o la copia local si se arranca con -r ./bd/base_local.js):

       node -r ./bd/base_local.js pruebas/completar_integrantes_bd.test.js

   Con PUERTO se elige el puerto del servidor (5173 por defecto). Crea una
   ficha de prueba con 2 integrantes declarados y 1 caracterizado, comprueba
   lo que no se puede (cambiar al registrado, bajar el ítem 51, no agregar
   nada), la completa, revisa la base —integrantes, orden, ítem 51, alertas,
   auditoría— y la borra al final.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const RAIZ = require('path').join(__dirname, '..');
const { Client } = require('pg');
const { asegurarUsuarioDePrueba, iniciarSesionDePrueba } = require(RAIZ + '/pruebas/_sesion_prueba');
const { completarAnexo, integranteAnexo } = require(RAIZ + '/pruebas/_anexo_datos');

const BASE = 'http://localhost:' + (process.env.PUERTO || 5173);
const CODIGO = 'F-PRUEBA-COMPLETAR-' + Date.now();
const DOC_1 = '1144077001';
const DOC_2 = '1144077002';
const DOC_3 = '1144077003';

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
    /* 125/75: «elevada», alerta RN-203 regular en el plan de la persona. */
    tensionSistolica: 125, tensionDiastolica: 75, clasificacionTension: 'elevada',
    enfermedadesNoTransmisibles: ['ninguna'], condicionesTransmisibles: ['ninguna'],
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  });
}

function ficha() {
  return completarAnexo({
    consentimiento: 'si', situacionInminente: ['no_aplica'],
    departamentoCodigo: '76', municipioCodigo: '76001', uzpe: 'UZPE006', areaUbicacion: 'urbana',
    territorio: 'T48', microterritorio: 'MT01', divisionTerritorial: 'Barrio San Cayetano',
    equipoSaludId: 'EBS12', prestadorPrimario: 'PROV-ESE-LADERA',
    responsableTipoId: 'CC', responsableNumeroId: '1144012345', responsableNombre: 'María Pérez',
    perfilProfesional: 'enfermeria', codigoFicha: CODIGO, fechaRegistro: new Date().toISOString(),
    fechaDiligenciamiento: hoy(), entornoAbordaje: 'hogar', cabezaFamilia: 'María Pérez', jovenesEnPaz: 'no',
    direccion: 'CL 45 A BIS SUR # 27 B - 15', direccionNormalizada: { completa: true, faltantes: [] },
    latitud: 3.45, longitud: -76.53, ubicacionReferencia: 'Frente a la cancha',
    estrato: 'bajo', hogaresEnVivienda: 1, personasEnVivienda: 3, habitacionesVivienda: 2, elementosParaDormir: 3,
    tipoVivienda: 'casa', materialTecho: 'concreto', riesgosAccidente: ['ninguno'], vectores: 'no',
    factoresContaminacion: ['ninguno'], actividadEconomica: 'no', animales: ['ninguno'],
    perros: 0, perrosVacunados: 0, gatos: 0, gatosVacunados: 0, carnetAntirrabico: 'no_aplica',
    fuenteAgua: ['acueducto_esp'], disposicionExcretas: ['alcantarillado'], aguasResiduales: ['alcantarillado'],
    residuosSolidos: ['servicio_aseo'],
    familias: [{
      tipoFamilia: 'nuclear_monoparental', numeroIntegrantes: 2, hogarNumero: 1,
      integrantes: [integrante(DOC_1, 'Ana')],
      cuidadorPrincipal: 'no', situacionesRiesgo: ['ninguna'], practicasVinculo: ['escucha_activa'],
      redesApoyo: 'cuenta_protectoras', practicasCuidadoHogar: ['ventilacion']
    }]
  });
}

async function principal() {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
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

  try {
    console.log('\n=== Ficha con un integrante de dos ===');
    const creada = await enviar(ficha());
    verificar('Se guarda con un integrante pendiente', creada.estado === 200, JSON.stringify(creada.cuerpo).slice(0, 400));
    verificar('  con la advertencia RN-051',
      (creada.cuerpo.advertencias || []).some((a) => a.codigo === 'RN-051'), JSON.stringify(creada.cuerpo.advertencias));

    const lista = await (await fetch(BASE + '/api/listar_fichas', { headers: sesion.cabeceras })).json();
    const fila = lista.find((f) => f.codigoFicha === CODIGO) || {};
    verificar('El historial dice que falta 1', fila.integrantesPendientes === 1, String(fila.integrantesPendientes));

    const completa = await (await fetch(BASE + '/api/ficha_completa?codigo=' + encodeURIComponent(CODIGO),
      { headers: sesion.cabeceras })).json();
    const guardada = completa.encuesta;
    verificar('ficha_completa la trae', Boolean(guardada) && guardada.familias[0].integrantes.length === 1);

    const base1 = Object.assign({}, guardada, { completarIntegrantes: true, esCorreccion: true });

    console.log('\n=== Lo que no se puede ===');
    const cambiaRegistrado = JSON.parse(JSON.stringify(base1));
    cambiaRegistrado.familias[0].integrantes[0].numeroId = DOC_3;
    cambiaRegistrado.familias[0].integrantes.push(integrante(DOC_2, 'Luis', 'hijo'));
    let r = await enviar(cambiaRegistrado);
    verificar('Cambiar al registrado: 409', r.estado === 409 && r.cuerpo.codigo === 'integrantes_registrados', r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 300));

    const baja51 = JSON.parse(JSON.stringify(base1));
    baja51.familias[0].numeroIntegrantes = 1;
    r = await enviar(baja51);
    verificar('Bajar el ítem 51: 409', r.estado === 409, r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 300));

    r = await enviar(JSON.parse(JSON.stringify(base1)));
    verificar('Sin integrantes nuevos: 409 y lo dice', r.estado === 409 &&
      /No agregó ningún integrante/.test(JSON.stringify(r.cuerpo)), r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 300));

    const sinDatos = JSON.parse(JSON.stringify(base1));
    sinDatos.familias[0].integrantes.push({ tipoId: 'CC', numeroId: DOC_2, primerNombre: 'Luis' });
    r = await enviar(sinDatos);
    verificar('Integrante nuevo incompleto: 400 con bloqueos sólo de él',
      r.estado === 400 && (r.cuerpo.bloqueos || []).length > 0 &&
      r.cuerpo.bloqueos.every((b) => /^familias\[0\]\.integrantes\[1\]|^planVivienda|\.plan(Familia|Persona)|numeroIntegrantes|^personasEnVivienda/.test(b.ruta) || b.codigo === 'RN-029'),
      r.estado + ' ' + JSON.stringify((r.cuerpo.bloqueos || []).map((b) => b.ruta)).slice(0, 400));

    console.log('\n=== Completar ===');
    const alertasAntes = (await cliente.query(`
      SELECT a.id, a.detectada_en, a.integrante_id FROM aps.alerta a JOIN aps.ficha f ON f.id = a.ficha_id
       WHERE f.codigo = $1 ORDER BY a.id`, [CODIGO])).rows;
    verificar('La ficha tiene la alerta de tensión de la registrada', alertasAntes.length === 1, JSON.stringify(alertasAntes));
    const bien = JSON.parse(JSON.stringify(base1));
    /* Lo que llegue de la registrada se ignora: no se vuelve a escribir. */
    bien.familias[0].integrantes[0].peso = 99;
    bien.familias[0].integrantes.push(integrante(DOC_2, 'Luis', 'hijo'));
    r = await enviar(bien);
    verificar('Agregar al que faltaba: 200', r.estado === 200 && r.cuerpo.completarIntegrantes === true &&
      r.cuerpo.integrantesAgregados === 1, r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 500));

    const enBase = (await cliente.query(`
      SELECT p.numero_id, i.orden, i.peso, ff.numero_integrantes
        FROM aps.ficha f
        JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
        JOIN aps.integrante i ON i.familia_ficha_id = ff.id
        JOIN aps.persona p ON p.id = i.persona_id
       WHERE f.codigo = $1 ORDER BY i.orden`, [CODIGO])).rows;
    verificar('En la base quedan los dos, en su orden',
      enBase.map((x) => x.numero_id + '#' + x.orden).join(',') === DOC_1 + '#1,' + DOC_2 + '#2', JSON.stringify(enBase));
    verificar('  el registrado no se reescribió (peso 65, no 99)', Number(enBase[0].peso) === 65, String(enBase[0].peso));
    verificar('  el ítem 51 sigue en 2', Number(enBase[0].numero_integrantes) === 2);

    const alertasDespues = (await cliente.query(`
      SELECT a.id, a.detectada_en, p.numero_id FROM aps.alerta a JOIN aps.ficha f ON f.id = a.ficha_id
        LEFT JOIN aps.integrante i ON i.id = a.integrante_id LEFT JOIN aps.persona p ON p.id = i.persona_id
       WHERE f.codigo = $1 ORDER BY a.id`, [CODIGO])).rows;
    verificar('La alerta que ya había sigue igual (mismo id y misma detección: su plazo no se reinicia)',
      alertasDespues.length === 2 && String(alertasDespues[0].id) === String(alertasAntes[0].id) &&
      new Date(alertasDespues[0].detectada_en).getTime() === new Date(alertasAntes[0].detectada_en).getTime(),
      JSON.stringify(alertasDespues));
    verificar('  y se agregó la del integrante nuevo', alertasDespues[1] && alertasDespues[1].numero_id === DOC_2,
      JSON.stringify(alertasDespues));

    const evento = (await cliente.query(`
      SELECT e.campo, e.valor_nuevo FROM aud.evento e JOIN aps.ficha f ON f.id = e.ficha_id
       WHERE f.codigo = $1 AND e.campo = 'integrantes'`, [CODIGO])).rows;
    verificar('Queda en auditoría', evento.length === 1 && /1 integrante/.test(evento[0].valor_nuevo), JSON.stringify(evento));

    const lista2 = await (await fetch(BASE + '/api/listar_fichas', { headers: sesion.cabeceras })).json();
    const fila2 = lista2.find((f) => f.codigoFicha === CODIGO) || {};
    verificar('El historial ya no tiene pendientes', fila2.integrantesPendientes === 0, String(fila2.integrantesPendientes));

    console.log('\n=== Subir el ítem 51 ===');
    const completa2 = (await (await fetch(BASE + '/api/ficha_completa?codigo=' + encodeURIComponent(CODIGO),
      { headers: sesion.cabeceras })).json()).encuesta;
    const sube = Object.assign({}, completa2, { completarIntegrantes: true, esCorreccion: true });
    sube.familias[0].numeroIntegrantes = 3;
    sube.personasEnVivienda = 3;
    sube.familias[0].integrantes.push(integrante(DOC_3, 'Eva', 'hijo'));
    r = await enviar(sube);
    verificar('Subir el ítem 51 y agregar a uno más: 200', r.estado === 200 && r.cuerpo.integrantesAgregados === 1,
      r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 500));
    const tres = (await cliente.query(`
      SELECT ff.numero_integrantes, count(i.id) AS n FROM aps.ficha f
        JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
        LEFT JOIN aps.integrante i ON i.familia_ficha_id = ff.id
       WHERE f.codigo = $1 GROUP BY ff.numero_integrantes`, [CODIGO])).rows[0] || {};
    verificar('  quedan 3 declarados y 3 integrantes', Number(tres.numero_integrantes) === 3 && Number(tres.n) === 3,
      JSON.stringify(tres));
  } finally {
    const hogares = (await cliente.query('DELETE FROM aps.ficha WHERE codigo = $1 RETURNING hogar_id', [CODIGO])).rows
      .map((f) => f.hogar_id);
    const sinFicha = `SELECT h.id FROM aps.hogar h WHERE h.id = ANY($1::bigint[])
                       AND NOT EXISTS (SELECT 1 FROM aps.ficha f WHERE f.hogar_id = h.id)`;
    await cliente.query(`DELETE FROM aps.familia WHERE hogar_id IN (${sinFicha})`, [hogares]);
    await cliente.query(`DELETE FROM aps.hogar WHERE id IN (${sinFicha})`, [hogares]);
    await cliente.query('DELETE FROM aps.persona WHERE numero_id = ANY($1) AND NOT EXISTS ' +
      '(SELECT 1 FROM aps.integrante i WHERE i.persona_id = aps.persona.id)', [[DOC_1, DOC_2, DOC_3]]);
    const queda = (await cliente.query('SELECT count(*) AS n FROM aps.ficha WHERE codigo = $1', [CODIGO])).rows[0].n;
    console.log('\nLimpieza: ficha de prueba ' + (Number(queda) === 0 ? 'borrada' : 'NO borrada'));
    await cliente.end();
  }

  console.log('\n' + ok + ' OK, ' + fail + ' FALLAS');
  process.exit(fail ? 1 : 0);
}

principal().catch((e) => { console.error(e); process.exit(1); });
