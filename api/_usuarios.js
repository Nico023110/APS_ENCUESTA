/* =========================================================================
   Encuesta_APS — Gestión de cuentas (módulo interno)
   -------------------------------------------------------------------------
   Lo comparten el endpoint /api/usuarios y el script bd/crear_usuario.js,
   para que crear una cuenta por consola y crearla desde la aplicación sea
   exactamente la misma operación con las mismas reglas.
   ========================================================================= */

'use strict';

const crypto = require('crypto');
const path = require('path');
const roles = require(path.join(__dirname, '..', 'roles.js'));
const { hashDeClave, requisitosIncumplidos } = require('./_auth');

const FORMATO_DOCUMENTO = /^[A-Za-z0-9]{5,16}$/;
const TIPOS_DOCUMENTO = ['CC', 'CD', 'CE', 'PT'];

/* 12 caracteres de un alfabeto sin ambigüedades (sin 0/O, 1/l/I), con al
   menos una letra y un número garantizados por la política. */
function claveTemporal() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let clave;
  do {
    clave = Array.from(crypto.randomBytes(12)).map(function (b) { return alfabeto[b % alfabeto.length]; }).join('');
  } while (requisitosIncumplidos(clave).length > 0);
  return clave;
}

class ErrorDeCuenta extends Error {
  constructor(mensaje, campo) {
    super(mensaje);
    this.campo = campo || null;
    this.esDeCuenta = true;
  }
}

/* Normaliza y valida los datos de una cuenta. Devuelve el objeto limpio o
   lanza ErrorDeCuenta con el campo que falla. `paraCrear` exige documento. */
function validarDatos(datos, paraCrear) {
  const d = datos || {};
  const salida = {};

  if (paraCrear) {
    salida.documento = String(d.documento || '').trim();
    if (!FORMATO_DOCUMENTO.test(salida.documento)) {
      throw new ErrorDeCuenta('El documento debe tener entre 5 y 16 letras o números, sin puntos.', 'documento');
    }
    salida.tipoId = String(d.tipoId || 'CC').toUpperCase();
    if (TIPOS_DOCUMENTO.indexOf(salida.tipoId) === -1) throw new ErrorDeCuenta('Tipo de documento no válido.', 'tipoId');
    if (salida.tipoId === 'CC' && !/^[0-9]{6,10}$/.test(salida.documento)) {
      throw new ErrorDeCuenta('Una cédula de ciudadanía lleva entre 6 y 10 dígitos.', 'documento');
    }
  }

  salida.nombre = String(d.nombre || '').trim().replace(/\s+/g, ' ');
  if (salida.nombre.length < 3 || salida.nombre.length > 120) throw new ErrorDeCuenta('Escriba el nombre completo.', 'nombre');

  salida.rol = String(d.rol || '').trim();
  if (!roles.esRolValido(salida.rol)) throw new ErrorDeCuenta('Elija un rol de la lista.', 'rol');

  salida.equipo = d.equipo ? String(d.equipo).trim() : null;
  if (roles.esAsistencial(salida.rol) && !salida.equipo) {
    throw new ErrorDeCuenta('Un rol que captura fichas necesita su Equipo Básico de Salud.', 'equipo');
  }
  if (salida.equipo && !/^[A-Za-z0-9]{3,20}$/.test(salida.equipo)) {
    throw new ErrorDeCuenta('El código del equipo lleva entre 3 y 20 letras o números (RN-010).', 'equipo');
  }

  /* Perfil del ítem 14 con el que firma las fichas. Para los roles
     asistenciales es el propio rol; el maestro lo elige (u «otro»). */
  if (salida.rol === 'maestro') {
    salida.perfil = d.perfil ? String(d.perfil) : 'otro';
    if (!roles.esRolValido(salida.perfil) || !roles.esAsistencial(salida.perfil) || salida.perfil === 'maestro') {
      throw new ErrorDeCuenta('El perfil profesional debe ser uno del ítem 14.', 'perfil');
    }
  } else if (roles.esAsistencial(salida.rol)) {
    salida.perfil = salida.rol;
  } else {
    salida.perfil = null;
  }

  salida.perfilOtro = d.perfilOtro ? String(d.perfilOtro).trim().slice(0, 80) : null;
  if (salida.perfil === 'otro' && !salida.perfilOtro) {
    if (salida.rol === 'maestro') salida.perfilOtro = 'Usuario maestro';
    else throw new ErrorDeCuenta('Con el perfil «Otro» hay que indicar cuál (RN-014).', 'perfilOtro');
  }
  if (salida.perfil !== 'otro') salida.perfilOtro = null;

  salida.activo = d.activo === undefined ? true : Boolean(d.activo);
  return salida;
}

async function asegurarEquipo(cliente, codigo) {
  if (!codigo) return null;
  const r = await cliente.query(`
    INSERT INTO aps.equipo_salud (codigo, activo) VALUES ($1, true)
    ON CONFLICT (codigo) DO UPDATE SET activo = true
    RETURNING id
  `, [codigo]);
  return r.rows[0].id;
}

/* Crea funcionario + cuenta dentro de la transacción del cliente. Devuelve
   { id, clave } con la clave temporal en claro, que sólo existe aquí. */
async function crearCuenta(cliente, datos, opciones) {
  const d = validarDatos(datos, true);
  const existente = (await cliente.query('SELECT id FROM aps.usuario WHERE documento = $1', [d.documento])).rows[0];
  if (existente) throw new ErrorDeCuenta('Ya existe un usuario con ese documento.', 'documento');

  const clave = (opciones && opciones.clave) || claveTemporal();
  const faltan = requisitosIncumplidos(clave, d.documento);
  if (faltan.length > 0) throw new ErrorDeCuenta('La clave inicial no cumple la política: ' + faltan.join(' '), 'clave');
  const hash = await hashDeClave(clave);

  const equipoId = await asegurarEquipo(cliente, d.equipo);

  let funcionarioId;
  try {
    funcionarioId = (await cliente.query(`
      INSERT INTO aps.funcionario (tipo_id, numero_id, nombre_completo, perfil_profesional, perfil_otro, equipo_salud_id, activo)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (tipo_id, numero_id) DO UPDATE
        SET nombre_completo = EXCLUDED.nombre_completo,
            perfil_profesional = COALESCE(EXCLUDED.perfil_profesional, aps.funcionario.perfil_profesional),
            perfil_otro = COALESCE(EXCLUDED.perfil_otro, aps.funcionario.perfil_otro),
            equipo_salud_id = COALESCE(EXCLUDED.equipo_salud_id, aps.funcionario.equipo_salud_id),
            activo = true
      RETURNING id
    `, [d.tipoId, d.documento, d.nombre, d.perfil, d.perfilOtro, equipoId])).rows[0].id;
  } catch (error) {
    if (error.code === '23514') throw new ErrorDeCuenta('El documento no tiene el formato de ese tipo (RN-013).', 'documento');
    throw error;
  }

  const usuarioId = (await cliente.query(`
    INSERT INTO aps.usuario (funcionario_id, documento, clave_hash, rol, debe_cambiar_clave, creado_por)
    VALUES ($1, $2, $3, $4, true, $5)
    RETURNING id
  `, [funcionarioId, d.documento, hash, d.rol, (opciones && opciones.creadoPor) || null])).rows[0].id;

  return { id: usuarioId, funcionarioId: funcionarioId, clave: clave, datos: d };
}

/* Modifica nombre, rol, equipo, perfil y estado de una cuenta existente. */
async function modificarCuenta(cliente, usuarioId, datos) {
  const d = validarDatos(datos, false);
  const fila = (await cliente.query(`
    SELECT u.id, u.funcionario_id, u.rol, u.activo, u.documento
      FROM aps.usuario u WHERE u.id = $1
  `, [usuarioId])).rows[0];
  if (!fila) throw new ErrorDeCuenta('La cuenta no existe.', null);

  const equipoId = await asegurarEquipo(cliente, d.equipo);

  await cliente.query(`
    UPDATE aps.funcionario
       SET nombre_completo = $2,
           perfil_profesional = $3,
           perfil_otro = $4,
           equipo_salud_id = $5,
           activo = $6
     WHERE id = $1
  `, [fila.funcionario_id, d.nombre, d.perfil, d.perfilOtro, equipoId, d.activo]);

  await cliente.query(`
    UPDATE aps.usuario SET rol = $2, activo = $3 WHERE id = $1
  `, [usuarioId, d.rol, d.activo]);

  if (!d.activo) {
    await cliente.query(`
      UPDATE aps.sesion SET revocada_en = now(), motivo_revocacion = 'desactivacion'
       WHERE usuario_id = $1 AND revocada_en IS NULL
    `, [usuarioId]);
  }

  return { id: usuarioId, anterior: fila, datos: d };
}

/* Nueva clave temporal: cierra todas las sesiones y obliga a cambiarla. */
async function restablecerClave(cliente, usuarioId, opciones) {
  const fila = (await cliente.query('SELECT id, documento FROM aps.usuario WHERE id = $1', [usuarioId])).rows[0];
  if (!fila) throw new ErrorDeCuenta('La cuenta no existe.', null);

  const clave = (opciones && opciones.clave) || claveTemporal();
  const hash = await hashDeClave(clave);
  await cliente.query(`
    UPDATE aps.usuario
       SET clave_hash = $2, debe_cambiar_clave = true, intentos_fallidos = 0, bloqueado_hasta = NULL, activo = true
     WHERE id = $1
  `, [usuarioId, hash]);
  await cliente.query(`
    UPDATE aps.sesion SET revocada_en = now(), motivo_revocacion = 'restablecimiento'
     WHERE usuario_id = $1 AND revocada_en IS NULL
  `, [usuarioId]);
  return { id: usuarioId, clave: clave };
}

const CONSULTA_LISTADO = `
  SELECT u.id, u.documento, u.rol, u.activo, u.debe_cambiar_clave, u.bloqueado_hasta,
         u.creado_en, u.ultimo_acceso_en,
         f.tipo_id, f.nombre_completo, f.perfil_profesional, f.perfil_otro,
         e.codigo AS equipo_codigo
    FROM aps.usuario u
    JOIN aps.funcionario f ON f.id = u.funcionario_id
    LEFT JOIN aps.equipo_salud e ON e.id = f.equipo_salud_id
`;

function filaPublica(fila) {
  return {
    id: Number(fila.id),
    documento: fila.documento,
    tipoId: fila.tipo_id,
    nombre: fila.nombre_completo,
    rol: fila.rol,
    rolEtiqueta: roles.etiquetaDeRol(fila.rol),
    nivel: roles.nivelDe(fila.rol),
    perfil: fila.perfil_profesional,
    perfilOtro: fila.perfil_otro,
    equipo: fila.equipo_codigo,
    activo: fila.activo,
    debeCambiarClave: fila.debe_cambiar_clave,
    bloqueadoHasta: fila.bloqueado_hasta,
    creadoEn: fila.creado_en,
    ultimoAccesoEn: fila.ultimo_acceso_en
  };
}

async function listarCuentas(cliente) {
  const r = await cliente.query(CONSULTA_LISTADO + ' ORDER BY u.activo DESC, f.nombre_completo');
  return r.rows.map(filaPublica);
}

async function obtenerCuenta(cliente, usuarioId) {
  const r = await cliente.query(CONSULTA_LISTADO + ' WHERE u.id = $1', [usuarioId]);
  return r.rows[0] ? filaPublica(r.rows[0]) : null;
}

module.exports = {
  ErrorDeCuenta, claveTemporal, validarDatos, crearCuenta, modificarCuenta,
  restablecerClave, listarCuentas, obtenerCuenta, TIPOS_DOCUMENTO
};
