/* =========================================================================
   Encuesta_APS — Arrancar contra la copia local de la base
   -------------------------------------------------------------------------
   Uso:   npm run dev:local     y abrir http://localhost:5173

   `.env.local` apunta a Neon, la base que usa la aplicación desplegada, y
   además define PGPASSWORD, PGUSER y PGHOST con los datos de Neon. Este
   archivo se precarga antes que servidor.js (node -r) y cambia la conexión
   a la copia local `aps_encuesta`.

   La clave sale del pgpass.conf de PostgreSQL y sólo vive en la memoria del
   proceso: no se escribe en ningún archivo del proyecto. Va dentro de la
   cadena de conexión porque ahí gana a las variables PG* de Neon, que
   servidor.js vuelve a cargar con dotenv.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const HOST = 'localhost';
const PUERTO = '5432';
const BASE = 'aps_encuesta';
const USUARIO = 'postgres';

/* Formato de pgpass: host:puerto:base:usuario:clave, con * como comodín y
   \: o \\ escapados. */
function claveDePgpass() {
  const archivo = process.env.PGPASSFILE ||
    (process.platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'postgresql', 'pgpass.conf')
      : path.join(process.env.HOME || '', '.pgpass'));
  if (!fs.existsSync(archivo)) return null;

  const coincide = function (patron, valor) { return patron === '*' || patron === valor; };

  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    if (!linea || linea.charAt(0) === '#') continue;
    const campos = linea.split(/(?<!\\):/).map(function (c) { return c.replace(/\\([:\\])/g, '$1'); });
    if (campos.length < 5) continue;
    if (coincide(campos[0], HOST) && coincide(campos[1], PUERTO) &&
        coincide(campos[2], BASE) && coincide(campos[3], USUARIO)) {
      return campos.slice(4).join(':');
    }
  }
  return null;
}

const clave = claveDePgpass();
if (clave === null) {
  console.error('\n  No hay clave para ' + USUARIO + '@' + HOST + ':' + PUERTO + ' en pgpass.conf.\n');
  process.exit(1);
}

const url = new URL('postgresql://' + HOST + ':' + PUERTO + '/' + BASE);
url.username = USUARIO;
url.password = clave;

process.env.DATABASE_URL = url.toString();
process.env.POSTGRES_URL = url.toString();

console.log('  Base: copia local (' + HOST + ':' + PUERTO + '/' + BASE + ')');
