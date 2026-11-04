/* =========================================================================
   Banco de pruebas de la aplicación instalada
   -------------------------------------------------------------------------
   Tres cosas que una prueba normal no puede hacer contra el servidor de siempre:

   1. Quitar la red de verdad. `setOffline` del navegador cambia navigator.onLine,
      pero un service worker puede seguir saliendo según el motor. Aquí el navegador
      habla con un proxy TCP propio, que puede dejar pasar, cortar o colgar.
      Con él cortado, lo que abra es porque está en el dispositivo.

   2. Señal débil. «Colgar» acepta la conexión y nunca contesta: lo que hace una
      rayita de señal, y lo que más engaña a la aplicación, porque navigator.onLine
      sigue diciendo que hay red.

   3. Publicar una versión nueva. La aplicación se sirve desde una copia temporal,
      y «publicar» es editar esa copia. Los archivos del proyecto no se tocan.

   La copia no lleva .env.local y corre en una carpeta sin él: el servidor no tiene
   de dónde sacar la dirección de Neon. bd/base_local.js pone la de la copia local.
   ========================================================================= */

'use strict';

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');

/* Lo que se publica: lo mismo que deja pasar .vercelignore, sin lo que el
   servidor no necesita. */
const CARPETAS = ['api', 'iconos', 'vendor'];
const EXTENSIONES = ['.html', '.js', '.css', '.png', '.webmanifest', '.json'];
const FUERA = ['package-lock.json', 'skills-lock.json', 'playwright.config.js', 'playwright.config.lento.js',
  'playwright.config.encuesta.js', 'playwright.config.pwa.js'];

function asegurarBaseLocal() {
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const host = (function () { try { return new URL(cadena).hostname; } catch (e) { return ''; } })();
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Esta prueba escribe en la base: sólo corre contra la copia local (base actual: ' + (host || 'sin definir') + ').');
  }
}

function copiarAplicacion() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'aps-pwa-'));
  fs.readdirSync(RAIZ).forEach(function (nombre) {
    const origen = path.join(RAIZ, nombre);
    if (!fs.statSync(origen).isFile()) return;
    if (FUERA.indexOf(nombre) !== -1 || EXTENSIONES.indexOf(path.extname(nombre)) === -1) return;
    fs.copyFileSync(origen, path.join(destino, nombre));
  });
  CARPETAS.forEach(function (carpeta) {
    fs.cpSync(path.join(RAIZ, carpeta), path.join(destino, carpeta), { recursive: true });
  });
  return destino;
}

function esperarPuerto(puerto, limiteMs) {
  const inicio = Date.now();
  return new Promise(function (resolver, rechazar) {
    (function intentar() {
      const socket = net.connect(puerto, '127.0.0.1');
      socket.once('connect', function () { socket.destroy(); resolver(); });
      socket.once('error', function () {
        socket.destroy();
        if (Date.now() - inicio > limiteMs) rechazar(new Error('El servidor de prueba no arrancó en el puerto ' + puerto));
        else setTimeout(intentar, 200);
      });
    })();
  });
}

function crearProxy(puertoDestino) {
  const vivas = new Set();
  let modo = 'pasar';

  const servidor = net.createServer(function (entrante) {
    vivas.add(entrante);
    entrante.on('close', function () { vivas.delete(entrante); });
    entrante.on('error', function () {});

    if (modo === 'cortar') { entrante.destroy(); return; }
    if (modo === 'colgar') return;

    const saliente = net.connect(puertoDestino, '127.0.0.1');
    vivas.add(saliente);
    saliente.on('close', function () { vivas.delete(saliente); entrante.destroy(); });
    saliente.on('error', function () { entrante.destroy(); });
    entrante.on('close', function () { saliente.destroy(); });
    entrante.pipe(saliente);
    saliente.pipe(entrante);
  });

  return {
    servidor: servidor,
    /* Soltar lo que esté abierto: el navegador reutiliza las conexiones, y una
       viva seguiría llegando al servidor aunque se haya «cortado» la red. */
    fijarModo: function (nuevo) {
      modo = nuevo;
      vivas.forEach(function (socket) { socket.destroy(); });
    },
    escuchar: function (puerto) {
      return new Promise(function (resolver) { servidor.listen(puerto, '127.0.0.1', resolver); });
    },
    cerrar: function () {
      vivas.forEach(function (socket) { socket.destroy(); });
      return new Promise(function (resolver) { servidor.close(function () { resolver(); }); });
    }
  };
}

async function montarBanco(opciones) {
  asegurarBaseLocal();

  const puertoProxy = opciones.puerto;
  const puertoServidor = opciones.puerto + 1;
  const carpeta = copiarAplicacion();

  /* Sin las variables de Neon que .env.local haya dejado en este proceso. */
  const entorno = Object.assign({}, process.env, {
    PUERTO: String(puertoServidor),
    NODE_PATH: path.join(RAIZ, 'node_modules')
  });
  ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGPORT', 'DATABASE_URL', 'POSTGRES_URL', 'NODE_ENV', 'VERCEL']
    .forEach(function (variable) { delete entorno[variable]; });

  const proceso = spawn(process.execPath, ['-r', path.join(RAIZ, 'bd', 'base_local.js'), 'servidor.js'], {
    cwd: carpeta,
    env: entorno,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const salida = [];
  proceso.stdout.on('data', function (d) { salida.push(String(d)); });
  proceso.stderr.on('data', function (d) { salida.push(String(d)); });

  await esperarPuerto(puertoServidor, 30000);

  const proxy = crearProxy(puertoServidor);
  await proxy.escuchar(puertoProxy);

  return {
    url: 'http://localhost:' + puertoProxy,
    carpeta: carpeta,
    salida: salida,
    conRed: function () { proxy.fijarModo('pasar'); },
    sinRed: function () { proxy.fijarModo('cortar'); },
    colgada: function () { proxy.fijarModo('colgar'); },

    /* «Publicar» es cambiar un archivo de la copia. */
    publicar: function (archivo, cambiar) {
      const ruta = path.join(carpeta, archivo);
      fs.writeFileSync(ruta, cambiar(fs.readFileSync(ruta, 'utf8')));
    },
    retirar: function (archivo) { fs.unlinkSync(path.join(carpeta, archivo)); },
    leer: function (archivo) { return fs.readFileSync(path.join(carpeta, archivo)); },
    escribir: function (archivo, contenido) { fs.writeFileSync(path.join(carpeta, archivo), contenido); },

    desmontar: async function () {
      await proxy.cerrar();
      proceso.kill();
      await new Promise(function (resolver) { proceso.once('exit', resolver); setTimeout(resolver, 3000); });
      try { fs.rmSync(carpeta, { recursive: true, force: true, maxRetries: 3 }); } catch (error) { /* temporal */ }
    }
  };
}

module.exports = { montarBanco, asegurarBaseLocal };
