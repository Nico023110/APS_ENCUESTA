/* =========================================================================
   Encuesta_APS — Autenticación y sesiones (módulo interno)
   -------------------------------------------------------------------------
   El prefijo _ lo deja fuera del enrutado HTTP. Aquí vive todo lo que toca
   claves y cookies para que ningún endpoint lo reimplemente a su manera.

   DECISIONES DE SEGURIDAD, Y POR QUÉ

   - La clave se deriva con scrypt (N=2^15, r=8, p=1, 64 bytes, sal de 16)
     usando la implementación de Node: sin dependencias nativas y con coste
     de memoria que frena los ataques por diccionario. La comparación es de
     tiempo constante.
   - Cuando el documento no existe se deriva igual una clave contra un hash
     señuelo, para que el tiempo de respuesta no diga si la cuenta existe.
     El mensaje de error es el mismo en ambos casos.
   - La sesión es un token aleatorio de 32 bytes que sólo viaja en una cookie
     HttpOnly + SameSite=Strict (+ Secure fuera de localhost). En la base se
     guarda su SHA-256: quien lea la tabla no puede fabricar la cookie.
   - Toda petición que muta exige la cabecera X-Requested-With. Un formulario
     HTML de otro origen no puede añadirla, y con SameSite=Strict la cookie
     tampoco viaja: doble cierre contra CSRF.
   - Cinco fallos seguidos bloquean la cuenta 15 minutos; más de 30 fallos
     desde una misma IP en 15 minutos devuelven 429. Ambos contadores viven
     en la base porque en Vercel cada petición puede caer en un proceso
     distinto: un contador en memoria no protegería nada.
   ========================================================================= */

'use strict';

const crypto = require('crypto');
const path = require('path');
const { consultar } = require('./_db');
const roles = require(path.join(__dirname, '..', 'roles.js'));

const NOMBRE_COOKIE = 'aps_sesion';
const DURACION_SESION_MS = 12 * 60 * 60 * 1000;   // tope absoluto: una jornada larga
const INACTIVIDAD_SESION_MS = 4 * 60 * 60 * 1000;  // sin uso en la API, caduca
const MAX_FALLOS_CUENTA = 5;
const BLOQUEO_CUENTA_MIN = 15;
const MAX_FALLOS_IP = 30;
const VENTANA_IP_MIN = 15;

const SCRYPT = { N: 32768, r: 8, p: 1, largo: 64, maxmem: 64 * 1024 * 1024 };

/* Hash señuelo: una clave que nadie tiene, derivada al arrancar el módulo, para
   que el camino «documento inexistente» cueste lo mismo que el camino real. */
let hashSenuelo = null;

/* ---------------------------------------------------------
   1. CLAVES
   --------------------------------------------------------- */

function derivar(clave, sal, parametros) {
  return new Promise(function (resolver, rechazar) {
    crypto.scrypt(clave, sal, parametros.largo, {
      N: parametros.N, r: parametros.r, p: parametros.p, maxmem: parametros.maxmem
    }, function (error, derivada) {
      if (error) return rechazar(error);
      resolver(derivada);
    });
  });
}

async function hashDeClave(clave) {
  const sal = crypto.randomBytes(16);
  const derivada = await derivar(String(clave).normalize('NFKC'), sal, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p,
    sal.toString('base64url'), derivada.toString('base64url')].join('$');
}

async function verificarClave(clave, hashGuardado) {
  const partes = String(hashGuardado || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const parametros = {
    N: parseInt(partes[1], 10), r: parseInt(partes[2], 10), p: parseInt(partes[3], 10),
    largo: Buffer.from(partes[5], 'base64url').length, maxmem: SCRYPT.maxmem
  };
  const sal = Buffer.from(partes[4], 'base64url');
  const esperada = Buffer.from(partes[5], 'base64url');
  const derivada = await derivar(String(clave).normalize('NFKC'), sal, parametros);

  return derivada.length === esperada.length && crypto.timingSafeEqual(derivada, esperada);
}

async function obtenerHashSenuelo() {
  if (!hashSenuelo) hashSenuelo = await hashDeClave(crypto.randomBytes(24).toString('base64url'));
  return hashSenuelo;
}

/* Política de clave. Devuelve la lista de requisitos incumplidos (vacía si
   la clave sirve). Se comparte con el navegador por texto, no por código:
   el servidor es quien manda. */
function requisitosIncumplidos(clave, documento) {
  const texto = String(clave || '');
  const faltan = [];
  if (texto.length < 10) faltan.push('Mínimo 10 caracteres.');
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(texto)) faltan.push('Al menos una letra.');
  if (!/[0-9]/.test(texto)) faltan.push('Al menos un número.');
  if (documento && texto.toLowerCase().indexOf(String(documento).toLowerCase()) !== -1) {
    faltan.push('No puede contener su número de documento.');
  }
  if (texto.length > 128) faltan.push('Máximo 128 caracteres.');
  return faltan;
}

/* ---------------------------------------------------------
   2. COOKIES Y TOKENS
   --------------------------------------------------------- */

function leerCookies(req) {
  const crudo = req.headers && req.headers.cookie ? String(req.headers.cookie) : '';
  const salida = {};
  crudo.split(';').forEach(function (par) {
    const indice = par.indexOf('=');
    if (indice === -1) return;
    const nombre = par.slice(0, indice).trim();
    const valor = par.slice(indice + 1).trim();
    if (nombre) salida[nombre] = decodeURIComponent(valor);
  });
  return salida;
}

function esConexionSegura(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (proto) return proto === 'https';
  return !!(req.socket && req.socket.encrypted);
}

function serializarCookie(req, valor, maxAgeSegundos) {
  const partes = [
    NOMBRE_COOKIE + '=' + encodeURIComponent(valor),
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + maxAgeSegundos
  ];
  if (esConexionSegura(req) || process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    partes.push('Secure');
  }
  return partes.join('; ');
}

function hashDeToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function ipDe(req) {
  const reenviada = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (reenviada) return reenviada.slice(0, 64);
  return req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress).slice(0, 64) : null;
}

function agenteDe(req) {
  const agente = req.headers['user-agent'];
  return agente ? String(agente).slice(0, 255) : null;
}

/* ---------------------------------------------------------
   3. SESIONES
   --------------------------------------------------------- */

async function crearSesion(req, res, usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DURACION_SESION_MS);

  await consultar(`
    INSERT INTO aps.sesion (id, usuario_id, expira_en, ip, agente)
    VALUES ($1, $2, $3, $4, $5)
  `, [hashDeToken(token), usuarioId, expira, ipDe(req), agenteDe(req)]);

  res.setHeader('Set-Cookie', serializarCookie(req, token, Math.floor(DURACION_SESION_MS / 1000)));
  return token;
}

async function revocarSesionActual(req, res, motivo) {
  const token = leerCookies(req)[NOMBRE_COOKIE];
  if (token) {
    await consultar(`
      UPDATE aps.sesion SET revocada_en = now(), motivo_revocacion = $2
       WHERE id = $1 AND revocada_en IS NULL
    `, [hashDeToken(token), motivo || 'cierre']);
  }
  res.setHeader('Set-Cookie', serializarCookie(req, '', 0));
}

async function revocarOtrasSesiones(usuarioId, tokenActual, motivo) {
  await consultar(`
    UPDATE aps.sesion SET revocada_en = now(), motivo_revocacion = $3
     WHERE usuario_id = $1 AND id <> $2 AND revocada_en IS NULL
  `, [usuarioId, hashDeToken(tokenActual || ''), motivo || 'nueva_sesion']);
}

/* Perfil que ve el navegador. Nunca lleva el hash ni contadores internos.
   Los bigint llegan de pg como texto; se pasan a número para poder
   compararlos con === contra las filas de las fichas. */
function numero(valor) {
  return valor === null || valor === undefined ? null : Number(valor);
}

function perfilPublico(fila) {
  return {
    id: numero(fila.usuario_id),
    documento: fila.documento,
    tipoId: fila.tipo_id,
    nombre: fila.nombre_completo,
    rol: fila.rol,
    rolEtiqueta: roles.etiquetaDeRol(fila.rol),
    nivel: roles.nivelDe(fila.rol),
    permisos: roles.permisosDe(fila.rol),
    perfilProfesional: fila.perfil_profesional,
    perfilOtro: fila.perfil_otro,
    funcionarioId: numero(fila.funcionario_id),
    equipoSaludId: numero(fila.equipo_salud_id),
    equipoCodigo: fila.equipo_codigo,
    debeCambiarClave: fila.debe_cambiar_clave,
    sesionExpiraEn: fila.expira_en
  };
}

const CONSULTA_USUARIO = `
  SELECT u.id AS usuario_id, u.documento, u.clave_hash, u.rol, u.activo,
         u.debe_cambiar_clave, u.intentos_fallidos, u.bloqueado_hasta,
         f.id AS funcionario_id, f.tipo_id, f.nombre_completo, f.perfil_profesional, f.perfil_otro,
         f.activo AS funcionario_activo,
         e.id AS equipo_salud_id, e.codigo AS equipo_codigo
    FROM aps.usuario u
    JOIN aps.funcionario f ON f.id = u.funcionario_id
    LEFT JOIN aps.equipo_salud e ON e.id = f.equipo_salud_id
`;

/* Devuelve el usuario de la sesión de la cookie, o null. Renueva la marca de
   último uso; no renueva el tope absoluto. */
async function usuarioDeSesion(req) {
  const token = leerCookies(req)[NOMBRE_COOKIE];
  if (!token || token.length < 32) return null;

  const resultado = await consultar(`
    SELECT q.*, s.expira_en
      FROM (${CONSULTA_USUARIO}) q
      JOIN aps.sesion s ON s.usuario_id = q.usuario_id
     WHERE s.id = $1
       AND s.revocada_en IS NULL
       AND s.expira_en > now()
       AND s.ultimo_uso_en > now() - ($2 || ' milliseconds')::interval
       AND q.activo AND q.funcionario_activo
  `, [hashDeToken(token), String(INACTIVIDAD_SESION_MS)]);

  const fila = resultado.rows[0];
  if (!fila) return null;

  consultar('UPDATE aps.sesion SET ultimo_uso_en = now() WHERE id = $1', [hashDeToken(token)])
    .catch(function (error) { console.warn('No se pudo sellar el uso de la sesión:', error.message); });

  return fila;
}

/* ---------------------------------------------------------
   4. GUARDIA PARA LOS ENDPOINTS
   ---------------------------------------------------------
   Uso:  const usuario = await requerirSesion(req, res, { permiso: 'ficha.crear' });
         if (!usuario) return;   // ya respondió 401/403
   --------------------------------------------------------- */

const METODOS_QUE_MUTAN = ['POST', 'PUT', 'PATCH', 'DELETE'];

function faltaCabeceraAntiCsrf(req) {
  if (METODOS_QUE_MUTAN.indexOf(req.method) === -1) return false;
  return String(req.headers['x-requested-with'] || '').toLowerCase() !== 'fetch';
}

async function requerirSesion(req, res, opciones) {
  const permiso = opciones && opciones.permiso;

  if (faltaCabeceraAntiCsrf(req)) {
    res.status(403).json({ error: 'Petición no admitida', codigo: 'csrf' });
    return null;
  }

  let fila;
  try {
    fila = await usuarioDeSesion(req);
  } catch (error) {
    console.error('Error al resolver la sesión:', error.message);
    res.status(500).json({ error: 'No fue posible verificar la sesión' });
    return null;
  }

  if (!fila) {
    res.setHeader('Set-Cookie', serializarCookie(req, '', 0));
    res.status(401).json({ error: 'Debe iniciar sesión', codigo: 'sin_sesion' });
    return null;
  }

  const usuario = perfilPublico(fila);

  /* Con clave temporal sólo se permite cambiarla y consultar el perfil. */
  if (usuario.debeCambiarClave && !(opciones && opciones.permitirClaveTemporal)) {
    res.status(403).json({ error: 'Debe crear su contraseña antes de continuar', codigo: 'clave_temporal' });
    return null;
  }

  if (permiso && !roles.puede(usuario.rol, permiso)) {
    res.status(403).json({ error: 'Su rol no permite esta acción', codigo: 'sin_permiso' });
    return null;
  }

  return usuario;
}

/* ---------------------------------------------------------
   5. INICIO DE SESIÓN
   --------------------------------------------------------- */

async function registrarIntento(datos) {
  try {
    await consultar(`
      INSERT INTO aps.intento_acceso (documento, usuario_id, exitoso, motivo, ip, agente)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [datos.documento, datos.usuarioId || null, datos.exitoso, datos.motivo || null, datos.ip, datos.agente]);
  } catch (error) {
    console.warn('No se pudo registrar el intento de acceso:', error.message);
  }
}

async function ipSaturada(ip) {
  if (!ip) return false;
  const r = await consultar(`
    SELECT count(*)::int AS fallos FROM aps.intento_acceso
     WHERE ip = $1 AND NOT exitoso AND ocurrido_en > now() - ($2 || ' minutes')::interval
  `, [ip, String(VENTANA_IP_MIN)]);
  return r.rows[0].fallos >= MAX_FALLOS_IP;
}

/* Resultado: { ok: true, usuario } o { ok: false, estado, mensaje, codigo }.
   El mensaje para credenciales malas es único a propósito. */
async function autenticar(req, documento, clave) {
  const ip = ipDe(req);
  const agente = agenteDe(req);
  const doc = String(documento || '').trim();
  const base = { documento: doc, ip: ip, agente: agente };

  const GENERICO = { ok: false, estado: 401, codigo: 'credenciales',
    mensaje: 'Documento o contraseña incorrectos.' };

  if (!/^[A-Za-z0-9]{5,16}$/.test(doc) || typeof clave !== 'string' || clave.length === 0 || clave.length > 128) {
    await registrarIntento(Object.assign({ exitoso: false, motivo: 'formato' }, base));
    return GENERICO;
  }

  if (await ipSaturada(ip)) {
    await registrarIntento(Object.assign({ exitoso: false, motivo: 'ip_saturada' }, base));
    return { ok: false, estado: 429, codigo: 'demasiados_intentos',
      mensaje: 'Demasiados intentos desde esta conexión. Espere 15 minutos.' };
  }

  const resultado = await consultar(CONSULTA_USUARIO + ' WHERE u.documento = $1', [doc]);
  const fila = resultado.rows[0];

  if (!fila) {
    await verificarClave(clave, await obtenerHashSenuelo());
    await registrarIntento(Object.assign({ exitoso: false, motivo: 'inexistente' }, base));
    return GENERICO;
  }

  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
    await verificarClave(clave, await obtenerHashSenuelo());
    await registrarIntento(Object.assign({ exitoso: false, motivo: 'bloqueado', usuarioId: fila.usuario_id }, base));
    const minutos = Math.max(1, Math.ceil((new Date(fila.bloqueado_hasta) - Date.now()) / 60000));
    return { ok: false, estado: 423, codigo: 'bloqueado',
      mensaje: 'Cuenta bloqueada por intentos fallidos. Intente en ' + minutos + ' minuto(s).' };
  }

  const valida = await verificarClave(clave, fila.clave_hash);

  if (!valida) {
    const fallos = (fila.intentos_fallidos || 0) + 1;
    const bloquear = fallos >= MAX_FALLOS_CUENTA;
    await consultar(`
      UPDATE aps.usuario
         SET intentos_fallidos = $2,
             bloqueado_hasta = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE bloqueado_hasta END
       WHERE id = $1
    `, [fila.usuario_id, bloquear ? 0 : fallos, bloquear, String(BLOQUEO_CUENTA_MIN)]);
    await registrarIntento(Object.assign({ exitoso: false, motivo: bloquear ? 'bloqueo_activado' : 'clave_incorrecta',
      usuarioId: fila.usuario_id }, base));
    return GENERICO;
  }

  if (!fila.activo || !fila.funcionario_activo) {
    await registrarIntento(Object.assign({ exitoso: false, motivo: 'inactivo', usuarioId: fila.usuario_id }, base));
    return { ok: false, estado: 403, codigo: 'inactivo',
      mensaje: 'Su cuenta está desactivada. Comuníquese con el administrador.' };
  }

  await consultar(`
    UPDATE aps.usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso_en = now()
     WHERE id = $1
  `, [fila.usuario_id]);
  await registrarIntento(Object.assign({ exitoso: true, usuarioId: fila.usuario_id }, base));

  return { ok: true, fila: fila, usuario: perfilPublico(fila) };
}

module.exports = {
  NOMBRE_COOKIE,
  hashDeClave,
  verificarClave,
  requisitosIncumplidos,
  leerCookies,
  crearSesion,
  revocarSesionActual,
  revocarOtrasSesiones,
  usuarioDeSesion,
  requerirSesion,
  autenticar,
  perfilPublico,
  ipDe,
  agenteDe,
  hashDeToken
};
