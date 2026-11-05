/* =========================================================================
   Pruebas de boveda.js: las fichas, cifradas en el dispositivo (RN-223.1)
       node pruebas/boveda.test.js
   Con los archivos reales (la librería de vendor/ y boveda.js) y el WebCrypto de
   Node. No tocan la base ni el servidor.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');
const { webcrypto } = nodeCrypto;

const RAIZ = path.join(__dirname, '..');

let pasadas = 0;
let fallidas = 0;

function verificar(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  OK   ' + nombre);
  } else {
    fallidas++;
    console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + detalle : ''));
  }
}

function leer(ruta) {
  return fs.readFileSync(path.join(RAIZ, ruta), 'utf8');
}

const LIBRERIA = leer('vendor/noble-ciphers/xchacha20poly1305.js');
const BOVEDA = leer('boveda.js');

const DOC_A = '1144099001';
const DOC_B = '1144099002';
const CLAVE_A = 'ClaveDePrueba2026';
const CLAVE_NUEVA = 'OtraClaveDePrueba2027';
const CUSTODIA = nodeCrypto.randomBytes(32).toString('base64url');
const OTRA_CUSTODIA = nodeCrypto.randomBytes(32).toString('base64url');
const SECRETO_DE_PRUEBA = 'María Fernández, víctima de violencia';

/* ---------------------------------------------------------
   Banco
   --------------------------------------------------------- */

/* Con `comoWebKit`, cobra como WebKit: el doble por todo texto que no sea latino. */
function almacenSimulado(cupo, comoWebKit) {
  const datos = new Map();
  const costo = function (k, v) {
    return k.length + v.length * (comoWebKit && /[^\u0000-\u00ff]/.test(v) ? 2 : 1);
  };
  const usado = function () {
    let total = 0;
    datos.forEach(function (v, k) { total += costo(k, v); });
    return total;
  };
  return {
    datos: datos,
    get length() { return datos.size; },
    key: function (i) { return Array.from(datos.keys())[i] || null; },
    getItem: function (k) { return datos.has(k) ? datos.get(k) : null; },
    setItem: function (k, v) {
      const texto = String(v);
      const antes = datos.has(k) ? costo(k, datos.get(k)) : 0;
      if (cupo && usado() - antes + costo(k, texto) > cupo) {
        const error = new Error('cupo lleno');
        error.name = 'QuotaExceededError';
        throw error;
      }
      datos.set(k, texto);
    },
    removeItem: function (k) { datos.delete(k); }
  };
}

const consolaCallada = { log: function () {}, warn: function () {}, error: function () {} };

/* Una «página»: la misma memoria no sobrevive de una a otra, el almacenamiento sí. */
function pagina(almacen, opciones) {
  opciones = opciones || {};
  const ventana = {
    crypto: opciones.sinCrypto ? {} : webcrypto,
    navigator: opciones.navigator || {}
  };
  const contexto = vm.createContext({
    window: ventana,
    localStorage: almacen,
    sessionStorage: opciones.sesion || almacenSimulado(),
    console: consolaCallada,
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    btoa: btoa,
    atob: atob,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    MessageChannel: MessageChannel
  });
  if (opciones.soltarCopia) contexto.soltarCopiaYaSubida = opciones.soltarCopia;
  vm.runInContext(LIBRERIA, contexto);
  vm.runInContext(BOVEDA, contexto);
  return ventana.BOVEDA;
}

async function abierta(almacen, documento, clave, opciones, opcionesDePagina) {
  const boveda = pagina(almacen, opcionesDePagina);
  const resultado = await boveda.prepararApertura(documento, clave).abrir(opciones);
  return { boveda: boveda, resultado: resultado };
}

function datosCifrados(sellado) {
  return sellado.slice(sellado.indexOf('.', sellado.indexOf('.', sellado.indexOf('.') + 1) + 1) + 1);
}

function deHexa(texto) {
  return Uint8Array.from(Buffer.from(texto.replace(/\s/g, ''), 'hex'));
}

/* HChaCha20, escrito aquí para esto: junto con el ChaCha20-Poly1305 de OpenSSL da un
   XChaCha20-Poly1305 que no comparte ni una línea con la librería de vendor/. */
function hchacha20(llave, nonce) {
  const giro = function (x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; };
  const estado = new Uint32Array(16);
  estado.set([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);
  const palabras = function (bytes, inicio, cuantas) {
    for (let i = 0; i < cuantas; i++) estado[inicio + i] = Buffer.from(bytes).readUInt32LE(i * 4);
  };
  palabras(llave, 4, 8);
  palabras(nonce, 12, 4);
  const cuarto = function (a, b, c, d) {
    estado[a] = (estado[a] + estado[b]) >>> 0; estado[d] = giro(estado[d] ^ estado[a], 16);
    estado[c] = (estado[c] + estado[d]) >>> 0; estado[b] = giro(estado[b] ^ estado[c], 12);
    estado[a] = (estado[a] + estado[b]) >>> 0; estado[d] = giro(estado[d] ^ estado[a], 8);
    estado[c] = (estado[c] + estado[d]) >>> 0; estado[b] = giro(estado[b] ^ estado[c], 7);
  };
  for (let i = 0; i < 10; i++) {
    cuarto(0, 4, 8, 12); cuarto(1, 5, 9, 13); cuarto(2, 6, 10, 14); cuarto(3, 7, 11, 15);
    cuarto(0, 5, 10, 15); cuarto(1, 6, 11, 12); cuarto(2, 7, 8, 13); cuarto(3, 4, 9, 14);
  }
  const salida = Buffer.alloc(32);
  [0, 1, 2, 3, 12, 13, 14, 15].forEach(function (p, i) { salida.writeUInt32LE(estado[p], i * 4); });
  return salida;
}

function xchachaDeOpenSSL(llave, nonce, aad, claro) {
  const subllave = hchacha20(llave, nonce.subarray(0, 16));
  const nonce12 = Buffer.concat([Buffer.alloc(4), Buffer.from(nonce.subarray(16))]);
  const cifrador = nodeCrypto.createCipheriv('chacha20-poly1305', subllave, nonce12, { authTagLength: 16 });
  cifrador.setAAD(Buffer.from(aad));
  return Buffer.concat([cifrador.update(claro), cifrador.final(), cifrador.getAuthTag()]);
}

/* Mínimo de lo que hace sw.js con los dos mensajes (el de verdad se prueba en e2e). */
function trabajadorSimulado() {
  let guardada = null;
  return {
    mensajes: [],
    postMessage: function (mensaje, puertos) {
      this.mensajes.push(mensaje.tipo);
      if (mensaje.tipo === 'llave-dejar') {
        /* Como postMessage de verdad: una copia, no la misma memoria. */
        guardada = structuredClone(mensaje);
        puertos[0].postMessage({ ok: true });
      } else if (mensaje.tipo === 'llave-tomar') {
        puertos[0].postMessage(guardada);
        guardada = null;
      }
      puertos[0].close();
    }
  };
}

/* ---------------------------------------------------------
   Las pruebas
   --------------------------------------------------------- */

async function principal() {
  console.log('\n=== 1. La librería cifra lo que dice que cifra ===');

  const contextoLibreria = vm.createContext({});
  vm.runInContext(LIBRERIA, contextoLibreria);
  const xchacha = contextoLibreria.NOBLE_XCHACHA;

  /* draft-irtf-cfrg-xchacha-03, A.3.1. */
  const vectorClaro = Buffer.from("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const vectorAad = deHexa('50515253c0c1c2c3c4c5c6c7');
  const vectorLlave = deHexa('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f');
  const vectorNonce = deHexa('404142434445464748494a4b4c4d4e4f5051525354555657');
  const vectorCifrado = 'bd6d179d3e83d43b9576579493c0e939572a1700252bfaccbed2902c21396cbb' +
    '731c7f1b0b4aa6440bf3a82f4eda7e39ae64c6708c54c216cb96b72e1213b452' +
    '2f8c9ba40db5d945b11b69b982c1bb9e3f3fac2bc369488f76b2383565d3fff9' +
    '21f9664c97637da9768812f615c68b13b52e' + 'c0875924c1c7987947deafd8780acf49';
  const salidaVector = xchacha(vectorLlave, vectorNonce, vectorAad).encrypt(new Uint8Array(vectorClaro));
  verificar('el vector oficial del borrador IETF', Buffer.from(salidaVector).toString('hex') === vectorCifrado,
    Buffer.from(salidaVector).toString('hex'));

  let coinciden = 0;
  const largos = [0, 1, 15, 16, 17, 63, 64, 65, 1000, 70000];
  largos.forEach(function (largo) {
    const llave = nodeCrypto.randomBytes(32);
    const nonce = nodeCrypto.randomBytes(24);
    const aad = nodeCrypto.randomBytes(largo % 40);
    const claro = nodeCrypto.randomBytes(largo);
    const nuestra = xchacha(new Uint8Array(llave), new Uint8Array(nonce), new Uint8Array(aad)).encrypt(new Uint8Array(claro));
    if (Buffer.from(nuestra).equals(xchachaDeOpenSSL(llave, nonce, aad, claro))) coinciden++;
  });
  verificar('coincide con OpenSSL en ' + largos.length + ' mensajes al azar', coinciden === largos.length, coinciden);

  let rechazo = false;
  try {
    const llave = new Uint8Array(32);
    const nonce = new Uint8Array(24);
    const cifrado = xchacha(llave, nonce).encrypt(new Uint8Array([1, 2, 3]));
    cifrado[0] ^= 1;
    xchacha(llave, nonce).decrypt(cifrado);
  } catch (error) { rechazo = true; }
  verificar('un byte alterado no descifra', rechazo);

  console.log('\n=== 2. Lo guardado no se lee ===');

  let almacen = almacenSimulado();
  let { boveda, resultado } = await abierta(almacen, DOC_A, CLAVE_A);
  verificar('la primera vez crea la llave', resultado.ok === true && resultado.creada === true);
  verificar('queda abierta y dice de quién', boveda.abierta() && boveda.documento() === DOC_A);

  const meta = JSON.parse(almacen.getItem('aps_boveda_' + DOC_A));
  verificar('guarda el costo con que se derivó', meta.iteraciones >= 600000);
  verificar('la llave no queda en claro: sólo la envuelta', meta.envuelta && Object.keys(meta).indexOf('llave') === -1);
  verificar('sin custodia si el servidor no la dio', meta.custodia === null);

  const ficha = { id: 'f1', codigoFicha: 'C1', nombre: SECRETO_DE_PRUEBA, sincronizada: false, capturadaPor: DOC_A };
  const sobres = boveda.sellarFichas([ficha]);
  verificar('el sobre sólo dice de quién es, si subió y lo sellado',
    Object.keys(sobres[0]).sort().join() === 'capturadaPor,sellada,sincronizada', Object.keys(sobres[0]).join());
  verificar('el nombre no está en el sobre', JSON.stringify(sobres).indexOf('María') === -1);
  verificar('tampoco el código de la ficha', JSON.stringify(sobres).indexOf('C1') === -1);
  verificar('el sobre dice que no ha subido', sobres[0].sincronizada === false);

  const abiertas = boveda.abrirFichas(sobres);
  verificar('se abre igual', abiertas.length === 1 && abiertas[0].nombre === SECRETO_DE_PRUEBA);
  abiertas[0].nombre = 'cambiado';
  verificar('cada lectura da objetos nuevos', boveda.abrirFichas(sobres)[0].nombre === SECRETO_DE_PRUEBA);

  const sello = boveda.sellarTexto('aps_borrador_7', JSON.stringify(ficha));
  verificar('un borrador va a otra llave', sello.clave === 'aps_cifrado_borrador_7', sello.clave);
  verificar('sellar no escribe por su cuenta', almacen.getItem(sello.clave) === null);
  almacen.setItem(sello.clave, sello.valor);
  verificar('tampoco se lee el borrador', almacen.getItem(sello.clave).indexOf('María') === -1);
  verificar('se lee con la llave', boveda.leerTexto('aps_borrador_7') === JSON.stringify(ficha));
  boveda.borrarTexto('aps_borrador_7');
  verificar('y se borra', almacen.getItem(sello.clave) === null);

  /* Los datos se guardan en caracteres, sin sustitutos ni de control. */
  const tramo = datosCifrados(sobres[0].sellada);
  let enElTramo = true;
  for (let i = 0; i < tramo.length; i++) {
    const c = tramo.charCodeAt(i);
    if (c < 0x0100 || c > 0x80ff) enElTramo = false;
  }
  verificar('todos los caracteres en U+0100..U+80FF', enElTramo);

  let idaYVuelta = true;
  for (let largo = 0; largo < 70; largo++) {
    const texto = 'x'.repeat(largo);
    const v = boveda.sellarTexto('aps_borrador_' + largo, texto);
    almacen.setItem(v.clave, v.valor);
    if (boveda.leerTexto('aps_borrador_' + largo) !== texto) idaYVuelta = false;
    almacen.removeItem(v.clave);
  }
  verificar('ida y vuelta exacta con todos los largos cortos', idaYVuelta);

  const largoTexto = JSON.stringify({ a: 'ñandú ☕ 𝒳 '.repeat(20000) });
  const selloLargo = boveda.sellarTexto('aps_en_curso_7', largoTexto);
  almacen.setItem(selloLargo.clave, selloLargo.valor);
  verificar('ida y vuelta de un texto largo, con acentos y fuera del plano básico', boveda.leerTexto('aps_en_curso_7') === largoTexto);
  const bytesClaros = Buffer.byteLength(largoTexto);
  verificar('ocupa cerca de la mitad en caracteres que sus bytes (base64 sería 1,33 veces)',
    selloLargo.valor.length < bytesClaros * 0.56, selloLargo.valor.length + ' / ' + bytesClaros);
  almacen.removeItem(selloLargo.clave);

  console.log('\n=== 3. Sin la llave no se lee ni se escribe ===');

  const otra = pagina(almacen);
  verificar('una página nueva empieza cerrada', !otra.abierta());
  verificar('cerrada no da fichas: ni selladas', otra.abrirFichas(sobres).length === 0);
  verificar('ni las que estén en claro', otra.abrirFichas([{ id: 'x' }]).length === 0);
  verificar('nada es legible', !otra.esLegible(sobres[0]));
  verificar('no da textos', otra.leerTexto('aps_borrador_7') === null);
  let cerrada = null;
  try { otra.sellarFichas([ficha]); } catch (error) { cerrada = error.name; }
  verificar('escribir falla en vez de pisar lo guardado', cerrada === 'BovedaCerrada', cerrada);
  cerrada = null;
  try { otra.sellarTexto('aps_borrador_7', 'x'); } catch (error) { cerrada = error.name; }
  verificar('también un borrador', cerrada === 'BovedaCerrada', cerrada);

  /* Con la contraseña, otra página lee lo de la primera. */
  const reabierta = await abierta(almacen, DOC_A, CLAVE_A);
  verificar('reabrir no crea otra llave', reabierta.resultado.ok && !reabierta.resultado.creada && !reabierta.resultado.llaveNueva);
  verificar('lee lo que selló la otra página', reabierta.boveda.abrirFichas(sobres)[0].nombre === SECRETO_DE_PRUEBA);

  console.log('\n=== 4. Un sellado no se mueve ni se altera ===');

  almacen = almacenSimulado();
  const a = (await abierta(almacen, DOC_A, CLAVE_A)).boveda;
  const b = (await abierta(almacen, DOC_B, CLAVE_A)).boveda;
  const sobreA = a.sellarFichas([ficha])[0];
  verificar('la misma contraseña en otra persona no abre', !b.esLegible(sobreA));
  verificar('y no aparece entre sus fichas', b.abrirFichas([sobreA]).length === 0);

  /* Mover un borrador a otra llave o a otra persona de la misma llave. */
  const borradorA = a.sellarTexto('aps_borrador_7', 'contenido');
  almacen.setItem('aps_cifrado_en_curso_7', borradorA.valor);
  verificar('un borrador copiado a otro sitio no abre', a.leerTexto('aps_en_curso_7') === null);
  almacen.removeItem('aps_cifrado_en_curso_7');

  const alterado = Object.assign({}, sobreA);
  const pos = alterado.sellada.length - 3;
  alterado.sellada = alterado.sellada.slice(0, pos) +
    String.fromCharCode(alterado.sellada.charCodeAt(pos) ^ 1) + alterado.sellada.slice(pos + 1);
  verificar('un carácter alterado no abre', !a.esLegible(alterado));
  verificar('y no rompe la lectura de las demás', a.abrirFichas([alterado, sobreA]).length === 1);
  verificar('un texto cualquiera tampoco', !a.esLegible({ sellada: 'no es un sellado' }));
  verificar('ni con formato pero recortado', !a.esLegible({ sellada: sobreA.sellada.slice(0, 40) }));

  console.log('\n=== 5. Una lista de fichas ===');

  const sobreIgual = a.sellarFichas([ficha])[0];
  verificar('una ficha sin cambios conserva su sellado', sobreIgual.sellada === sobreA.sellada);
  const cambiada = Object.assign({}, ficha, { sincronizada: true });
  const sobreCambiado = a.sellarFichas([cambiada])[0];
  verificar('una ficha con cambios se vuelve a sellar', sobreCambiado.sellada !== sobreA.sellada);
  verificar('y su sobre dice que subió', sobreCambiado.sincronizada === true);
  verificar('un sobre ya hecho se queda igual', a.sellarFichas([sobreA])[0] === sobreA);
  const enClaro = { id: 'vieja', nombre: 'en claro de una versión anterior' };
  const mezcla = a.abrirFichas([sobreA, enClaro]);
  verificar('lo que siga en claro se lee', mezcla.length === 2 && mezcla[1].id === 'vieja');
  verificar('y falta cifrarlo', a.faltaCifrar(enClaro) && !a.faltaCifrar(sobreA));
  verificar('el sobre nunca lleva otro dueño', a.sellarFichas([Object.assign({}, ficha, { capturadaPor: DOC_B })])[0].capturadaPor === DOC_A);

  console.log('\n=== 6. Bloquear ===');

  almacen = almacenSimulado();
  let bloqueo = (await abierta(almacen, DOC_A, CLAVE_A)).boveda;
  const orden = [];
  bloqueo.antesDeCerrar(function () {
    orden.push('antes');
    const v = bloqueo.sellarTexto('aps_borrador_7', 'lo último');
    almacen.setItem(v.clave, v.valor);
  });
  bloqueo.cerrar();
  verificar('antes de borrar la llave se alcanza a escribir', orden.join() === 'antes');
  verificar('queda cerrada', !bloqueo.abierta() && bloqueo.documento() === null);
  verificar('sin leer', bloqueo.leerTexto('aps_borrador_7') === null);
  const tras = await bloqueo.prepararApertura(DOC_A, CLAVE_A).abrir();
  verificar('la contraseña la vuelve a abrir, en la misma página', tras.ok && bloqueo.abierta());
  verificar('y lee lo que se escribió al cerrar', bloqueo.leerTexto('aps_borrador_7') === 'lo último');

  /* Algo en camino retiene la llave. */
  const soltar = bloqueo.retener();
  bloqueo.cerrar();
  verificar('con una subida en curso sigue la llave', bloqueo.abierta());
  soltar();
  verificar('al terminar se cierra sola', !bloqueo.abierta());
  soltar();

  await bloqueo.prepararApertura(DOC_A, CLAVE_A).abrir();
  const soltar2 = bloqueo.retener();
  bloqueo.cerrar();
  await bloqueo.prepararApertura(DOC_A, CLAVE_A).abrir();
  soltar2();
  verificar('si ya se desbloqueó, terminar no la cierra', bloqueo.abierta());

  /* Abrir avisa. */
  const avisos = [];
  bloqueo.alAbrir(function (primera) { avisos.push(primera); });
  verificar('si ya está abierta, avisa de una vez, como primera', avisos.join() === 'true');
  bloqueo.cerrar();
  await bloqueo.prepararApertura(DOC_A, CLAVE_A).abrir();
  verificar('al volver a abrir avisa sin ser primera', avisos.join() === 'true,false', avisos.join());

  console.log('\n=== 7. Olvidó la contraseña: se recupera con la custodia ===');

  almacen = almacenSimulado();
  const antes = await abierta(almacen, DOC_A, CLAVE_A, { custodia: CUSTODIA });
  const sobresAntes = antes.boveda.sellarFichas([ficha]);
  verificar('con señal guarda también la custodia', JSON.parse(almacen.getItem('aps_boveda_' + DOC_A)).custodia);

  const metaAntes = almacen.getItem('aps_boveda_' + DOC_A);
  const tras7 = await abierta(almacen, DOC_A, CLAVE_NUEVA, { custodia: CUSTODIA });
  verificar('con la contraseña nueva y la custodia, se recupera', tras7.resultado.recuperada === true, JSON.stringify(tras7.resultado));
  verificar('es la misma llave: las fichas no se tocan', tras7.boveda.abrirFichas(sobresAntes)[0].nombre === SECRETO_DE_PRUEBA);
  verificar('la envuelta cambió', JSON.parse(almacen.getItem('aps_boveda_' + DOC_A)).envuelta !== JSON.parse(metaAntes).envuelta);

  const sinSenal = await abierta(almacen, DOC_A, CLAVE_NUEVA);
  verificar('después abre sin señal con la nueva', sinSenal.resultado.ok && !sinSenal.resultado.llaveNueva);
  verificar('y lee lo de antes', sinSenal.boveda.abrirFichas(sobresAntes).length === 1);

  /* La contraseña vieja ya no abre esta llave. */
  const vieja = pagina(almacen);
  const metaHoy = JSON.parse(almacen.getItem('aps_boveda_' + DOC_A));
  const idDeHoy = metaHoy.id;
  await vieja.prepararApertura(DOC_A, CLAVE_A).abrir();
  verificar('la contraseña vieja ya no abre las fichas', !vieja.esLegible(sobresAntes[0]));
  verificar('y no se pierde nada: la llave queda como anterior', JSON.parse(almacen.getItem('aps_boveda_' + DOC_A)).anteriores[0].id === idDeHoy);

  verificar('una custodia con mala forma se ignora', (await abierta(almacenSimulado(), DOC_A, CLAVE_A, { custodia: 'corta' })).resultado.ok);

  /* La custodia se renueva en cada ingreso con señal. */
  almacen = almacenSimulado();
  await abierta(almacen, DOC_A, CLAVE_A);
  verificar('creada sin señal no tiene custodia', JSON.parse(almacen.getItem('aps_boveda_' + DOC_A)).custodia === null);
  await abierta(almacen, DOC_A, CLAVE_A, { custodia: CUSTODIA });
  verificar('el primer ingreso con señal se la pone', JSON.parse(almacen.getItem('aps_boveda_' + DOC_A)).custodia);

  console.log('\n=== 8. Sin custodia que sirva: nada se borra y se abre con la anterior ===');

  almacen = almacenSimulado();
  const original = (await abierta(almacen, DOC_A, CLAVE_A, { custodia: CUSTODIA })).boveda;
  const sobresViejos = original.sellarFichas([ficha]);
  const borradorViejo = original.sellarTexto('aps_borrador_7', 'borrador viejo');
  almacen.setItem(borradorViejo.clave, borradorViejo.valor);
  const listaViejaEnCurso = original.sellarTexto('aps_en_curso_7', '[1]');
  almacen.setItem(listaViejaEnCurso.clave, listaViejaEnCurso.valor);

  const siguiente = await abierta(almacen, DOC_A, CLAVE_NUEVA, { custodia: OTRA_CUSTODIA });
  const hoy = siguiente.boveda;
  verificar('con otra custodia no se recupera: llave nueva', siguiente.resultado.llaveNueva === true, JSON.stringify(siguiente.resultado));
  verificar('lo viejo no se lee', !hoy.esLegible(sobresViejos[0]));
  verificar('ni se da por perdido: hay llaves anteriores', hoy.hayLlavesAnteriores());
  verificar('el borrador viejo tampoco se lee', hoy.leerTexto('aps_borrador_7') === null);
  verificar('pero se sabe que está', hoy.tieneDeOtraLlave('aps_borrador_7'));
  verificar('la llave nueva ya trae custodia', JSON.parse(almacen.getItem('aps_boveda_' + DOC_A)).custodia);

  /* Escribir un borrador nuevo no pisa el viejo. */
  const borradorNuevo = hoy.sellarTexto('aps_borrador_7', 'borrador nuevo');
  almacen.setItem(borradorNuevo.clave, borradorNuevo.valor);
  verificar('el nuevo se lee', hoy.leerTexto('aps_borrador_7') === 'borrador nuevo');
  verificar('el viejo sigue aparte', hoy.tieneDeOtraLlave('aps_borrador_7'));
  hoy.borrarTexto('aps_en_curso_7');
  verificar('borrar lo de hoy tampoco se lleva lo viejo', hoy.tieneDeOtraLlave('aps_en_curso_7'));

  verificar('una contraseña que no es, no abre nada', await hoy.recuperarAnteriores('NoEsLaClave2026') === 0);
  verificar('sigue sin leerse', !hoy.esLegible(sobresViejos[0]));
  verificar('la contraseña anterior abre', await hoy.recuperarAnteriores(CLAVE_A) === 1);
  verificar('ya se lee', hoy.abrirFichas(sobresViejos)[0].nombre === SECRETO_DE_PRUEBA);
  verificar('falta volver a cifrarla', hoy.faltaCifrar(sobresViejos[0]));

  const resellada = hoy.sellarFichas(hoy.abrirFichas(sobresViejos))[0];
  verificar('al guardarla queda con la llave de hoy', resellada.sellada !== sobresViejos[0].sellada && !hoy.faltaCifrar(resellada));

  const viejos = hoy.textosDeOtraLlave('aps_borrador_7');
  verificar('el borrador viejo se puede recoger', viejos.length === 1 && viejos[0].texto === 'borrador viejo', viejos.length);
  viejos[0].retirar();
  verificar('y una vez recogido ya no está', !hoy.tieneDeOtraLlave('aps_borrador_7'));
  hoy.textosDeOtraLlave('aps_en_curso_7').forEach(function (t) { t.retirar(); });

  hoy.confirmarRecuperacion();
  verificar('confirmado, no quedan llaves anteriores', !hoy.hayLlavesAnteriores());
  verificar('lo viejo sin volver a cifrar ya no abre', !hoy.esLegible(sobresViejos[0]));
  verificar('lo vuelto a cifrar sí', hoy.esLegible(resellada));

  /* Otra página de ahí en adelante. */
  const despues8 = await abierta(almacen, DOC_A, CLAVE_NUEVA);
  verificar('otra página lee con la contraseña de hoy', despues8.boveda.abrirFichas([resellada]).length === 1);

  console.log('\n=== 9. Lo que estaba en claro pasa a cifrado ===');

  almacen = almacenSimulado();
  const mig = (await abierta(almacen, DOC_A, CLAVE_A)).boveda;
  almacen.setItem('aps_borrador_7', '{"nombre":"' + SECRETO_DE_PRUEBA + '"}');
  verificar('pasa a cifrado', mig.pasarACifrado('aps_borrador_7') === true);
  verificar('no queda en claro', almacen.getItem('aps_borrador_7') === null);
  verificar('tampoco en lo cifrado', almacen.getItem('aps_cifrado_borrador_7').indexOf('María') === -1);
  verificar('se lee igual', JSON.parse(mig.leerTexto('aps_borrador_7')).nombre === SECRETO_DE_PRUEBA);
  verificar('sin nada en claro no hace nada', mig.pasarACifrado('aps_borrador_7') === true);

  /* Una pestaña con la versión anterior siguió escribiendo. */
  almacen.setItem('aps_borrador_7', '"nuevo en claro"');
  const llamadas = [];
  mig.pasarACifrado('aps_borrador_7', function (claro, cifrado) {
    llamadas.push(claro, cifrado);
    return '"fusionado"';
  });
  verificar('si hay de los dos, se fusiona', llamadas[0] === '"nuevo en claro"' && /María/.test(llamadas[1]));
  verificar('y queda lo fusionado', mig.leerTexto('aps_borrador_7') === '"fusionado"' && almacen.getItem('aps_borrador_7') === null);

  /* Cerrada, nada cambia. */
  almacen.setItem('aps_en_curso_7', '[]');
  const sinAbrir = pagina(almacen);
  verificar('cerrada no toca lo que está en claro', sinAbrir.pasarACifrado('aps_en_curso_7') === false && almacen.getItem('aps_en_curso_7') === '[]');

  /* Sin sitio para los dos a la vez: se cambia en el mismo instante. */
  const lleno = almacenSimulado(4000);
  const conLlave = (await abierta(lleno, DOC_A, CLAVE_A)).boveda;
  const grande = 'x'.repeat(2500);
  lleno.setItem('aps_borrador_7', grande);
  verificar('sin sitio para los dos, igual pasa', conLlave.pasarACifrado('aps_borrador_7') === true);
  verificar('sin dejarlo en claro', lleno.getItem('aps_borrador_7') === null && conLlave.leerTexto('aps_borrador_7') === grande);

  /* En WebKit lo cifrado puede ocupar un poco más que en claro, y si no cabe ni
     quitando lo que había, sigue como estaba. */
  const mini = almacenSimulado(3000, true);
  const conLlaveMini = (await abierta(mini, DOC_A, CLAVE_A)).boveda;
  const azaroso = nodeCrypto.randomBytes(500).toString('hex');
  mini.setItem('aps_borrador_7', azaroso);
  let relleno = 3000 - 'relleno'.length - 'aps_borrador_7'.length - azaroso.length;
  mini.datos.forEach(function (v, k) { if (k !== 'aps_borrador_7') relleno -= k.length + v.length; });
  mini.setItem('relleno', 'r'.repeat(relleno));
  verificar('si no cabe, no se pierde', conLlaveMini.pasarACifrado('aps_borrador_7') === false);
  verificar('sigue en claro, igual', mini.getItem('aps_borrador_7') === azaroso);
  verificar('sin dejar nada a medias', mini.getItem('aps_cifrado_borrador_7') === null);

  console.log('\n=== 10. Sin espacio ni para la llave ===');

  const ajustado = almacenSimulado(1000);
  ajustado.setItem('aps_cups_resueltos', 'c'.repeat(700));
  ajustado.setItem('aps_encuestas', 'e'.repeat(150));
  const conCaches = await abierta(ajustado, DOC_A, CLAVE_A);
  verificar('suelta una caché que se puede volver a pedir', conCaches.resultado.ok && ajustado.getItem('aps_cups_resueltos') === null, JSON.stringify(conCaches.resultado));
  verificar('lo pendiente no se toca', ajustado.getItem('aps_encuestas') === 'e'.repeat(150));

  const conCopias = almacenSimulado(1000);
  conCopias.setItem('aps_encuestas', 'e'.repeat(800));
  let soltadas = 0;
  const conSoltar = await abierta(conCopias, DOC_A, CLAVE_A, null, { soltarCopia: function () {
    soltadas++;
    conCopias.setItem('aps_encuestas', 'e'.repeat(100));
    return true;
  } });
  verificar('primero suelta copias ya subidas', conSoltar.resultado.ok && soltadas === 1, JSON.stringify(conSoltar.resultado));

  const sinNada = almacenSimulado(300);
  sinNada.setItem('aps_encuestas', 'e'.repeat(280));
  const imposible = await abierta(sinNada, DOC_A, CLAVE_A);
  verificar('si no hay de dónde, no abre y lo dice', imposible.resultado.ok === false && !imposible.boveda.abierta(), JSON.stringify(imposible.resultado));
  verificar('sin cambiar nada', sinNada.getItem('aps_encuestas') === 'e'.repeat(280));

  console.log('\n=== 11. Del acceso a la aplicación ===');

  almacen = almacenSimulado();
  const sesionTab = almacenSimulado();
  const trabajador = trabajadorSimulado();
  const nav = { serviceWorker: { ready: Promise.resolve({ active: trabajador }) } };

  const acceso = (await abierta(almacen, DOC_A, CLAVE_A, null, { navigator: nav, sesion: sesionTab })).boveda;
  const sobresAcceso = acceso.sellarFichas([ficha]);
  verificar('entrega', await acceso.entregar() === true);
  verificar('deja la marca de que viene en camino', sesionTab.getItem('aps_llave_en_camino') === 'si');
  verificar('la marca no dice nada de la llave', sesionTab.datos.size === 1);
  let enElAlmacen = false;
  const llaveEnHexa = almacen.getItem('aps_boveda_' + DOC_A);
  enElAlmacen = llaveEnHexa === null;
  verificar('nada nuevo en el almacenamiento', !enElAlmacen && almacen.datos.size === 1, almacen.datos.size);

  const aplicacion = pagina(almacen, { navigator: nav, sesion: sesionTab });
  verificar('la página siguiente sabe que viene', aplicacion.hayEntregaEnCamino());
  const avisosEntrega = [];
  aplicacion.alAbrir(function (primera) { avisosEntrega.push(primera); });
  verificar('la recibe', await aplicacion.recibir(DOC_A) === true && aplicacion.abierta());
  verificar('lee con ella', aplicacion.abrirFichas(sobresAcceso)[0].nombre === SECRETO_DE_PRUEBA);
  verificar('avisa que abrió', avisosEntrega.join() === 'true');
  verificar('quita la marca', sesionTab.getItem('aps_llave_en_camino') === null);

  const tercera = pagina(almacen, { navigator: nav, sesion: sesionTab });
  verificar('una tercera página no recibe nada: es de un solo uso', await tercera.recibir(DOC_A) === false && !tercera.abierta());

  /* La marca sin nada en el trabajador. */
  sesionTab.setItem('aps_llave_en_camino', 'si');
  verificar('si no llegó, se pide la contraseña', await pagina(almacen, { navigator: nav, sesion: sesionTab }).recibir(DOC_A) === false);

  /* De otra persona. */
  await acceso.entregar();
  const deOtro = pagina(almacen, { navigator: nav, sesion: sesionTab });
  verificar('la de otra persona no se acepta', await deOtro.recibir(DOC_B) === false && !deOtro.abierta());

  /* Cambió la llave entre medias. */
  await acceso.entregar();
  const metaCambiada = JSON.parse(almacen.getItem('aps_boveda_' + DOC_A));
  metaCambiada.id = 'ffffffff';
  almacen.setItem('aps_boveda_' + DOC_A, JSON.stringify(metaCambiada));
  verificar('si ya no es la vigente, no se acepta', await pagina(almacen, { navigator: nav, sesion: sesionTab }).recibir(DOC_A) === false);

  /* Sin service worker. */
  const sinTrabajador = (await abierta(almacenSimulado(), DOC_A, CLAVE_A, null, { sesion: almacenSimulado() })).boveda;
  verificar('sin service worker no entrega', await sinTrabajador.entregar() === false);
  verificar('cerrada no entrega', await pagina(almacenSimulado()).entregar() === false);

  console.log('\n=== 12. Donde no se puede cifrar ===');

  const sinCrypto = pagina(almacenSimulado(), { sinCrypto: true });
  verificar('lo dice', !sinCrypto.disponible());
  const respuesta = await sinCrypto.prepararApertura(DOC_A, CLAVE_A).abrir();
  verificar('no abre, sin lanzar', respuesta.ok === false && respuesta.codigo === 'no_disponible', JSON.stringify(respuesta));

  console.log('\n=== 13. La contraseña normaliza igual que el servidor ===');

  const compuesta = 'CaféClave2026';
  const precompuesta = 'CaféClave2026';
  almacen = almacenSimulado();
  await abierta(almacen, DOC_A, compuesta);
  const norm = await abierta(almacen, DOC_A, precompuesta);
  verificar('dos formas de la misma letra son la misma contraseña', norm.resultado.ok && !norm.resultado.llaveNueva, JSON.stringify(norm.resultado));

  console.log('\n' + pasadas + ' pasadas, ' + fallidas + ' fallidas.');
  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch(function (error) {
  console.error('La prueba se detuvo:', error);
  process.exit(1);
});
