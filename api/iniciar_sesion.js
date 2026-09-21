/* =========================================================================
   Encuesta_APS — POST /api/iniciar_sesion
   -------------------------------------------------------------------------
   Cuerpo: { documento, clave }. Responde el perfil público y deja la cookie
   de sesión. Los motivos de rechazo por credenciales se funden en un solo
   mensaje: no se confirma si el documento existe (ver _auth.js).
   ========================================================================= */

'use strict';

const auth = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (String(req.headers['x-requested-with'] || '').toLowerCase() !== 'fetch') {
    return res.status(403).json({ error: 'Petición no admitida', codigo: 'csrf' });
  }

  const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const resultado = await auth.autenticar(req, cuerpo.documento, cuerpo.clave);

    if (!resultado.ok) {
      return res.status(resultado.estado).json({ error: resultado.mensaje, codigo: resultado.codigo });
    }

    /* Si esta petición reemplaza una sesión anterior del mismo navegador
       (bloqueo por inactividad), la anterior se cierra. */
    await auth.revocarSesionActual(req, res, 'reemplazada');
    await auth.crearSesion(req, res, resultado.usuario.id);

    return res.status(200).json({ usuario: resultado.usuario });
  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);
    return res.status(500).json({ error: 'No fue posible iniciar sesión. Intente de nuevo.' });
  }
};
