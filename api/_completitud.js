/* =========================================================================
   Encuesta_APS — Lo que le falta a una ficha (integrantes y hogares)
   -------------------------------------------------------------------------
   Una ficha está completa cuando tiene caracterizados todos los integrantes
   que declara el ítem 51 de cada familia (RN-051) y una familia en cada hogar
   que declara el ítem 28 (RN-028).

   Desde el 2026-11-19 (instrucción de los EBS) esto no decide si la ficha sube
   ni si va al archivo plano: va con quienes estaban, y quien faltaba se
   caracteriza en una segunda visita (api/_visitas.js). Sirve para listar en
   el resumen del reporte las fichas que esperan esa visita. Del 18 al 19 de
   noviembre de 2026 las incompletas quedaban por fuera del plano.

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

module.exports = { faltantesDeFicha, estaCompleta, SQL_FICHA_INCOMPLETA };
