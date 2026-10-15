/* =========================================================================
   Encuesta_APS — /api/permisos_plan: autorizar la corrección de una ficha
   -------------------------------------------------------------------------
   RN-228: una ficha guardada sólo se completa (Evolucionar plan). Para
   corregirla —incluido lo registrado en su plan de cuidado— quien no puede
   hacerlo por su rol necesita que la coordinación del EBS o el usuario
   maestro lo autoricen, a esa persona y para esa ficha. La autorización
   sirve para un guardado: guardar_encuesta.js la gasta al usarla.

   GET  ?codigo=…   las autorizaciones vigentes de la ficha y los usuarios a
                    quienes se les puede dar: quienes ven la ficha en su
                    historial y no pueden ya hacer lo que la autorización da
                    (roles.puedeRecibirAutorizacion).
   POST {accion: 'otorgar', codigo, usuarioId, motivo?}
   POST {accion: 'revocar', permisoId}

   Exige el permiso ficha.autorizar. Cada otorgamiento y revocación queda en
   la propia tabla (quién, cuándo, por qué) y en aud.evento (RN-225).
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const roles = require('../roles.js');

const LARGO_MAXIMO_MOTIVO = 300;

async function fichaPorCodigo(cliente, codigo) {
  return (await cliente.query(`
    SELECT f.id, f.codigo, f.equipo_salud_id, f.responsable_id
      FROM aps.ficha f
     WHERE f.codigo = $1
  `, [codigo])).rows[0] || null;
}

async function vigentes(cliente, fichaId) {
  return (await cliente.query(`
    SELECT pp.id, pp.otorgado_en, pp.motivo,
           u.id AS usuario_id, u.documento, u.rol, fu.nombre_completo,
           m.documento AS otorgado_por_documento, fm.nombre_completo AS otorgado_por_nombre
      FROM aps.permiso_plan pp
      JOIN aps.usuario u      ON u.id = pp.usuario_id
      JOIN aps.funcionario fu ON fu.id = u.funcionario_id
      JOIN aps.usuario m      ON m.id = pp.otorgado_por
      JOIN aps.funcionario fm ON fm.id = m.funcionario_id
     WHERE pp.ficha_id = $1 AND pp.usado_en IS NULL AND pp.revocado_en IS NULL
     ORDER BY pp.otorgado_en
  `, [fichaId])).rows.map(function (fila) {
    return {
      id: Number(fila.id),
      otorgadoEn: fila.otorgado_en,
      motivo: fila.motivo,
      usuario: { id: Number(fila.usuario_id), documento: fila.documento, rol: fila.rol, nombre: fila.nombre_completo },
      otorgadoPor: { documento: fila.otorgado_por_documento, nombre: fila.otorgado_por_nombre }
    };
  });
}

/* Quien puede recibir la autorización: una cuenta activa que ve la ficha y
   no puede ya corregirla, o cambiar lo registrado en su plan, por sí misma. */
async function candidatos(cliente, ficha) {
  const filas = (await cliente.query(`
    SELECT u.id, u.documento, u.rol, fu.id AS funcionario_id, fu.nombre_completo, fu.equipo_salud_id
      FROM aps.usuario u
      JOIN aps.funcionario fu ON fu.id = u.funcionario_id
     WHERE u.activo AND fu.activo
     ORDER BY fu.nombre_completo
  `)).rows;

  return filas.filter(function (fila) {
    return roles.puedeRecibirAutorizacion(
      { rol: fila.rol, equipoSaludId: fila.equipo_salud_id === null ? null : Number(fila.equipo_salud_id),
        funcionarioId: Number(fila.funcionario_id) },
      { equipoSaludId: Number(ficha.equipo_salud_id), responsableId: Number(ficha.responsable_id) });
  }).map(function (fila) {
    return { id: Number(fila.id), documento: fila.documento, rol: fila.rol, nombre: fila.nombre_completo };
  });
}

async function auditar(cliente, actor, fichaId, campo, detalle) {
  await cliente.query(`
    INSERT INTO aud.evento (ficha_id, entidad, entidad_id, tipo, campo, valor_nuevo, funcionario_id)
    VALUES ($1, 'permiso_plan', $1, 'modificacion', $2, $3, $4)
  `, [fichaId, campo, detalle, actor.funcionarioId]);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const actor = await requerirSesion(req, res, { permiso: 'ficha.autorizar' });
  if (!actor) return;

  let cliente;
  try {
    cliente = await obtenerPool().connect();

    if (req.method === 'GET') {
      const codigo = req.query && req.query.codigo ? String(req.query.codigo).trim() : '';
      if (!codigo) return res.status(400).json({ error: 'Falta el parámetro «codigo».' });
      const ficha = await fichaPorCodigo(cliente, codigo);
      if (!ficha) return res.status(404).json({ error: 'No existe ninguna ficha con ese código.' });
      return res.status(200).json({
        ficha: { codigo: ficha.codigo },
        permisos: await vigentes(cliente, ficha.id),
        candidatos: await candidatos(cliente, ficha)
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
    const accion = String(cuerpo.accion || '');

    if (accion === 'otorgar') {
      const ficha = await fichaPorCodigo(cliente, String(cuerpo.codigo || '').trim());
      if (!ficha) return res.status(404).json({ error: 'No existe ninguna ficha con ese código.' });

      const usuarioId = parseInt(cuerpo.usuarioId, 10);
      const elegible = (await candidatos(cliente, ficha)).find(function (c) { return c.id === usuarioId; });
      if (!elegible) {
        return res.status(400).json({ error: 'Ese usuario no puede recibir la autorización: la ficha no está ' +
          'en su historial, su cuenta no está activa o ya puede corregirla por sí mismo.', campo: 'usuarioId' });
      }

      const motivo = String(cuerpo.motivo || '').trim().slice(0, LARGO_MAXIMO_MOTIVO) || null;

      await cliente.query('BEGIN');
      /* Un solo permiso vigente por usuario y ficha: si ya lo tiene, se
         devuelve el mismo en vez de fallar contra el índice único. */
      const existente = (await cliente.query(`
        SELECT id FROM aps.permiso_plan
         WHERE ficha_id = $1 AND usuario_id = $2 AND usado_en IS NULL AND revocado_en IS NULL
      `, [ficha.id, usuarioId])).rows[0];
      if (!existente) {
        const nuevo = (await cliente.query(`
          INSERT INTO aps.permiso_plan (ficha_id, usuario_id, otorgado_por, motivo)
          VALUES ($1, $2, $3, $4) RETURNING id
        `, [ficha.id, usuarioId, actor.id, motivo])).rows[0];
        await auditar(cliente, actor, ficha.id, 'autorizacion_otorgada',
          'permiso ' + nuevo.id + ' a ' + elegible.documento + (motivo ? ': ' + motivo : ''));
      }
      await cliente.query('COMMIT');

      return res.status(200).json({ permisos: await vigentes(cliente, ficha.id) });
    }

    if (accion === 'revocar') {
      const permisoId = parseInt(cuerpo.permisoId, 10);
      await cliente.query('BEGIN');
      const revocado = (await cliente.query(`
        UPDATE aps.permiso_plan SET revocado_en = now(), revocado_por = $2
         WHERE id = $1 AND usado_en IS NULL AND revocado_en IS NULL
        RETURNING ficha_id
      `, [permisoId, actor.id])).rows[0];
      if (!revocado) {
        await cliente.query('ROLLBACK');
        return res.status(404).json({ error: 'La autorización no existe o ya no está vigente.' });
      }
      await auditar(cliente, actor, revocado.ficha_id, 'autorizacion_revocada', 'permiso ' + permisoId);
      await cliente.query('COMMIT');
      return res.status(200).json({ permisos: await vigentes(cliente, revocado.ficha_id) });
    }

    return res.status(400).json({ error: 'Acción no reconocida: use «otorgar» o «revocar».' });
  } catch (error) {
    if (cliente) {
      try { await cliente.query('ROLLBACK'); } catch (e) { /* sin transacción abierta */ }
    }
    console.error('Error en las autorizaciones de corrección:', error.message);
    return res.status(500).json({ error: 'No fue posible procesar la autorización.' });
  } finally {
    if (cliente) cliente.release();
  }
};
