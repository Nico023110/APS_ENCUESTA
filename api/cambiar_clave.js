/* =========================================================================
   Encuesta_APS — POST /api/cambiar_clave
   -------------------------------------------------------------------------
   Cuerpo: { claveActual, claveNueva }. Exige sesión (también con clave
   temporal: es justamente el camino del primer ingreso), verifica la clave
   vigente, aplica la política y cierra las demás sesiones del usuario: si
   alguien cambió la clave es porque quiere quedarse solo dentro.
   ========================================================================= */

'use strict';

const auth = require('./_auth');
const { consultar } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await auth.requerirSesion(req, res, { permitirClaveTemporal: true });
  if (!usuario) return;

  const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
  const claveActual = typeof cuerpo.claveActual === 'string' ? cuerpo.claveActual : '';
  const claveNueva = typeof cuerpo.claveNueva === 'string' ? cuerpo.claveNueva : '';

  try {
    const fila = (await consultar('SELECT clave_hash FROM aps.usuario WHERE id = $1', [usuario.id])).rows[0];
    if (!fila || !(await auth.verificarClave(claveActual, fila.clave_hash))) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.', codigo: 'clave_actual' });
    }

    const faltan = auth.requisitosIncumplidos(claveNueva, usuario.documento);
    if (claveNueva === claveActual) faltan.push('Debe ser distinta de la contraseña actual.');
    if (faltan.length > 0) {
      return res.status(400).json({ error: 'La contraseña nueva no cumple los requisitos.',
        codigo: 'requisitos', requisitos: faltan });
    }

    const hash = await auth.hashDeClave(claveNueva);
    await consultar(`
      UPDATE aps.usuario
         SET clave_hash = $2, debe_cambiar_clave = false, clave_cambiada_en = now(),
             intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE id = $1
    `, [usuario.id, hash]);

    const token = auth.leerCookies(req)[auth.NOMBRE_COOKIE];
    await auth.revocarOtrasSesiones(usuario.id, token, 'cambio_de_clave');

    usuario.debeCambiarClave = false;
    return res.status(200).json({ usuario: usuario });
  } catch (error) {
    console.error('Error al cambiar la contraseña:', error.message);
    return res.status(500).json({ error: 'No fue posible cambiar la contraseña. Intente de nuevo.' });
  }
};
