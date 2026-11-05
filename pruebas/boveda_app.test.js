/* =========================================================================
   Las fichas cifradas, dentro de la aplicación
       node pruebas/boveda_app.test.js
   -------------------------------------------------------------------------
   boveda.test.js prueba la bóveda sola. Aquí va con los archivos reales de la
   aplicación en jsdom, sobre un mismo almacenamiento, como un teléfono: lo que había
   en claro, guardar, sincronizar, bloquear a mitad de algo, dos personas y olvidar la
   contraseña. El recorrido en un navegador de verdad es pruebas/e2e/pwa.spec.js.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const leer = function (archivo) { return fs.readFileSync(path.join(RAIZ, archivo), 'utf8'); };

const html = leer('index.html');
const fuentes = ['vendor/noble-ciphers/xchacha20poly1305.js', 'boveda.js', 'roles.js', 'acceso_local.js',
  'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js', 'reglas.js', 'formulario.js',
  'cups.js', 'correccion.js', 'captura_local.js', 'app.js']
  .map(leer)
  .join('\n;\n');

let pasadas = 0;
let fallidas = 0;
function check(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK    ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle !== undefined ? '\n        ' + detalle : ''));
  }
}

const esperar = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); };

/* Derivar una contraseña tarda lo que tarde la máquina: se espera el resultado, no un
   tiempo fijo. */
async function hasta(condicion) {
  for (let i = 0; i < 400 && !condicion(); i++) await esperar(50);
}

const ANA = { id: 1, documento: '1144000001', nombre: 'Ana Ruiz', rol: 'enfermeria', equipoCodigo: 'EBS12', permisos: ['ficha.crear'] };
const LUIS = { id: 2, documento: '1144000002', nombre: 'Luis Mora', rol: 'enfermeria', equipoCodigo: 'EBS12', permisos: ['ficha.crear'] };
const CLAVE_ANA = 'ClaveDeAna2026';
const CLAVE_NUEVA = 'ClaveNuevaDeAna2027';
const CLAVE_LUIS = 'ClaveDeLuis2026';
const CUSTODIA = nodeCrypto.randomBytes(32).toString('base64url');
const SECRETO = 'María Secreta';

const HOY = new Date().toISOString().split('T')[0];

function ficha(codigo, persona, extras) {
  return Object.assign({
    id: 'enc_' + codigo, codigoFicha: codigo, sincronizada: false, fechaRegistro: new Date().toISOString(),
    fechaDiligenciamiento: HOY, territorio: 'T49', microterritorio: 'MT01', hogaresEnVivienda: 1,
    cabezaFamilia: SECRETO, responsableNumeroId: persona.documento, familias: [],
    planCuidado: { pendiente: false, accionesRegistradas: 1, alertasSinConducta: 0 }
  }, extras);
}

/* El teléfono: lo que sobrevive de una «página» a otra. */
function telefono(fichas, cupo) {
  const datos = new Map();
  const almacen = {
    datos: datos,
    get length() { return datos.size; },
    key: function (i) { return Array.from(datos.keys())[i] || null; },
    getItem: function (k) { return datos.has(k) ? datos.get(k) : null; },
    setItem: function (k, v) {
      const texto = String(v);
      if (cupo) {
        let total = k.length + texto.length;
        datos.forEach(function (valor, clave) { if (clave !== k) total += clave.length + valor.length; });
        if (total > cupo) {
          const error = new Error('cupo lleno');
          error.name = 'QuotaExceededError';
          throw error;
        }
      }
      datos.set(k, texto);
    },
    removeItem: function (k) { datos.delete(k); }
  };
  datos.set('aps_semilla_retirada', 'si');
  if (fichas) datos.set('aps_encuestas', JSON.stringify(fichas));
  return almacen;
}

const lista = function (almacen) { return JSON.parse(almacen.getItem('aps_encuestas') || '[]'); };
const todoElAlmacen = function (almacen) { return JSON.stringify(Array.from(almacen.datos.entries())); };

/* Una página nueva, con la sesión de esa persona y sin la llave todavía. */
async function abrir(almacen, usuario, opciones) {
  const o = opciones || {};
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;

  Object.defineProperty(window, 'localStorage', { value: almacen, configurable: true });
  Object.defineProperty(window, 'crypto', { value: nodeCrypto.webcrypto, configurable: true });
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.navigator.geolocation = { getCurrentPosition: function () {} };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.SESION = { usuario: function () { return usuario; }, aplicarEnFormulario: function () {} };

  const avisos = [];
  const validaciones = [];
  window.Swal = {
    fire: function (conf) {
      avisos.push(conf);
      /* El diálogo de la contraseña anterior: «teclea» lo que diga la prueba. */
      if (conf.input === 'password') {
        return Promise.resolve(conf.preConfirm(o.contrasenaAnterior)).then(function (valor) {
          return { isConfirmed: Boolean(valor), value: valor };
        });
      }
      return Promise.resolve({ isConfirmed: true });
    },
    showValidationMessage: function (texto) { validaciones.push(texto); },
    isLoading: function () { return false; }
  };

  const enviadas = [];
  const responder = function (estado, cuerpo) {
    return { ok: estado >= 200 && estado < 300, status: estado, json: function () { return Promise.resolve(cuerpo); } };
  };
  window.fetch = function (url, conf) {
    const ruta = String(url);
    if (ruta.indexOf('/api/listar_fichas') === 0) return Promise.reject(new Error('sin red'));
    if (ruta === '/api/guardar_encuesta') {
      const cuerpo = JSON.parse(conf.body);
      enviadas.push(cuerpo);
      if (o.retenidas) return new Promise(function (resolver) { o.retenidas.push(function () { resolver(responder(200, { codigos: null })); }); });
      return Promise.resolve(responder(200, { codigos: null }));
    }
    return Promise.reject(new Error('sin red'));
  };

  const errores = [];
  window.addEventListener('error', function (e) { errores.push(e.message); });
  window.console.warn = function () {};
  window.console.error = function () {};
  window.console.info = function () {};
  window.console.log = function () {};

  window.eval(fuentes + `;
    window.__api = {
      obtenerEncuestas, guardarEncuestas, agregarEncuesta, reemplazarEncuesta, eliminarEncuestaPorId, soltarCopiaYaSubida,
      sincronizarEncuestas, renderizarEstadoSync, pendientesDeOtrasPersonas, guardarBorradorAhora, leerBorrador, leerFichasEnCurso,
      fichaTieneDatos, reiniciarFichaEnCurso
    };`);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  await esperar(20);

  const $ = function (s) { return window.document.querySelector(s); };
  return {
    window: window, $: $, api: window.__api, boveda: window.BOVEDA, avisos: avisos, validaciones: validaciones,
    enviadas: enviadas, errores: errores, usuario: usuario,
    entrar: async function (clave, custodia) {
      const resultado = await window.BOVEDA.prepararApertura(usuario.documento, clave).abrir(custodia ? { custodia: custodia } : undefined);
      await esperar(5);
      return resultado;
    },
    propias: function () { return window.__api.obtenerEncuestas().map(function (f) { return f.codigoFicha; }).sort().join(); },
    escribir: function (valor) {
      const campo = $('#cabezaFamilia');
      campo.value = valor;
      campo.dispatchEvent(new window.Event('input', { bubbles: true }));
    },
    textosDeAviso: function () { return avisos.map(function (a) { return String(a.text || ''); }).join(' | '); }
  };
}

async function principal() {
  console.log('\n=== 1. Sin la contraseña no se lee ni se toca ===');

  const FICHAS = function () {
    return [ficha('A1', ANA), ficha('A2', ANA, { sincronizada: true }), ficha('L1', LUIS)];
  };
  let almacen = telefono(FICHAS());
  const enClaro = almacen.getItem('aps_encuestas');
  let app = await abrir(almacen, ANA);

  check('la aplicación arranca sin errores', app.errores.length === 0, app.errores.join(' | '));
  check('queda cerrada', !app.boveda.abierta());
  check('no muestra ninguna ficha', app.propias() === '');
  check('lo guardado no cambia', almacen.getItem('aps_encuestas') === enClaro);
  let error = null;
  try { app.api.agregarEncuesta(ficha('X', ANA)); } catch (e) { error = e.name; }
  check('guardar falla', error === 'BovedaCerrada', error);
  check('sin pisar lo que había', almacen.getItem('aps_encuestas') === enClaro);
  app.api.renderizarEstadoSync();
  await app.api.sincronizarEncuestas();
  check('sincronizar no hace nada', app.enviadas.length === 0 && almacen.getItem('aps_encuestas') === enClaro);

  console.log('\n=== 2. Al entrar, lo de esa persona pasa a cifrado ===');

  let resultado = await app.entrar(CLAVE_ANA);
  check('abre', resultado.ok === true, JSON.stringify(resultado));
  let crudas = lista(almacen);
  check('no se pierde ninguna', crudas.length === 3, crudas.length);
  const deAna = crudas.filter(function (e) { return e.capturadaPor === ANA.documento; });
  check('las de Ana quedan selladas', deAna.length === 2 && deAna.every(function (e) { return e.sellada; }));
  check('con sólo tres campos', deAna.every(function (e) { return Object.keys(e).sort().join() === 'capturadaPor,sellada,sincronizada'; }));
  check('el sobre conserva si subió', deAna.filter(function (e) { return e.sincronizada === true; }).length === 1);
  const deLuis = crudas.find(function (e) { return e.responsableNumeroId === LUIS.documento; });
  check('la de Luis sigue como estaba: nadie más puede cifrarla', deLuis && deLuis.codigoFicha === 'L1' && !deLuis.sellada);
  check('Ana ve lo suyo, igual que antes', app.propias() === 'A1,A2', app.propias());
  check('con todo su contenido', app.api.obtenerEncuestas().every(function (f) { return f.cabezaFamilia === SECRETO; }));
  check('el aviso de lo ajeno sigue funcionando', app.api.pendientesDeOtrasPersonas()[0].documento === LUIS.documento);
  crudas.filter(function (e) { return e.sellada; }).forEach(function (e) {
    check('un sobre no deja leer el nombre', JSON.stringify(e).indexOf('María') === -1);
  });

  const selladasAntes = almacen.getItem('aps_encuestas');
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA);
  check('al volver a entrar no se reescribe nada', almacen.getItem('aps_encuestas') === selladasAntes);
  check('y lee lo de antes', app.propias() === 'A1,A2');

  /* Una pestaña con la versión anterior siguió guardando en claro. */
  const conUnaEnClaro = lista(almacen).concat([ficha('A3', ANA)]);
  almacen.setItem('aps_encuestas', JSON.stringify(conUnaEnClaro));
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA);
  check('lo que aparezca en claro se cifra al entrar', lista(almacen).every(function (e) { return e.sellada || e.responsableNumeroId === LUIS.documento; }));
  check('y se lee', app.propias() === 'A1,A2,A3', app.propias());

  console.log('\n=== 3. Guardar ===');

  const selladaDeA2 = lista(almacen).find(function (e) { return e.sincronizada === true; }).sellada;
  app.api.agregarEncuesta(ficha('A4', ANA));
  crudas = lista(almacen);
  check('una ficha nueva queda sellada', crudas[0].sellada && crudas[0].capturadaPor === ANA.documento);
  check('las demás conservan su sellado: no se vuelven a cifrar', crudas.some(function (e) { return e.sellada === selladaDeA2; }));
  check('lo de Luis no se toca', crudas.some(function (e) { return e.codigoFicha === 'L1'; }));
  app.api.reemplazarEncuesta('enc_A4', Object.assign(ficha('A4', ANA), { cabezaFamilia: 'Otro nombre' }));
  check('corregir se lee', app.api.obtenerEncuestas().find(function (f) { return f.codigoFicha === 'A4'; }).cabezaFamilia === 'Otro nombre');
  app.api.eliminarEncuestaPorId('enc_A4');
  check('eliminar también', app.propias() === 'A1,A2,A3');
  check('nada de esto dejó el nombre en claro, salvo lo de Luis', lista(almacen).filter(function (e) { return e.sellada; }).every(function (e) { return JSON.stringify(e).indexOf('María') === -1; }));

  console.log('\n=== 4. Sincronizar ===');

  await app.api.sincronizarEncuestas();
  check('sube lo pendiente de Ana, en claro por el canal', app.enviadas.map(function (f) { return f.codigoFicha; }).sort().join() === 'A1,A3', app.enviadas.map(function (f) { return f.codigoFicha; }).join());
  check('con todo su contenido', app.enviadas.every(function (f) { return f.cabezaFamilia === SECRETO; }));
  check('firmado por quien subió', app.enviadas.every(function (f) { return f.capturadaPor === ANA.documento; }));
  check('el sobre ya dice que subió', lista(almacen).filter(function (e) { return e.capturadaPor === ANA.documento; }).every(function (e) { return e.sincronizada === true; }));
  check('y sigue sellado', lista(almacen).filter(function (e) { return e.capturadaPor === ANA.documento; }).every(function (e) { return e.sellada; }));

  console.log('\n=== 5. Se bloquea a mitad de una subida ===');

  almacen = telefono([ficha('A1', ANA)]);
  const retenidas = [];
  app = await abrir(almacen, ANA, { retenidas: retenidas });
  await app.entrar(CLAVE_ANA);
  const subida = app.api.sincronizarEncuestas();
  await esperar(5);
  app.boveda.cerrar();
  check('la llave sigue hasta que termine', app.boveda.abierta());
  retenidas.forEach(function (soltar) { soltar(); });
  await subida;
  check('al terminar se borra', !app.boveda.abierta());
  check('y lo subido quedó anotado', lista(almacen)[0].sincronizada === true);
  check('sin avisar de un error que no hubo', !/Error de red/.test(app.textosDeAviso()), app.textosDeAviso());

  console.log('\n=== 6. El borrador ===');

  almacen = telefono([]);
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA);
  app.escribir('Nombre del borrador');
  check('escribir deja ficha en curso', app.api.fichaTieneDatos());
  app.api.guardarBorradorAhora();
  check('queda cifrado', almacen.getItem('aps_cifrado_borrador_1') !== null && almacen.getItem('aps_cifrado_en_curso_1') !== null);
  check('no en claro', almacen.getItem('aps_borrador_1') === null && almacen.getItem('aps_en_curso_1') === null);
  check('no se lee', todoElAlmacen(almacen).indexOf('Nombre del borrador') === -1);
  check('la aplicación sí', app.api.leerBorrador().datos.cabezaFamilia === 'Nombre del borrador');

  /* Lo último antes de bloquear no se pierde. */
  app.escribir('Justo antes de bloquear');
  app.boveda.cerrar();
  check('al bloquear se escribe lo último', todoElAlmacen(almacen).indexOf('Justo antes') === -1);
  check('y la llave ya no está', !app.boveda.abierta());
  check('bloqueado no se lee', app.api.leerBorrador() === null);
  check('lo de la pantalla sigue debajo', app.$('#cabezaFamilia').value === 'Justo antes de bloquear');
  const cuantosAvisos = app.avisos.length;
  app.api.guardarBorradorAhora();
  check('lo que dispare el guardado automático debajo del velo no hace nada, ni dice que falta espacio', app.avisos.length === cuantosAvisos);

  await app.entrar(CLAVE_ANA);
  check('al desbloquear el formulario sigue como estaba', app.$('#cabezaFamilia').value === 'Justo antes de bloquear');
  check('y hay borrador', app.api.leerBorrador().datos.cabezaFamilia === 'Justo antes de bloquear');
  app.escribir('Sigo escribiendo');
  await app.boveda.cerrar();
  await app.entrar(CLAVE_ANA);
  check('sin volver a cargar lo guardado encima de lo escrito', app.$('#cabezaFamilia').value === 'Sigo escribiendo');

  /* Una página nueva: no hay nada hasta dar la contraseña, y entonces vuelve. */
  app.api.guardarBorradorAhora();
  app = await abrir(almacen, ANA);
  check('una página nueva no muestra el borrador', app.$('#cabezaFamilia').value === '');
  await app.entrar(CLAVE_ANA);
  check('con la contraseña vuelve al formulario', app.$('#cabezaFamilia').value === 'Sigo escribiendo', app.$('#cabezaFamilia').value);
  check('y lo dice', !app.$('#avisoBorrador').hidden);

  console.log('\n=== 7. Un borrador de antes ===');

  const textoBorrador = app.boveda.leerTexto('aps_borrador_1');
  const textoEnCurso = app.boveda.leerTexto('aps_en_curso_1');
  almacen = telefono([]);
  almacen.setItem('aps_borrador_1', textoBorrador);
  almacen.setItem('aps_en_curso_1', textoEnCurso);
  almacen.setItem('aps_borrador_2', '{"version":1,"datos":{"cabezaFamilia":"De Luis"}}');
  app = await abrir(almacen, ANA);
  check('sin la contraseña sigue igual', almacen.getItem('aps_borrador_1') === textoBorrador);
  await app.entrar(CLAVE_ANA);
  check('pasa a cifrado', almacen.getItem('aps_borrador_1') === null && almacen.getItem('aps_en_curso_1') === null);
  check('no se lee', almacen.getItem('aps_cifrado_borrador_1').indexOf('Sigo escribiendo') === -1);
  check('vuelve al formulario', app.$('#cabezaFamilia').value === 'Sigo escribiendo', app.$('#cabezaFamilia').value);
  check('sigue entre las fichas sin terminar', app.api.leerFichasEnCurso().length === 1);
  check('el de otra persona no se toca', almacen.getItem('aps_borrador_2') !== null && almacen.getItem('aps_cifrado_borrador_2') === null);

  /* Una pestaña con la versión anterior escribió después de migrar. */
  const masNuevo = JSON.parse(textoBorrador);
  masNuevo.guardadoEn = new Date(Date.now() + 60000).toISOString();
  masNuevo.datos.cabezaFamilia = 'Más nuevo en claro';
  almacen.setItem('aps_borrador_1', JSON.stringify(masNuevo));
  almacen.setItem('aps_en_curso_1', JSON.stringify([masNuevo]));
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA);
  check('si hay de los dos gana el más reciente', app.$('#cabezaFamilia').value === 'Más nuevo en claro', app.$('#cabezaFamilia').value);
  check('sin duplicar la ficha sin terminar', app.api.leerFichasEnCurso().length === 1, app.api.leerFichasEnCurso().length);
  check('y no queda en claro', almacen.getItem('aps_borrador_1') === null);

  console.log('\n=== 8. Dos personas ===');

  almacen = telefono(FICHAS());
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA);
  let luis = await abrir(almacen, LUIS);
  await luis.entrar(CLAVE_LUIS);
  crudas = lista(almacen);
  check('al entrar Luis se cifra lo suyo', crudas.every(function (e) { return e.sellada; }), JSON.stringify(crudas.map(function (e) { return Boolean(e.sellada); })));
  check('no se pierde ninguna', crudas.length === 3);
  check('cada quien lee lo suyo', luis.propias() === 'L1' && app.propias() === 'A1,A2', luis.propias() + ' / ' + app.propias());
  luis.api.agregarEncuesta(ficha('L2', LUIS));
  check('lo que guarda Luis no toca lo de Ana', app.propias() === 'A1,A2', app.propias());
  check('y Ana no puede abrirlo', !app.boveda.esLegible(lista(almacen)[0]));
  check('cada una sabe de las pendientes de la otra, sin llave', luis.api.pendientesDeOtrasPersonas()[0].cantidad === 1 && app.api.pendientesDeOtrasPersonas()[0].cantidad === 2);

  /* Una copia ya subida de otra persona se puede soltar sin su llave. */
  almacen = telefono([ficha('A1', ANA), ficha('L1', LUIS, { sincronizada: true })]);
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA);
  luis = await abrir(almacen, LUIS);
  await luis.entrar(CLAVE_LUIS);
  app.boveda.cerrar();
  check('sin espacio se suelta una copia ya subida, aunque nadie tenga su llave abierta', app.api.soltarCopiaYaSubida() === true);
  check('sólo esa', lista(almacen).length === 1 && lista(almacen)[0].capturadaPor === ANA.documento);

  console.log('\n=== 9. Sin espacio ===');

  /* El cupo real se prueba en el navegador: aquí, que nada se pierda al rozarlo. */
  const relleno = 'x'.repeat(4000);
  almacen = telefono([ficha('A1', ANA, { relleno: relleno }), ficha('A2', ANA, { relleno: relleno, sincronizada: true })], 12000);
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA);
  check('cabe lo cifrado, que ocupa menos', lista(almacen).every(function (e) { return e.sellada; }));
  error = null;
  try { app.api.agregarEncuesta(ficha('A3', ANA, { relleno: 'y'.repeat(30000) })); } catch (e) { error = e.name; }
  check('lo que no cabe falla, para poder avisarlo', error === 'QuotaExceededError', error);
  check('lo pendiente sigue', app.propias().indexOf('A1') !== -1);

  console.log('\n=== 10. Olvidó la contraseña ===');

  almacen = telefono([ficha('A1', ANA)]);
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_ANA, CUSTODIA);
  app.escribir('Borrador de antes de olvidar');
  app.api.guardarBorradorAhora();
  const antesDeOlvidar = almacen.getItem('aps_encuestas');

  /* Con custodia: entra con la nueva y todo sigue igual. */
  app = await abrir(almacen, ANA);
  resultado = await app.entrar(CLAVE_NUEVA, CUSTODIA);
  check('con la custodia se recupera', resultado.recuperada === true, JSON.stringify(resultado));
  check('se leen las fichas', app.propias() === 'A1', app.propias());
  check('y vuelve el borrador', app.$('#cabezaFamilia').value === 'Borrador de antes de olvidar');
  check('sin tocar lo guardado', almacen.getItem('aps_encuestas') === antesDeOlvidar);
  check('sin aviso de nada pendiente de abrir', app.$('#fichasDeOtraLlave').hidden);

  /* Sin custodia: no se lee, no se pierde, y se ofrece abrirlo. */
  const meta = JSON.parse(almacen.getItem('aps_boveda_' + ANA.documento));
  meta.custodia = null;
  almacen.setItem('aps_boveda_' + ANA.documento, JSON.stringify(meta));
  const CLAVE_OTRA = 'OtraClaveDeAna2028';
  app = await abrir(almacen, ANA, { contrasenaAnterior: 'NoEsLaClave2026' });
  resultado = await app.entrar(CLAVE_OTRA, CUSTODIA);
  check('sin la custodia guardada no se recupera: llave nueva', resultado.llaveNueva === true, JSON.stringify(resultado));
  check('lo de antes no se lee', app.propias() === '', app.propias());
  check('no se pierde', lista(almacen).length === 1 && lista(almacen)[0].sellada);
  check('el borrador de antes no aparece', app.$('#cabezaFamilia').value === '');
  app.api.renderizarEstadoSync();
  check('Inicio avisa', !app.$('#fichasDeOtraLlave').hidden && /1 ficha sin subir guardada con su contraseña anterior/.test(app.$('#fichasDeOtraLlave').textContent), app.$('#fichasDeOtraLlave').textContent);
  check('y no dice que todo subió', /Falta abrir/.test(app.$('.sincronia__titulo').textContent), app.$('.sincronia__titulo').textContent);

  /* Seguir trabajando no pisa lo de antes. */
  app.api.agregarEncuesta(ficha('A2', ANA));
  app.escribir('Borrador nuevo');
  app.api.guardarBorradorAhora();
  check('lo nuevo convive con lo de antes', lista(almacen).length === 2 && app.propias() === 'A2', app.propias());

  /* Una contraseña que no es. */
  app.$('#btnAbrirOtraLlave').click();
  await hasta(function () { return app.validaciones.length > 0; });
  check('una contraseña que no es no abre, y lo dice', app.propias() === 'A2' && /no es su contraseña anterior/.test(app.validaciones.join()), app.validaciones.join());
  check('el aviso sigue', !app.$('#fichasDeOtraLlave').hidden);

  /* La de verdad. */
  app = await abrir(almacen, ANA, { contrasenaAnterior: CLAVE_NUEVA });
  await app.entrar(CLAVE_OTRA);
  app.$('#btnAbrirOtraLlave').click();
  await hasta(function () { return /ya está disponible/.test(app.textosDeAviso()); });
  check('la contraseña anterior abre lo de antes', app.propias() === 'A1,A2', app.propias());
  const metaDeHoy = JSON.parse(almacen.getItem('aps_boveda_' + ANA.documento));
  check('todo queda con la llave de hoy', lista(almacen).every(function (e) { return e.sellada.split('.')[1] === metaDeHoy.id; }));
  check('la anterior ya no se guarda', metaDeHoy.anteriores.length === 0);
  check('el aviso se va', app.$('#fichasDeOtraLlave').hidden);
  check('lo dice', /ya está disponible/.test(app.textosDeAviso()), app.textosDeAviso());
  const sinTerminar = app.api.leerFichasEnCurso().map(function (b) { return b.datos.cabezaFamilia; });
  check('el borrador de antes vuelve entre las fichas sin terminar', sinTerminar.indexOf('Borrador de antes de olvidar') !== -1, sinTerminar.join());
  check('junto con el de hoy', sinTerminar.indexOf('Borrador nuevo') !== -1, sinTerminar.join());

  /* En otra página, con la contraseña de hoy, todo se lee. */
  app = await abrir(almacen, ANA);
  await app.entrar(CLAVE_OTRA);
  check('otra página lo lee todo', app.propias() === 'A1,A2');
  check('y sigue funcionando subirlo', await app.api.sincronizarEncuestas() === undefined && app.enviadas.length === 2);

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
}

principal().catch(function (error) {
  console.error('La prueba se detuvo:', error);
  process.exit(1);
});
