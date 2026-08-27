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

const PUERTO = Number(process.env.PUERTO) || 5173;
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
  '.md': 'text/plain; charset=utf-8'
};

/* Nunca se sirven por HTTP, aunque estén en la carpeta del proyecto. */
const VETADOS = [/^\.env/, /^\.git/, /^node_modules/];

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

/* Se recarga el módulo en cada petición para poder editar los manejadores
   sin reiniciar el servidor. Es deliberado y sólo vale en desarrollo. */
function cargarManejador(nombre) {
  const ruta = path.join(DIR_API, nombre + '.js');
  if (!fs.existsSync(ruta)) return null;

  delete require.cache[require.resolve(ruta)];
  const modulo = require(ruta);
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

function atenderEstatico(respuesta, relativa) {
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

  fs.readFile(absoluta, function (error, contenido) {
    if (error) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      respuesta.end('No se encontró ' + relativa);
      return;
    }

    respuesta.writeHead(200, {
      'Content-Type': TIPOS[path.extname(absoluta).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    respuesta.end(contenido);
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

  atenderEstatico(respuesta, ruta === '/' ? 'index.html' : ruta.replace(/^\/+/, ''));
});

servidor.listen(PUERTO, function () {
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
  console.log('  Los manejadores de api/ se recargan solos al editarlos.');
  console.log('  Ctrl+C para detener.');
  console.log('');
});
