/* =========================================================
   Encuesta_APS — Servidor local de desarrollo
   ---------------------------------------------------------
   Los navegadores bloquean la geolocalización y las consultas
   de red cuando la página se abre con doble clic (file://).
   Este servidor sirve la aplicación desde http://localhost,
   que sí es un origen seguro.

   Además enruta /api/* a los manejadores de la carpeta api/,
   emulando el contrato de las funciones serverless de Vercel
   (req.body ya parseado, res.status().json()). Sin esto la
   sincronización sólo se podía probar desplegada.

   Uso:   npm run dev
          y abrir http://localhost:5173
   ========================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PUERTO = Number(process.env.PUERTO) || 5173;
/* Detrás de Apache (XAMPP) se fija HOST=127.0.0.1: Node sólo atiende al
   proxy de la misma máquina y nadie de la red le llega sin pasar por Apache. */
const HOST = process.env.HOST || undefined;
const RAIZ = __dirname;
const DIR_API = path.join(RAIZ, 'api');

/* Tamaño máximo del cuerpo de una petición. Una ficha con varias familias
   y sus integrantes ronda los 100 KB; 5 MB deja margen sin exponer el
   proceso a que lo tumben con un cuerpo enorme. */
const LIMITE_CUERPO = 5 * 1024 * 1024;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* Tipos de texto: se comprimen con gzip si el navegador lo acepta. El JS y
   el CSS de la aplicación suman ~1,2 MB y bajan a ~300 KB; en un teléfono
   con datos móviles es la diferencia que más se nota. */
const COMPRIMIBLES = ['.html', '.js', '.css', '.json', '.csv', '.md', '.svg'];

/* Nunca se sirven por HTTP, aunque estén en la carpeta del proyecto. */
const VETADOS = [/^\.env/, /^\.git/, /^node_modules/, /^bd\//, /^pruebas\//, /^\.claude/, /^\.impeccable/];

/* Cabeceras de seguridad. Las mismas que declara vercel.json para producción;
   aquí se aplican en desarrollo para que lo que rompa la CSP rompa antes de
   desplegar. Los orígenes permitidos son exactamente los CDN que index.html
   ya carga: iconos y SweetAlert2 (jsdelivr) y Google Fonts. unpkg salió en
   octubre de 2026, cuando los iconos pasaron a una hoja fija de jsdelivr. */
const CABECERAS_SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), payment=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data:",
    "connect-src 'self' https://nominatim.openstreetmap.org https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};

/* =========================================================
   1. EMULACIÓN DEL CONTRATO DE VERCEL
   ========================================================= */

/* Los manejadores de api/ están escritos para Vercel, que entrega el cuerpo
   ya parseado y añade helpers a la respuesta. Node crudo no hace ninguna de
   las dos cosas, así que se añaden aquí y el mismo archivo sirve en ambos
   entornos sin bifurcaciones. */
function adaptarRespuesta(respuesta) {
  respuesta.status = function (codigo) {
    respuesta.statusCode = codigo;
    return respuesta;
  };

  respuesta.json = function (cuerpo) {
    const texto = JSON.stringify(cuerpo);
    respuesta.setHeader('Content-Type', 'application/json; charset=utf-8');
    respuesta.end(texto);
    return respuesta;
  };

  respuesta.send = function (cuerpo) {
    if (cuerpo === null || cuerpo === undefined) return respuesta.end();
    if (typeof cuerpo === 'object') return respuesta.json(cuerpo);
    respuesta.setHeader('Content-Type', 'text/plain; charset=utf-8');
    respuesta.end(String(cuerpo));
    return respuesta;
  };

  return respuesta;
}

function leerCuerpo(peticion) {
  return new Promise(function (resolver, rechazar) {
    const trozos = [];
    let total = 0;

    peticion.on('data', function (trozo) {
      total += trozo.length;
      if (total > LIMITE_CUERPO) {
        rechazar(new Error('El cuerpo de la petición supera ' + (LIMITE_CUERPO / 1024 / 1024) + ' MB'));
        peticion.destroy();
        return;
      }
      trozos.push(trozo);
    });

    peticion.on('end', function () {
      const texto = Buffer.concat(trozos).toString('utf8');
      if (!texto) return resolver(undefined);

      const tipo = peticion.headers['content-type'] || '';
      if (tipo.indexOf('application/json') === -1) return resolver(texto);

      try {
        resolver(JSON.parse(texto));
      } catch (error) {
        rechazar(new Error('El cuerpo no es JSON válido: ' + error.message));
      }
    });

    peticion.on('error', rechazar);
  });
}

/* Los manejadores comparten módulos —roles.js, api/_auth.js, reglas.js…— que
   require() guarda en caché. Recargar sólo el manejador dejaba esos módulos
   con la versión con que arrancó el servidor: un permiso nuevo en roles.js no
   contaba hasta reiniciar, y el manejador nuevo respondía con la regla vieja.
   Si alguno cambió en disco, se sueltan todos los módulos del proyecto para
   que se vuelvan a cargar juntos. _db.js se conserva: guarda el pool de
   conexiones, y soltarlo dejaría conexiones abiertas sin dueño. */
const fechaDeCarga = new Map();

function modulosDelProyecto() {
  const dependencias = path.sep + 'node_modules' + path.sep;
  return Object.keys(require.cache).filter(function (ruta) {
    return ruta.indexOf(RAIZ + path.sep) === 0 && ruta.indexOf(dependencias) === -1 &&
      ruta !== __filename && path.basename(ruta) !== '_db.js';
  });
}

function modificadoEn(ruta) {
  try { return fs.statSync(ruta).mtimeMs; } catch (error) { return null; }
}

function soltarModulosModificados() {
  const propios = modulosDelProyecto();
  const alguno = propios.some(function (ruta) {
    return fechaDeCarga.has(ruta) && fechaDeCarga.get(ruta) !== modificadoEn(ruta);
  });
  if (!alguno) return;
  propios.forEach(function (ruta) {
    delete require.cache[ruta];
    fechaDeCarga.delete(ruta);
  });
}

function recordarFechasDeCarga() {
  modulosDelProyecto().forEach(function (ruta) {
    if (!fechaDeCarga.has(ruta)) fechaDeCarga.set(ruta, modificadoEn(ruta));
  });
}

/* Se recarga el manejador en cada petición para poder editarlo sin
   reiniciar el servidor, y con él los módulos del proyecto que hayan
   cambiado. Es deliberado y sólo vale en desarrollo. */
function cargarManejador(nombre) {
  const ruta = path.join(DIR_API, nombre + '.js');
  if (!fs.existsSync(ruta)) return null;

  soltarModulosModificados();
  delete require.cache[require.resolve(ruta)];
  const modulo = require(ruta);
  recordarFechasDeCarga();
  return typeof modulo === 'function' ? modulo : modulo.default;
}

async function atenderApi(peticion, respuesta, nombre) {
  const manejador = cargarManejador(nombre);

  if (!manejador) {
    respuesta.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    respuesta.end(JSON.stringify({ error: 'No existe el endpoint /api/' + nombre }));
    return;
  }

  adaptarRespuesta(respuesta);
  respuesta.setHeader('X-Content-Type-Options', 'nosniff');
  respuesta.setHeader('Cache-Control', 'no-store');

  try {
    peticion.body = await leerCuerpo(peticion);
  } catch (error) {
    respuesta.status(400).json({ error: 'Petición mal formada', detalles: error.message });
    return;
  }

  /* Vercel expone la query ya parseada. */
  const consulta = new URL(peticion.url, 'http://localhost').searchParams;
  peticion.query = Object.fromEntries(consulta.entries());

  const inicio = Date.now();
  try {
    await manejador(peticion, respuesta);
  } catch (error) {
    console.error('  [api/' + nombre + '] excepción no capturada:', error);
    if (!respuesta.headersSent) {
      respuesta.status(500).json({ error: 'Error de servidor', detalles: error.message });
    } else {
      respuesta.end();
    }
  }

  console.log('  ' + peticion.method + ' /api/' + nombre +
    ' → ' + respuesta.statusCode + '  (' + (Date.now() - inicio) + ' ms)');
}

/* =========================================================
   2. ARCHIVOS ESTÁTICOS
   ========================================================= */

/* Copias comprimidas por archivo y fecha de modificación: se comprime una
   vez por versión del archivo, no en cada petición. */
const comprimidos = new Map();

function comprimido(absoluta, version, contenido) {
  const guardado = comprimidos.get(absoluta);
  if (guardado && guardado.version === version) return guardado.datos;
  const datos = zlib.gzipSync(contenido, { level: 6 });
  comprimidos.set(absoluta, { version: version, datos: datos });
  return datos;
}

function atenderEstatico(peticion, respuesta, relativa) {
  if (VETADOS.some(function (patron) { return patron.test(relativa); })) {
    respuesta.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    respuesta.end('Acceso denegado');
    return;
  }

  const absoluta = path.join(RAIZ, relativa);

  /* El separador final importa: sin él, una carpeta hermana cuyo nombre
     empiece igual que RAIZ pasaría la comprobación. */
  if (absoluta !== RAIZ && !absoluta.startsWith(RAIZ + path.sep)) {
    respuesta.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    respuesta.end('Acceso denegado');
    return;
  }

  fs.stat(absoluta, function (errorStat, datos) {
    if (errorStat || !datos.isFile()) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      respuesta.end('No se encontró ' + relativa);
      return;
    }

    /* `no-cache` obliga al navegador a preguntar siempre —un archivo editado
       se ve en la siguiente recarga—, pero sin validador cada pregunta bajaba
       el archivo entero. Con la ETag, lo que no cambió responde 304 sin
       cuerpo. */
    const extension = path.extname(absoluta).toLowerCase();
    const version = datos.size + '-' + Math.floor(datos.mtimeMs);
    const etiqueta = 'W/"' + version + '"';
    const cabeceras = Object.assign({
      'Content-Type': TIPOS[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'ETag': etiqueta,
      'Last-Modified': datos.mtime.toUTCString()
    }, CABECERAS_SEGURIDAD);

    const comprimible = COMPRIMIBLES.indexOf(extension) !== -1;
    if (comprimible) cabeceras['Vary'] = 'Accept-Encoding';

    if (peticion.headers['if-none-match'] === etiqueta) {
      respuesta.writeHead(304, cabeceras);
      respuesta.end();
      return;
    }

    fs.readFile(absoluta, function (error, contenido) {
      if (error) {
        respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        respuesta.end('No se encontró ' + relativa);
        return;
      }

      const aceptaGzip = /\bgzip\b/.test(String(peticion.headers['accept-encoding'] || ''));
      if (comprimible && aceptaGzip && contenido.length > 1024) {
        cabeceras['Content-Encoding'] = 'gzip';
        respuesta.writeHead(200, cabeceras);
        respuesta.end(comprimido(absoluta, version, contenido));
        return;
      }

      respuesta.writeHead(200, cabeceras);
      respuesta.end(contenido);
    });
  });
}

/* =========================================================
   3. SERVIDOR
   ========================================================= */

const servidor = http.createServer(function (peticion, respuesta) {
  const ruta = decodeURIComponent(peticion.url.split('?')[0]);

  if (ruta.indexOf('/api/') === 0) {
    const nombre = ruta.slice(5).replace(/\/+$/, '');
    /* Sólo un segmento, sin separadores, y sin prefijo _ : impide
       /api/../secreto y deja los módulos internos fuera del alcance HTTP. */
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(nombre)) {
      respuesta.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      respuesta.end(JSON.stringify({ error: 'Nombre de endpoint inválido' }));
      return;
    }
    atenderApi(peticion, respuesta, nombre);
    return;
  }

  if (ruta === '/login' || ruta === '/login/') {
    atenderEstatico(peticion, respuesta, 'login.html');
    return;
  }

  atenderEstatico(peticion, respuesta, ruta === '/' ? 'index.html' : ruta.replace(/^\/+/, ''));
});

/* Bajo xampp/servicio_api.js el proceso nace con canal IPC. Si el supervisor
   muere (se detuvo la tarea programada), Windows no mata a los hijos: sin
   esto Node quedaría huérfano ocupando el puerto y el siguiente arranque
   fallaría. */
if (process.send) {
  process.on('disconnect', function () { process.exit(0); });
}

servidor.listen(PUERTO, HOST, function () {
  const endpoints = fs.existsSync(DIR_API)
    ? fs.readdirSync(DIR_API).filter(function (a) {
      return a.endsWith('.js') && a.charAt(0) !== '_';
    })
    : [];

  console.log('');
  console.log('  Encuesta_APS en marcha');
  console.log('  ----------------------');
  console.log('  Abra:  http://localhost:' + PUERTO);
  console.log('');

  if (endpoints.length > 0) {
    console.log('  Endpoints disponibles:');
    endpoints.forEach(function (archivo) {
      console.log('    /api/' + archivo.replace(/\.js$/, ''));
    });
    console.log('');
  }

  console.log('  Base de datos: ' +
    (process.env.DATABASE_URL || process.env.POSTGRES_URL
      ? 'configurada en .env.local'
      : 'SIN CONFIGURAR — /api fallará (revise .env.local)'));
  console.log('');
  console.log('  Los manejadores de api/ y los módulos que comparten (roles.js, api/_*.js…)');
  console.log('  se recargan solos al editarlos; api/_db.js exige reiniciar.');
  console.log('  Ctrl+C para detener.');
  console.log('');
});
