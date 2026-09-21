/* GET /api/sesion — perfil del usuario de la cookie, o 401. Es lo primero
   que pide el navegador al abrir la aplicación. */

'use strict';

const auth = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await auth.requerirSesion(req, res, { permitirClaveTemporal: true });
  if (!usuario) return;

  return res.status(200).json({ usuario: usuario });
};
