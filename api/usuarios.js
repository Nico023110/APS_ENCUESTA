/* =========================================================================
   Encuesta_APS — /api/usuarios: gestión de cuentas desde la aplicación
   -------------------------------------------------------------------------
   GET            lista las cuentas.
   POST {accion}  crear | modificar | restablecer.

   Exige el permiso usuarios.gestionar (administrador y maestro). Reglas
   que el permiso solo no cubre:
     - Nadie se desactiva ni se cambia el rol a sí mismo: la sesión que lo
       hiciera quedaría inválida a mitad de camino.
     - Sólo un maestro toca cuentas de maestro (crear, modificar o
       restablecer): el administrador no puede escalar ni bloquear a quien
       responde por el proyecto.
   Cada acción queda en aud.evento a nombre de quien la hizo (RN-225).
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const cuentas = require('./_usuarios');

async function auditar(cliente, actor, tipo, usuarioId, campo, anterior, nuevo) {
  await cliente.query(`
    INSERT INTO aud.evento (entidad, entidad_id, tipo, campo, valor_anterior, valor_nuevo, funcionario_id)
    VALUES ('usuario', $1, $2, $3, $4, $5, $6)
  `, [usuarioId, tipo, campo || null, anterior === undefined ? null : String(anterior),
    nuevo === undefined ? null : String(nuevo), actor.funcionarioId]);
}

function tocaUnMaestro(actor, rolObjetivo, rolNuevo) {
  return actor.rol !== 'maestro' && (rolObjetivo === 'maestro' || rolNuevo === 'maestro');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const actor = await requerirSesion(req, res, { permiso: 'usuarios.gestionar' });
  if (!actor) return;

  let cliente;
  try {
    cliente = await obtenerPool().connect();

    if (req.method === 'GET') {
      return res.status(200).json({ usuarios: await cuentas.listarCuentas(cliente) });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
    const accion = String(cuerpo.accion || '');

    await cliente.query('BEGIN');

    if (accion === 'crear') {
      if (tocaUnMaestro(actor, null, cuerpo.rol)) {
        await cliente.query('ROLLBACK');
        return res.status(403).json({ error: 'Sólo un usuario maestro puede crear otro maestro.', codigo: 'sin_permiso' });
      }
      const creada = await cuentas.crearCuenta(cliente, cuerpo, { creadoPor: actor.id });
      await auditar(cliente, actor, 'creacion', creada.id, 'rol', null, creada.datos.rol);
      await cliente.query('COMMIT');
      return res.status(200).json({
        usuario: await cuentas.obtenerCuenta(cliente, creada.id),
        claveTemporal: creada.clave
      });
    }

    const objetivoId = parseInt(cuerpo.id, 10);
    if (!objetivoId) {
      await cliente.query('ROLLBACK');
      return res.status(400).json({ error: 'Falta la cuenta a modificar.' });
    }
    const objetivo = await cuentas.obtenerCuenta(cliente, objetivoId);
    if (!objetivo) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'La cuenta no existe.' });
    }

    if (accion === 'modificar') {
      if (tocaUnMaestro(actor, objetivo.rol, cuerpo.rol)) {
        await cliente.query('ROLLBACK');
        return res.status(403).json({ error: 'Sólo un usuario maestro puede modificar una cuenta maestra.', codigo: 'sin_permiso' });
      }
      if (objetivo.id === actor.id && (String(cuerpo.rol) !== actor.rol || cuerpo.activo === false)) {
        await cliente.query('ROLLBACK');
        return res.status(400).json({ error: 'No puede cambiar su propio rol ni desactivar su propia cuenta.', campo: 'rol' });
      }
      const resultado = await cuentas.modificarCuenta(cliente, objetivoId, cuerpo);
      if (resultado.anterior.rol !== resultado.datos.rol) {
        await auditar(cliente, actor, 'modificacion', objetivoId, 'rol', resultado.anterior.rol, resultado.datos.rol);
      }
      if (resultado.anterior.activo !== resultado.datos.activo) {
        await auditar(cliente, actor, 'modificacion', objetivoId, 'activo', resultado.anterior.activo, resultado.datos.activo);
      }
      await auditar(cliente, actor, 'modificacion', objetivoId, 'datos', null, null);
      await cliente.query('COMMIT');
      return res.status(200).json({ usuario: await cuentas.obtenerCuenta(cliente, objetivoId) });
    }

    if (accion === 'restablecer') {
      if (tocaUnMaestro(actor, objetivo.rol, null)) {
        await cliente.query('ROLLBACK');
        return res.status(403).json({ error: 'Sólo un usuario maestro puede restablecer la clave de un maestro.', codigo: 'sin_permiso' });
      }
      const resultado = await cuentas.restablecerClave(cliente, objetivoId);
      await auditar(cliente, actor, 'modificacion', objetivoId, 'clave', null, 'restablecida');
      await cliente.query('COMMIT');
      return res.status(200).json({
        usuario: await cuentas.obtenerCuenta(cliente, objetivoId),
        claveTemporal: resultado.clave
      });
    }

    await cliente.query('ROLLBACK');
    return res.status(400).json({ error: 'Acción desconocida.' });
  } catch (error) {
    if (cliente) await cliente.query('ROLLBACK').catch(function () {});
    if (error && error.esDeCuenta) {
      return res.status(400).json({ error: error.message, campo: error.campo });
    }
    console.error('Error en /api/usuarios:', error.message);
    return res.status(500).json({ error: 'No fue posible completar la operación.' });
  } finally {
    if (cliente) cliente.release();
  }
};
