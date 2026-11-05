/* =========================================================================
   Conexión a la base: el certificado siempre se verifica
   -------------------------------------------------------------------------
       node pruebas/conexion_tls.test.js

   No usa la base ni sale de este equipo: el impostor es un servidor falso que
   sólo habla el inicio del protocolo de PostgreSQL, y el socket de las pruebas
   va a él diga lo que diga la cadena. Comprueba:
     1. que ninguna cadena le quite la verificación al controlador;
     2. que la base local siga sin SSL y que una remota no pase por local;
     3. que psql también verifique;
     4. con TLS de verdad, que un certificado autofirmado, de otra autoridad o
        de otro nombre se rechace, y que el impostor no reciba la clave;
     5. que ningún archivo del proyecto se conecte por su cuenta.
   ========================================================================= */

'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const tls = require('tls');
const util = require('util');
const { Client } = require('pg');
const ConnectionParameters = require('pg/lib/connection-parameters');
const { opcionesConexion } = require('../api/_db');
const { cadenaParaPsql } = require('../bd/crear_bd');

/* Sólo para esta prueba: generados con openssl, válidos hasta 2126 y para un
   dominio reservado (.test). La clave no protege nada. */
const CLAVE_DEL_SERVIDOR = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgu7vhdHjo6o3Ku1uY
T+3lh8xjxNErHj61qgZIuGxd75KhRANCAAQB3j6CTWelkNxgZ+w0PJvE+int2jzn
cCGQpBLnw5Gk156eP0wmwwKoM1S+UZZn3IWl4abHVP3SpKfS/c/Hwu19
-----END PRIVATE KEY-----
`;
const AUTOFIRMADO = `-----BEGIN CERTIFICATE-----
MIIBrDCCAVOgAwIBAgIUdBSfD/FLpFZh/O5A1+bgqG6SXnowCgYIKoZIzj0EAwIw
HDEaMBgGA1UEAwwRYmFzZS5lamVtcGxvLnRlc3QwIBcNMjYxMTA0MjEwNjE3WhgP
MjEyNjEwMTEyMTA2MTdaMBwxGjAYBgNVBAMMEWJhc2UuZWplbXBsby50ZXN0MFkw
EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEAd4+gk1npZDcYGfsNDybxPop7do853Ah
kKQS58ORpNeenj9MJsMCqDNUvlGWZ9yFpeGmx1T90qSn0v3Px8LtfaNxMG8wHQYD
VR0OBBYEFG0cox41cdCDmp+R2qaftXCxCThsMB8GA1UdIwQYMBaAFG0cox41cdCD
mp+R2qaftXCxCThsMA8GA1UdEwEB/wQFMAMBAf8wHAYDVR0RBBUwE4IRYmFzZS5l
amVtcGxvLnRlc3QwCgYIKoZIzj0EAwIDRwAwRAIgYkmIhSPsV52Y5We5U5PLU73I
ei3fqE55NY6tiyuaADwCIBvhSU2bE4tETtUmpeg2BktKrfaKdpGEhA9kPK9gO8Qr
-----END CERTIFICATE-----
`;
const AUTORIDAD = `-----BEGIN CERTIFICATE-----
MIIBqzCCAVGgAwIBAgIUa+HIJhH2eT1qTj6ycwsGcWy//b0wCgYIKoZIzj0EAwIw
IjEgMB4GA1UEAwwXQXV0b3JpZGFkIGRlIHBydWViYSBBUFMwIBcNMjYxMTA0MjEw
NjE3WhgPMjEyNjEwMTEyMTA2MTdaMCIxIDAeBgNVBAMMF0F1dG9yaWRhZCBkZSBw
cnVlYmEgQVBTMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEhGF255VO+1tr4B7m
tA3Wt+b7hSUc4CaBMNTN+8OlSVNoNkieAWtEML7S8JGsNne/453RuqOU9YLi6aue
3ndvJ6NjMGEwHQYDVR0OBBYEFHCvlBsCmJmg5IyntJ0HbTRc9mBUMB8GA1UdIwQY
MBaAFHCvlBsCmJmg5IyntJ0HbTRc9mBUMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0P
AQH/BAQDAgIEMAoGCCqGSM49BAMCA0gAMEUCIFgUoRGMXanAanQcSWDb1W1JaB1c
KclJPJ9wfZ6/J6FXAiEA7v2GxAQ7LijRheC6MWf/7k76qx/FiVC1lRmGzuezQ70=
-----END CERTIFICATE-----
`;
/* Firmado por AUTORIDAD para base.ejemplo.test. */
const CON_AUTORIDAD = `-----BEGIN CERTIFICATE-----
MIIBrDCCAVOgAwIBAgIUGHCTWMj1H6FCUZWWnkyJ+aZlw8wwCgYIKoZIzj0EAwIw
IjEgMB4GA1UEAwwXQXV0b3JpZGFkIGRlIHBydWViYSBBUFMwIBcNMjYxMTA0MjEw
NjE3WhgPMjEyNjEwMTEyMTA2MTdaMBwxGjAYBgNVBAMMEWJhc2UuZWplbXBsby50
ZXN0MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEAd4+gk1npZDcYGfsNDybxPop
7do853AhkKQS58ORpNeenj9MJsMCqDNUvlGWZ9yFpeGmx1T90qSn0v3Px8LtfaNr
MGkwHAYDVR0RBBUwE4IRYmFzZS5lamVtcGxvLnRlc3QwCQYDVR0TBAIwADAdBgNV
HQ4EFgQUbRyjHjVx0IOan5Happ+1cLEJOGwwHwYDVR0jBBgwFoAUcK+UGwKYmaDk
jKe0nQdtNFz2YFQwCgYIKoZIzj0EAwIDRwAwRAIgC1773n6F4EJWexgbnwCNj49T
nUf9lxIsphwislBU3EsCIEvPa0vNPqCOC0u0HMVp0EI31jgcOJEwspDSlFKCmKGL
-----END CERTIFICATE-----
`;

const CLAVE = 'clave-falsa';
const REMOTA = 'postgresql://usuario:' + CLAVE + '@base.ejemplo.test/neondb';
const LOCAL = 'postgresql://postgres:' + CLAVE + '@localhost:5432/aps_encuesta';

let pasadas = 0, fallidas = 0;
function verificar(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK   ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + detalle : '')); }
}

function esEstricta(opciones) {
  const ssl = new ConnectionParameters(opciones).ssl;
  return Boolean(ssl) && ssl.rejectUnauthorized === true && Object.keys(ssl).length === 1;
}

/* ---------------------------------------------------------
   1. Lo que le llega al controlador
   --------------------------------------------------------- */

console.log('\n=== 1. Ninguna cadena le quita la verificación al controlador ===');

const PARAMETROS = {
  'sin parámetros': '',
  'la que entrega Neon': '?channel_binding=require&sslmode=require',
  'sslmode=no-verify': '?sslmode=no-verify',
  'sslmode=disable': '?sslmode=disable',
  'sslmode repetido': '?sslmode=require&sslmode=no-verify',
  'ssl=0': '?ssl=0',
  'ssl=false': '?ssl=false',
  'ssl=no-verify': '?ssl=no-verify',
  'uselibpqcompat=true': '?uselibpqcompat=true&sslmode=require',
  'sslnegotiation=direct': '?sslnegotiation=direct',
  'sslrootcert de otra máquina': '?sslrootcert=/no/existe.pem'
};
Object.keys(PARAMETROS).forEach(function (nombre) {
  const opciones = opcionesConexion(REMOTA + PARAMETROS[nombre]);
  verificar(nombre, esEstricta(opciones), JSON.stringify(new ConnectionParameters(opciones).ssl));
});

process.env.PGSSLMODE = 'no-verify';
verificar('PGSSLMODE=no-verify en el entorno no cambia nada', esEstricta(opcionesConexion(REMOTA)));
delete process.env.PGSSLMODE;

const completa = 'postgresql://usuario:p%40ss%2Fw@base.ejemplo.test:5433/neondb?channel_binding=require&sslmode=require&connect_timeout=15';
const parametros = new ConnectionParameters(opcionesConexion(completa));
verificar('conserva usuario, clave, host, puerto y base',
  parametros.user === 'usuario' && parametros.password === 'p@ss/w' && parametros.host === 'base.ejemplo.test' &&
  parametros.port === 5433 && parametros.database === 'neondb');
const conservada = new URL(opcionesConexion(completa).connectionString).searchParams;
verificar('conserva channel_binding y connect_timeout',
  conservada.get('channel_binding') === 'require' && conservada.get('connect_timeout') === '15');

function errorDe(cadena) {
  try { opcionesConexion(cadena); return null; } catch (error) { return error; }
}
const errorDeCadena = errorDe('no-es-una-url ' + CLAVE);
verificar('una cadena inválida da error y no lleva la clave',
  errorDeCadena !== null && util.inspect(errorDeCadena).indexOf(CLAVE) === -1);
verificar('sin cadena da error', errorDe(undefined) !== null);

/* ---------------------------------------------------------
   2. La base local
   --------------------------------------------------------- */

console.log('\n=== 2. La base local sigue sin SSL, y lo remoto no pasa por local ===');

[LOCAL, 'postgresql://postgres:' + CLAVE + '@127.0.0.1:5432/aps_encuesta'].forEach(function (cadena) {
  const opciones = opcionesConexion(cadena);
  verificar(new URL(cadena).hostname + ': sin SSL y con la cadena intacta',
    opciones.ssl === false && opciones.connectionString === cadena && new ConnectionParameters(opciones).ssl === false);
});

const NO_LOCALES = {
  'localhost en la clave': 'postgresql://usuario:localhost@base.ejemplo.test/neondb',
  '127.0.0.1 en un parámetro': REMOTA + '?application_name=127.0.0.1',
  'un host que empieza por localhost': 'postgresql://usuario:' + CLAVE + '@localhost.ejemplo.test/neondb',
  '?host= sobre una URL de localhost': 'postgresql://usuario:' + CLAVE + '@localhost/neondb?host=base.ejemplo.test'
};
Object.keys(NO_LOCALES).forEach(function (nombre) {
  verificar(nombre + ': verifica', esEstricta(opcionesConexion(NO_LOCALES[nombre])));
});

/* ---------------------------------------------------------
   3. psql
   --------------------------------------------------------- */

console.log('\n=== 3. psql también verifica ===');

const dePsql = new URL(cadenaParaPsql(REMOTA + '?channel_binding=require&sslmode=require&options=-c%20statement_timeout%3D5000'));
verificar('exige verify-full, sin otro sslmode', dePsql.searchParams.getAll('sslmode').join() === 'verify-full', dePsql.search);
const raices = dePsql.searchParams.get('sslrootcert');
verificar('con las autoridades de node en un archivo',
  fs.existsSync(raices) && fs.readFileSync(raices, 'utf8').indexOf(tls.rootCertificates[0]) !== -1);
verificar('conserva channel_binding', dePsql.searchParams.get('channel_binding') === 'require');
verificar('los espacios van como %20: libpq no lee + como espacio',
  dePsql.search.indexOf('+') === -1 && dePsql.search.indexOf('-c%20statement_timeout') !== -1, dePsql.search);
verificar('la cadena local no cambia', cadenaParaPsql(LOCAL) === LOCAL);

/* ---------------------------------------------------------
   Banco: un impostor en este equipo
   ---------------------------------------------------------
   Con un certificado pide TLS, y después la clave en claro: lo que haría quien
   se pone en medio. Sin certificado contesta que no habla TLS. */

const PETICION_TLS = Buffer.from([0, 0, 0, 8, 0x04, 0xd2, 0x16, 0x2f]);
const PIDE_LA_CLAVE = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 3]);
const ACEPTA_Y_LISTO = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0, 0x5a, 0, 0, 0, 5, 0x49]);

function montarImpostor(certificado) {
  const visto = { pidioTls: false, enClaro: 0, cifrado: 0, sni: null, clave: null };
  const servidorTls = certificado && tls.createServer({ key: CLAVE_DEL_SERVIDOR, cert: certificado }, function (seguro) {
    visto.sni = seguro.servername;
    seguro.on('error', function () {});
    seguro.on('data', function (datos) {
      visto.cifrado += datos.length;
      if (datos[0] === 0x00) seguro.write(PIDE_LA_CLAVE);
      if (datos[0] === 0x70) {
        visto.clave = datos.subarray(5, -1).toString();
        seguro.write(ACEPTA_Y_LISTO);
      }
    });
  });
  if (servidorTls) servidorTls.on('tlsClientError', function () {});

  const servidor = net.createServer(function (socket) {
    socket.on('error', function () {});
    visto.cerrado = new Promise(function (resolver) { socket.on('close', resolver); });
    socket.once('data', function (pedido) {
      visto.pidioTls = pedido.equals(PETICION_TLS);
      if (servidorTls) {
        socket.write('S');
        servidorTls.emit('connection', socket);
      } else {
        socket.on('data', function (datos) { visto.enClaro += datos.length; });
        socket.write('N');
      }
    });
  });

  return new Promise(function (resolver) {
    servidor.listen(0, '127.0.0.1', function () {
      resolver({ puerto: servidor.address().port, visto: visto, cerrar: function () { servidor.close(); } });
    });
  });
}

/* Va al impostor diga lo que diga la cadena: así el nombre del certificado se
   compara con el de la cadena, y ninguna prueba puede salir de este equipo. */
class SocketAlImpostor extends net.Socket {
  constructor(puerto) {
    super();
    this.puertoDelImpostor = puerto;
  }
  connect() {
    return super.connect(this.puertoDelImpostor, '127.0.0.1');
  }
}

async function intentar(opciones, certificado) {
  const impostor = await montarImpostor(certificado);
  const cliente = new Client(Object.assign({}, opciones, {
    connectionTimeoutMillis: 5000,
    stream: function () { return new SocketAlImpostor(impostor.puerto); }
  }));
  cliente.on('error', function () {});

  const resultado = { conecto: false, codigo: null, autorizado: null, visto: impostor.visto };
  try {
    await cliente.connect();
    resultado.conecto = true;
    resultado.autorizado = cliente.connection.stream.authorized;
    await cliente.end();
  } catch (error) {
    resultado.codigo = error.code || error.message;
  }
  /* Lo que el cliente alcanzó a mandar ya llegó cuando el socket se cierra. */
  await Promise.race([impostor.visto.cerrado, new Promise(function (r) { setTimeout(r, 1000); })]);
  impostor.cerrar();
  return resultado;
}

function rechazado(resultado, codigo) {
  return !resultado.conecto && resultado.codigo === codigo && resultado.visto.clave === null && resultado.visto.cifrado === 0;
}

function resumen(resultado) {
  return JSON.stringify({ conecto: resultado.conecto, codigo: resultado.codigo, clave: resultado.visto.clave, cifrado: resultado.visto.cifrado });
}

/* ---------------------------------------------------------
   5. Nadie se conecta por su cuenta
   --------------------------------------------------------- */

const RAIZ = path.join(__dirname, '..');
const SIN_MIRAR = ['node_modules', 'vendor', 'informe', 'resultados'];

function archivosDelProyecto() {
  const archivos = fs.readdirSync(RAIZ)
    .filter(function (nombre) { return /\.js$|^package\.json$|^vercel\.json$/.test(nombre); })
    .map(function (nombre) { return path.join(RAIZ, nombre); });
  (function recorrer(carpetas) {
    carpetas.forEach(function (carpeta) {
      fs.readdirSync(carpeta, { withFileTypes: true }).forEach(function (entrada) {
        const ruta = path.join(carpeta, entrada.name);
        if (entrada.isDirectory()) { if (SIN_MIRAR.indexOf(entrada.name) === -1) recorrer([ruta]); }
        else if (/\.js$/.test(entrada.name)) archivos.push(ruta);
      });
    });
  })(['api', 'bd', 'pruebas'].map(function (carpeta) { return path.join(RAIZ, carpeta); }));
  return archivos.filter(function (ruta) { return ruta !== __filename; });
}

function revisarElProyecto() {
  const archivos = archivosDelProyecto();
  const DB = path.join(RAIZ, 'api', '_db.js');
  const conApagado = [];
  const porSuCuenta = [];
  const psqlSinVerificar = [];

  archivos.forEach(function (ruta) {
    const texto = fs.readFileSync(ruta, 'utf8');
    const nombre = path.relative(RAIZ, ruta);
    /* _db.js las nombra en sus comentarios; lo que hace se prueba arriba. */
    if (ruta !== DB && /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED|sslmode=(no-verify|disable)|ssl=no-verify/.test(texto)) {
      conApagado.push(nombre);
    }
    (texto.match(/new\s+(?:pg\.)?(?:Client|Pool)\s*\([^\n]*/g) || []).forEach(function (linea) {
      if (!/\((?:Object\.assign\()?opcionesConexion\(/.test(linea)) porSuCuenta.push(nombre + ': ' + linea);
    });
    if (/(?:spawn|exec)[A-Za-z]*\(\s*['"`]psql/.test(texto) && texto.indexOf('--dbname=\' + cadenaParaPsql(') === -1) {
      psqlSinVerificar.push(nombre);
    }
  });

  verificar('se revisó el proyecto, no una carpeta vacía (' + archivos.length + ' archivos)', archivos.length > 50 && archivos.indexOf(DB) !== -1);
  verificar('nadie apaga la verificación', conApagado.length === 0, conApagado.join(', '));
  verificar('toda conexión de node sale de opcionesConexion', porSuCuenta.length === 0, porSuCuenta.join(' | '));
  verificar('psql recibe la cadena de cadenaParaPsql', psqlSinVerificar.length === 0, psqlSinVerificar.join(', '));
}

/* ---------------------------------------------------------
   4. TLS de verdad
   --------------------------------------------------------- */

async function principal() {
  /* El aviso de Node sobre NODE_TLS_REJECT_UNAUTHORIZED es parte de la prueba. */
  process.removeAllListeners('warning');

  console.log('\n=== 4. TLS de verdad, contra un impostor en este equipo ===');

  const control = await intentar({ connectionString: REMOTA, ssl: { rejectUnauthorized: false } }, AUTOFIRMADO);
  verificar('control: sin verificar, el impostor se queda con la clave (el banco detecta el problema)',
    control.conecto && control.visto.clave === CLAVE, resumen(control));

  const CADENAS = {
    'cadena sin parámetros': REMOTA,
    'la que entrega Neon': REMOTA + '?channel_binding=require&sslmode=require',
    'sslmode=no-verify': REMOTA + '?sslmode=no-verify',
    'uselibpqcompat=true': REMOTA + '?uselibpqcompat=true&sslmode=require'
  };
  for (const nombre of Object.keys(CADENAS)) {
    const resultado = await intentar(opcionesConexion(CADENAS[nombre]), AUTOFIRMADO);
    verificar('autofirmado, ' + nombre + ': rechazado sin mandar nada',
      rechazado(resultado, 'DEPTH_ZERO_SELF_SIGNED_CERT') && resultado.visto.pidioTls, resumen(resultado));
  }

  const anterior = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const conVariable = await intentar(opcionesConexion(REMOTA), AUTOFIRMADO);
  if (anterior === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  else process.env.NODE_TLS_REJECT_UNAUTHORIZED = anterior;
  verificar('autofirmado con NODE_TLS_REJECT_UNAUTHORIZED=0: rechazado igual',
    rechazado(conVariable, 'DEPTH_ZERO_SELF_SIGNED_CERT'), resumen(conVariable));

  const deOtraAutoridad = await intentar(opcionesConexion(REMOTA), CON_AUTORIDAD);
  verificar('de una autoridad desconocida: rechazado sin mandar nada',
    rechazado(deOtraAutoridad, 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'), resumen(deOtraAutoridad));

  const sinTls = await intentar(opcionesConexion(REMOTA), null);
  verificar('servidor que no ofrece TLS: rechazado, y nada viaja en claro',
    !sinTls.conecto && sinTls.visto.pidioTls && sinTls.visto.enClaro === 0 && sinTls.visto.clave === null, resumen(sinTls));

  /* De aquí en adelante la autoridad de prueba es de confianza, como lo es para
     Neon la suya; sólo en este proceso. */
  tls.setDefaultCACertificates([AUTORIDAD]);

  const otroNombre = await intentar(opcionesConexion('postgresql://usuario:' + CLAVE + '@otra.ejemplo.test/neondb'), CON_AUTORIDAD);
  verificar('de autoridad conocida pero de otro nombre: rechazado sin mandar nada',
    rechazado(otroNombre, 'ERR_TLS_CERT_ALTNAME_INVALID'), resumen(otroNombre));

  const legitimo = await intentar(opcionesConexion(REMOTA + '?channel_binding=require&sslmode=require'), CON_AUTORIDAD);
  verificar('de autoridad conocida y con su nombre: conecta, autorizado',
    legitimo.conecto && legitimo.autorizado === true && legitimo.visto.clave === CLAVE, resumen(legitimo));
  verificar('y le dice al servidor a qué host va (Neon enruta por ahí)', legitimo.visto.sni === 'base.ejemplo.test', legitimo.visto.sni);

  console.log('\n=== 5. Nadie se conecta por su cuenta ===');
  revisarElProyecto();

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas > 0 ? 1 : 0);
}

principal().catch(function (error) {
  console.error('\nERROR inesperado: ' + error.message + '\n');
  process.exit(1);
});
