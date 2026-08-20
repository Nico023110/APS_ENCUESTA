/* =========================================================
   Encuesta_APS — Servidor local de desarrollo
   ---------------------------------------------------------
   Los navegadores bloquean la geolocalización y las consultas
   de red cuando la página se abre con doble clic (file://).
   Este servidor sirve la aplicación desde http://localhost,
   que sí es un origen seguro.

   Uso:   node servidor.js
          y abrir http://localhost:5173

   No requiere instalar dependencias.
   ========================================================= */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = Number(process.env.PUERTO) || 5173;
const RAIZ = __dirname;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.md': 'text/plain; charset=utf-8'
};

const servidor = http.createServer(function (peticion, respuesta) {
  const ruta = decodeURIComponent(peticion.url.split('?')[0]);
  const relativa = ruta === '/' ? 'index.html' : ruta.replace(/^\/+/, '');
  const absoluta = path.join(RAIZ, relativa);

  // Impide salir del directorio del proyecto.
  if (!absoluta.startsWith(RAIZ)) {
    respuesta.writeHead(403).end('Acceso denegado');
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
});

servidor.listen(PUERTO, function () {
  console.log('');
  console.log('  Encuesta_APS en marcha');
  console.log('  ----------------------');
  console.log('  Abra:  http://localhost:' + PUERTO);
  console.log('');
  console.log('  Desde este origen el navegador habilita el GPS y la');
  console.log('  búsqueda automática de coordenadas. Ctrl+C para detener.');
  console.log('');
});
