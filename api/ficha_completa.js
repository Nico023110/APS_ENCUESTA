/* =========================================================================
   Encuesta_APS — /api/ficha_completa
   -------------------------------------------------------------------------
   GET  ?codigo=…
   La ficha entera —familias, integrantes, selección múltiple y planes— para
   devolverla al formulario y corregirla, o evolucionar su plan, desde
   cualquier dispositivo. Antes «Corregir» sólo funcionaba con fichas
   guardadas en el propio navegador.

   Trae todo, datos sensibles incluidos (violencias, salud mental), así que:
     - sólo la recibe quien puede volver a guardar esa ficha: quien la
       corrige por su rol, quien evoluciona su plan (roles.puedeEvolucionar)
       o quien tiene una autorización vigente sobre ella (RN-228). Es la misma
       regla que aplica guardar_encuesta.js;
     - fuera del alcance de lectura responde 404, como obtener_ficha: no se
       confirma que el código exista;
     - la consulta queda en aud.acceso_sensible (RN-224.2).
   La respuesta dice si la ficha se puede corregir (`corregible`) y si lo
   registrado en su plan se puede cambiar (`planRegistradoEditable`); el
   formulario lo usa para abrirla en el modo que corresponde. Quien decide
   al guardar es guardar_encuesta.js.

   POST {accion: 'eliminar', codigo, motivo}
   Sólo el usuario maestro (ficha.eliminar) elimina una ficha de la base, con
   motivo. Se borran la ficha y lo que cuelga de ella —familias de la visita,
   integrantes, planes, alertas, autorizaciones— en una transacción. La
   vivienda y la familia como identidades (aps.hogar, aps.familia) se
   conservan: sus códigos y el NUV no se reutilizan nunca. El evento queda en
   aud.evento, que no depende de la ficha y sobrevive al borrado (RN-225).
   No es un endpoint aparte: Vercel cobra cada archivo de api/ como una
   función, y eliminar es una acción sobre el mismo recurso.
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const { leerFichaCompleta } = require('./_ficha_completa');
const roles = require('../roles.js');

const LARGO_MINIMO_MOTIVO = 10;
const LARGO_MAXIMO_MOTIVO = 300;

function codigoPedido(req) {
  return req.query && req.query.codigo ? String(req.query.codigo).trim() : '';
}

/* Lo que hace falta para decidir si se entrega la ficha: su equipo, quién la
   diligenció y quiénes tienen una autorización vigente sobre ella. Se busca a
   la vez que se verifica la sesión (ver el manejador, al final) y no sale de
   aquí: sólo se usa si la sesión es válida. El contenido de la ficha se lee
   después, con el permiso ya decidido. */
async function buscarFicha(pool, codigo) {
  return (await pool.query(`
    SELECT f.id, f.equipo_salud_id, f.responsable_id,
           ARRAY(SELECT pp.usuario_id FROM aps.permiso_plan pp
                  WHERE pp.ficha_id = f.id AND pp.usado_en IS NULL AND pp.revocado_en IS NULL) AS autorizados
      FROM aps.ficha f
     WHERE f.codigo = $1
  `, [codigo])).rows[0] || null;
}

async function leer(req, res, usuario, busqueda) {
  const alcance = roles.alcanceDeLectura(usuario.rol);
  if (!alcance) return res.status(403).json({ error: 'Su rol no permite consultar fichas', codigo: 'sin_permiso' });

  const codigo = codigoPedido(req);
  if (codigo === '') return res.status(400).json({ error: 'Falta el parámetro «codigo».' });

  /* Todo por el pool y no por un cliente apartado: así leerFichaCompleta
     lanza a la vez las lecturas que no dependen entre sí (ver aLaVez en
     _db.js). */
  const pool = obtenerPool();
  try {
    let fila = await busqueda;
    /* RN-224.3: fuera del equipo la ficha «no existe», igual que antes cuando
       el equipo iba en el WHERE. */
    if (fila && alcance !== 'todas' && Number(fila.equipo_salud_id) !== (usuario.equipoSaludId || -1)) fila = null;

    if (!fila) return res.status(404).json({ error: 'No existe ninguna ficha con ese código.' });

    const fichaRef = { equipoSaludId: Number(fila.equipo_salud_id), responsableId: Number(fila.responsable_id) };
    const autorizado = (fila.autorizados || []).map(String).indexOf(String(usuario.id)) !== -1;
    const corregible = roles.puedeCorregir(usuario, fichaRef) || autorizado;
    if (!corregible && !roles.puedeEvolucionar(usuario, fichaRef)) {
      return res.status(403).json({ error: 'Puede ver esta ficha, pero no corregirla ni evolucionar su plan: ' +
        'la diligenció otra persona de su equipo.', codigo: 'sin_permiso' });
    }

    /* El registro del acceso no depende de la lectura: van a la vez. */
    const [encuesta] = await Promise.all([
      leerFichaCompleta(pool, fila.id),
      pool.query(`
        INSERT INTO aud.acceso_sensible (ficha_id, funcionario_id, grupo_dato)
        VALUES ($1, $2, 'ficha_completa')
      `, [fila.id, usuario.funcionarioId])
    ]);

    /* RN-228: lo registrado en el plan sólo se completa, salvo para los roles
       que lo modifican (coordinación y maestro) o para quien tenga una
       autorización vigente sobre esta ficha. */
    const planRegistradoEditable = roles.puede(usuario.rol, 'plan.modificar_registrado') || autorizado;

    return res.status(200).json({
      encuesta: encuesta,
      corregible: corregible,
      planRegistradoEditable: planRegistradoEditable
    });
  } catch (error) {
    console.error('Error al leer la ficha completa:', error.message);
    return res.status(500).json({ error: 'No fue posible leer la ficha.' });
  }
}

async function eliminar(req, res, usuario) {
  if (!roles.puede(usuario.rol, 'ficha.eliminar')) {
    return res.status(403).json({ error: 'Sólo el usuario maestro puede eliminar una ficha.', codigo: 'sin_permiso' });
  }

  const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
  const codigo = String(cuerpo.codigo || '').trim();
  const motivo = String(cuerpo.motivo || '').trim().replace(/\s+/g, ' ').slice(0, LARGO_MAXIMO_MOTIVO);
  if (!codigo) return res.status(400).json({ error: 'Falta la ficha que se quiere eliminar.', campo: 'codigo' });
  if (motivo.length < LARGO_MINIMO_MOTIVO) {
    return res.status(400).json({ error: 'Escriba el motivo de la eliminación (al menos ' + LARGO_MINIMO_MOTIVO +
      ' caracteres): queda en la auditoría.', campo: 'motivo' });
  }

  let cliente;
  try {
    cliente = await obtenerPool().connect();
    await cliente.query('BEGIN');

    const ficha = (await cliente.query(`
      SELECT f.id, f.codigo, to_char(f.fecha_diligenciamiento, 'YYYY-MM-DD') AS fecha,
             eq.codigo AS equipo, h.codigo AS vivienda, r.numero_id AS responsable,
             (SELECT count(*) FROM aps.familia_ficha ff WHERE ff.ficha_id = f.id)::int AS familias,
             (SELECT count(*) FROM aps.integrante i
                JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
               WHERE ff.ficha_id = f.id)::int AS integrantes
        FROM aps.ficha f
        JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
        JOIN aps.hogar h         ON h.id = f.hogar_id
        JOIN aps.funcionario r   ON r.id = f.responsable_id
       WHERE f.codigo = $1
         FOR UPDATE OF f
    `, [codigo])).rows[0];

    if (!ficha) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'No existe ninguna ficha con ese código.' });
    }

    /* Lo que apunta a la ficha sin borrarse en cascada: el histórico de
       sincronización y la ficha a la que reemplazó una corrección. */
    await cliente.query('UPDATE aps.ficha SET ficha_reemplazada_id = NULL WHERE ficha_reemplazada_id = $1', [ficha.id]);
    await cliente.query('UPDATE aps.sincronizacion SET ficha_conservada_id = NULL WHERE ficha_conservada_id = $1', [ficha.id]);
    await cliente.query('DELETE FROM aps.sincronizacion WHERE ficha_id = $1', [ficha.id]);
    await cliente.query('DELETE FROM aps.ficha WHERE id = $1', [ficha.id]);

    const resumen = 'ficha ' + ficha.codigo + ' · vivienda ' + ficha.vivienda + ' · ' + ficha.equipo +
      ' · diligenciada el ' + ficha.fecha + ' por ' + ficha.responsable + ' · ' +
      ficha.familias + ' familia(s), ' + ficha.integrantes + ' integrante(s)';
    await cliente.query(`
      INSERT INTO aud.evento (ficha_id, entidad, entidad_id, tipo, campo, valor_anterior, valor_nuevo, funcionario_id)
      VALUES ($1, 'ficha', $1, 'eliminacion', 'ficha', $2, $3, $4)
    `, [ficha.id, resumen, motivo, usuario.funcionarioId]);

    await cliente.query('COMMIT');
    console.log('  Ficha eliminada por ' + usuario.documento + ': ' + ficha.codigo + ' (id ' + ficha.id + ')');
    return res.status(200).json({ eliminada: ficha.codigo });
  } catch (error) {
    if (cliente) await cliente.query('ROLLBACK').catch(function () {});
    console.error('Error al eliminar la ficha:', error.message);
    return res.status(500).json({ error: 'No fue posible eliminar la ficha.' });
  } finally {
    if (cliente) cliente.release();
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  /* GET: la ficha se busca mientras se verifica la sesión; contra Neon cada
     consulta en serie suma ~125 ms. Si la sesión no vale, lo encontrado se
     descarta sin usarlo. Un error de la búsqueda se informa en leer(). */
  const codigo = req.method === 'GET' ? codigoPedido(req) : '';
  const busqueda = codigo
    ? (async function () { return buscarFicha(obtenerPool(), codigo); })()
    : Promise.resolve(null);
  busqueda.catch(function () { /* se atiende en leer(); evita el aviso de promesa sin atender */ });

  const usuario = await requerirSesion(req, res);
  if (!usuario) return;

  if (req.method === 'GET') return leer(req, res, usuario, busqueda);

  const accion = req.body && typeof req.body === 'object' ? String(req.body.accion || '') : '';
  if (accion === 'eliminar') return eliminar(req, res, usuario);
  return res.status(400).json({ error: 'Acción desconocida.' });
};
