/* =========================================================================
   APS APP — Alta de usuarios desde la línea de comandos
   -------------------------------------------------------------------------
   Crea (o restablece) la cuenta de acceso de un funcionario. Es el camino
   para el primer administrador o maestro; después las cuentas se gestionan
   desde la aplicación (menú del usuario → Modificar usuarios), que usa el
   mismo módulo api/_usuarios.js.

   Uso:
     npm run usuario:crear -- --documento 1144012345 --nombre "María Pérez" \
         --rol enfermeria --equipo EBS001 [--tipo CC] [--perfil-otro "..."]
     npm run usuario:crear -- --documento 1144000000 --nombre "Admin" --rol administrador
     npm run usuario:crear -- --documento 1144000001 --nombre "Maestro" --rol maestro --equipo EBS001 [--perfil enfermeria]
     npm run usuario:crear -- --documento 1144012345 --restablecer      (nueva clave temporal)

   La clave temporal se genera aquí y se imprime UNA sola vez; el usuario
   debe cambiarla en su primer ingreso. Para fijar una clave concreta (sólo
   en pruebas) use la variable de entorno CLAVE_INICIAL, nunca un argumento:
   los argumentos quedan en el historial de la consola.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'] });

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

async function principal() {
  const args = leerArgumentos(process.argv.slice(2));
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!cadena) salir('no hay DATABASE_URL en .env.local');

  const documento = String(args.documento || '').trim();
  if (!/^[A-Za-z0-9]{5,16}$/.test(documento)) salir('--documento debe tener entre 5 y 16 caracteres alfanuméricos');

  const cliente = new Client({
    connectionString: cadena,
    ssl: /localhost|127\.0\.0\.1/.test(cadena) ? false : { rejectUnauthorized: false }
  });
  await cliente.connect();

  try {
    await cliente.query('BEGIN');

    const existente = (await cliente.query(
      'SELECT u.id, u.rol, f.nombre_completo FROM aps.usuario u JOIN aps.funcionario f ON f.id = u.funcionario_id WHERE u.documento = $1',
      [documento]
    )).rows[0];

    if (existente) {
      if (args.restablecer !== true) salir('ya existe un usuario con el documento ' + documento + '. Use --restablecer para darle una clave nueva.');
      const r = await cuentas.restablecerClave(cliente, existente.id, { clave: process.env.CLAVE_INICIAL });
      await cliente.query('COMMIT');
      imprimirResultado(existente.nombre_completo, documento, existente.rol, r.clave, true);
      return;
    }

    const creada = await cuentas.crearCuenta(cliente, {
      documento: documento,
      tipoId: args.tipo || 'CC',
      nombre: args.nombre,
      rol: args.rol,
      equipo: args.equipo,
      perfil: args.perfil,
      perfilOtro: args['perfil-otro']
    }, { clave: process.env.CLAVE_INICIAL });

    await cliente.query('COMMIT');
    imprimirResultado(creada.datos.nombre, documento, creada.datos.rol, creada.clave, false);
  } catch (error) {
    await cliente.query('ROLLBACK').catch(function () {});
    if (error.esDeCuenta) salir(error.message + (error.campo ? ' (--' + error.campo + ')' : ''));
    if (error.code === '23505' && /funcionario/.test(error.message)) {
      salir('ya existe un funcionario con otro tipo de documento y ese número; revise --tipo');
    }
    salir(error.message);
  } finally {
    await cliente.end();
  }
}

function imprimirResultado(nombre, documento, rol, clave, restablecida) {
  console.log('');
  console.log('  ' + (restablecida ? 'Clave restablecida' : 'Usuario creado'));
  console.log('  ----------------------------------------------------');
  console.log('  Nombre:      ' + nombre);
  console.log('  Documento:   ' + documento + '   (con esto inicia sesión)');
  console.log('  Rol:         ' + roles.etiquetaDeRol(rol));
  console.log('  Clave temporal:  ' + clave);
  console.log('');
  console.log('  Entréguela en persona. Se pedirá cambiarla en el primer ingreso');
  console.log('  y no volverá a mostrarse.');
  console.log('');
}

principal();
