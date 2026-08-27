/* =========================================================================
   Del formulario a la base, sin atajos.
   -------------------------------------------------------------------------
       node pruebas/extremo_a_extremo.test.js   (requiere base y servidor)

   POR QUÉ

   Las demás pruebas cubren tramos: `campos_catalogo` comprueba que el
   formulario emite códigos, `endpoint` comprueba que un objeto bien formado
   se guarda. Ninguna comprueba la unión: que la ficha que sale del
   formulario de verdad —con sus selects, sus bloques repetibles y su
   recolección anidada— llegue a la base.

   Ese tramo es justo donde estaba la avería: el formulario enviaba
   'EMSSANAR' donde la base espera 'ESS024', y ninguna prueba lo veía porque
   cada una miraba su mitad.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { JSDOM } = require('jsdom');
const { Client } = require('pg');

const RAIZ = path.join(__dirname, '..');
const BASE = 'http://localhost:' + (process.env.PUERTO || 5173);

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
   1. Montar la aplicación como la carga el navegador
   --------------------------------------------------------- */

function montar() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
  const w = dom.window;

  const almacen = {};
  Object.defineProperty(w, 'localStorage', {
    value: {
      getItem: function (k) { return k in almacen ? almacen[k] : null; },
      setItem: function (k, v) { almacen[k] = String(v); },
      removeItem: function (k) { delete almacen[k]; }
    },
    configurable: true
  });
  w.navigator.geolocation = { getCurrentPosition: function () {} };
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  w.HTMLElement.prototype.scrollIntoView = function () {};

  const fuentes = ['catalogos.js', 'direccion.js', 'geocodificacion.js',
    'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'app.js']
    .map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); })
    .join('\n;\n');

  w.eval(fuentes + ';\nwindow.__api = { recolectarDatosFormulario: recolectarDatosFormulario,' +
    ' construirEncuestaDesdeDatos: construirEncuestaDesdeDatos,' +
    ' propagarLlavesHeredadas: propagarLlavesHeredadas,' +
    ' fijarCatalogoAcciones: fijarCatalogoAcciones,' +
    ' repintarSelectsDeAccion: repintarSelectsDeAccion };');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

  /* Los códigos de acción del plan (ítems 114, 124 y 136a) dejaron de ser
     texto libre: ahora salen de un <select> que la aplicación puebla pidiendo
     /api/catalogo_acciones. Aquí no hay red —es deliberado, la prueba
     comprueba que el resto del formulario no la necesita—, así que el
     catálogo se inyecta directamente en vez de simular la petición. */
  w.__api.fijarCatalogoAcciones(ACCIONES_DEL_PLAN);
  w.__api.repintarSelectsDeAccion();

  return w;
}

/* Las acciones que usa esta prueba, con la forma que devuelve el endpoint. */
const ACCIONES_DEL_PLAN = [
  { codigo: 'NC-AMB-07', nombre: 'Visita de seguimiento por entorno de alto riesgo sanitario', ambito: 'vivienda' },
  { codigo: 'NC-FAM-02', nombre: 'Evaluación de relevo del cuidador principal por sobrecarga', ambito: 'familia' },
  { codigo: 'NC-GES-06', nombre: 'Asignación de cita con verificación de asistencia', ambito: 'persona' }
];

/* ---------------------------------------------------------
   2. Diligenciar el formulario
   --------------------------------------------------------- */

function ponerValor(doc, w, selector, valor) {
  const el = doc.querySelector(selector);
  if (!el) return false;
  el.value = valor;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
  return true;
}

function marcar(doc, w, nombre, valores) {
  const lista = Array.isArray(valores) ? valores : [valores];
  let marcados = 0;
  lista.forEach(function (valor) {
    const el = doc.querySelector('[name="' + nombre + '"][value="' + valor + '"]');
    if (!el) return;
    el.checked = true;
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
    marcados++;
  });
  return marcados === lista.length;
}

function diligenciar(w, sufijo) {
  const doc = w.document;
  const noEncontrados = [];
  const hoy = new Date().toISOString().split('T')[0];
  const enDias = function (n) {
    const f = new Date();
    f.setDate(f.getDate() + n);
    return f.toISOString().split('T')[0];
  };

  const escalares = [
    ['#uzpe', 'UZPE006'],
    ['[name="areaUbicacion"]', 'urbana'],
    ['[name="territorio"]', 'T48'],
    ['[name="divisionTerritorial"]', 'Barrio San Cayetano'],
    ['#equipoSaludId', 'EBSE2E'],
    ['[name="prestadorPrimario"]', 'PROV-ESE-LADERA'],
    ['[name="responsableTipoId"]', 'CC'],
    ['[name="responsableNumeroId"]', '1144012345'],
    ['[name="perfilProfesional"]', 'enfermeria'],
    ['[name="codigoFicha"]', 'F-E2E-' + sufijo],
    ['[name="fechaDiligenciamiento"]', hoy],
    ['[name="entornoAbordaje"]', 'hogar'],
    ['[name="cabezaFamilia"]', 'María Pérez'],
    ['[name="idHogar"]', 'HG-E2E-' + sufijo],
    ['[name="idFamilia"]', 'FM-E2E-' + sufijo],
    ['[name="latitud"]', '3.45'],
    ['[name="longitud"]', '-76.53'],
    ['[name="ubicacionReferencia"]', 'Frente a la cancha'],
    ['[name="estrato"]', 'bajo'],
    ['[name="hogaresEnVivienda"]', '1'],
    ['[name="personasEnVivienda"]', '4'],
    ['[name="habitacionesVivienda"]', '2'],
    ['[name="elementosParaDormir"]', '3'],
    ['[name="tipoVivienda"]', 'casa'],
    ['[name="materialTecho"]', 'concreto'],
    ['#jovenesEnPaz', 'no'],
    /* Ítem 21: la dirección se compone por partes (RN-021). */
    ['#viaTipo', 'CL'],
    ['#viaNumero', '45'],
    ['#genNumero', '27'],
    ['#placa', '15'],
    /* Ítems 41 a 45: conteo de animales y cobertura antirrábica. */
    ['[name="perros"]', '0'],
    ['[name="perrosVacunados"]', '0'],
    ['[name="gatos"]', '0'],
    ['[name="gatosVacunados"]', '0'],
    ['[name="fuenteAgua"]', 'acueducto_esp'],
    ['[name="disposicionExcretas"]', 'alcantarillado'],
    ['[name="aguasResiduales"]', 'alcantarillado'],
    ['[name="residuosSolidos"]', 'servicio_aseo'],
    /* Integrante */
    ['[name="familias[0].integrantes[0].primerNombre"]', 'Ana'],
    ['[name="familias[0].integrantes[0].primerApellido"]', 'Gomez'],
    ['[name="familias[0].integrantes[0].numeroId"]', '1144099887'],
    ['[name="familias[0].integrantes[0].fechaNacimiento"]', '1996-05-10'],
    ['[name="familias[0].integrantes[0].nacionalidad"]', 'CO'],
    ['[name="familias[0].integrantes[0].telefono1"]', '3155551234'],
    ['[name="familias[0].integrantes[0].ocupacion"]', '5223'],
    ['[name="familias[0].integrantes[0].nivelEducativo"]', 'media_academica'],
    ['[name="familias[0].integrantes[0].regimenAfiliacion"]', 'subsidiado'],
    ['[name="familias[0].integrantes[0].eapb"]', 'ESS024'],
    ['[name="familias[0].integrantes[0].pertenenciaEtnica"]', 'ninguna'],
    /* Antropometría y tensión (ítems 92 a 99). */
    ['[name="familias[0].integrantes[0].peso"]', '65'],
    ['[name="familias[0].integrantes[0].talla"]', '160'],
    ['[name="familias[0].integrantes[0].circunferenciaCintura"]', '80'],
    ['[name="familias[0].integrantes[0].tensionSistolica"]', '118'],
    ['[name="familias[0].integrantes[0].tensionDiastolica"]', '75'],
    ['[name="familias[0].tipoFamilia"]', 'nuclear_monoparental'],
    ['[name="familias[0].numeroIntegrantes"]', '1'],
    /* Plan de cuidado de la vivienda (ítems 111 a 119). Los códigos de EBS y
       vivienda son de sólo lectura: los rellena propagarLlavesHeredadas. */
    ['[name="planVivienda.acciones[0].ejecutorTipoId"]', 'CC'],
    ['[name="planVivienda.acciones[0].ejecutorNumeroId"]', '1144012345'],
    ['[name="planVivienda.acciones[0].codigoAccion"]', 'NC-AMB-07'],
    /* Ítem 114, complemento: el procedimiento en palabras del profesional. */
    ['[name="planVivienda.acciones[0].procedimientoRealizado"]',
      'Se revisó la humedad del muro y se acordó ventilar a diario'],
    /* Seguimientos del plan (ítems 116 a 119). */
    ['[name="planVivienda.seguimientos[0].seguimientoTipoId"]', 'CC'],
    ['[name="planVivienda.seguimientos[0].seguimientoNumeroId"]', '1144012345'],
    ['[name="planVivienda.seguimientos[0].accionConcertada"]', 'Mejorar la ventilación de la cocina'],
    ['[name="planVivienda.seguimientos[0].seg1Fecha"]', hoy],
    ['[name="planVivienda.seguimientos[0].seg1Estado"]', 'C'],
    /* RN-119: el segundo seguimiento va después del primero. */
    ['[name="planVivienda.seguimientos[0].seg2Fecha"]', enDias(30)],
    ['[name="planVivienda.seguimientos[0].seg2Estado"]', 'C']
  ];

  escalares.forEach(function (par) {
    if (!ponerValor(doc, w, par[0], par[1])) noEncontrados.push(par[0]);
  });

  /* El microterritorio se repuebla al elegir territorio: va después. */
  if (!ponerValor(doc, w, '[name="microterritorio"]', 'MT01')) {
    noEncontrados.push('microterritorio');
  }

  const grupos = [
    ['consentimiento', 'si'],
    ['situacionInminente', 'no_aplica'],
    ['vectores', 'no'],
    ['actividadEconomica', 'no'],
    ['animales', 'ninguno'],
    ['riesgosAccidente', 'ninguno'],
    ['factoresContaminacion', 'ninguno'],
    ['familias[0].integrantes[0].tipoId', 'CC'],
    ['familias[0].integrantes[0].sexo', 'mujer'],
    ['familias[0].integrantes[0].genero', 'femenino'],
    ['familias[0].integrantes[0].autoidentificacionGenero', 'femenino'],
    ['familias[0].integrantes[0].orientacionSexual', 'heterosexual'],
    /* Grupos de radio construidos desde catálogo: se marcan, no se asignan. */
    ['familias[0].integrantes[0].rolFamiliar', 'responsable_economico'],
    ['familias[0].cuidadorPrincipal', 'no'],
    ['familias[0].redesApoyo', 'cuenta_protectoras'],
    ['familias[0].integrantes[0].sujetoEspecialProteccion', 'ninguna'],
    ['familias[0].integrantes[0].saberesAncestrales', 'ninguna'],
    ['familias[0].integrantes[0].discapacidad', 'sin_discapacidad'],
    ['familias[0].integrantes[0].practicasCuidado', 'alimentacion'],
    ['familias[0].integrantes[0].intencionReproductiva', 'no'],
    ['familias[0].integrantes[0].gestacionActual', 'no'],
    ['familias[0].integrantes[0].atencionesPendientesRpms', 'ninguna'],
    ['familias[0].integrantes[0].conocimientoDerecho', 'derechos_deberes'],
    ['familias[0].integrantes[0].lactanciaExclusiva', 'no_aplica'],
    ['familias[0].integrantes[0].certificacionRlcpd', 'no_aplica'],
    ['familias[0].integrantes[0].enfermedadesNoTransmisibles', 'ninguna'],
    ['familias[0].integrantes[0].condicionesTransmisibles', 'ninguna'],
    ['familias[0].integrantes[0].zonaEndemica', 'ninguna'],
    ['familias[0].integrantes[0].sintomatologiaDepresiva', 'ninguno'],
    ['familias[0].integrantes[0].ideacionSuicida', 'ninguno'],
    ['familias[0].integrantes[0].consumoSpa', 'no'],
    ['familias[0].integrantes[0].limitacionCotidiana', 'no'],
    ['familias[0].integrantes[0].clasificacionAntropometrica', 'normal'],
    ['familias[0].situacionesRiesgo', 'ninguna'],
    ['familias[0].practicasVinculo', 'escucha_activa'],
    ['familias[0].practicasCuidadoHogar', 'ventilacion'],
    ['planVivienda.acciones[0].tipoRespuesta', 'en_sitio']
  ];

  grupos.forEach(function (par) {
    if (!marcar(doc, w, par[0], par[1])) noEncontrados.push('grupo ' + par[0]);
  });

  /* RN-111 a RN-134: los códigos del plan se heredan de la ficha en vez de
     digitarse. La app lo hace al recalcular; aquí se invoca igual. */
  w.__api.propagarLlavesHeredadas();

  return noEncontrados;
}

/* ---------------------------------------------------------
   3. Ejecución
   --------------------------------------------------------- */

async function limpiar(cliente, sufijo) {
  await cliente.query("DELETE FROM aps.ficha WHERE codigo LIKE 'F-E2E-%'");
  /* El código de familia lo genera el servidor a partir del hogar (RN-026),
     así que se borra por hogar y no por patrón de código. */
  await cliente.query(`
    DELETE FROM aps.familia
     WHERE hogar_id IN (SELECT id FROM aps.hogar WHERE codigo LIKE 'HG-E2E-%')
        OR codigo LIKE 'FM-E2E-%'
  `);
  await cliente.query("DELETE FROM aps.hogar WHERE codigo LIKE 'HG-E2E-%'");
  await cliente.query("DELETE FROM aps.persona WHERE numero_id = '1144099887'");
}

async function principal() {
  const sufijo = Date.now().toString(36);

  console.log('\n=== 1. El formulario se diligencia con los controles reales ===');

  const w = montar();
  const faltantes = diligenciar(w, sufijo);

  verificar('todos los controles esperados existen en el formulario',
    faltantes.length === 0, faltantes.slice(0, 6).join(', '));

  const formulario = w.document.getElementById('formEncuesta') || w.document.querySelector('form');

  const datos = w.__api.recolectarDatosFormulario(formulario);

  /* RN-111/112: las llaves heredadas deben llegar al modelo. Se comprueba
     aquí porque se perdían en la recolección sin que nada lo delatara. */
  verificar('las llaves heredadas del plan llegan al modelo',
    !!(datos.planVivienda && datos.planVivienda.codigoEbs === 'EBSE2E' &&
       datos.planVivienda.codigoVivienda === 'HG-E2E-' + sufijo),
    JSON.stringify(datos.planVivienda && {
      codigoEbs: datos.planVivienda.codigoEbs,
      codigoVivienda: datos.planVivienda.codigoVivienda
    }));
  const encuesta = w.__api.construirEncuestaDesdeDatos(datos);

  verificar('el prestador salió como código',
    encuesta.prestadorPrimario === 'PROV-ESE-LADERA', String(encuesta.prestadorPrimario));

  const ing = encuesta.familias && encuesta.familias[0] && encuesta.familias[0].integrantes[0];
  verificar('la ocupación salió como código CIUO', ing && ing.ocupacion === '5223',
    ing ? String(ing.ocupacion) : 'sin integrante');
  verificar('la EAPB salió como código', ing && ing.eapb === 'ESS024',
    ing ? String(ing.eapb) : 'sin integrante');

  console.log('\n=== 2. Esa misma ficha llega a la base ===');

  const cliente = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: false
  });
  await cliente.connect();
  await limpiar(cliente, sufijo);

  const respuesta = await fetch(BASE + '/api/guardar_encuesta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encuesta)
  });
  const cuerpo = await respuesta.json().catch(function () { return {}; });

  verificar('la ficha del formulario se guarda => 200', respuesta.status === 200,
    'estado ' + respuesta.status + ' ' +
    (cuerpo.bloqueos
      ? cuerpo.bloqueos.slice(0, 4).map(function (b) {
        return b.codigo + '@' + b.ruta + ': ' + b.mensaje;
      }).join(' | ')
      : JSON.stringify(cuerpo).slice(0, 200)));

  if (respuesta.status === 200) {
    const fila = await cliente.query(`
      SELECT f.prestador_codigo, i.ocupacion_codigo, i.eapb_codigo,
             pr.nombre AS prestador, oc.nombre AS ocupacion, ea.nombre AS aseguradora
        FROM aps.ficha f
        JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
        JOIN aps.integrante i     ON i.familia_ficha_id = ff.id
        LEFT JOIN cat.prestador pr      ON pr.codigo = f.prestador_codigo
        LEFT JOIN cat.ocupacion_ciuo oc ON oc.codigo = i.ocupacion_codigo
        LEFT JOIN cat.eapb ea           ON ea.codigo = i.eapb_codigo
       WHERE f.codigo = $1
    `, [encuesta.codigoFicha]);

    const g = fila.rows[0] || {};
    verificar('  el prestador resuelve contra el catálogo',
      g.prestador === 'E.S.E. Ladera', String(g.prestador));
    verificar('  la ocupación resuelve contra CIUO',
      g.ocupacion === 'Vendedor de tienda o almacén', String(g.ocupacion));
    verificar('  la EAPB resuelve contra el catálogo',
      g.aseguradora === 'Emssanar ESS', String(g.aseguradora));

    console.log('\n=== 3. Los datos clínicos del integrante ya no se pierden ===');

    const clinico = await cliente.query(`
      SELECT i.peso, i.talla, i.imc, i.circunferencia_cintura,
             i.tension_sistolica, i.tension_diastolica, i.clasificacion_tension,
             i.clasificacion_antropometrica, i.telefono1,
             i.gestacion_actual, i.intencion_reproductiva, i.ideacion_suicida,
             i.consumo_spa, i.certificacion_rlcpd
        FROM aps.integrante i
        JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
        JOIN aps.ficha f          ON f.id = ff.ficha_id
       WHERE f.codigo = $1
    `, [encuesta.codigoFicha]);

    const c = clinico.rows[0] || {};
    verificar('  peso y talla', Number(c.peso) === 65 && Number(c.talla) === 160,
      c.peso + ' / ' + c.talla);
    verificar('  IMC calculado', Number(c.imc) === 25.39, String(c.imc));
    verificar('  tensión arterial y su clasificación',
      c.tension_sistolica === 118 && c.tension_diastolica === 75 && c.clasificacion_tension === 'normal',
      c.tension_sistolica + '/' + c.tension_diastolica + ' ' + c.clasificacion_tension);
    verificar('  clasificación antropométrica',
      c.clasificacion_antropometrica === 'normal', String(c.clasificacion_antropometrica));
    verificar('  teléfono de contacto (RN-070)', c.telefono1 === '3155551234', String(c.telefono1));
    verificar('  gestación e intención reproductiva',
      c.gestacion_actual === false && c.intencion_reproductiva === false,
      c.gestacion_actual + ' / ' + c.intencion_reproductiva);
    verificar('  ideación suicida como booleano (ítem 107)',
      c.ideacion_suicida === false, String(c.ideacion_suicida));

    console.log('\n=== 4. El plan de cuidado se persiste ===');

    verificar('  el endpoint informa filas de plan',
      typeof cuerpo.filasPlanCuidado === 'number' && cuerpo.filasPlanCuidado > 0,
      String(cuerpo.filasPlanCuidado));

    const plan = await cliente.query(`
      SELECT pc.ambito, pc.codigo_ebs, pc.codigo_vivienda,
             (SELECT count(*)::int FROM aps.plan_accion      pa WHERE pa.plan_id = pc.id) AS acciones,
             (SELECT count(*)::int FROM aps.plan_seguimiento ps WHERE ps.plan_id = pc.id) AS seguimientos
        FROM aps.plan_cuidado pc
        JOIN aps.ficha f ON f.id = pc.ficha_id
       WHERE f.codigo = $1
    `, [encuesta.codigoFicha]);

    const pv = plan.rows.find(function (x) { return x.ambito === 'vivienda'; });
    verificar('  existe el plan de vivienda', !!pv, JSON.stringify(plan.rows));

    if (pv) {
      verificar('  con las llaves heredadas correctas',
        pv.codigo_ebs === 'EBSE2E' && pv.codigo_vivienda === 'HG-E2E-' + sufijo,
        pv.codigo_ebs + ' / ' + pv.codigo_vivienda);
      verificar('  con su acción registrada', pv.acciones === 1, String(pv.acciones));
      verificar('  con su seguimiento registrado', pv.seguimientos === 1, String(pv.seguimientos));
    }

    const accion = await cliente.query(`
      SELECT pa.codigo_accion, pa.tipo_respuesta, pa.procedimiento_realizado,
             cu.nombre AS accion,
             fu.tipo_id, fu.numero_id
        FROM aps.plan_accion pa
        JOIN aps.plan_cuidado pc ON pc.id = pa.plan_id
        JOIN aps.ficha f         ON f.id = pc.ficha_id
        JOIN cat.cups cu         ON cu.codigo = pa.codigo_accion
        JOIN aps.funcionario fu  ON fu.id = pa.ejecutor_id
       WHERE f.codigo = $1
    `, [encuesta.codigoFicha]);

    const a = accion.rows[0] || {};
    verificar('  la acción resuelve contra CUPS/NoCUPS',
      a.accion === 'Visita de seguimiento por entorno de alto riesgo sanitario',
      String(a.accion));
    verificar('  el ejecutor quedó registrado como funcionario',
      a.tipo_id === 'CC' && a.numero_id === '1144012345',
      a.tipo_id + ' ' + a.numero_id);
    /* El código no basta: la codificación es cerrada y el profesional tiene
       que poder dejar escrito qué hizo (ítems 114 / 124 / 136a). */
    verificar('  el procedimiento escrito por el profesional se persiste',
      a.procedimiento_realizado === 'Se revisó la humedad del muro y se acordó ventilar a diario',
      JSON.stringify(a.procedimiento_realizado));

    console.log('\n=== 5. Las alertas se persisten (RN-200 a RN-212) ===');

    const alertas = await cliente.query(`
      SELECT al.regla_codigo, al.ambito, al.prioridad, al.bloquea_cierre,
             al.vence_en IS NOT NULL AS tiene_vencimiento
        FROM aps.alerta al
        JOIN aps.ficha f ON f.id = al.ficha_id
       WHERE f.codigo = $1
       ORDER BY al.regla_codigo
    `, [encuesta.codigoFicha]);

    verificar('  el endpoint informa cuántas alertas escribió',
      typeof cuerpo.alertas === 'number', String(cuerpo.alertas));
    verificar('  el número informado coincide con la base',
      alertas.rows.length === cuerpo.alertas,
      alertas.rows.length + ' en base, ' + cuerpo.alertas + ' informadas');

    if (alertas.rows.length > 0) {
      verificar('  el disparador calculó el vencimiento (RN-200)',
        alertas.rows.every(function (x) { return x.tiene_vencimiento; }));
      verificar('  cada alerta tiene ámbito coherente',
        alertas.rows.every(function (x) {
          return ['vivienda', 'familia', 'persona'].indexOf(x.ambito) !== -1;
        }),
        alertas.rows.map(function (x) { return x.regla_codigo + ':' + x.ambito; }).join(', '));
    }
  }

  await limpiar(cliente, sufijo);
  await cliente.end();

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas === 0 ? 0 : 1);
}

/* El servidor se levanta solo si no está corriendo, para que la prueba
   funcione tanto suelta como dentro de `npm run test:todo`. */
async function servidorArriba() {
  try {
    const r = await fetch(BASE + '/index.html');
    return r.ok;
  } catch (error) {
    return false;
  }
}

async function conServidor() {
  let proceso = null;

  if (!(await servidorArriba())) {
    proceso = spawn('node', ['servidor.js'], { cwd: RAIZ, stdio: 'ignore' });

    let intentos = 0;
    while (intentos < 40 && !(await servidorArriba())) {
      await new Promise(function (r) { setTimeout(r, 200); });
      intentos++;
    }

    if (!(await servidorArriba())) {
      console.error('  No fue posible levantar el servidor local.');
      if (proceso) proceso.kill();
      process.exit(1);
    }
  }

  try {
    await principal();
  } finally {
    if (proceso) proceso.kill();
  }
}

conServidor().catch(function (error) {
  console.error('  Error en la prueba:', error);
  process.exit(1);
});
