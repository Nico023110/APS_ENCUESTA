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
const { asegurarUsuarioDePrueba, iniciarSesionDePrueba, USUARIO_PRUEBA } = require('./_sesion_prueba');
const { completarAnexo } = require('./_anexo_datos');

const BASE = 'http://localhost:' + (process.env.PUERTO || 5173);
const RAIZ = path.join(__dirname, '..');

/* Cabeceras de la sesión de prueba (cookie + anti-CSRF); las llena limpiar(). */
let sesion = { cabeceras: {} };

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
    zonaEndemica: 'ninguna', sintomatologiaDepresiva: ['ninguno'],
    ideacionSuicida: 'ninguno', consumoSpa: 'no', limitacionCotidiana: 'no'
  };
}

function fichaValida(sufijo) {
  const integrante = integranteValido();

  /* completarAnexo: las variables obligatorias del anexo técnico SI-APS. */
  return completarAnexo({
    consentimiento: 'si',
    situacionInminente: ['no_aplica'],
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
    fuenteAgua: ['acueducto_esp'],
    disposicionExcretas: ['alcantarillado'],
    aguasResiduales: ['alcantarillado'],
    residuosSolidos: ['servicio_aseo'],
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
  });
}

async function enviar(ficha, cabeceras) {
  const respuesta = await fetch(BASE + '/api/guardar_encuesta', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cabeceras || sesion.cabeceras),
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
  await asegurarUsuarioDePrueba(cliente);
  await asegurarUsuarioDePrueba(cliente, {
    documento: '1144099002', nombre: 'Prueba Auxiliar', rol: 'auxiliar_enfermeria', equipo: 'EBS12'
  });
  await asegurarUsuarioDePrueba(cliente, {
    documento: '1144099003', nombre: 'Prueba Otro Equipo', rol: 'enfermeria', equipo: 'EBS99'
  });
  await cliente.end();
  sesion = await iniciarSesionDePrueba(BASE);
}

async function correrPruebas() {
  const sello = Date.now().toString(36);

  await limpiar();

  console.log('\n=== 0. Acceso: sin sesión no hay API ===');

  let r = await enviar(fichaValida(sello + '0'), {});
  verificar('POST sin sesión ni cabecera anti-CSRF => 403', r.estado === 403, 'estado ' + r.estado);
  r = await enviar(fichaValida(sello + '0'), { 'X-Requested-With': 'fetch' });
  verificar('POST sin sesión => 401', r.estado === 401, 'estado ' + r.estado);
  r = await enviar(fichaValida(sello + '0'), { Cookie: sesion.cabeceras.Cookie });
  verificar('POST con cookie pero sin cabecera anti-CSRF => 403', r.estado === 403, 'estado ' + r.estado);

  let listado = await fetch(BASE + '/api/listar_fichas');
  verificar('GET listar_fichas sin sesión => 401', listado.status === 401, 'estado ' + listado.status);
  listado = await fetch(BASE + '/api/catalogo_dinamico');
  verificar('GET catalogo_dinamico sin sesión => 401', listado.status === 401, 'estado ' + listado.status);

  const malaClave = await fetch(BASE + '/api/iniciar_sesion', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ documento: USUARIO_PRUEBA.documento, clave: 'incorrecta123' })
  });
  const inexistente = await fetch(BASE + '/api/iniciar_sesion', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ documento: '9999999999', clave: 'incorrecta123' })
  });
  const cuerpoMala = await malaClave.json();
  const cuerpoInex = await inexistente.json();
  verificar('Clave incorrecta => 401', malaClave.status === 401, 'estado ' + malaClave.status);
  verificar('  mismo mensaje para documento inexistente (no revela cuentas)',
    inexistente.status === 401 && cuerpoMala.error === cuerpoInex.error,
    cuerpoMala.error + ' | ' + cuerpoInex.error);

  console.log('\n=== 1. Rechazo de datos ausentes (antes se rellenaban) ===');

  /* El equipo y el responsable ya no vienen del cuerpo: los firma la sesión.
     Un cuerpo que intente otro equipo u otro responsable se sobrescribe. */
  const otroEquipo = fichaValida(sello + 'a');
  otroEquipo.equipoSaludId = 'EQTEST';
  otroEquipo.responsableNumeroId = '9999999999';
  otroEquipo.responsableNombre = 'Suplantador';
  r = await enviar(otroEquipo);
  verificar('Equipo y responsable ajenos en el cuerpo => 200 con la firma de la sesión',
    r.estado === 200, 'estado ' + r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 200));
  if (r.estado === 200) {
    const firmaDb = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: false });
    await firmaDb.connect();
    const firma = (await firmaDb.query(`
      SELECT eq.codigo AS equipo, fu.numero_id, fu.nombre_completo
        FROM aps.ficha f JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
        JOIN aps.funcionario fu ON fu.id = f.responsable_id
       WHERE f.codigo = $1`, [otroEquipo.codigoFicha])).rows[0] || {};
    const evento = (await firmaDb.query(`
      SELECT count(*)::int AS n FROM aud.evento e JOIN aps.ficha f ON f.id = e.ficha_id
       WHERE f.codigo = $1 AND e.tipo = 'creacion'`, [otroEquipo.codigoFicha])).rows[0].n;
    await firmaDb.end();
    verificar('  la ficha quedó en el equipo de la sesión (EBS12), no en EQTEST', firma.equipo === 'EBS12', String(firma.equipo));
    verificar('  el responsable es quien inició sesión', firma.numero_id === USUARIO_PRUEBA.documento, String(firma.numero_id));
    verificar('  RN-225: quedó el evento de creación en auditoría', evento === 1, String(evento));
  }

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

  console.log('\n=== 5b. RN-092 / RN-093 — unidades equivocadas (antes: 500 "numeric field overflow") ===');

  const pesoEnGramos = fichaValida(sello + 'l2');
  pesoEnGramos.familias[0].integrantes[0].peso = 3500;
  pesoEnGramos.familias[0].integrantes[0].imc = 136.72;
  r = await enviar(pesoEnGramos);
  verificar('Peso en gramos => 400, no 500', r.estado === 400, 'estado ' + r.estado);
  verificar('  señala peso', bloqueoEn(r.cuerpo, 'peso'));

  const tallaEnMetros = fichaValida(sello + 'l3');
  tallaEnMetros.familias[0].integrantes[0].talla = 1.6;
  tallaEnMetros.familias[0].integrantes[0].imc = 253906.25;
  r = await enviar(tallaEnMetros);
  verificar('Talla en metros => 400, no 500', r.estado === 400, 'estado ' + r.estado);
  verificar('  señala talla', bloqueoEn(r.cuerpo, 'talla'));

  console.log('\n=== 5c. RN-224.3 — alcance por rol y equipo al corregir ===');

  const auxiliar = await iniciarSesionDePrueba(BASE, { documento: '1144099002', clave: USUARIO_PRUEBA.clave });
  const otroEquipoSesion = await iniciarSesionDePrueba(BASE, { documento: '1144099003', clave: USUARIO_PRUEBA.clave });

  const fichaDeAuxiliar = fichaValida(sello + 'l4');
  r = await enviar(fichaDeAuxiliar, auxiliar.cabeceras);
  verificar('La auxiliar registra una ficha => 200', r.estado === 200, 'estado ' + r.estado);

  r = await enviar(fichaDeAuxiliar, otroEquipoSesion.cabeceras);
  verificar('Otro equipo intenta corregirla => 403', r.estado === 403, 'estado ' + r.estado);

  r = await enviar(fichaDeAuxiliar, sesion.cabeceras);
  verificar('La profesional del mismo equipo la corrige => 200', r.estado === 200, 'estado ' + r.estado);

  const fichaDeProfesional = fichaValida(sello + 'l5');
  r = await enviar(fichaDeProfesional, sesion.cabeceras);
  verificar('La profesional registra otra ficha => 200', r.estado === 200, 'estado ' + r.estado);
  r = await enviar(fichaDeProfesional, auxiliar.cabeceras);
  verificar('La auxiliar intenta corregir la de la profesional => 403 (sólo las propias)',
    r.estado === 403, 'estado ' + r.estado);

  const listadoOtro = await fetch(BASE + '/api/listar_fichas', { headers: otroEquipoSesion.cabeceras })
    .then(function (x) { return x.json(); });
  verificar('El listado del otro equipo no trae las fichas de EBS12',
    Array.isArray(listadoOtro) && !listadoOtro.some(function (f) { return f.equipoSaludId === 'EBS12'; }),
    JSON.stringify((listadoOtro || []).map(function (f) { return f.equipoSaludId; })));

  const detalleAjeno = await fetch(BASE + '/api/obtener_ficha?codigo=' + fichaDeAuxiliar.codigoFicha,
    { headers: otroEquipoSesion.cabeceras });
  verificar('El detalle de una ficha ajena => 404 (no se confirma que exista)',
    detalleAjeno.status === 404, 'estado ' + detalleAjeno.status);

  console.log('\n=== 5d. /api/usuarios — gestión de cuentas por rol ===');

  async function usuariosApi(cabeceras, cuerpo) {
    const respuesta = await fetch(BASE + '/api/usuarios', cuerpo
      ? { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cabeceras), body: JSON.stringify(cuerpo) }
      : { headers: cabeceras });
    return { estado: respuesta.status, cuerpo: await respuesta.json().catch(function () { return {}; }) };
  }

  const listadoAsistencial = await usuariosApi(sesion.cabeceras);
  verificar('Una profesional no lista usuarios => 403', listadoAsistencial.estado === 403, 'estado ' + listadoAsistencial.estado);

  const limpiarCuentas = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: false });
  await limpiarCuentas.connect();
  await asegurarUsuarioDePrueba(limpiarCuentas, { documento: '1144099010', nombre: 'Prueba Admin', rol: 'administrador', equipo: null });
  await asegurarUsuarioDePrueba(limpiarCuentas, { documento: '1144099011', nombre: 'Prueba Maestro Api', rol: 'maestro', equipo: 'EBS12' });
  await limpiarCuentas.query("DELETE FROM aps.usuario WHERE documento IN ('1144099012','1144099013')");
  await limpiarCuentas.query("DELETE FROM aps.funcionario WHERE numero_id IN ('1144099012','1144099013')");
  await limpiarCuentas.end();

  const admin = await iniciarSesionDePrueba(BASE, { documento: '1144099010', clave: USUARIO_PRUEBA.clave });
  const maestro = await iniciarSesionDePrueba(BASE, { documento: '1144099011', clave: USUARIO_PRUEBA.clave });

  const listadoAdmin = await usuariosApi(admin.cabeceras);
  verificar('El administrador lista usuarios => 200 con la lista', listadoAdmin.estado === 200 && Array.isArray(listadoAdmin.cuerpo.usuarios),
    'estado ' + listadoAdmin.estado);
  verificar('  la lista no expone hashes de clave', JSON.stringify(listadoAdmin.cuerpo).indexOf('scrypt$') === -1);

  const creaMaestro = await usuariosApi(admin.cabeceras, { accion: 'crear', documento: '1144099012', nombre: 'Intento Maestro', rol: 'maestro', equipo: 'EBS12' });
  verificar('El administrador no puede crear un maestro => 403', creaMaestro.estado === 403, 'estado ' + creaMaestro.estado);

  const creaMal = await usuariosApi(admin.cabeceras, { accion: 'crear', documento: '1144099012', nombre: 'Sin Equipo', rol: 'medicina' });
  verificar('Rol asistencial sin equipo => 400 señalando equipo', creaMal.estado === 400 && creaMal.cuerpo.campo === 'equipo',
    'estado ' + creaMal.estado + ' ' + JSON.stringify(creaMal.cuerpo));

  const creaBien = await usuariosApi(admin.cabeceras, { accion: 'crear', documento: '1144099012', nombre: 'Creada Por Api', rol: 'medicina', equipo: 'EBS12' });
  verificar('El administrador crea una médica => 200 con clave temporal',
    creaBien.estado === 200 && typeof creaBien.cuerpo.claveTemporal === 'string' && creaBien.cuerpo.claveTemporal.length >= 10,
    'estado ' + creaBien.estado + ' ' + JSON.stringify(creaBien.cuerpo).slice(0, 120));

  const entraNueva = await fetch(BASE + '/api/iniciar_sesion', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ documento: '1144099012', clave: creaBien.cuerpo.claveTemporal })
  });
  const cuerpoNueva = await entraNueva.json();
  verificar('  la cuenta nueva entra con la clave temporal y debe cambiarla',
    entraNueva.status === 200 && cuerpoNueva.usuario && cuerpoNueva.usuario.debeCambiarClave === true, 'estado ' + entraNueva.status);

  const duplicado = await usuariosApi(admin.cabeceras, { accion: 'crear', documento: '1144099012', nombre: 'Otra', rol: 'medicina', equipo: 'EBS12' });
  verificar('Documento repetido => 400 señalando documento', duplicado.estado === 400 && duplicado.cuerpo.campo === 'documento', 'estado ' + duplicado.estado);

  const idNueva = creaBien.cuerpo.usuario && creaBien.cuerpo.usuario.id;
  const modifica = await usuariosApi(admin.cabeceras, { accion: 'modificar', id: idNueva, nombre: 'Creada Por Api Editada', rol: 'auxiliar_enfermeria', equipo: 'EBS12', activo: true });
  verificar('Modificar nombre y rol => 200', modifica.estado === 200 && modifica.cuerpo.usuario && modifica.cuerpo.usuario.rol === 'auxiliar_enfermeria',
    'estado ' + modifica.estado + ' ' + JSON.stringify(modifica.cuerpo).slice(0, 120));

  const autoBaja = await usuariosApi(admin.cabeceras, { accion: 'modificar', id: admin.usuario.id, nombre: 'Prueba Admin', rol: 'administrador', activo: false });
  verificar('Desactivarse a sí mismo => 400', autoBaja.estado === 400, 'estado ' + autoBaja.estado);

  const maestroDesdeAdmin = await usuariosApi(admin.cabeceras, { accion: 'restablecer', id: maestro.usuario.id });
  verificar('El administrador no restablece la clave de un maestro => 403', maestroDesdeAdmin.estado === 403, 'estado ' + maestroDesdeAdmin.estado);

  const restablece = await usuariosApi(maestro.cabeceras, { accion: 'restablecer', id: idNueva });
  verificar('El maestro restablece la clave => 200 con clave nueva', restablece.estado === 200 && typeof restablece.cuerpo.claveTemporal === 'string',
    'estado ' + restablece.estado);

  const desactiva = await usuariosApi(maestro.cabeceras, { accion: 'modificar', id: idNueva, nombre: 'Creada Por Api Editada', rol: 'auxiliar_enfermeria', equipo: 'EBS12', activo: false });
  const entraDesactivada = await fetch(BASE + '/api/iniciar_sesion', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ documento: '1144099012', clave: restablece.cuerpo.claveTemporal })
  });
  verificar('Cuenta desactivada => no puede entrar (403)', desactiva.estado === 200 && entraDesactivada.status === 403,
    'modificar ' + desactiva.estado + ', entrar ' + entraDesactivada.status);

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

    /* Observaciones del equipo (2026-09): territorios T01–T110, líder
       derivado en Hogar (RN-019), familia declarada ausente (RN-028) y ficha
       que igual se guarda. Desde el anexo técnico la nacionalidad es el país
       (tabla Pais de SISPRO) con su estatus migratorio (variable 10). */
    const obs = fichaValida(sello + 'o');
    obs.territorio = 'T01';
    obs.microterritorio = 'MT02';
    obs.entornoAbordaje = 'hogar';
    obs.cabezaFamilia = '';
    obs.hogaresEnVivienda = 2;                                   // la otra familia no estaba
    obs.familias[0].integrantes[0].nacionalidad = 'EC';
    obs.familias[0].integrantes[0].estatusMigratorio = 'regular';
    obs.familias[0].integrantes[0].tipoId = 'CE';                 // extranjería: exige nacionalidad ≠ CO
    obs.familias[0].integrantes[0].numeroId = 'E1234567';
    const rObs = await enviar(obs);
    verificar('Territorio T01, líder vacío en Hogar y familia ausente => 200', rObs.estado === 200,
      'estado ' + rObs.estado + ' ' + JSON.stringify(rObs.cuerpo).slice(0, 300));
    if (rObs.estado === 200) {
      const fObs = await cliente.query(`
        SELECT f.lider_entorno, h.territorio_codigo, h.microterritorio_codigo,
               p.nacionalidad, i.estatus_migratorio
          FROM aps.ficha f
          JOIN aps.hogar h          ON h.id = f.hogar_id
          JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
          JOIN aps.integrante i     ON i.familia_ficha_id = ff.id
          JOIN aps.persona p        ON p.id = i.persona_id
         WHERE f.codigo = $1
      `, [obs.codigoFicha]);
      const o = fObs.rows[0] || {};
      verificar('  territorio T01 / MT02 aceptado por la base', o.territorio_codigo === 'T01' && o.microterritorio_codigo === 'MT02',
        o.territorio_codigo + '/' + o.microterritorio_codigo);
      verificar('  el líder del entorno se derivó del responsable económico', o.lider_entorno === 'Ana Gomez', o.lider_entorno);
      verificar('  nacionalidad EC (Ecuador) con su estatus migratorio', o.nacionalidad === 'EC' && o.estatus_migratorio === 'regular',
        o.nacionalidad + '/' + o.estatus_migratorio);
      verificar('  la familia ausente quedó como advertencia',
        (rObs.cuerpo.advertencias || []).some(function (a) { return a.codigo === 'RN-028'; }),
        JSON.stringify((rObs.cuerpo.advertencias || []).map(function (a) { return a.codigo; })));
    }
    const otraSinPais = fichaValida(sello + 'o');
    otraSinPais.familias[0].integrantes[0].nacionalidad = 'OT';
    const rSinPais = await enviar(otraSinPais);
    verificar('Nacionalidad «Otra» (sin país) => 400 en el ítem 65', rSinPais.estado === 400 && bloqueoEn(rSinPais.cuerpo, 'nacionalidad'),
      'estado ' + rSinPais.estado);
    const sinEstatus = fichaValida(sello + 'o');
    sinEstatus.familias[0].integrantes[0].nacionalidad = 'VE';
    const rSinEstatus = await enviar(sinEstatus);
    verificar('Extranjera sin estatus migratorio => 400 (A3.10)',
      rSinEstatus.estado === 400 && bloqueoEn(rSinEstatus.cuerpo, 'estatusMigratorio'), 'estado ' + rSinEstatus.estado);

    console.log('\n=== 6b. Corregir desde cualquier dispositivo: la ficha vuelve entera ===');

    const completa = fichaValida(sello + 'fc');
    completa.idFamilia = 'REF-FAM-77';
    completa.direccionComponentes = {
      modo: 'urbana', viaTipo: 'CL', viaNumero: '45', viaLetra: 'A', viaBis: true, viaLetraBis: '',
      viaCuadrante: 'SUR', genNumero: '27', genLetra: 'B', genCuadrante: '', placa: '15',
      complementos: [{ tipo: 'CA', valor: '3' }]
    };
    completa.animales = ['perros'];
    completa.perros = 2;
    completa.perrosVacunados = 1;
    completa.carnetAntirrabico = 'si';
    /* Con animales, el anexo técnico pide su tenencia (variables 97 a 102). */
    completa.finalidadTenencia = ['compania'];
    completa.confinamientoAnimales = ['parcial'];
    completa.desparasitaAnimales = 'si';
    completa.instalacionesSegurasAnimales = 'si';
    completa.excretasAnimales = 'si';
    completa.barrerasContactoAnimales = 'no';
    completa.familias[0].integrantes[0].practicasCuidado = ['alimentacion', 'actividad_fisica'];
    r = await enviar(completa);
    verificar('Ficha con dirección por partes, ítem 26 y animales => 200', r.estado === 200,
      'estado ' + r.estado + ' ' + JSON.stringify(r.cuerpo).slice(0, 300));

    const leer = async function (codigo, cabeceras) {
      const x = await fetch(BASE + '/api/ficha_completa?codigo=' + encodeURIComponent(codigo), { headers: cabeceras });
      return { estado: x.status, cuerpo: await x.json().catch(function () { return {}; }) };
    };

    const leida = await leer(completa.codigoFicha, sesion.cabeceras);
    verificar('La responsable la lee completa => 200', leida.estado === 200 && leida.cuerpo.encuesta, 'estado ' + leida.estado);

    if (leida.estado === 200) {
      const e = leida.cuerpo.encuesta;
      const ie = e.familias && e.familias[0] && e.familias[0].integrantes[0];
      const orden = function (lista) { return JSON.stringify((lista || []).slice().sort()); };
      verificar('  ficha: código, UZPE, territorio, fecha', e.codigoFicha === completa.codigoFicha && e.uzpe === 'UZPE006' &&
        e.territorio === 'T48' && e.microterritorio === 'MT01' && e.fechaDiligenciamiento === completa.fechaDiligenciamiento,
        JSON.stringify([e.codigoFicha, e.uzpe, e.territorio, e.microterritorio, e.fechaDiligenciamiento]));
      verificar('  dirección por partes (ítem 21) vuelve igual',
        e.direccionComponentes && e.direccionComponentes.viaTipo === 'CL' && e.direccionComponentes.viaBis === true &&
        e.direccionComponentes.viaCuadrante === 'SUR' && e.direccionComponentes.complementos.length === 1,
        JSON.stringify(e.direccionComponentes));
      verificar('  ítem 26 (referencia de la familia) vuelve igual', e.idFamilia === 'REF-FAM-77', e.idFamilia);
      verificar('  vivienda: conteos, animales y carné', e.personasEnVivienda === 4 && e.perros === 2 &&
        orden(e.animales) === orden(['perros']) && e.carnetAntirrabico === 'si',
        JSON.stringify([e.personasEnVivienda, e.perros, e.animales, e.carnetAntirrabico]));
      verificar('  sí/no vuelven como en el formulario', e.consentimiento === 'si' && e.jovenesEnPaz === 'no' &&
        e.actividadEconomica === 'no' && e.familias[0].cuidadorPrincipal === 'no',
        JSON.stringify([e.consentimiento, e.jovenesEnPaz, e.actividadEconomica]));
      verificar('  integrante: identidad, clínica y catálogos', ie && ie.numeroId === '1144099887' &&
        ie.fechaNacimiento === '1996-05-10' && ie.peso === 65 && ie.talla === 160 && ie.eapb === 'ESS024' &&
        ie.ocupacion === '5223' && ie.ideacionSuicida === 'ninguno' && ie.limitacionCotidiana === 'no',
        JSON.stringify(ie && [ie.numeroId, ie.fechaNacimiento, ie.peso, ie.talla, ie.eapb, ie.ocupacion, ie.ideacionSuicida]));
      verificar('  selección múltiple del integrante', ie && orden(ie.practicasCuidado) === orden(['alimentacion', 'actividad_fisica']),
        JSON.stringify(ie && ie.practicasCuidado));

      /* La prueba de verdad: lo leído se puede volver a guardar tal cual. */
      const reenvio = await enviar(e);
      verificar('  lo leído se vuelve a guardar sin tocarlo => 200', reenvio.estado === 200,
        'estado ' + reenvio.estado + ' ' + JSON.stringify(reenvio.cuerpo).slice(0, 300));
      const familiasTrasReenvio = (await cliente.query(`
        SELECT count(*)::int AS n FROM aps.familia_ficha ff JOIN aps.ficha f ON f.id = ff.ficha_id WHERE f.codigo = $1
      `, [completa.codigoFicha])).rows[0].n;
      verificar('  y no duplica familias', familiasTrasReenvio === 1, String(familiasTrasReenvio));
    }

    const leidaOtroEquipo = await leer(completa.codigoFicha, otroEquipoSesion.cabeceras);
    verificar('Otro equipo => 404 (no se confirma que exista)', leidaOtroEquipo.estado === 404, 'estado ' + leidaOtroEquipo.estado);
    const leidaAuxiliar = await leer(completa.codigoFicha, auxiliar.cabeceras);
    verificar('La auxiliar del mismo equipo, sobre la ficha de otra => 403', leidaAuxiliar.estado === 403, 'estado ' + leidaAuxiliar.estado);
    const leidaMaestro = await leer(completa.codigoFicha, maestro.cabeceras);
    verificar('El maestro la lee completa => 200', leidaMaestro.estado === 200, 'estado ' + leidaMaestro.estado);

    const auditada = (await cliente.query(`
      SELECT count(*)::int AS n FROM aud.acceso_sensible a JOIN aps.ficha f ON f.id = a.ficha_id
       WHERE f.codigo = $1 AND a.grupo_dato = 'ficha_completa'
    `, [completa.codigoFicha])).rows[0].n;
    verificar('  cada lectura completa quedó en aud.acceso_sensible', auditada >= 2, String(auditada));

    /* RN-016: el tope de 30 días es para registrar, no para corregir. */
    await cliente.query(`UPDATE aps.ficha SET fecha_diligenciamiento = CURRENT_DATE - 45 WHERE codigo = $1`, [completa.codigoFicha]);
    const vieja = await leer(completa.codigoFicha, maestro.cabeceras);
    const rVieja = vieja.estado === 200 ? await enviar(vieja.cuerpo.encuesta, maestro.cabeceras) : { estado: vieja.estado };
    verificar('Corregir una ficha ya registrada de hace 45 días => 200 (RN-016 no aplica)', rVieja.estado === 200,
      'estado ' + rVieja.estado + ' ' + JSON.stringify(rVieja.cuerpo || {}).slice(0, 300));
    const nuevaVieja = fichaValida(sello + 'fv');
    const hace45 = new Date(); hace45.setDate(hace45.getDate() - 45);
    nuevaVieja.fechaDiligenciamiento = hace45.toISOString().split('T')[0];
    nuevaVieja.yaRegistradaEnLaBase = true;
    const rNuevaVieja = await enviar(nuevaVieja, maestro.cabeceras);
    verificar('Una ficha NUEVA de hace 45 días sigue rechazada aunque el cuerpo diga «ya registrada»',
      rNuevaVieja.estado === 400 && bloqueoEn(rNuevaVieja.cuerpo, 'fechaDiligenciamiento'), 'estado ' + rNuevaVieja.estado);

    console.log('\n=== 6c. Anexo técnico SI-APS: variables nuevas ===');

    const anx = fichaValida(sello + 'ax');
    anx.direccionComponentes = {
      modo: 'urbana', viaTipo: 'CL', viaNumero: '45', viaLetra: 'A', viaBis: true, viaLetraBis: '',
      viaCuadrante: 'SUR', genNumero: '27', genLetra: 'B', genCuadrante: '', placa: '15', complementos: []
    };
    anx.fuenteAgua = ['acueducto_esp', 'aguas_lluvias'];
    anx.ambientesLuzNatural = ['cocina', 'sala_comedor'];
    anx.familias[0].cuidadorPrincipal = 'si';
    anx.familias[0].zaritPuntaje = 60;
    anx.familias[0].zarit = 'ausencia';                  // el cliente no decide: se deriva del puntaje
    /* Respuestas a preguntas que NO aplican: un POST armado a mano no debe
       poder dejarlas guardadas (sin tanque no hay limpieza del tanque; sin
       actividad económica no hay área de trabajo; colombiana sin estatus). */
    anx.frecuenciaLimpiezaTanque = 'semestral';
    anx.areaTrabajoIndependiente = 'si';
    anx.familias[0].integrantes[0].estatusMigratorio = 'sin_autorizacion';
    const rAnx = await enviar(anx);
    verificar('Ficha con las variables del anexo => 200', rAnx.estado === 200,
      'estado ' + rAnx.estado + ' ' + JSON.stringify(rAnx.cuerpo).slice(0, 300));
    if (rAnx.estado === 200) {
      const a = (await cliente.query(`
        SELECT h.tipo_ubicacion, h.consecutivo_sispro, v.alumbrado, v.frecuencia_limpieza_tanque,
               v.area_trabajo_independiente, v.fuente_agua,
               ff.alias_familia, ff.apgar_familiar, ff.zarit, ff.zarit_puntaje,
               i.lavado_manos, i.consumo_tabaco, i.estatus_migratorio,
               (SELECT array_agg(codigo ORDER BY codigo) FROM aps.vivienda_fuente_agua x WHERE x.ficha_id = f.id) AS fuentes,
               (SELECT array_agg(codigo ORDER BY codigo) FROM aps.vivienda_ambientes_luz_natural x WHERE x.ficha_id = f.id) AS luz,
               (SELECT array_agg(codigo ORDER BY codigo) FROM aps.ficha_situacion_inminente x WHERE x.ficha_id = f.id) AS situaciones
          FROM aps.ficha f
          JOIN aps.hogar h          ON h.id = f.hogar_id
          JOIN aps.vivienda v       ON v.ficha_id = f.id
          JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
          JOIN aps.integrante i     ON i.familia_ficha_id = ff.id
         WHERE f.codigo = $1`, [anx.codigoFicha])).rows[0] || {};
      verificar('  columnas del anexo en hogar, vivienda, familia e integrante',
        a.tipo_ubicacion === 'barrio' && a.alumbrado === 'electrica' && a.alias_familia === 'Familia Gomez' &&
        a.apgar_familiar === 'alta' && a.lavado_manos === 'si' && a.consumo_tabaco === 'no_aplica',
        JSON.stringify([a.tipo_ubicacion, a.alumbrado, a.alias_familia, a.apgar_familiar, a.lavado_manos, a.consumo_tabaco]));
      verificar('  el hogar recibió su consecutivo para el ID de vivienda (var. 123)',
        Number.isInteger(a.consecutivo_sispro) && a.consecutivo_sispro > 0, String(a.consecutivo_sispro));
      verificar('  ítem 46 selección múltiple: la lista en el puente y la principal en la columna',
        JSON.stringify(a.fuentes) === JSON.stringify(['acueducto_esp', 'aguas_lluvias']) && a.fuente_agua === 'acueducto_esp',
        JSON.stringify([a.fuentes, a.fuente_agua]));
      verificar('  pregunta múltiple del anexo en su puente', JSON.stringify(a.luz) === JSON.stringify(['cocina', 'sala_comedor']),
        JSON.stringify(a.luz));
      verificar('  ítem 2 en su puente', JSON.stringify(a.situaciones) === JSON.stringify(['no_aplica']), JSON.stringify(a.situaciones));
      verificar('  Zarit: se guarda el puntaje y la categoría se deriva en el servidor',
        a.zarit_puntaje === 60 && a.zarit === 'intensa', a.zarit_puntaje + ' / ' + a.zarit);
      verificar('  las respuestas que no aplican quedan vacías aunque el cuerpo las traiga',
        a.frecuencia_limpieza_tanque === null && a.area_trabajo_independiente === null && a.estatus_migratorio === null,
        JSON.stringify([a.frecuencia_limpieza_tanque, a.area_trabajo_independiente, a.estatus_migratorio]));

      /* Otro hogar del mismo microterritorio recibe el siguiente consecutivo. */
      const anx2 = fichaValida(sello + 'ay');
      anx2.familias[0].integrantes[0].numeroId = '1144055099';
      const rAnx2 = await enviar(anx2);
      const consecutivos = (await cliente.query(`
        SELECT h.codigo, h.consecutivo_sispro FROM aps.hogar h WHERE h.codigo = ANY($1) ORDER BY h.codigo`,
        [[anx.idHogar, anx2.idHogar]])).rows;
      verificar('  otro hogar del microterritorio => consecutivo distinto',
        rAnx2.estado === 200 && consecutivos.length === 2 &&
        consecutivos[0].consecutivo_sispro !== consecutivos[1].consecutivo_sispro,
        'estado ' + rAnx2.estado + ' ' + JSON.stringify(consecutivos));

      const leidaAnx = await leer(anx.codigoFicha, sesion.cabeceras);
      const ea = leidaAnx.cuerpo.encuesta || {};
      const fa = (ea.familias || [])[0] || {};
      const ia = (fa.integrantes || [])[0] || {};
      verificar('  ficha_completa devuelve las variables del anexo',
        ea.tipoUbicacion === 'barrio' && JSON.stringify(ea.ambientesLuzNatural) === JSON.stringify(['cocina', 'sala_comedor']) &&
        JSON.stringify(ea.fuenteAgua) === JSON.stringify(['acueducto_esp', 'aguas_lluvias']) &&
        JSON.stringify(ea.situacionInminente) === JSON.stringify(['no_aplica']) &&
        fa.aliasFamilia === 'Familia Gomez' && fa.zaritPuntaje === 60 && ia.lavadoManos === 'si' &&
        ia.zonaEndemica === 'ninguna' && ia.ocupacion === '5223',
        JSON.stringify([ea.tipoUbicacion, ea.ambientesLuzNatural, ea.fuenteAgua, ea.situacionInminente,
          fa.aliasFamilia, fa.zaritPuntaje, ia.lavadoManos, ia.zonaEndemica, ia.ocupacion]));
      const reenvioAnx = leidaAnx.estado === 200 ? await enviar(ea) : { estado: leidaAnx.estado };
      verificar('  y lo leído se vuelve a guardar tal cual => 200', reenvioAnx.estado === 200,
        'estado ' + reenvioAnx.estado + ' ' + JSON.stringify(reenvioAnx.cuerpo || {}).slice(0, 300));
    }

    const tanqueMalo = fichaValida(sello + 'az');
    tanqueMalo.tanqueAlmacenamiento = 'bajo_suelo_sin_tapa';
    const rTanque = await enviar(tanqueMalo);
    verificar('Opción inexistente en una pregunta del anexo => 400 y señala el campo',
      rTanque.estado === 400 && bloqueoEn(rTanque.cuerpo, 'tanqueAlmacenamiento'), 'estado ' + rTanque.estado);

    const sinAnexo = fichaValida(sello + 'a0');
    delete sinAnexo.alumbrado;
    const rSinAnexo = await enviar(sinAnexo);
    verificar('Sin una variable obligatoria del anexo => 400 (A2.37)',
      rSinAnexo.estado === 400 && bloqueoEn(rSinAnexo.cuerpo, 'alumbrado'), 'estado ' + rSinAnexo.estado);

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

    console.log('\n=== 12. Plan de cuidado diferido (RN-220 / RN-222) ===');

    /* La ficha entra sin plan: la fila vacía que deja el formulario no cuenta
       como acción, y una alerta INMEDIATA sin conducta ya no bloquea. Queda
       marcada como pendiente, y el historial lo dice. */
    const sinPlan = fichaValida(sello + 'p');
    sinPlan.familias[0].integrantes[0].ideacionSuicida = 'ha_pensado';   // RN-202, INMEDIATA
    sinPlan.planVivienda = {
      codigoEbs: sinPlan.equipoSaludId, codigoVivienda: sinPlan.idHogar,
      acciones: [{ ejecutorTipoId: null, ejecutorNumeroId: '', codigoAccion: null, procedimientoRealizado: '' }],
      seguimientos: [{ seguimientoTipoId: '', seguimientoNumeroId: null, accionConcertada: null }]
    };
    rp = await enviar(sinPlan);
    verificar('Riesgo suicida sin plan y con fila vacía => 200', rp.estado === 200,
      'estado ' + rp.estado + ' ' + JSON.stringify(rp.cuerpo).slice(0, 250));
    verificar('  la respuesta marca el plan como pendiente',
      rp.cuerpo.planCuidado && rp.cuerpo.planCuidado.pendiente === true &&
      rp.cuerpo.planCuidado.alertasSinConducta === 1,
      JSON.stringify(rp.cuerpo.planCuidado));

    const listado = await fetch(BASE + '/api/listar_fichas', { headers: sesion.cabeceras }).then(function (r) { return r.json(); });
    const filaSinPlan = (Array.isArray(listado) ? listado : []).find(function (f) {
      return f.codigoFicha === 'F-TEST-' + sello + 'p';
    });
    verificar('  el historial la lista con plan pendiente',
      !!filaSinPlan && filaSinPlan.planCuidado && filaSinPlan.planCuidado.pendiente === true &&
      filaSinPlan.planCuidado.accionesRegistradas === 0,
      JSON.stringify(filaSinPlan && filaSinPlan.planCuidado));

    /* Completar el plan después: la misma ficha se reenvía con la conducta y
       la marca desaparece, sin crear otra ficha. */
    const conPlan = fichaValida(sello + 'p');
    conPlan.familias[0].integrantes[0].ideacionSuicida = 'ha_pensado';
    conPlan.familias[0].integrantes[0].planPersona = {
      codigoEbs: conPlan.equipoSaludId, codigoVivienda: conPlan.idHogar, codigoFamilia: conPlan.idFamilia,
      tipoIdIntegrante: 'CC', numeroIdIntegrante: '1144099887',
      acciones: [{ ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
        codigoAccion: 'NC-FAM-01', tipoRespuesta: 'derivada', institucionDestino: 'ESE Ladera' }],
      seguimientos: []
    };
    rp = await enviar(conPlan);
    verificar('Al completar el plan después => 200', rp.estado === 200,
      'estado ' + rp.estado + ' ' + JSON.stringify(rp.cuerpo).slice(0, 250));
    verificar('  y el plan deja de estar pendiente',
      rp.cuerpo.planCuidado && rp.cuerpo.planCuidado.pendiente === false,
      JSON.stringify(rp.cuerpo.planCuidado));
    const unaSola = await cliente.query('SELECT count(*)::int AS n FROM aps.ficha WHERE codigo = $1',
      ['F-TEST-' + sello + 'p']);
    verificar('  sin duplicar la ficha', unaSola.rows[0].n === 1, String(unaSola.rows[0].n));
    const listado2 = await fetch(BASE + '/api/listar_fichas', { headers: sesion.cabeceras }).then(function (r) { return r.json(); });
    const filaConPlan = (Array.isArray(listado2) ? listado2 : []).find(function (f) {
      return f.codigoFicha === 'F-TEST-' + sello + 'p';
    });
    verificar('  el historial la muestra con plan registrado',
      !!filaConPlan && filaConPlan.planCuidado && filaConPlan.planCuidado.pendiente === false,
      JSON.stringify(filaConPlan && filaConPlan.planCuidado));

    console.log('\n=== 13. Archivo plano APS124CCFP (reporte SI-APS) ===');

    const pedirReporte = async function (cabeceras, cuerpo, metodo) {
      const x = await fetch(BASE + '/api/reporte_sispro', {
        method: metodo || 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, cabeceras),
        body: metodo === 'GET' ? undefined : JSON.stringify(cuerpo)
      });
      const texto = await x.text();
      let json = null;
      try { json = JSON.parse(texto); } catch (error) { json = null; }
      return { estado: x.status, texto: texto, cuerpo: json, cabeceras: x.headers };
    };
    const hoy = hoyIso();

    let rr = await pedirReporte(sesion.cabeceras, { desde: hoy, hasta: hoy });
    verificar('Una profesional asistencial no genera el reporte => 403', rr.estado === 403, 'estado ' + rr.estado);
    rr = await pedirReporte({ Cookie: maestro.cabeceras.Cookie }, { desde: hoy, hasta: hoy });
    verificar('Sin la cabecera anti-CSRF => 403', rr.estado === 403, 'estado ' + rr.estado);
    rr = await pedirReporte(maestro.cabeceras, null, 'GET');
    verificar('Por GET => 405 (un enlace no lo dispara)', rr.estado === 405, 'estado ' + rr.estado);
    rr = await pedirReporte(maestro.cabeceras, { desde: '2026-02-30', hasta: hoy });
    verificar('Fecha imposible => 400', rr.estado === 400, 'estado ' + rr.estado);
    rr = await pedirReporte(maestro.cabeceras, { desde: '2024-01-01', hasta: '2026-01-01' });
    verificar('Período de más de un año => 400', rr.estado === 400, 'estado ' + rr.estado);
    rr = await pedirReporte(maestro.cabeceras, { desde: hoy, hasta: hoy, formato: 'pdf' });
    verificar('Formato desconocido => 400', rr.estado === 400, 'estado ' + rr.estado);

    const resumenReporte = await pedirReporte(maestro.cabeceras, { desde: hoy, hasta: hoy, formato: 'resumen' });
    const cr = resumenReporte.cuerpo || {};
    verificar('El maestro pide el resumen => 200 con el nombre oficial del archivo',
      resumenReporte.estado === 200 && /^APS124CCFP\d{8}NI000805027289\.TXT$/.test(cr.nombreArchivo || ''),
      'estado ' + resumenReporte.estado + ' ' + resumenReporte.texto.slice(0, 200));
    verificar('  incluye las fichas de prueba de hoy',
      cr.registros && cr.registros.tipo2 >= 1 && cr.registros.tipo3 >= 1, JSON.stringify(cr.registros));
    verificar('  el resumen no trae datos personales, sólo códigos de ficha',
      resumenReporte.texto.indexOf('1144099887') === -1 && resumenReporte.texto.toUpperCase().indexOf('GOMEZ') === -1);

    const archivoReporte = await pedirReporte(admin.cabeceras, { desde: hoy, hasta: hoy, formato: 'archivo' });
    verificar('El administrador descarga el archivo => 200 como adjunto',
      archivoReporte.estado === 200 &&
      /attachment; filename="APS124CCFP\d{8}NI000805027289\.TXT"/.test(archivoReporte.cabeceras.get('content-disposition') || ''),
      'estado ' + archivoReporte.estado + ' ' + archivoReporte.cabeceras.get('content-disposition'));
    const lineasReporte = archivoReporte.texto.split('\r\n');
    lineasReporte.pop();
    const control = (lineasReporte[0] || '').split('|');
    verificar('  el registro de control cuenta los registros de detalle',
      control[0] === '1' && control[1] === 'NI' && control[2] === '805027289' && control[3] === hoy &&
      Number(control[5]) === lineasReporte.length - 1, lineasReporte[0]);
    verificar('  cada tipo 2 lleva 125 variables y cada tipo 3, 119',
      lineasReporte.length > 1 && lineasReporte.slice(1).every(function (l) {
        return (l[0] === '2' && l.split('|').length === 125) || (l[0] === '3' && l.split('|').length === 119);
      }));
    verificar('  la persona de prueba está en un registro tipo 3',
      lineasReporte.some(function (l) { return l[0] === '3' && l.split('|')[7] === '1144099887'; }));
    const auditoriaReporte = (await cliente.query(`
      SELECT count(*)::int AS n
        FROM aud.evento e JOIN aps.usuario u ON u.funcionario_id = e.funcionario_id
       WHERE e.entidad = 'reporte_sispro' AND u.documento = ANY($1) AND e.ocurrido_en > now() - interval '10 minutes'
    `, [['1144099010', '1144099011']])).rows[0].n;
    verificar('  cada generación quedó en aud.evento', auditoriaReporte >= 2, String(auditoriaReporte));

    /* Limpieza. El orden importa: `familia` cuelga de `hogar` y la ficha
       arrastra en cascada su vivienda, familia_ficha e integrantes, pero no
       la identidad persistente del hogar ni la de la familia (RN-025/026). */
    await cliente.query('DELETE FROM aps.ficha WHERE codigo LIKE $1', ['F-TEST-%']);
    await cliente.query('DELETE FROM aps.familia WHERE codigo LIKE $1', ['FM-TEST-%']);
    await cliente.query('DELETE FROM aps.hogar WHERE codigo LIKE $1', ['HG-TEST-%']);
    await cliente.query('DELETE FROM aps.persona WHERE numero_id = ANY($1)', [['1144099887', 'E1234567']]);
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
