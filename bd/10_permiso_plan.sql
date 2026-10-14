/* =========================================================================
   APS APP — PERMISO PARA MODIFICAR UN PLAN DE CUIDADO YA REGISTRADO
   Archivo 10 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   Lo que se registra en el plan de cuidado (acciones y seguimientos) queda
   bloqueado: quien diligencia la ficha sólo puede completar lo que falta
   —acciones nuevas, un seguimiento vacío— (RN-228). Cambiar o quitar algo ya
   registrado exige autorización de un rol superior; por ahora, del usuario
   maestro.

   Cada fila es una autorización: el maestro (otorgado_por) le permite a un
   usuario modificar el plan registrado de una ficha. Sirve una vez: el
   primer guardado que la usa la cierra (usado_en) y el plan vuelve a quedar
   bloqueado. El maestro también puede revocarla antes de que se use. La
   tabla es a la vez el permiso y su rastro de auditoría.

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

BEGIN;

CREATE TABLE IF NOT EXISTS aps.permiso_plan (
  id            bigserial PRIMARY KEY,
  ficha_id      bigint NOT NULL REFERENCES aps.ficha(id) ON DELETE CASCADE,
  usuario_id    bigint NOT NULL REFERENCES aps.usuario(id),
  otorgado_por  bigint NOT NULL REFERENCES aps.usuario(id),
  otorgado_en   timestamptz NOT NULL DEFAULT now(),
  motivo        text,
  usado_en      timestamptz,
  revocado_por  bigint REFERENCES aps.usuario(id),
  revocado_en   timestamptz,
  CONSTRAINT permiso_plan_un_solo_cierre CHECK (usado_en IS NULL OR revocado_en IS NULL),
  CONSTRAINT permiso_plan_revocacion_completa CHECK ((revocado_en IS NULL) = (revocado_por IS NULL))
);

COMMENT ON TABLE aps.permiso_plan IS
  'RN-228: autorización de un usuario superior (hoy, el maestro) para que un usuario modifique el plan de cuidado ya registrado de una ficha. Se usa una vez.';

/* Un solo permiso vigente por usuario y ficha. */
CREATE UNIQUE INDEX IF NOT EXISTS ux_permiso_plan_vigente
  ON aps.permiso_plan (ficha_id, usuario_id)
  WHERE usado_en IS NULL AND revocado_en IS NULL;

COMMIT;
