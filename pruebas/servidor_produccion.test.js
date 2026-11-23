/* =========================================================================
   Prueba: servidor.js en producción (servidor propio, despliegue/)
   -------------------------------------------------------------------------
   Arranca servidor.js con NODE_ENV=production en un puerto de prueba y
   comprueba que:
     - entrega la aplicación (las páginas y los archivos del service worker);
     - no entrega nada más: ni .env (en mayúsculas o minúsculas: Windows no
       las distingue), ni respaldos, ni documentos, ni el código del servidor;
     - el API responde (sin sesión, 401) y los módulos internos no existen;
     - exige HTTPS al navegador (HSTS) y escucha sólo en este equipo.
   Y en desarrollo, que /.ENV.local tampoco sale. No toca la base.
       node pruebas/servidor_produccion.test.js
   ========================================================================= */

'use strict';

const path = require('path');
const os = require('os');
const net = require('net');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..');
let pasadas = 0;
let fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

function arrancar(puerto, entorno) {
  return new Promise(function (resolver, rechazar) {
    const proceso = spawn(process.execPath, ['servidor.js'], {
      cwd: RAIZ,
      env: Object.assign({}, process.env, { PUERTO: String(puerto), DATABASE_URL: 'postgresql://nadie@127.0.0.1:1/nada' }, entorno),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let salida = '';
    const tope = setTimeout(function () { proceso.kill(); rechazar(new Error('No arrancó: ' + salida)); }, 15000);
    proceso.stdout.on('data', function (d) {
      salida += d;
      if (/en marcha/.test(salida)) { clearTimeout(tope); resolver(proceso); }
    });
    proceso.stderr.on('data', function (d) { salida += d; });
  });
}

async function pedir(puerto, ruta) {
  const r = await fetch('http://127.0.0.1:' + puerto + ruta);
  return { estado: r.status, cabeceras: r.headers, texto: await r.text() };
}

function puedeConectar(host, puerto) {
  return new Promise(function (resolver) {
    const socket = net.connect({ host: host, port: puerto });
    socket.setTimeout(2000);
    socket.on('connect', function () { socket.destroy(); resolver(true); });
    socket.on('error', function () { resolver(false); });
    socket.on('timeout', function () { socket.destroy(); resolver(false); });
  });
}

(async function () {
  const PUERTO = 5291;
  console.log('\n=== Producción ===');
  const produccion = await arrancar(PUERTO, { NODE_ENV: 'production', HOST: '127.0.0.1' });
  try {
    for (const ruta of ['/', '/login', '/instalar', '/sw.js', '/app.js', '/styles.css', '/manifest.webmanifest',
      '/vendor/phosphor/style.css', '/iconos/icono-192.png']) {
      const r = await pedir(PUERTO, ruta);
      verificar('entrega ' + ruta, r.estado === 200, String(r.estado));
    }
    const inicio = await pedir(PUERTO, '/');
    verificar('exige HTTPS al navegador (HSTS) y mantiene la CSP',
      /max-age=31536000/.test(inicio.cabeceras.get('strict-transport-security') || '') &&
      /default-src 'self'/.test(inicio.cabeceras.get('content-security-policy') || ''));

    for (const ruta of ['/.env.local', '/.ENV.local', '/.Env', '/servidor.js', '/package.json', '/vercel.json',
      '/REGLAS_DE_NEGOCIO.md', '/respaldos/copia.dump', '/RESPALDOS/copia.dump', '/bd/01_esquema.sql', '/BD/crear_bd.js',
      '/Microterritorios%20ESE%20LADERA.xlsx', '/despliegue/INSTALACION.md', '/pruebas/servidor_produccion.test.js',
      '/node_modules/pg/package.json', '/.git/config', '/img/', '/playwright.config.js', '/..%2F..%2FWindows/win.ini']) {
      const r = await pedir(PUERTO, ruta);
      verificar('no entrega ' + decodeURIComponent(ruta), r.estado === 404 || r.estado === 403 || r.estado === 400,
        r.estado + ' ' + r.texto.slice(0, 40));
    }

    const sesion = await pedir(PUERTO, '/api/sesion');
    verificar('el API responde: sin sesión, 401', sesion.estado === 401, sesion.estado + ' ' + sesion.texto.slice(0, 60));
    const interno = await pedir(PUERTO, '/api/_db');
    verificar('los módulos internos del API no existen hacia afuera', interno.estado === 400, String(interno.estado));

    const red = Object.values(os.networkInterfaces()).flat()
      .find(function (i) { return i && i.family === 'IPv4' && !i.internal; });
    if (red) {
      verificar('escucha sólo en este equipo: desde la red (' + red.address + ') no se llega',
        (await puedeConectar(red.address, PUERTO)) === false);
    } else {
      console.log('  (sin interfaz de red para probar que no escucha afuera)');
    }
  } finally {
    produccion.kill();
  }

  console.log('\n=== Desarrollo ===');
  const desarrollo = await arrancar(PUERTO + 1, { NODE_ENV: '' });
  try {
    const r = await pedir(PUERTO + 1, '/.ENV.local');
    verificar('en desarrollo /.ENV.local tampoco sale (Windows no distingue mayúsculas)', r.estado === 403, String(r.estado));
    const respaldo = await pedir(PUERTO + 1, '/respaldos/copia.dump');
    verificar('en desarrollo los respaldos tampoco', respaldo.estado === 403, String(respaldo.estado));
    const app = await pedir(PUERTO + 1, '/app.js');
    verificar('en desarrollo la aplicación sí', app.estado === 200, String(app.estado));
  } finally {
    desarrollo.kill();
  }

  console.log('\nPasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
