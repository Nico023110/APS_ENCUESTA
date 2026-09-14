/* =========================================================================
   Encuesta_APS — Estado del plan de cuidado de una ficha guardada
   -------------------------------------------------------------------------
   RN-220 / RN-222 (plan diferido): la ficha se guarda aunque el plan de
   cuidado esté vacío, y queda marcada como pendiente hasta que se complete.
   El navegador calcula esa marca con el motor de reglas antes de guardar;
   para las filas que se leen de la base hay que deducirla de lo escrito:

     - sin ninguna acción en ningún plan       -> pendiente
     - alguna alerta sin acción en su ámbito   -> pendiente (RN-220)

   El cruce alerta ↔ acción es el mismo que hace `verificarTrazabilidadAlertas`
   en reglas.js: una alerta de un ámbito está atendida si hay al menos una
   acción registrada en un plan de ese mismo ámbito.

   Se comparte entre listar_fichas.js y obtener_ficha.js para que el historial
   y el detalle no puedan decir cosas distintas de la misma ficha.
   ========================================================================= */

'use strict';

/* Dos columnas calculadas para un SELECT donde la ficha se llama `f`. */
const COLUMNAS_PLAN = `
        (SELECT count(*)
           FROM aps.plan_cuidado p
           JOIN aps.plan_accion a ON a.plan_id = p.id
          WHERE p.ficha_id = f.id)                    AS plan_acciones,
        (SELECT count(*)
           FROM aps.alerta al
          WHERE al.ficha_id = f.id
            AND NOT EXISTS (
                  SELECT 1
                    FROM aps.plan_cuidado p
                    JOIN aps.plan_accion a ON a.plan_id = p.id
                   WHERE p.ficha_id = f.id
                     AND p.ambito = al.ambito))       AS plan_alertas_sin_conducta`;

/* Misma forma que `planCuidado` en la ficha del navegador
   (ver resumirPlanCuidado en reglas.js). */
function resumenPlanDesdeFila(fila) {
  const acciones = Number(fila.plan_acciones) || 0;
  const sinConducta = Number(fila.plan_alertas_sin_conducta) || 0;
  return {
    pendiente: acciones === 0 || sinConducta > 0,
    accionesRegistradas: acciones,
    alertasSinConducta: sinConducta
  };
}

module.exports = { COLUMNAS_PLAN, resumenPlanDesdeFila };
