/* POST /api/cerrar_sesion — revoca la sesión de la cookie y la borra. */

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

  try {
    await auth.revocarSesionActual(req, res, 'cierre');
  } catch (error) {
    console.warn('No se pudo revocar la sesión en la base:', error.message);
  }
  return res.status(200).json({ ok: true });
};
