/* =========================================================================
   APS APP — Crear varias cuentas de una vez
   -------------------------------------------------------------------------
   Uso:
     npm run usuarios:lote -- --archivo bd/usuarios_lote.local.json [--neon] [--probar]

   El archivo es una lista JSON de cuentas, con los mismos campos que el
   formulario de usuarios:
     [{ "documento": "1144000000", "nombre": "Nombre Apellido", "rol": "lider_ebs",
        "cargo": "Líder Zona Norte", "correo": "...", "telefono": "...",
        "tipoId": "CC", "equipo": "EBS001", "perfil": "enfermeria" }]
   Sólo documento, nombre y rol son obligatorios; el equipo, sólo para el
   personal asistencial (la coordinación lidera zonas y no tiene EBS propio).

     --neon     usa la base de .env.neon (producción); sin él, la de .env.local.
     --probar   valida el archivo y dice qué se crearía, sin escribir nada.

   Una cuenta cuyo documento ya existe se salta: no se le cambia nada ni se
   le restablece la clave (para eso, npm run usuario:crear -- --restablecer).
   Cada cuenta se crea en su propia transacción con el mismo módulo que la
   aplicación (api/_usuarios.js), y su clave temporal se imprime UNA sola vez:
   se entrega en persona y se pide cambiarla en el primer ingreso.

   Los datos personales del archivo no se suben al repositorio: .gitignore
   excluye bd/*.local.json.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const roles = require(path.join(__dirname, '..', 'roles.js'));
const cuentas = require(path.join(__dirname, '..', 'api', '_usuarios.js'));

function leerArgumentos(argv) {
  const salida = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.indexOf('--') !== 0) continue;
    const nombre = arg.slice(2);
    const siguiente = argv[i + 1];
    if (siguiente === undefined || siguiente.indexOf('--') === 0) {
      salida[nombre] = true;
    } else {
      salida[nombre] = siguiente;
      i++;
    }
  }
  return salida;
}

function salir(mensaje) {
  console.error('\nERROR: ' + mensaje + '\n');
  process.exit(1);
}

/* La cadena de conexión de .env.neon, sin imprimirla. */
function conexionDeNeon() {
  const ruta = path.join(__dirname, '..', '.env.neon');
  if (!fs.existsSync(ruta)) salir('no existe .env.neon con la conexión de producción');
  const linea = fs.readFileSync(ruta, 'utf8').split(/\r?\n/).find(function (l) { return l.indexOf('DATABASE_URL=') === 0; });
  if (!linea) salir('.env.neon no trae DATABASE_URL');
  return linea.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
}

function leerCuentas(rutaArchivo) {
  if (!rutaArchivo || rutaArchivo === true) salir('indique el archivo con --archivo bd/usuarios_lote.local.json');
  const ruta = path.resolve(rutaArchivo);
  if (!fs.existsSync(ruta)) salir('no existe el archivo ' + ruta);
  let lista;
  try {
    lista = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch (error) {
    salir('el archivo no es JSON válido: ' + error.message);
  }
  if (!Array.isArray(lista) || lista.length === 0) salir('el archivo debe ser una lista con al menos una cuenta');
  return lista;
}

function describir(datos) {
  return datos.nombre + ' — ' + datos.tipoId + ' ' + datos.documento + ' — ' + roles.etiquetaDeRol(datos.rol) +
    (datos.cargo ? ' (' + datos.cargo + ')' : '') + (datos.equipo ? ' — ' + datos.equipo : ' — sin EBS propio');
}

async function principal() {
  const args = leerArgumentos(process.argv.slice(2));
  const lista = leerCuentas(args.archivo);
  const probar = args.probar === true;

  /* Primero se valida todo el archivo: si una cuenta tiene un dato malo, no
     se crea ninguna y se dice cuál corregir. */
  const validas = lista.map(function (entrada, i) {
    try {
      return cuentas.validarDatos(entrada, true);
    } catch (error) {
      if (error.esDeCuenta) salir('cuenta ' + (i + 1) + ' (' + (entrada.nombre || entrada.documento || '?') + '): ' +
        error.message + (error.campo ? ' [' + error.campo + ']' : ''));
      throw error;
    }
  });
  const repetidos = validas.map(function (d) { return d.documento; })
    .filter(function (doc, i, todos) { return todos.indexOf(doc) !== i; });
  if (repetidos.length > 0) salir('documento repetido en el archivo: ' + repetidos.join(', '));

  const cadena = args.neon === true ? conexionDeNeon() : (process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (!cadena) salir('no hay DATABASE_URL en .env.local');
  const cliente = new Client({
    connectionString: cadena,
    ssl: /localhost|127\.0\.0\.1/.test(cadena) ? false : { rejectUnauthorized: false }
  });
  await cliente.connect();

  console.log('\n  ' + (probar ? 'Prueba (no se escribe nada)' : 'Creación de cuentas') + ' — base ' +
    (args.neon === true ? 'de producción (.env.neon)' : 'local (.env.local)'));
  console.log('  ----------------------------------------------------');

  let creadas = 0;
  let saltadas = 0;
  let fallidas = 0;
  try {
    for (let i = 0; i < lista.length; i++) {
      const datos = validas[i];
      const existente = (await cliente.query('SELECT id FROM aps.usuario WHERE documento = $1', [datos.documento])).rows[0];
      if (existente) {
        saltadas++;
        console.log('\n  Ya existe, se salta:  ' + describir(datos));
        continue;
      }
      if (probar) {
        creadas++;
        console.log('\n  Se crearía:  ' + describir(datos));
        continue;
      }
      try {
        await cliente.query('BEGIN');
        const creada = await cuentas.crearCuenta(cliente, lista[i]);
        await cliente.query('COMMIT');
        creadas++;
        console.log('\n  Creada:  ' + describir(creada.datos));
        console.log('           Clave temporal:  ' + creada.clave);
      } catch (error) {
        await cliente.query('ROLLBACK').catch(function () {});
        fallidas++;
        console.log('\n  NO se creó:  ' + describir(datos));
        console.log('           ' + (error.esDeCuenta ? error.message : 'Error de la base: ' + error.message));
      }
    }
  } finally {
    await cliente.end();
  }

  console.log('\n  ----------------------------------------------------');
  console.log('  ' + (probar ? 'Se crearían: ' : 'Creadas: ') + creadas + '   Ya existían: ' + saltadas +
    (fallidas ? '   Con error: ' + fallidas : ''));
  if (!probar && creadas > 0) {
    console.log('\n  Entregue cada clave temporal en persona. No vuelve a mostrarse; en el');
    console.log('  primer ingreso la aplicación pide reemplazarla por una propia.');
  }
  console.log('');
  process.exit(fallidas > 0 ? 1 : 0);
}

principal().catch(function (error) {
  console.error('\nERROR: ' + error.message + '\n');
  process.exit(1);
});
