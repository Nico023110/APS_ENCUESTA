/* =========================================================================
   Sesión para las pruebas que hablan con el servidor.
   -------------------------------------------------------------------------
   Desde que la API exige sesión, cada prueba contra la base necesita entrar
   como alguien. Este módulo deja un usuario de prueba conocido (documento
   1144099001, enfermería, equipo EBS12) con clave fija y sin cambio
   obligatorio, inicia sesión por la misma ruta que el navegador y devuelve
   las cabeceras que hay que pegar a cada fetch: la cookie y la marca
   anti-CSRF.
   ========================================================================= */

'use strict';

const path = require('path');
const { hashDeClave } = require(path.join(__dirname, '..', 'api', '_auth.js'));

const USUARIO_PRUEBA = {
  documento: '1144099001',
  tipoId: 'CC',
  nombre: 'Prueba Enfermería',
  rol: 'enfermeria',
  equipo: 'EBS12',
  clave: 'ClavePrueba2026'
};

async function asegurarUsuarioDePrueba(cliente, datos) {
  const u = Object.assign({}, USUARIO_PRUEBA, datos || {});
  const hash = await hashDeClave(u.clave);

  const equipoId = u.equipo ? (await cliente.query(`
    INSERT INTO aps.equipo_salud (codigo, activo) VALUES ($1, true)
    ON CONFLICT (codigo) DO UPDATE SET activo = true RETURNING id
  `, [u.equipo])).rows[0].id : null;

  const funcionarioId = (await cliente.query(`
    INSERT INTO aps.funcionario (tipo_id, numero_id, nombre_completo, perfil_profesional, equipo_salud_id, activo)
    VALUES ($1, $2, $3, $4, $5, true)
    ON CONFLICT (tipo_id, numero_id) DO UPDATE
      SET nombre_completo = EXCLUDED.nombre_completo,
          perfil_profesional = EXCLUDED.perfil_profesional,
          equipo_salud_id = EXCLUDED.equipo_salud_id,
          activo = true
    RETURNING id
  `, [u.tipoId, u.documento, u.nombre, u.rol === 'administrador' ? null : u.rol, equipoId])).rows[0].id;

  await cliente.query(`
    INSERT INTO aps.usuario (funcionario_id, documento, clave_hash, rol, debe_cambiar_clave, activo)
    VALUES ($1, $2, $3, $4, false, true)
    ON CONFLICT (documento) DO UPDATE
      SET clave_hash = EXCLUDED.clave_hash, rol = EXCLUDED.rol, debe_cambiar_clave = false,
          activo = true, intentos_fallidos = 0, bloqueado_hasta = NULL
  `, [funcionarioId, u.documento, hash, u.rol]);

  return u;
}

async function iniciarSesionDePrueba(base, datos) {
  const u = Object.assign({}, USUARIO_PRUEBA, datos || {});
  const respuesta = await fetch(base + '/api/iniciar_sesion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ documento: u.documento, clave: u.clave })
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(function () { return {}; });
    throw new Error('No se pudo iniciar sesión de prueba: ' + respuesta.status + ' ' + JSON.stringify(cuerpo));
  }
  const cookie = String(respuesta.headers.get('set-cookie') || '').split(';')[0];
  return {
    usuario: (await respuesta.json()).usuario,
    cabeceras: { Cookie: cookie, 'X-Requested-With': 'fetch' }
  };
}

module.exports = { USUARIO_PRUEBA, asegurarUsuarioDePrueba, iniciarSesionDePrueba };
