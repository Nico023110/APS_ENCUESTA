/* =========================================================================
   Encuesta_APS — Visitas de una ficha en el archivo plano (RN-227, RN-051)
   -------------------------------------------------------------------------
   Desde el 2026-11-19 (instrucción de los EBS) una ficha se reporta aunque le
   falten integrantes: va al archivo de su mes con quienes estaban. Volver a
   caracterizar a quienes faltaban («Completar integrantes») es otra visita de
   la misma ficha (aps.visita_ficha, CF002…), y el archivo del mes de esa
   visita lleva la ficha completa otra vez, con la fecha y el responsable de
   esa visita.

     visita 1   la ficha misma: su fecha y su responsable; sólo los
                integrantes caracterizados en ella. El archivo de ese mes no
                cambia aunque se genere después de completarla.
     visita n   aps.visita_ficha: su fecha y su responsable; los integrantes
                hasta ella (todos los que tenía la ficha en ese momento).

   De cada vivienda va una sola visita por período: la más reciente (volver a
   una casa deja otra visita, no otra vivienda).
   ========================================================================= */

'use strict';

/* $1 y $2: el período. Sólo fichas con consentimiento, cerradas o
   sincronizadas (la visita cerrada por causa externa no se reporta). */
const SQL_VISITAS_DEL_PERIODO = `
  SELECT ficha_id, numero, to_char(fecha, 'YYYY-MM-DD') AS fecha, responsable_id FROM (
    SELECT DISTINCT ON (t.hogar_id) t.ficha_id, t.numero, t.fecha, t.responsable_id
      FROM (
        SELECT f.id AS ficha_id, f.hogar_id, 1 AS numero, f.fecha_diligenciamiento AS fecha,
               NULL::bigint AS responsable_id
          FROM aps.ficha f
         WHERE f.fecha_diligenciamiento BETWEEN $1 AND $2
           AND f.consentimiento AND f.estado IN ('cerrada', 'sincronizada')
        UNION ALL
        SELECT f.id, f.hogar_id, v.numero, v.fecha, v.responsable_id
          FROM aps.visita_ficha v
          JOIN aps.ficha f ON f.id = v.ficha_id
         WHERE v.fecha BETWEEN $1 AND $2
           AND f.consentimiento AND f.estado IN ('cerrada', 'sincronizada')
      ) t
     ORDER BY t.hogar_id, t.fecha DESC, t.numero DESC, t.ficha_id DESC
  ) ultimas
  ORDER BY fecha, ficha_id, numero
`;

/* Quienes hicieron las visitas 2 en adelante, para las variables 27 a 29. */
async function responsablesDeVisitas(cliente, visitas) {
  const ids = Array.from(new Set(visitas
    .filter(function (v) { return Number(v.numero) > 1 && v.responsable_id !== null && v.responsable_id !== undefined; })
    .map(function (v) { return String(v.responsable_id); })));
  const porId = new Map();
  if (ids.length === 0) return porId;
  (await cliente.query(`
    SELECT id, tipo_id, numero_id, perfil_profesional, perfil_otro
      FROM aps.funcionario WHERE id = ANY($1::bigint[])
  `, [ids])).rows.forEach(function (f) { porId.set(String(f.id), f); });
  return porId;
}

/**
 * La ficha como fue en una visita: los integrantes hasta ella y, desde la
 * segunda, la fecha y el responsable de esa visita. No modifica `leida`.
 * @param leida        { id, encuesta, meta } de leerFichasCompletas
 * @param visita       { numero, fecha }
 * @param responsable  fila de aps.funcionario (visitas 2 en adelante) o null
 */
function fichaEnLaVisita(leida, visita, responsable) {
  const numero = Number(visita && visita.numero) || 1;
  const original = leida.encuesta || {};
  const encuesta = Object.assign({}, original, {
    familias: (original.familias || []).map(function (familia) {
      return Object.assign({}, familia, {
        integrantes: (familia.integrantes || []).filter(function (integrante) {
          return (Number(integrante && integrante.visitaNumero) || 1) <= numero;
        })
      });
    })
  });

  if (numero > 1) {
    encuesta.visitaNumero = numero;
    if (visita.fecha) encuesta.fechaDiligenciamiento = visita.fecha;
    if (responsable) {
      encuesta.responsableTipoId = responsable.tipo_id;
      encuesta.responsableNumeroId = responsable.numero_id;
      encuesta.perfilProfesional = responsable.perfil_profesional;
      encuesta.perfilProfesionalOtro = responsable.perfil_otro;
    }
  }

  return { id: leida.id, encuesta: encuesta, meta: leida.meta, visita: numero };
}

module.exports = { SQL_VISITAS_DEL_PERIODO, responsablesDeVisitas, fichaEnLaVisita };
