/* =========================================================
   Encuesta_APS — Conexión compartida a PostgreSQL
   ---------------------------------------------------------
   Un solo pool para todos los endpoints. El prefijo _ hace que
   Vercel no lo publique como función: es un módulo interno.

   SSL SEGÚN EL HOST
   Neon exige SSL; un PostgreSQL local no lo habla y rechaza el
   intento. Antes estaba fijo en `rejectUnauthorized: false`, lo
   que impedía trabajar contra una base local. Ahora se decide
   por el host, y el mismo código sirve en ambos entornos.
   ========================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

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
    pool = new Pool({
      connectionString: CADENA,
      ssl: esLocal(CADENA) ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

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

module.exports = { obtenerPool, enTransaccion, consultar, esLocal };
