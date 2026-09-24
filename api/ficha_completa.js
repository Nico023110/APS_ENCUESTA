/* =========================================================================
   Encuesta_APS — GET /api/ficha_completa?codigo=…
   -------------------------------------------------------------------------
   La ficha entera —familias, integrantes, selección múltiple y planes— para
   devolverla al formulario y corregirla desde cualquier dispositivo. Antes
   «Corregir» sólo funcionaba con fichas guardadas en el propio navegador.

   Trae todo, datos sensibles incluidos (violencias, salud mental), así que:
     - sólo la recibe quien puede corregir esa ficha (roles.puedeCorregir,
       la misma regla que aplica guardar_encuesta.js al reemplazarla);
     - fuera del alcance de lectura responde 404, como obtener_ficha: no se
       confirma que el código exista;
     - la consulta queda en aud.acceso_sensible (RN-224.2).
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const { leerFichaCompleta } = require('./_ficha_completa');
const roles = require('../roles.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await requerirSesion(req, res);
  if (!usuario) return;

  const alcance = roles.alcanceDeLectura(usuario.rol);
  if (!alcance) return res.status(403).json({ error: 'Su rol no permite consultar fichas', codigo: 'sin_permiso' });

  const codigo = req.query && req.query.codigo ? String(req.query.codigo).trim() : '';
  if (codigo === '') return res.status(400).json({ error: 'Falta el parámetro «codigo».' });

  let cliente;
  try {
    cliente = await obtenerPool().connect();

    const fila = (await cliente.query(`
      SELECT f.id, f.equipo_salud_id, f.responsable_id
        FROM aps.ficha f
       WHERE f.codigo = $1 ${alcance === 'todas' ? '' : 'AND f.equipo_salud_id = $2'}
    `, alcance === 'todas' ? [codigo] : [codigo, usuario.equipoSaludId || -1])).rows[0];

    if (!fila) return res.status(404).json({ error: 'No existe ninguna ficha con ese código.' });

    const permitido = roles.puedeCorregir(usuario, {
      equipoSaludId: Number(fila.equipo_salud_id),
      responsableId: Number(fila.responsable_id)
    });
    if (!permitido) {
      return res.status(403).json({ error: 'Puede ver esta ficha, pero no corregirla: la diligenció otra persona de su equipo.',
        codigo: 'sin_permiso' });
    }

    const encuesta = await leerFichaCompleta(cliente, fila.id);

    await cliente.query(`
      INSERT INTO aud.acceso_sensible (ficha_id, funcionario_id, grupo_dato)
      VALUES ($1, $2, 'ficha_completa')
    `, [fila.id, usuario.funcionarioId]);

    return res.status(200).json({ encuesta: encuesta });
  } catch (error) {
    console.error('Error al leer la ficha completa:', error.message);
    return res.status(500).json({ error: 'No fue posible leer la ficha.' });
  } finally {
    if (cliente) cliente.release();
  }
};
