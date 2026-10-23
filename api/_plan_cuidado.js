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

   Se comparte entre listar_fichas.js, obtener_ficha.js y productividad.js
   para que el historial, el detalle y los reportes no puedan decir cosas
   distintas de la misma ficha.
   ========================================================================= */

'use strict';

/* Columnas calculadas para un SELECT donde la ficha se llama `f`. Las dos
   primeras deciden si el plan está pendiente; las demás son lo que el
   historial muestra de él: alertas por prioridad y el plazo más próximo de
   las que siguen sin conducta, derivaciones con su próxima cita, y
   seguimientos realizados. Sólo cuentas y fechas: ningún dato personal. */
const SIN_CONDUCTA = `NOT EXISTS (
                  SELECT 1
                    FROM aps.plan_cuidado p
                    JOIN aps.plan_accion a ON a.plan_id = p.id
                   WHERE p.ficha_id = f.id
                     AND a.codigo_accion IS NOT NULL
                     AND p.ambito = al.ambito)`;

const COLUMNAS_PLAN = `
        (SELECT count(*)
           FROM aps.plan_cuidado p
           JOIN aps.plan_accion a ON a.plan_id = p.id
          WHERE p.ficha_id = f.id
            AND a.codigo_accion IS NOT NULL)          AS plan_acciones,
        (SELECT count(*)
           FROM aps.alerta al
          WHERE al.ficha_id = f.id
            AND ${SIN_CONDUCTA})       AS plan_alertas_sin_conducta,
        (SELECT jsonb_build_object(
                  'inmediata',   count(*) FILTER (WHERE al.prioridad = 'inmediata'),
                  'prioritaria', count(*) FILTER (WHERE al.prioridad = 'prioritaria'),
                  'regular',     count(*) FILTER (WHERE al.prioridad = 'regular'),
                  'vence',       min(al.vence_en) FILTER (WHERE ${SIN_CONDUCTA}))
           FROM aps.alerta al
          WHERE al.ficha_id = f.id)                   AS plan_alertas,
        (SELECT jsonb_build_object(
                  'derivadas',    count(*) FILTER (WHERE a.tipo_respuesta = 'derivada'),
                  'proxima_cita', min(a.fecha_cita) FILTER (WHERE a.fecha_cita >= current_date))
           FROM aps.plan_cuidado p
           JOIN aps.plan_accion a ON a.plan_id = p.id
          WHERE p.ficha_id = f.id)                    AS plan_derivaciones,
        (SELECT jsonb_build_object(
                  'hechos',    count(s.seg1_fecha) + count(s.seg2_fecha),
                  'esperados', 2 * count(*))
           FROM aps.plan_cuidado p
           JOIN aps.plan_seguimiento s ON s.plan_id = p.id
          WHERE p.ficha_id = f.id)                    AS plan_seguimientos`;

/* Misma forma que `planCuidado` en la ficha del navegador
   (ver resumirPlanCuidado en reglas.js), más `detalle`, que la ficha del
   navegador calcula al pintarse (detallePlanDeFicha en app.js). */
function resumenPlanDesdeFila(fila) {
  const acciones = Number(fila.plan_acciones) || 0;
  const sinConducta = Number(fila.plan_alertas_sin_conducta) || 0;
  const alertas = fila.plan_alertas || {};
  const derivaciones = fila.plan_derivaciones || {};
  const seguimientos = fila.plan_seguimientos || {};
  return {
    pendiente: acciones === 0 || sinConducta > 0,
    accionesRegistradas: acciones,
    alertasSinConducta: sinConducta,
    detalle: {
      alertas: {
        inmediata: Number(alertas.inmediata) || 0,
        prioritaria: Number(alertas.prioritaria) || 0,
        regular: Number(alertas.regular) || 0
      },
      venceSinConducta: alertas.vence || null,
      derivadas: Number(derivaciones.derivadas) || 0,
      proximaCita: derivaciones.proxima_cita || null,
      seguimientosHechos: Number(seguimientos.hechos) || 0,
      seguimientosEsperados: Number(seguimientos.esperados) || 0
    }
  };
}

module.exports = { COLUMNAS_PLAN, SIN_CONDUCTA, resumenPlanDesdeFila };
