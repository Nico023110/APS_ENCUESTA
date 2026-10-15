/* =========================================================================
   APS APP — COORDINACIÓN DEL EBS, AUTORIZACIÓN DE CORRECCIONES Y
   ELIMINACIÓN DE FICHAS
   Archivo 12 — se aplica con npm run bd:crear y con npm run bd:migrar
   =========================================================================

   QUÉ CAMBIA

   1. Dos roles nuevos para la coordinación del Equipo Básico de Salud
      (roles.js, nivel «coordinacion»): coordinador_ebs y lider_ebs. Ven,
      corrigen y evolucionan cualquier ficha, autorizan correcciones, generan
      el reporte y crean cuentas del personal asistencial; no modifican
      cuentas ni restablecen claves.

   2. Datos de contacto del funcionario: cargo («Líder Zona Norte»), correo y
      teléfono. Son opcionales y sirven para ubicar a la persona; no van en
      la ficha ni en el reporte.

   3. aps.permiso_plan pasa a ser la autorización de corrección: quien no
      puede corregir una ficha guardada —el personal asistencial— la corrige
      con una autorización vigente de la coordinación o del maestro, que
      también le deja cambiar lo registrado en el plan de cuidado. Sirve para
      un guardado. La tabla no cambia de forma.

   4. Sólo el maestro elimina una ficha de la base. El registro de auditoría
      no tiene llave foránea a la ficha (01_esquema.sql) y sobrevive al
      borrado con el motivo: hace falta el tipo de evento «eliminacion».

   Idempotente: una segunda pasada no encuentra nada que cambiar.
   ========================================================================= */

/* ALTER TYPE … ADD VALUE va fuera de la transacción: el valor nuevo no puede
   usarse en la misma transacción que lo crea. */
ALTER TYPE aud.tipo_evento ADD VALUE IF NOT EXISTS 'eliminacion';

BEGIN;

/* -------------------------------------------------------------------------
   1. Roles de coordinación
   ------------------------------------------------------------------------- */
ALTER TABLE aps.usuario DROP CONSTRAINT IF EXISTS usuario_rol_valido;
ALTER TABLE aps.usuario ADD CONSTRAINT usuario_rol_valido CHECK (
  rol IN ('administrador', 'maestro', 'coordinador_ebs', 'lider_ebs')
  OR cat.es_opcion('PERFIL_PROFESIONAL', rol)
);

/* -------------------------------------------------------------------------
   2. Cargo y contacto del funcionario
   ------------------------------------------------------------------------- */
ALTER TABLE aps.funcionario ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE aps.funcionario ADD COLUMN IF NOT EXISTS correo text;
ALTER TABLE aps.funcionario ADD COLUMN IF NOT EXISTS telefono text;

ALTER TABLE aps.funcionario DROP CONSTRAINT IF EXISTS func_correo_formato;
ALTER TABLE aps.funcionario ADD CONSTRAINT func_correo_formato
  CHECK (correo IS NULL OR correo ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');

ALTER TABLE aps.funcionario DROP CONSTRAINT IF EXISTS func_telefono_formato;
ALTER TABLE aps.funcionario ADD CONSTRAINT func_telefono_formato
  CHECK (telefono IS NULL OR telefono ~ '^[0-9]{7,10}$');

COMMENT ON COLUMN aps.funcionario.cargo IS
  'Cargo o zona a cargo (p. ej. «Líder Comuna 1, 3 y 18»). Informativo; no es el perfil del ítem 14.';
COMMENT ON COLUMN aps.funcionario.correo IS 'Correo de contacto. Opcional; no se usa para iniciar sesión.';
COMMENT ON COLUMN aps.funcionario.telefono IS 'Teléfono de contacto: 7 a 10 dígitos, sin espacios. Opcional.';

/* -------------------------------------------------------------------------
   3. La autorización de un plan pasa a ser de corrección
   ------------------------------------------------------------------------- */
COMMENT ON TABLE aps.permiso_plan IS
  'RN-228: autorización de la coordinación del EBS o del maestro para que un usuario corrija una ficha '
  'guardada, incluido lo registrado en su plan de cuidado. Sirve para un guardado (usado_en) y se puede revocar.';

COMMIT;
