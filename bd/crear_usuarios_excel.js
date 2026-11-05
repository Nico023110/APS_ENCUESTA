/* =========================================================================
   APS APP — Crear varias cuentas y entregar las claves en un Excel
   -------------------------------------------------------------------------
   Uso:
     node bd/crear_usuarios_excel.js --archivo bd/usuarios_enfoque.local.json          (ensayo)
     node bd/crear_usuarios_excel.js --archivo bd/usuarios_enfoque.local.json --crear

   Sin --crear sólo dice qué pasaría con cada cuenta y no escribe nada. La
   base es la de DATABASE_URL en .env.local, y se muestra antes de empezar.

   El archivo es una lista JSON con los campos del formulario de usuarios
   (bd/crear_usuarios_lote.js), más «territorio», que sólo va al Excel. Una
   cuenta que no cumple las reglas no detiene a las demás: va a la hoja de
   pendientes con el motivo. Una cuenta que ya existe no se toca.

   A diferencia de crear_usuarios_lote.js, las claves temporales no salen por
   la pantalla: sólo quedan en el Excel. Por eso todo va en una transacción
   que se confirma después de escribir el archivo: si no se puede escribir,
   no se crea ninguna cuenta y ninguna clave se pierde.

   --salida  carpeta del Excel; por defecto, Descargas del usuario.
   ========================================================================= */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config({ path: [path.join(__dirname, '..', '.env.local'), path.join(__dirname, '..', '.env')], quiet: true });

const { Client } = require('pg');
const roles = require(path.join(__dirname, '..', 'roles.js'));
const cuentas = require(path.join(__dirname, '..', 'api', '_usuarios.js'));
const { crearLibro, ESTILO } = require(path.join(__dirname, '..', 'api', '_xlsx.js'));
const { opcionesConexion } = require(path.join(__dirname, '..', 'api', '_db.js'));

function salir(mensaje) {
  console.error('\nERROR: ' + mensaje + '\n');
  process.exit(1);
}

function argumento(nombre) {
  const i = process.argv.indexOf('--' + nombre);
  if (i === -1) return null;
  const valor = process.argv[i + 1];
  return valor === undefined || valor.indexOf('--') === 0 ? true : valor;
}

function leerLista(ruta) {
  if (!ruta || ruta === true) salir('indique el archivo con --archivo bd/usuarios_enfoque.local.json');
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

/* En pantalla, la persona se reconoce por el final del documento: el nombre,
   el correo y la clave se quedan en el Excel. */
function etiqueta(entrada) {
  return '…' + String(entrada.documento || '????').slice(-4) + '  ' + roles.etiquetaDeRol(entrada.rol);
}

function ebsDe(entrada) {
  const apoyo = Array.isArray(entrada.apoyo) ? entrada.apoyo : [];
  return apoyo.length > 0 ? 'Apoya a ' + apoyo.join(', ') : (entrada.equipo || '');
}

function construirExcel(creadas, yaExistian, pendientes) {
  const instrucciones = [
    [['Cuentas de la Encuesta APS: personal de apoyo a varios EBS', ESTILO.tituloLibro]],
    [''],
    ['• El usuario de cada persona es su número de cédula, sin puntos.'],
    ['• La contraseña es temporal: al primer ingreso la aplicación pide cambiarla por una propia.'],
    ['• Entregue cada contraseña a su dueño de forma individual (en persona o por mensaje privado), nunca en un grupo.'],
    ['• Este archivo contiene contraseñas y datos personales: no lo reenvíe ni lo deje en carpetas compartidas;'],
    ['  bórrelo cuando todas las contraseñas estén entregadas.'],
    ['• Si alguien pierde su contraseña, un administrador puede restablecerla desde Usuarios en la aplicación.'],
    ['• En el ítem 10 de cada ficha, la persona elige el EBS al que apoya en esa visita.']
  ];
  return crearLibro({
    titulo: 'Cuentas y claves temporales',
    autor: 'Encuesta APS — Red de Salud de Ladera E.S.E.',
    fecha: new Date(),
    hojas: [
      { nombre: 'Instrucciones', antes: instrucciones, anchos: [110] },
      {
        nombre: 'Usuarios creados',
        columnas: [
          { titulo: 'EBS', ancho: 40 }, { titulo: 'Territorio', ancho: 44 }, { titulo: 'Nombre', ancho: 36 },
          { titulo: 'Usuario (cédula)', ancho: 16 }, { titulo: 'Contraseña temporal', ancho: 20 },
          { titulo: 'Rol en la aplicación', ancho: 24 }, { titulo: 'Correo', ancho: 36 }, { titulo: 'Celular', ancho: 14 },
          { titulo: 'Observación', ancho: 24 }
        ],
        filas: creadas.map(function (c) {
          return [ebsDe(c.entrada), c.entrada.territorio || '', c.datos.nombre, c.datos.documento, c.clave,
            roles.etiquetaDeRol(c.datos.rol), c.datos.correo || '', c.datos.telefono || '', c.datos.cargo || ''];
        })
      },
      {
        nombre: 'Ya tenían cuenta',
        columnas: [{ titulo: 'Nombre', ancho: 36 }, { titulo: 'Usuario (cédula)', ancho: 16 },
          { titulo: 'Cuenta existente', ancho: 28 }, { titulo: 'Observación', ancho: 60 }],
        filas: yaExistian.map(function (c) {
          return [c.entrada.nombre, c.entrada.documento, roles.etiquetaDeRol(c.rol),
            'No se modificó ni se le cambió la clave.'];
        })
      },
      {
        nombre: 'Pendientes sin crear',
        columnas: [{ titulo: 'EBS / territorio', ancho: 44 }, { titulo: 'Perfil', ancho: 24 }, { titulo: 'Nombre', ancho: 36 },
          { titulo: 'Documento recibido', ancho: 18 }, { titulo: 'Motivo', ancho: 60 }],
        filas: pendientes.map(function (c) {
          return [c.entrada.territorio || ebsDe(c.entrada), roles.etiquetaDeRol(c.entrada.rol), c.entrada.nombre,
            c.entrada.documento, c.motivo];
        })
      }
    ]
  });
}

function nombreDeArchivo() {
  const ahora = new Date();
  const dos = function (n) { return String(n).padStart(2, '0'); };
  return 'USUARIOS APOYO EBS - CLAVES TEMPORALES ' + ahora.getFullYear() + '-' + dos(ahora.getMonth() + 1) + '-' +
    dos(ahora.getDate()) + ' ' + dos(ahora.getHours()) + dos(ahora.getMinutes()) + dos(ahora.getSeconds()) + '.xlsx';
}

async function principal() {
  const lista = leerLista(argumento('archivo'));
  const crear = argumento('crear') === true;
  const salida = typeof argumento('salida') === 'string' ? argumento('salida') : path.join(os.homedir(), 'Downloads');
  if (crear && !fs.existsSync(salida)) salir('no existe la carpeta ' + salida);

  const cadena = process.env.DATABASE_URL;
  if (!cadena) salir('no hay DATABASE_URL en .env.local');
  const host = new URL(cadena).hostname;
  const esLocal = host === 'localhost' || host === '127.0.0.1';
  const cliente = new Client(opcionesConexion(cadena));
  await cliente.connect();

  console.log('\n  ' + (crear ? 'Creación de cuentas' : 'Ensayo (no se escribe nada)') + ' — base ' +
    (esLocal ? 'LOCAL' : 'de producción (Neon)') + ': ' + host);
  console.log('  ----------------------------------------------------');

  const creadas = [];
  const yaExistian = [];
  const pendientes = [];
  let confirmada = false;
  let rutaExcel = null;

  try {
    await cliente.query(crear ? 'BEGIN' : 'BEGIN READ ONLY');

    for (const entrada of lista) {
      let datos;
      try {
        datos = cuentas.validarDatos(entrada, true);
      } catch (error) {
        if (!error.esDeCuenta) throw error;
        pendientes.push({ entrada: entrada, motivo: error.message });
        console.log('  Pendiente:  ' + etiqueta(entrada) + ' — ' + error.message);
        continue;
      }

      const existente = (await cliente.query('SELECT rol FROM aps.usuario WHERE documento = $1', [datos.documento])).rows[0];
      if (existente) {
        yaExistian.push({ entrada: entrada, rol: existente.rol });
        console.log('  Ya existe:  ' + etiqueta(entrada));
        continue;
      }

      if (!crear) {
        const registrados = (await cliente.query(
          'SELECT upper(codigo) AS codigo FROM aps.equipo_salud WHERE upper(codigo) = ANY($1::text[]) AND activo', [datos.apoyo])).rows;
        const faltan = datos.apoyo.filter(function (c) { return !registrados.some(function (r) { return r.codigo === c; }); });
        if (faltan.length > 0) {
          pendientes.push({ entrada: entrada, motivo: 'EBS sin registrar: ' + faltan.join(', ') });
          console.log('  Pendiente:  ' + etiqueta(entrada) + ' — EBS sin registrar: ' + faltan.join(', '));
        } else {
          creadas.push({ entrada: entrada, datos: datos });
          console.log('  Se crearía: ' + etiqueta(entrada) + ' — ' + ebsDe(datos));
        }
        continue;
      }

      await cliente.query('SAVEPOINT cuenta');
      try {
        const creada = await cuentas.crearCuenta(cliente, entrada);
        await cliente.query('RELEASE SAVEPOINT cuenta');
        creadas.push({ entrada: entrada, datos: creada.datos, clave: creada.clave });
        console.log('  Creada:     ' + etiqueta(entrada) + ' — ' + ebsDe(creada.datos));
      } catch (error) {
        await cliente.query('ROLLBACK TO SAVEPOINT cuenta');
        pendientes.push({ entrada: entrada, motivo: error.esDeCuenta ? error.message : 'Error de la base: ' + error.message });
        console.log('  Pendiente:  ' + etiqueta(entrada) + ' — ' + (error.esDeCuenta ? error.message : 'error de la base'));
      }
    }

    if (crear && creadas.length > 0) {
      rutaExcel = path.join(salida, nombreDeArchivo());
      /* «wx»: nunca sobrescribe otro archivo de claves. */
      fs.writeFileSync(rutaExcel, construirExcel(creadas, yaExistian, pendientes), { flag: 'wx' });
      await cliente.query('COMMIT');
      confirmada = true;
    } else {
      await cliente.query('ROLLBACK');
    }
  } catch (error) {
    await cliente.query('ROLLBACK').catch(function () {});
    /* Sin confirmar, las claves del archivo no sirven para entrar. */
    if (rutaExcel && !confirmada && fs.existsSync(rutaExcel)) fs.unlinkSync(rutaExcel);
    if (crear) console.error('\n  No se creó ninguna cuenta: se deshizo todo lo anterior.');
    throw error;
  } finally {
    await cliente.end();
  }

  console.log('  ----------------------------------------------------');
  console.log('  ' + (crear ? 'Creadas: ' : 'Se crearían: ') + creadas.length + '   Ya existían: ' + yaExistian.length +
    '   Pendientes: ' + pendientes.length);
  if (rutaExcel) {
    console.log('\n  Claves temporales en:\n  ' + rutaExcel);
    console.log('\n  Entregue cada clave en privado y borre el archivo cuando estén todas entregadas.');
  } else if (crear) {
    console.log('\n  No se creó ninguna cuenta ni se generó ningún archivo.');
  }
  console.log('');
}

principal().catch(function (error) {
  console.error('\nERROR: ' + error.message + '\n');
  process.exit(1);
});
