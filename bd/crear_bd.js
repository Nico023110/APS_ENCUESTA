/* =========================================================================
   APS APP — Creación de la base de datos local
   -------------------------------------------------------------------------
   Crea la base, ejecuta los cinco scripts en orden y verifica el resultado.

   Uso:   npm run bd:crear          (crea si no existe y aplica los scripts)
          npm run bd:crear -- --recrear   (BORRA la base y la vuelve a crear)

   POR QUÉ psql Y NO node-postgres
   `04_cups.sql` carga los 10.024 procedimientos con `\copy`, que es un
   meta-comando de psql y no una sentencia SQL: el driver no lo entiende.
   Ejecutar todo por psql evita reimplementar la carga y da errores con
   número de línea del archivo que falló.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

const { Client } = require('pg');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DIR_BD = __dirname;

/* Los scripts se aplican en este orden: la estructura antes que los datos,
   los catálogos antes que las reglas que los referencian. */
const SCRIPTS = [
  { archivo: '01_esquema.sql', descripcion: 'Estructura — 54 tablas, 3 esquemas' },
  { archivo: '02_catalogos_seed.sql', descripcion: 'Catálogos — dominios, territorios, EAPB' },
  { archivo: '03_reglas.sql', descripcion: 'Cálculos, disparadores y validación de cierre' },
  { archivo: '04_cups.sql', descripcion: 'CUPS — 10.024 procedimientos (\\copy)' },
  { archivo: '05_nocups.sql', descripcion: 'NoCUPS y mapeo regla → acción' },
  /* Idempotente: sobre una base recién creada no encuentra nada que hacer.
     Existe para las bases que ya tienen fichas capturadas y no se pueden
     recrear. Ver el encabezado de 06_migraciones.sql. */
  { archivo: '06_migraciones.sql', descripcion: 'Migraciones sobre bases ya creadas' }
];

/* ---------------------------------------------------------
   1. CONEXIÓN
   --------------------------------------------------------- */

function leerCadenaConexion() {
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!cadena) {
    console.error('\nERROR: no hay DATABASE_URL ni POSTGRES_URL definidas.');
    console.error('Cree el archivo .env.local en la raíz del proyecto con:\n');
    console.error('  DATABASE_URL=postgresql://postgres:LA_CLAVE@localhost:5432/aps_encuesta\n');
    console.error('Puede copiar .env.example como punto de partida.\n');
    process.exit(1);
  }

  let url;
  try {
    url = new URL(cadena);
  } catch (error) {
    console.error('\nERROR: DATABASE_URL no es una URL válida:', cadena, '\n');
    process.exit(1);
  }

  return {
    cadena: cadena,
    host: url.hostname,
    puerto: url.port || '5432',
    usuario: decodeURIComponent(url.username),
    clave: decodeURIComponent(url.password),
    base: url.pathname.replace(/^\//, ''),
    esLocal: url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  };
}

/* Postgres local no habla SSL; Neon lo exige. Decidirlo por el host evita
   tener que cambiar código al pasar de desarrollo a la nube. */
function opcionesSsl(conexion) {
  return conexion.esLocal ? false : { rejectUnauthorized: false };
}

/* ---------------------------------------------------------
   2. CREACIÓN DE LA BASE
   --------------------------------------------------------- */

/* CREATE DATABASE no admite IF NOT EXISTS ni puede correr dentro de una
   transacción, así que se consulta primero contra la base de mantenimiento. */
async function crearBaseSiNoExiste(conexion, recrear) {
  const urlMantenimiento = new URL(conexion.cadena);
  urlMantenimiento.pathname = '/postgres';

  const cliente = new Client({
    connectionString: urlMantenimiento.toString(),
    ssl: opcionesSsl(conexion)
  });

  try {
    await cliente.connect();
  } catch (error) {
    console.error('\nERROR: no fue posible conectar a PostgreSQL en ' +
      conexion.host + ':' + conexion.puerto);
    console.error('  ' + error.message);
    if (/password|autenticación|authentication/i.test(error.message)) {
      console.error('\n  Revise el usuario y la clave en .env.local.');
    }
    console.error('');
    process.exit(1);
  }

  const existe = await cliente.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [conexion.base]
  );

  if (existe.rows.length > 0 && recrear) {
    console.log('  Cerrando conexiones abiertas a "' + conexion.base + '"...');
    await cliente.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [conexion.base]
    );
    console.log('  Eliminando la base "' + conexion.base + '"...');
    await cliente.query('DROP DATABASE ' + JSON.stringify(conexion.base));
  }

  if (existe.rows.length === 0 || recrear) {
    console.log('  Creando la base "' + conexion.base + '"...');
    await cliente.query(
      'CREATE DATABASE ' + JSON.stringify(conexion.base) + " ENCODING 'UTF8' TEMPLATE template0"
    );
  } else {
    console.log('  La base "' + conexion.base + '" ya existe. Los scripts son idempotentes.');
  }

  await cliente.end();
}

/* ---------------------------------------------------------
   3. EJECUCIÓN DE LOS SCRIPTS
   --------------------------------------------------------- */

function ejecutarScript(conexion, script) {
  const ruta = path.join(DIR_BD, script.archivo);

  if (!fs.existsSync(ruta)) {
    console.error('  ERROR: no se encontró ' + script.archivo);
    process.exit(1);
  }

  /* cwd = bd/ porque el `\copy` de 04_cups.sql referencia 'cups.csv'
     por ruta relativa. */
  const resultado = spawnSync('psql', [
    '--dbname=' + conexion.cadena,
    '--file=' + script.archivo,
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-psqlrc'
  ], {
    cwd: DIR_BD,
    env: Object.assign({}, process.env, {
      PGPASSWORD: conexion.clave,
      PGCLIENTENCODING: 'UTF8'
    }),
    encoding: 'utf8'
  });

  if (resultado.error && resultado.error.code === 'ENOENT') {
    console.error('\nERROR: no se encontró el ejecutable "psql" en el PATH.');
    console.error('  En Windows suele estar en C:\\Program Files\\PostgreSQL\\17\\bin');
    console.error('  Agregue esa carpeta al PATH y vuelva a intentar.\n');
    process.exit(1);
  }

  if (resultado.status !== 0) {
    console.error('\n  FALLÓ ' + script.archivo + ':\n');
    console.error(resultado.stderr || resultado.stdout);
    process.exit(1);
  }

  /* psql escribe los NOTICE en stderr aunque todo haya salido bien. */
  if (resultado.stderr && resultado.stderr.trim()) {
    const avisos = resultado.stderr.trim().split('\n')
      .filter(function (linea) { return !/^NOTICE:/.test(linea); });
    if (avisos.length > 0) console.log('    ' + avisos.join('\n    '));
  }
}

/* ---------------------------------------------------------
   4. VERIFICACIÓN
   --------------------------------------------------------- */

async function verificar(conexion) {
  const cliente = new Client({
    connectionString: conexion.cadena,
    ssl: opcionesSsl(conexion)
  });
  await cliente.connect();

  const tablas = await cliente.query(`
    SELECT table_schema AS esquema, count(*)::int AS tablas
      FROM information_schema.tables
     WHERE table_schema IN ('cat', 'aps', 'aud') AND table_type = 'BASE TABLE'
     GROUP BY table_schema
     ORDER BY table_schema
  `);

  const conteos = await cliente.query(`
    SELECT 'cat.cups'            AS tabla, count(*)::int AS filas FROM cat.cups
    UNION ALL SELECT 'cat.opcion',          count(*)::int FROM cat.opcion
    UNION ALL SELECT 'cat.territorio',      count(*)::int FROM cat.territorio
    UNION ALL SELECT 'cat.microterritorio', count(*)::int FROM cat.microterritorio
    UNION ALL SELECT 'cat.eapb',            count(*)::int FROM cat.eapb
    UNION ALL SELECT 'cat.accion_sugerida', count(*)::int FROM cat.accion_sugerida
    ORDER BY tabla
  `);

  const disparadores = await cliente.query(`
    SELECT count(*)::int AS total
      FROM information_schema.triggers
     WHERE trigger_schema IN ('aps', 'aud')
  `);

  await cliente.end();

  console.log('\n  Tablas por esquema');
  tablas.rows.forEach(function (fila) {
    console.log('    ' + fila.esquema.padEnd(6) + String(fila.tablas).padStart(4));
  });

  console.log('\n  Filas de catálogo');
  conteos.rows.forEach(function (fila) {
    console.log('    ' + fila.tabla.padEnd(22) + String(fila.filas).padStart(7));
  });

  console.log('\n  Disparadores activos: ' + disparadores.rows[0].total);
}

/* ---------------------------------------------------------
   5. ORQUESTACIÓN
   --------------------------------------------------------- */

async function principal() {
  const recrear = process.argv.includes('--recrear');
  /* Sobre una base con fichas capturadas no se puede correr 01_esquema.sql
     —sus CREATE TABLE no llevan IF NOT EXISTS— ni mucho menos recrearla. Con
     esta bandera se aplican sólo las migraciones, que sí son idempotentes. */
  const soloMigraciones = process.argv.includes('--migrar');
  const conexion = leerCadenaConexion();

  console.log('\n  APS APP — Base de datos');
  console.log('  ' + '-'.repeat(52));
  console.log('  Servidor: ' + conexion.host + ':' + conexion.puerto +
    (conexion.esLocal ? '  (local, sin SSL)' : '  (remoto, con SSL)'));
  console.log('  Base:     ' + conexion.base);
  console.log('  Usuario:  ' + conexion.usuario);
  console.log('');

  if (recrear && !conexion.esLocal) {
    console.error('  --recrear está bloqueado contra servidores remotos.\n');
    process.exit(1);
  }

  const pendientes = soloMigraciones
    ? SCRIPTS.filter(function (script) { return /migraciones\.sql$/.test(script.archivo); })
    : SCRIPTS;

  if (!soloMigraciones) await crearBaseSiNoExiste(conexion, recrear);

  console.log('');
  for (let i = 0; i < pendientes.length; i++) {
    const script = pendientes[i];
    process.stdout.write('  [' + (i + 1) + '/' + pendientes.length + '] ' +
      script.archivo.padEnd(34) + script.descripcion + '\n');
    ejecutarScript(conexion, script);
  }

  await verificar(conexion);

  console.log('\n  Base de datos lista.\n');
}

principal().catch(function (error) {
  console.error('\n  ERROR inesperado:', error.message, '\n');
  process.exit(1);
});
