/* =========================================================================
   Corregir una ficha rechazada, sin volver a diligenciarla
   -------------------------------------------------------------------------
       npx playwright test pruebas/e2e/correccion.spec.js

   QUÉ REPRODUCE

   El caso real que dejó una ficha atrapada: se capturó cuando el código de
   acción del plan era texto libre, quedó guardada con un código inexistente,
   y desde entonces la API la rechazaba en cada sincronización sin que hubiera
   forma de arreglarla. El historial sólo ofrecía «Ver» y «Eliminar»: corregir
   un dato costaba volver a diligenciar la visita entera o perderla.

   La ficha se siembra directamente en el almacenamiento del navegador —es lo
   que hace verosímil el escenario: una ficha que hoy el formulario ya no
   podría producir— y desde ahí se prueba el camino completo:

     1. Sincronizar la rechaza y dice cuál es el campo.
     2. «Corregir» la devuelve al formulario con sus respuestas puestas.
     3. Se arregla lo señalado y se guarda.
     4. La ficha entra a la base y el historial no queda con dos copias.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });

const { test, expect } = require('@playwright/test');
const ayudas = require('./ayudas');
const flujo = require('./diligenciar');

const SUFIJO = Date.now().toString(36).toUpperCase();
const CODIGO = 'F-COR-' + SUFIJO;

/* El código que la ficha trae guardado y que la base no reconoce. */
const CODIGO_INVALIDO = 'CUPS-INVENTADO-99';
/* El que se elegirá del catálogo para repararla. */
const CODIGO_VALIDO = 'NC-AMB-08';

const DOCUMENTOS = ['1122334455'];

async function limpiarBase() {
  const { Client } = require('pg');
  const cliente = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: false
  });
  await cliente.connect();
  try {
    await cliente.query("DELETE FROM aps.ficha WHERE codigo LIKE 'F-COR-%'");
    await cliente.query(`
      DELETE FROM aps.familia
       WHERE hogar_id IN (SELECT id FROM aps.hogar WHERE codigo LIKE 'HG-COR-%')
    `);
    await cliente.query("DELETE FROM aps.hogar WHERE codigo LIKE 'HG-COR-%'");
    await cliente.query('DELETE FROM aps.persona WHERE numero_id = ANY($1)', [DOCUMENTOS]);
  } finally {
    await cliente.end();
  }
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(limpiarBase);
test.afterAll(limpiarBase);

test('Una ficha rechazada se corrige y llega a la base', async function ({ page }, infoPrueba) {
  const diario = ayudas.crearDiario();
  ayudas.vigilar(page, diario);

  /* =====================================================================
     1. Una ficha válida, con un solo defecto: el código de acción
     =====================================================================
     Se diligencia con el formulario y se guarda, para no inventar a mano la
     forma del objeto —que es justo donde una prueba se desincroniza del
     código—. Después se le estropea el código en el almacenamiento, que es lo
     que la interfaz ya no permite hacer. */

  const FICHA = fichaDePrueba();

  await flujo.diligenciarEncuesta(page, diario, FICHA, [personaDePrueba()]);
  const cierre = await flujo.cerrarYGuardar(page, diario, FICHA);

  expect(cierre.guardo, 'la ficha de partida no se pudo guardar').toBe(true);
  expect(cierre.respuestaApi && cierre.respuestaApi.estado,
    'la ficha de partida no llegó a la base').toBe(200);

  diario.entrarA('1. Se estropea el código de acción, como estaba la ficha real');

  const estropeada = await page.evaluate(function (datos) {
    const todas = JSON.parse(localStorage.getItem('aps_encuestas') || '[]');
    const ficha = todas.find(function (e) { return e.codigoFicha === datos.codigo; });
    if (!ficha) return null;

    ficha.planVivienda.acciones[0].codigoAccion = datos.invalido;
    ficha.sincronizada = false;   // vuelve a quedar pendiente

    localStorage.setItem('aps_encuestas', JSON.stringify(todas));
    return { id: ficha.id, codigoAccion: ficha.planVivienda.acciones[0].codigoAccion };
  }, { codigo: FICHA.codigo, invalido: CODIGO_INVALIDO });

  expect(estropeada, 'no se encontró la ficha recién guardada').not.toBeNull();
  diario.ok('La ficha quedó con un código que la base no reconoce', estropeada.codigoAccion);

  /* =====================================================================
     2. Sincronizar la rechaza y dice por qué
     ===================================================================== */

  diario.entrarA('2. La sincronización la rechaza');
  await ayudas.anunciar(page, 'La ficha guardada ya no es válida: sincronizar la rechaza');

  await page.reload();
  await esperarCatalogos(page);
  await page.getByRole('button', { name: 'Inicio' }).click();
  await page.getByRole('button', { name: 'Sincronizar a la Nube' }).click();
  await page.waitForTimeout(1500);

  const avisosRechazo = await ayudas.leerAvisos(page);
  avisosRechazo.forEach(function (a) { console.log('   • aviso [' + a.tipo + '] ' + a.texto); });

  /* Lo que importa es que el aviso nombre el campo que falla, no una palabra
     concreta: el mensaje cambia según por qué falle el código —mal formado, o
     bien formado pero inexistente en `cat.cups`— y las dos formas nombran
     CUPS. Atarse al texto exacto convierte cualquier mejora del mensaje en un
     fallo de la prueba. */
  const explico = avisosRechazo.some(function (a) {
    return a.tipo === 'error' && a.texto.indexOf('CUPS') !== -1;
  });

  if (explico) diario.ok('El aviso nombra el problema, sin mandar a la consola');
  else diario.problema('Sincronización', 'el rechazo no explica qué campo falla',
    avisosRechazo.map(function (a) { return a.tipo + ': ' + a.texto; }).join(' | '));

  /* =====================================================================
     3. «Corregir» devuelve la ficha al formulario
     ===================================================================== */

  diario.entrarA('3. Se corrige desde el historial');
  await ayudas.anunciar(page, 'Corregir: la ficha vuelve al formulario con sus respuestas');

  /* La pestaña, no el botón «Ver historial completo» de la portada. */
  await page.locator('#appTabs button[data-view="historial"]').click();

  const filaFicha = page.locator('#historialTableBody tr', { hasText: CODIGO });
  await expect(filaFicha, 'la ficha no aparece en el historial').toHaveCount(1);

  await filaFicha.getByRole('button', { name: 'Corregir' }).click();

  await expect(page.locator('#view-nueva'),
    'Corregir no llevó al formulario').toHaveClass(/is-active/);
  await expect(page.locator('#avisoCorreccion'),
    'no se avisó que se está corrigiendo, no capturando').toBeVisible();

  diario.ok('La ficha se abrió en modo corrección');

  /* Lo que importa: que las respuestas volvieran, no sólo que el formulario
     se abriera. Se comprueban campos de secciones distintas —ficha, vivienda,
     integrante y plan— para no dar por bueno un rellenado parcial. */
  const recuperados = await page.evaluate(function () {
    const leer = function (nombre) {
      const el = document.querySelector('[name="' + nombre + '"]');
      return el ? el.value : null;
    };
    const marcado = function (nombre) {
      const el = document.querySelector('[name="' + nombre + '"]:checked');
      return el ? el.value : null;
    };
    return {
      codigoFicha: leer('codigoFicha'),
      idHogar: leer('idHogar'),
      territorio: leer('territorio'),
      microterritorio: leer('microterritorio'),
      estrato: leer('estrato'),
      consentimiento: marcado('consentimiento'),
      animales: marcado('animales'),
      primerNombre: leer('familias[0].integrantes[0].primerNombre'),
      numeroId: leer('familias[0].integrantes[0].numeroId'),
      peso: leer('familias[0].integrantes[0].peso'),
      imc: leer('familias[0].integrantes[0].imc'),
      sexo: marcado('familias[0].integrantes[0].sexo'),
      codigoAccion: leer('planVivienda.acciones[0].codigoAccion'),
      accionConcertada: leer('planVivienda.seguimientos[0].accionConcertada')
    };
  });

  console.log('\n   Respuestas recuperadas en el formulario:');
  Object.keys(recuperados).forEach(function (k) {
    console.log('     ' + k.padEnd(18) + ' ' + JSON.stringify(recuperados[k]));
  });

  const esperados = {
    codigoFicha: FICHA.codigo,
    idHogar: FICHA.hogar,
    territorio: FICHA.territorio,
    microterritorio: FICHA.microterritorio,
    estrato: FICHA.estrato,
    consentimiento: 'si',
    animales: FICHA.animales,
    primerNombre: 'Beatriz',
    numeroId: DOCUMENTOS[0],
    sexo: 'mujer',
    accionConcertada: FICHA.planVivienda.accionConcertada
  };

  Object.keys(esperados).forEach(function (campo) {
    if (recuperados[campo] === esperados[campo]) {
      diario.ok('Se recuperó ' + campo, recuperados[campo]);
    } else {
      diario.problema('Corrección: ' + campo, 'no se recuperó del registro guardado',
        'se esperaba "' + esperados[campo] + '" y quedó "' + recuperados[campo] + '"');
    }
  });

  /* El IMC es derivado: tiene que recalcularse solo al reponer peso y talla. */
  if (recuperados.imc && recuperados.imc !== '—') {
    diario.ok('El IMC se recalculó al recuperar peso y talla', recuperados.imc);
  } else {
    diario.problema('Corrección: IMC', 'no se recalculó tras cargar la ficha');
  }

  /* El código inválido sí vuelve al campo —ahora se escribe, no se elige de
     una lista cerrada—, y es mejor así: el encuestador ve QUÉ estaba mal. Lo
     que tiene que aparecer es el aviso de que ese código no está en el
     catálogo, y en el momento, no al sincronizar. */
  if (recuperados.codigoAccion === CODIGO_INVALIDO) {
    diario.ok('El código rechazado vuelve al campo, para poder verlo', recuperados.codigoAccion);
  } else {
    diario.problema('Corrección: codigoAccion',
      'el código que hay que corregir no se restauró',
      'se esperaba "' + CODIGO_INVALIDO + '" y quedó "' + recuperados.codigoAccion + '"');
  }

  const avisoCups = page.locator('#filasAccionVivienda .combo-cups__nombre').first();
  await expect(avisoCups, 'no se avisó de que el código no está en el catálogo')
    .toHaveClass(/combo-cups__nombre--error/, { timeout: 10000 });
  diario.ok('El buscador avisa de que ese código no está en el catálogo',
    (await avisoCups.textContent()).trim());

  /* =====================================================================
     4. Se arregla y se guarda
     ===================================================================== */

  diario.entrarA('4. Se elige un código válido y se guarda');
  await ayudas.anunciar(page, 'Se corrige el código y se guarda: ahora sí entra a la base');

  await ayudas.buscarCups(page, diario, 'planVivienda.acciones[0].codigoAccion',
    CODIGO_VALIDO, 'Código de la acción (corregido)');

  const esperaApi = page.waitForResponse(function (r) {
    return r.url().indexOf('/api/guardar_encuesta') !== -1;
  }, { timeout: 30000 });

  await page.locator('#btnGuardar').click();

  const respuesta = await esperaApi.catch(function () { return null; });
  await page.waitForTimeout(1200);

  if (!respuesta) {
    diario.problema('Guardado', 'la corrección no llamó a /api/guardar_encuesta');
  } else if (respuesta.status() === 200) {
    diario.ok('La ficha corregida entró a la base', 'HTTP 200');
  } else {
    const cuerpo = await respuesta.json().catch(function () { return {}; });
    diario.problema('Guardado', 'la API rechazó la corrección (HTTP ' + respuesta.status() + ')',
      (cuerpo.bloqueos || []).map(function (b) { return b.ruta + ': ' + b.mensaje; }).join(' | '));
  }

  (await ayudas.leerAvisos(page)).forEach(function (a) {
    console.log('   • aviso [' + a.tipo + '] ' + a.texto);
  });

  /* =====================================================================
     5. Una sola ficha, no dos
     ===================================================================== */

  diario.entrarA('5. El historial no quedó con copias');

  const estadoFinal = await page.evaluate(function (codigo) {
    const todas = JSON.parse(localStorage.getItem('aps_encuestas') || '[]');
    const nuestras = todas.filter(function (e) { return e.codigoFicha === codigo; });
    return {
      copias: nuestras.length,
      sincronizada: nuestras[0] ? nuestras[0].sincronizada === true : null,
      modificaciones: nuestras[0] ? (nuestras[0].fechasModificacion || []).length : 0
    };
  }, FICHA.codigo);

  if (estadoFinal.copias === 1) diario.ok('Corregir reemplazó la ficha, no la duplicó');
  else diario.problema('Historial', 'la corrección dejó ' + estadoFinal.copias + ' copias');

  if (estadoFinal.sincronizada) diario.ok('La ficha quedó marcada como guardada en la base');
  else diario.problema('Estado local', 'la ficha corregida no quedó marcada como sincronizada');

  if (estadoFinal.modificaciones > 0) {
    diario.ok('Quedó registrada la fecha de corrección', estadoFinal.modificaciones + ' modificación(es)');
  } else {
    diario.problema('Trazabilidad', 'no se registró que la ficha fue corregida');
  }

  await expect(page.locator('#avisoCorreccion'),
    'la cinta de corrección siguió visible después de guardar').toBeHidden();

  /* La comprobación que cierra el caso: una sola fila en la base, con el
     código bueno. */
  const enLaBase = await leerAccionGuardada(FICHA.codigo);
  console.log('\n   En la base: ' + JSON.stringify(enLaBase));

  ayudas.imprimirInforme(diario);

  await infoPrueba.attach('informe-de-la-correccion.txt', {
    body: JSON.stringify(diario, null, 2),
    contentType: 'text/plain'
  });

  expect(
    diario.problemas.map(function (p) {
      return '«' + p.zona + '» ' + p.etiqueta + ': ' + p.motivo + (p.detalle ? ' — ' + p.detalle : '');
    }),
    'la corrección dejó problemas sin resolver'
  ).toEqual([]);

  expect(enLaBase.fichas, 'la base debería tener una sola ficha con ese código').toBe(1);
  expect(enLaBase.codigoAccion, 'la base no guardó el código corregido').toBe(CODIGO_VALIDO);
});

/* ---------------------------------------------------------
   Apoyos
   --------------------------------------------------------- */

async function esperarCatalogos(page) {
  await page.waitForFunction(function () {
    const s = document.getElementById('territorio');
    return s && s.options.length > 1;
  }, null, { timeout: 15000 });
}

async function leerAccionGuardada(codigoFicha) {
  const { Client } = require('pg');
  const cliente = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: false
  });

  await cliente.connect();
  try {
    const fichas = await cliente.query(
      'SELECT id FROM aps.ficha WHERE codigo = $1', [codigoFicha]);

    if (fichas.rows.length === 0) return { fichas: 0, codigoAccion: null };

    const accion = await cliente.query(`
      SELECT pa.codigo_accion
        FROM aps.plan_accion pa
        JOIN aps.plan_cuidado pc ON pc.id = pa.plan_id
       WHERE pc.ficha_id = $1 AND pc.ambito = 'vivienda'
       LIMIT 1
    `, [fichas.rows[0].id]);

    return {
      fichas: fichas.rows.length,
      codigoAccion: accion.rows[0] ? accion.rows[0].codigo_accion : null
    };
  } finally {
    await cliente.end();
  }
}

function fichaDePrueba() {
  return {
    codigo: CODIGO,
    hogar: 'HG-COR-' + SUFIJO,
    familia: 'FM-COR-' + SUFIJO,
    codigoFamiliaDerivado: 'HG-COR-' + SUFIJO + '-F1',
    ebs: 'EBSCOR1',

    situacionInminente: 'no_aplica',
    uzpe: 'UZPE006',
    areaUbicacion: 'urbana',
    territorio: 'T50',
    microterritorio: 'MT02',
    divisionTerritorial: 'Barrio de prueba de corrección',

    prestador: 'PROV-ESE-NORTE',
    responsableTipoId: 'CC',
    responsableNumeroId: '1144012345',
    perfilProfesional: 'enfermeria',
    entornoAbordaje: 'hogar',
    cabezaFamilia: 'Beatriz Salazar',
    jovenesEnPaz: 'no',

    direccion: { viaTipo: 'DG', viaNumero: '18', genNumero: '9', placa: '21' },
    latitud: '3.470000',
    longitud: '-76.520000',
    ubicacionReferencia: 'Casa esquinera de dos pisos',

    estrato: 'medio_bajo',
    hogaresEnVivienda: '1',
    personasEnVivienda: '1',
    habitacionesVivienda: '2',
    elementosParaDormir: '2',

    tipoVivienda: 'apartamento',
    materialTecho: 'concreto',
    vectores: 'no',
    riesgosAccidente: 'ninguno',
    factoresContaminacion: 'ninguno',
    actividadEconomica: 'no',
    animales: 'ninguno',

    fuenteAgua: 'acueducto_esp',
    disposicionExcretas: 'alcantarillado',
    aguasResiduales: 'alcantarillado',
    residuosSolidos: 'servicio_aseo',

    tipoFamilia: 'unipersonal',
    cuidadorPrincipal: 'no',
    redesApoyo: 'cuenta_protectoras',
    situacionesRiesgo: 'ninguna',
    practicasVinculo: 'escucha_activa',
    practicasCuidadoHogar: 'ventilacion',

    planVivienda: {
      ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
      codigoAccion: 'NC-AMB-07', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se revisó la humedad del muro de la cocina y se acordó ventilar a diario',
      accionConcertada: 'Revisar la humedad del muro de la cocina'
    },
    planFamilia: {
      ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
      codigoAccion: 'NC-FAM-02', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se conversó con la familia sobre el relevo del cuidador',
      accionConcertada: 'Acordar una red de apoyo cercana'
    },
    planPersona: {
      integrante: 0,
      ejecutorTipoId: 'CC', ejecutorNumeroId: '1144012345',
      codigoAccion: 'NC-GES-06', tipoRespuesta: 'en_sitio',
      procedimientoRealizado: 'Se dejó agendada la cita de control con verificación de asistencia',
      accionConcertada: 'Programar la cita de control anual'
    }
  };
}

function personaDePrueba() {
  return {
    titulo: 'Beatriz Salazar — 51 años, vive sola',
    primerNombre: 'Beatriz', segundoNombre: 'Elena',
    primerApellido: 'Salazar', segundoApellido: 'Mejía',
    tipoId: 'CC', numeroId: DOCUMENTOS[0], fechaNacimiento: '1975-01-20',
    sexo: 'mujer', genero: 'femenino', autoidentificacion: 'femenino',
    orientacion: 'heterosexual',
    telefono: '3151122334', rol: 'responsable_economico',
    ocupacion: '5120', nivelEducativo: 'media_academica',
    peso: '68', talla: '162', cintura: '86',
    sistolica: '118', diastolica: '76',
    gestacion: 'no'
  };
}
