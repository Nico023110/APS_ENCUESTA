/* =========================================================
   Encuesta_APS — Conexión compartida a PostgreSQL
   ---------------------------------------------------------
   Un solo pool para todos los endpoints. El prefijo _ hace que
   Vercel no lo publique como función: es un módulo interno.

   SSL SEGÚN EL HOST
   Neon exige SSL; un PostgreSQL local no lo habla y rechaza el
   intento. Se decide por el host, y el mismo código sirve en ambos
   entornos. Contra un servidor que no sea local se verifica siempre
   el certificado, su cadena y su nombre: por ahí viajan datos de
   salud. Todas las conexiones del proyecto, también las de los
   scripts de bd/ y las de las pruebas, salen de opcionesConexion().
   ========================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });

const { Pool } = require('pg');

const CADENA = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function esLocal(cadena) {
  try {
    const host = new URL(cadena).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch (error) {
    return false;
  }
}

/* Lo que la cadena puede decir sobre SSL. El controlador le hace caso a la
   cadena antes que a la opción `ssl`: con sslmode=no-verify, ssl=0 o
   uselibpqcompat=true no verificaría aunque aquí se le pida, y Neon entrega
   sslmode=require, que con pg 9 dejará de verificar. Por eso se quitan; el
   resto de la cadena (channel_binding, connect_timeout…) sigue igual. */
const PARAMETROS_SSL = ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation', 'uselibpqcompat'];

/* Las opciones para `new Client` o `new Pool`. rejectUnauthorized va explícito
   porque así NODE_TLS_REJECT_UNAUTHORIZED=0 no puede apagarlo; el nombre del
   host lo comprueba Node mientras nadie le cambie checkServerIdentity. */
function opcionesConexion(cadena) {
  let url;
  try {
    url = new URL(cadena);
  } catch (error) {
    /* Un error nuevo: el `input` del original lleva la clave. */
    throw new Error('La cadena de conexión a la base no es una URL válida.');
  }

  /* El controlador prefiere `?host=` al host de la URL: con él ya no es local. */
  if (esLocal(cadena) && !url.searchParams.has('host')) {
    return { connectionString: cadena, ssl: false };
  }

  PARAMETROS_SSL.forEach(function (parametro) { url.searchParams.delete(parametro); });
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true } };
}

let pool = null;

/* El pool se crea al primer uso y no al importar el módulo, para que la
   falta de configuración se reporte como un error de la petición y no
   tumbe el arranque del servidor. */
function obtenerPool() {
  if (!CADENA) {
    throw new Error(
      'No hay DATABASE_URL ni POSTGRES_URL definidas. Copie .env.example como .env.local.'
    );
  }

  if (!pool) {
    /* max: la lectura de una ficha completa lanza ~20 consultas a la vez
       (aLaVez); con 10 conexiones la mitad esperaba turno.
       idleTimeoutMillis: abrir una conexión a Neon desde Cali cuesta ~600 ms.
       Un servidor que sigue corriendo (local o propio) conserva las suyas 5
       minutos, lo mismo que Neon tarda en dormir la base por inactividad, para
       no mantenerla despierta más de la cuenta; en Vercel, donde la función
       se congela entre peticiones, se mantiene el medio minuto de antes.
       keepAlive detecta las que el otro lado haya cerrado. */
    pool = new Pool(Object.assign(opcionesConexion(CADENA), {
      max: 20,
      idleTimeoutMillis: process.env.VERCEL ? 30000 : 300000,
      keepAlive: true,
      connectionTimeoutMillis: 10000
    }));

    pool.on('error', function (error) {
      console.error('Error inesperado en el pool de PostgreSQL:', error.message);
    });
  }

  return pool;
}

/* Ejecuta una función dentro de una transacción y garantiza el ROLLBACK
   y la devolución de la conexión al pool pase lo que pase. Evita repetir
   el BEGIN/COMMIT/ROLLBACK/release en cada endpoint. */
async function enTransaccion(tarea) {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await tarea(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    try {
      await cliente.query('ROLLBACK');
    } catch (errorRollback) {
      console.error('Falló el ROLLBACK:', errorRollback.message);
    }
    throw error;
  } finally {
    cliente.release();
  }
}

async function consultar(texto, parametros) {
  return obtenerPool().query(texto, parametros);
}

/* Corre lecturas que no dependen entre sí (`tareas`: funciones que devuelven
   una promesa) y devuelve sus resultados en orden. Con el pool van a la vez,
   cada una por su conexión: contra Neon cada ida y vuelta cuesta ~125 ms y
   en serie se suman. Con un cliente —una transacción, como la de
   guardar_encuesta— van una tras otra: pg no admite dos consultas a la vez
   sobre la misma conexión. */
async function aLaVez(ejecutor, tareas) {
  if (ejecutor instanceof Pool) {
    return Promise.all(tareas.map(function (tarea) { return tarea(); }));
  }
  const resultados = [];
  for (const tarea of tareas) resultados.push(await tarea());
  return resultados;
}

module.exports = { obtenerPool, enTransaccion, consultar, esLocal, opcionesConexion, aLaVez };
