/* =========================================================================
   Encuesta_APS — Familias ya caracterizadas antes: su CF (RN-015, RN-230)
   -------------------------------------------------------------------------
   Si alguna persona de una familia ya se había caracterizado —en la base
   anterior a la app (hist) o en otra ficha de la app de fecha anterior—, la
   ficha es una visita más a esa familia (decisión del 2026-11-19):

     visitas_anteriores  caracterizaciones distintas donde aparece alguna de
                         sus personas (una vivienda de la base anterior o una
                         ficha de la app cuenta una vez, aunque coincidan
                         varias personas);
     CF                  CF + (visitas_anteriores + la visita de esta ficha):
                         CF002 si se caracterizó una vez antes. La visita que
                         completa integrantes suma una más (guardar_encuesta).

   Los datos vigentes son los de la ficha; lo anterior queda como antecedente
   (aps.familia_antecedente) para verlo en el detalle. El archivo plano no
   cambia: el CF no se reporta.

   Se cruza por número de documento, sin importar el tipo (una tarjeta de
   identidad que pasó a cédula conserva el número). Una ficha sin
   coincidencias cuesta una consulta y no escribe nada.
   ========================================================================= */

'use strict';

function textoCf(numero) {
  return 'CF' + String(Math.max(1, Number(numero) || 1)).padStart(3, '0');
}

/* Por familia de la ficha $1: su CF y su visita, y dónde aparecen antes sus
   personas. Las fichas de la app cuentan si son de otra vivienda o anteriores
   (fecha, y a igual fecha el id) y no se cuentan a sí mismas. */
const SQL_FAMILIAS_Y_ANTECEDENTES = `
  WITH esta AS (
    SELECT id, fecha_diligenciamiento FROM aps.ficha WHERE id = $1
  ), personas AS (
    SELECT DISTINCT ff.id AS familia_ficha_id, upper(p.numero_id) AS numero
      FROM aps.familia_ficha ff
      JOIN aps.integrante i ON i.familia_ficha_id = ff.id
      JOIN aps.persona p    ON p.id = i.persona_id
     WHERE ff.ficha_id = $1
  ), antecedentes AS (
    SELECT pe.familia_ficha_id, 'base_previa'::text AS origen, v.numero_anterior AS referencia,
           NULL::bigint AS ficha_id, v.ultima_fecha AS fecha, v.ebs_codigo AS ebs, v.territorio,
           count(DISTINCT pe.numero)::int AS personas
      FROM personas pe
      JOIN hist.persona hp  ON hp.numero_id = pe.numero
      JOIN hist.vivienda v  ON v.id = hp.vivienda_id
     GROUP BY pe.familia_ficha_id, v.numero_anterior, v.ultima_fecha, v.ebs_codigo, v.territorio
    UNION ALL
    SELECT pe.familia_ficha_id, 'app', fo.codigo, fo.id, fo.fecha_diligenciamiento, eo.codigo, ho.territorio_codigo,
           count(DISTINCT pe.numero)::int
      FROM personas pe
      JOIN aps.persona po        ON upper(po.numero_id) = pe.numero
      JOIN aps.integrante io     ON io.persona_id = po.id
      JOIN aps.familia_ficha ffo ON ffo.id = io.familia_ficha_id
      JOIN aps.ficha fo          ON fo.id = ffo.ficha_id
      JOIN aps.equipo_salud eo   ON eo.id = fo.equipo_salud_id
      JOIN aps.hogar ho          ON ho.id = fo.hogar_id
      CROSS JOIN esta
     WHERE fo.id <> esta.id
       AND (fo.fecha_diligenciamiento < esta.fecha_diligenciamiento
            OR (fo.fecha_diligenciamiento = esta.fecha_diligenciamiento AND fo.id < esta.id))
     GROUP BY pe.familia_ficha_id, fo.codigo, fo.id, fo.fecha_diligenciamiento, eo.codigo, ho.territorio_codigo
  )
  SELECT ff.id, fa.consecutivo, ff.codigo_cf, ff.visitas_anteriores,
         1 + (SELECT count(*) FROM aps.visita_ficha v WHERE v.ficha_id = ff.ficha_id)::int AS visita,
         coalesce((SELECT json_agg(json_build_object(
                     'origen', a.origen, 'referencia', a.referencia, 'fichaId', a.ficha_id,
                     'fecha', to_char(a.fecha, 'YYYY-MM-DD'), 'ebs', a.ebs, 'territorio', a.territorio,
                     'personas', a.personas) ORDER BY a.fecha, a.referencia)
                     FROM antecedentes a WHERE a.familia_ficha_id = ff.id), '[]'::json) AS antecedentes
    FROM aps.familia_ficha ff
    JOIN aps.familia fa ON fa.id = ff.familia_id
   WHERE ff.ficha_id = $1
   ORDER BY fa.consecutivo, ff.id
`;

/**
 * Qué cambia en cada familia: sus visitas anteriores, su CF y sus
 * antecedentes. Función pura sobre las filas de SQL_FAMILIAS_Y_ANTECEDENTES.
 */
function planDeAntecedentes(filas) {
  return filas.map(function (f) {
    const antecedentes = Array.isArray(f.antecedentes) ? f.antecedentes : [];
    const visitasAnteriores = antecedentes.length;
    const codigoCf = textoCf(visitasAnteriores + (Number(f.visita) || 1));
    return {
      familiaFichaId: f.id,
      consecutivo: Number(f.consecutivo),
      antes: { codigoCf: f.codigo_cf, visitasAnteriores: Number(f.visitas_anteriores) || 0 },
      visitasAnteriores: visitasAnteriores,
      codigoCf: codigoCf,
      antecedentes: antecedentes,
      cambia: codigoCf !== f.codigo_cf || visitasAnteriores !== (Number(f.visitas_anteriores) || 0)
    };
  });
}

function textoDeAntecedente(a) {
  return (a.origen === 'base_previa' ? 'base anterior, vivienda ' : 'ficha ') + a.referencia +
    (a.fecha ? ' (' + a.fecha + (a.ebs ? ', ' + a.ebs : '') + ')' : '');
}

/**
 * Calcula y guarda los antecedentes de las familias de una ficha, y su CF.
 * Dentro de la transacción del guardado. Sin coincidencias ni cambios no
 * escribe nada.
 * @returns {Promise<object[]>} por familia, en su orden: { consecutivo, codigoCf, visitasAnteriores, antecedentes, cambia }
 */
async function registrarAntecedentes(cliente, fichaId, funcionarioId, dispositivoId) {
  const plan = planDeAntecedentes((await cliente.query(SQL_FAMILIAS_Y_ANTECEDENTES, [fichaId])).rows);
  const conAntecedentes = plan.filter(function (f) { return f.antecedentes.length > 0 || f.antes.visitasAnteriores > 0; });
  const cambian = plan.filter(function (f) { return f.cambia; });
  if (conAntecedentes.length === 0 && cambian.length === 0) return plan;

  /* El vínculo se rehace: una corrección pudo cambiar un documento. */
  await cliente.query('DELETE FROM aps.familia_antecedente WHERE familia_ficha_id = ANY($1::bigint[])',
    [plan.map(function (f) { return f.familiaFichaId; })]);
  const filas = [];
  plan.forEach(function (f) {
    f.antecedentes.forEach(function (a) { filas.push({ familia: f.familiaFichaId, a: a }); });
  });
  if (filas.length > 0) {
    await cliente.query(`
      INSERT INTO aps.familia_antecedente
        (familia_ficha_id, origen, referencia, ficha_id, fecha, ebs, territorio, personas_coinciden)
      SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[], $4::bigint[], $5::date[], $6::text[], $7::text[], $8::int[])
      ON CONFLICT (familia_ficha_id, origen, referencia) DO NOTHING
    `, [
      filas.map(function (x) { return x.familia; }),
      filas.map(function (x) { return x.a.origen; }),
      filas.map(function (x) { return x.a.referencia; }),
      filas.map(function (x) { return x.a.fichaId || null; }),
      filas.map(function (x) { return x.a.fecha || null; }),
      filas.map(function (x) { return x.a.ebs || null; }),
      filas.map(function (x) { return x.a.territorio || null; }),
      filas.map(function (x) { return Number(x.a.personas) || 1; })
    ]);
  }

  if (cambian.length > 0) {
    await cliente.query(`
      UPDATE aps.familia_ficha ff
         SET visitas_anteriores = x.previas, codigo_cf = x.cf
        FROM unnest($1::bigint[], $2::int[], $3::text[]) AS x(id, previas, cf)
       WHERE ff.id = x.id
    `, [
      cambian.map(function (f) { return f.familiaFichaId; }),
      cambian.map(function (f) { return f.visitasAnteriores; }),
      cambian.map(function (f) { return f.codigoCf; })
    ]);
    /* RN-225: el cambio de CF queda en la auditoría, con su motivo. */
    await cliente.query(`
      INSERT INTO aud.evento (ficha_id, entidad, entidad_id, tipo, campo, valor_anterior, valor_nuevo, funcionario_id, dispositivo_id)
      SELECT $1, 'familia_ficha', x.id, 'modificacion', 'codigo_cf', x.antes, x.despues, $5, $6
        FROM unnest($2::bigint[], $3::text[], $4::text[]) AS x(id, antes, despues)
    `, [
      fichaId,
      cambian.map(function (f) { return f.familiaFichaId; }),
      cambian.map(function (f) { return f.antes.codigoCf; }),
      cambian.map(function (f) {
        return f.codigoCf + (f.antecedentes.length
          ? ': ya caracterizada antes en ' + f.antecedentes.map(textoDeAntecedente).join('; ')
          : ': sin caracterizaciones anteriores');
      }),
      funcionarioId || null,
      dispositivoId || null
    ]);
  }
  return plan;
}

module.exports = { registrarAntecedentes, planDeAntecedentes, textoCf, textoDeAntecedente, SQL_FAMILIAS_Y_ANTECEDENTES };
