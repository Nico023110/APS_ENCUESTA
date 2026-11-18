/* =========================================================================
   Encuesta_APS — Completitud de una ficha para el archivo plano
   -------------------------------------------------------------------------
   Una ficha está completa cuando tiene caracterizados todos los integrantes
   que declara el ítem 51 de cada familia (RN-051) y una familia en cada hogar
   que declara el ítem 28 (RN-028). Desde el 2026-11-18 una ficha nueva no
   sube incompleta; las que ya estaban en la base pueden estarlo, y el archivo
   plano no las lleva hasta que se completen (api/reporte_sispro.js).

   Cuándo quedó completa: una ficha que se completa después —«Completar
   integrantes» o una corrección— deja en aud.evento campo «completitud»
   (anotarSiQuedoCompleta). El reporte la lleva en el período en que se
   completó. Los «integrantes» que anotaba «Completar integrantes» antes de
   esta regla también cuentan como fecha de completitud.

   Mismo criterio en JavaScript (sobre la ficha armada) y en SQL (sobre la
   base), igual que reglas.js: los hogares se cuentan distintos —una familia
   sin hogar elegido, de fichas anteriores, cuenta como un hogar propio— y
   sólo si la ficha tiene alguna familia.
   ========================================================================= */

'use strict';

/** { integrantes, hogares } que le faltan a una ficha armada (encuesta). */
function faltantesDeFicha(encuesta) {
  const e = encuesta || {};
  const familias = Array.isArray(e.familias) ? e.familias : [];
  const integrantes = familias.reduce(function (total, familia) {
    const declarados = Number(familia && familia.numeroIntegrantes) || 0;
    const capturados = Array.isArray(familia && familia.integrantes) ? familia.integrantes.length : 0;
    return total + Math.max(0, declarados - capturados);
  }, 0);
  let hogares = 0;
  if (familias.length > 0) {
    const distintos = new Set(familias.map(function (familia, i) {
      const n = Number(familia && familia.hogarNumero);
      return Number.isInteger(n) && n > 0 ? 'h' + n : 'f' + i;
    })).size;
    const declarados = Number(e.hogaresEnVivienda) || 0;
    hogares = Math.max(0, declarados - distintos);
  }
  return { integrantes: integrantes, hogares: hogares };
}

function estaCompleta(encuesta) {
  const f = faltantesDeFicha(encuesta);
  return f.integrantes === 0 && f.hogares === 0;
}

/* Condición SQL «la ficha f está incompleta» (alias f = aps.ficha). */
const SQL_FICHA_INCOMPLETA = `(
  EXISTS (
    SELECT 1 FROM aps.familia_ficha ffi
     WHERE ffi.ficha_id = f.id
       AND ffi.numero_integrantes > (SELECT count(*) FROM aps.integrante ii WHERE ii.familia_ficha_id = ffi.id)
  )
  OR EXISTS (
    SELECT 1 FROM aps.vivienda vi
     WHERE vi.ficha_id = f.id
       AND EXISTS (SELECT 1 FROM aps.familia_ficha ffh WHERE ffh.ficha_id = f.id)
       AND vi.hogares_en_vivienda > (
         SELECT count(DISTINCT coalesce(ffh.hogar_numero::text, 'f' || ffh.id))
           FROM aps.familia_ficha ffh WHERE ffh.ficha_id = f.id)
  )
)`;

/* Día (hora de Colombia) en que la ficha f quedó completa después de su
   visita, o NULL si nunca estuvo incompleta en la base. */
const SQL_COMPLETADA_EL = `(
  SELECT max((ev.ocurrido_en AT TIME ZONE 'America/Bogota')::date)
    FROM aud.evento ev
   WHERE ev.ficha_id = f.id AND ev.entidad = 'ficha' AND ev.campo IN ('completitud', 'integrantes')
)`;

/* Si la ficha que estaba incompleta en la base queda completa con este
   guardado, se anota: de ahí sale el período en que va al archivo plano. */
async function anotarSiQuedoCompleta(cliente, fichaId, antes, despues, funcionarioId, dispositivoId) {
  if (!antes || estaCompleta(antes) || !estaCompleta(despues)) return false;
  const f = faltantesDeFicha(antes);
  await cliente.query(`
    INSERT INTO aud.evento (ficha_id, entidad, entidad_id, tipo, campo, valor_anterior, valor_nuevo, funcionario_id, dispositivo_id)
    VALUES ($1, 'ficha', $1, 'modificacion', 'completitud', $2, 'completa', $3, $4)
  `, [fichaId, 'faltaban ' + f.integrantes + ' integrante(s) y ' + f.hogares + ' hogar(es)',
    funcionarioId || null, dispositivoId || null]);
  return true;
}

module.exports = { faltantesDeFicha, estaCompleta, anotarSiQuedoCompleta, SQL_FICHA_INCOMPLETA, SQL_COMPLETADA_EL };
