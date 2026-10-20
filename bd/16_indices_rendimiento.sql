/* =========================================================================
   APS APP — ÍNDICES PARA EL HISTORIAL, EL DETALLE Y EL GUARDADO
   Archivo 16 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   Sólo agrega índices: no cambia datos, columnas ni reglas.

   El listado del historial (api/listar_fichas.js) calcula, por cada ficha,
   el estado de su plan de cuidado con subconsultas sobre plan_cuidado,
   plan_accion y plan_seguimiento. Ninguna de las tres tenía índice por la
   columna con que se buscan:

     plan_cuidado.ficha_id     sólo había uno parcial, para el plan de la
                               vivienda; el de familia y el de persona no
                               lo usaban.
     plan_accion.plan_id       ninguno.
     plan_seguimiento.plan_id  ninguno.

   Con pocas fichas no se nota. Con miles, cada fila del historial recorría
   las tablas del plan enteras —el costo crece con el cuadrado del número de
   fichas—, y lo mismo el detalle de una ficha y el borrado de las acciones
   que hace cada guardado.

     familia_ficha.familia_id  el código CF (14_codigo_cf.sql) cuenta las
                               visitas anteriores de la familia: sin índice
                               recorría todas las caracterizaciones.

   Idempotente: una segunda pasada no encuentra nada que crear.
   ========================================================================= */

BEGIN;

CREATE INDEX IF NOT EXISTS ix_plan_cuidado_ficha      ON aps.plan_cuidado (ficha_id);
CREATE INDEX IF NOT EXISTS ix_plan_accion_plan        ON aps.plan_accion (plan_id);
CREATE INDEX IF NOT EXISTS ix_plan_seguimiento_plan   ON aps.plan_seguimiento (plan_id);
CREATE INDEX IF NOT EXISTS ix_familia_ficha_familia   ON aps.familia_ficha (familia_id);

COMMIT;
